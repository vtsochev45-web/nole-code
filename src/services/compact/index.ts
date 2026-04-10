/**
 * Session Compaction System
 * Token budget management + message pruning
 */

import { estimateTotalTokens, estimateMessageTokens } from '../../utils/count-tokens.js'
import { loadMemory, saveMemory, addToWorklog } from '../../session-memory/index.js'
import { feature } from '../../feature-flags/index.js'

// Token budget configuration
const COMPACT_CONFIG = {
  // Minimum tokens to preserve after compaction
  minTokens: 8000,
  // Maximum tokens in context before triggering compaction
  maxTokens: 100000,
  // Keep at least N most recent messages with content
  minMessages: 10,
  // System prompt tokens (approximate)
  systemPromptTokens: 2000,
  // Compact when at 80% of max
  compactThreshold: 0.8,
}

export interface CompactResult {
  originalTokens: number
  compactedTokens: number
  messagesPruned: number
  summary: string
}

/**
 * Check if session needs compaction
 */
export function needsCompaction(messages: Array<{ role: string, content: string }>): boolean {
  if (!feature('SESSION_COMPACT')) return false
  
  const totalTokens = estimateTotalTokens(messages)
  return totalTokens > COMPACT_CONFIG.maxTokens * COMPACT_CONFIG.compactThreshold
}

/**
 * Get token budget status
 */
export function getTokenBudget(messages: Array<{ role: string, content: string }>): {
  used: number
  max: number
  percent: number
  needsCompact: boolean
} {
  const used = estimateTotalTokens(messages)
  const max = COMPACT_CONFIG.maxTokens
  return {
    used,
    max,
    percent: Math.round((used / max) * 100),
    needsCompact: needsCompaction(messages),
  }
}

/**
 * Compact session messages
 * Strategy:
 * 1. Keep recent N messages (don't touch working context)
 * 2. Summarize older messages into a single "session summary" message
 * 3. Compress long tool results
 */
export function compactSession(
  messages: Array<{
    role: string
    content: string
    timestamp?: string
    tool_call_id?: string
    name?: string
    isError?: boolean
  }>,
  sessionId: string
): CompactResult {
  const originalTokens = estimateTotalTokens(messages)
  
  if (originalTokens < COMPACT_CONFIG.maxTokens) {
    return {
      originalTokens,
      compactedTokens: originalTokens,
      messagesPruned: 0,
      summary: 'No compaction needed',
    }
  }
  
  // Find the cutoff point
  // Keep: recent messages + system prompt
  // Summarize: older user/assistant/tool messages
  
  const systemMessages = messages.filter(m => m.role === 'system')
  const recentCutoff = COMPACT_CONFIG.minMessages
  
  const recentMessages = messages.slice(-recentCutoff)
  const olderMessages = messages.slice(0, -recentCutoff)
  
  // Generate summary of older messages
  const summary = generateSessionSummary(olderMessages)
  
  // Compress tool results
  const compressedRecent = recentMessages.map(msg => {
    if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 2000) {
      return {
        ...msg,
        content: compressToolResult(msg.content),
      }
    }
    return msg
  })
  
  // Build new message list
  const compactedMessages = [
    ...systemMessages,
    {
      role: 'system' as const,
      content: `[Previous session context summarized]\n\n${summary}`,
      timestamp: new Date().toISOString(),
    },
    ...compressedRecent,
  ]
  
  const compactedTokens = estimateTotalTokens(compactedMessages)
  const messagesPruned = messages.length - compactedMessages.length

  // Actually replace the messages array contents
  messages.length = 0
  messages.push(...compactedMessages)

  // Update memory with summary
  addToWorklog(sessionId, `Session compacted: ${originalTokens - compactedTokens} tokens saved`)

  console.log(`\n📦 Session compacted:`)
  console.log(`   Before: ${originalTokens} tokens`)
  console.log(`   After: ${compactedTokens} tokens`)
  console.log(`   Pruned: ${messagesPruned} messages\n`)

  return {
    originalTokens,
    compactedTokens,
    messagesPruned,
    summary,
  }
}

/**
 * Generate a summary of older messages
 */
function generateSessionSummary(messages: Array<{
  role: string
  content: string
  name?: string
}>): string {
  if (messages.length === 0) return ''
  
  // Extract key information
  const toolResults = messages
    .filter(m => m.role === 'tool')
    .map(m => {
      const text = typeof m.content === 'string' ? m.content : ''
      const firstLine = text.split('\n')[0] || ''
      return firstLine.slice(0, 100)
    })
    .slice(-10)

  const filesCreated = extractFilesCreated(messages)
  const errors = extractErrors(messages)
  
  let summary = `Session had ${messages.length} messages. `
  
  if (filesCreated.length > 0) {
    summary += `Files created/modified: ${filesCreated.join(', ')}. `
  }
  
  if (toolResults.length > 0) {
    summary += `Recent operations: ${toolResults.join(' | ')}. `
  }
  
  if (errors.length > 0) {
    summary += `Errors encountered: ${errors.slice(0, 3).join(', ')}. `
  }
  
  return summary || 'Coding session with various file operations and tool executions.'
}

/**
 * Extract files that were created or modified
 */
function extractFilesCreated(messages: Array<{ content: string }>): string[] {
  const BLOCKED_PREFIXES = ['/dev/', '/tmp/', '/proc/', '/sys/', '/.ssh/']
  const patterns = [
    /(?:Created|Wrote|Saved|Modified|Edited)\s+([^\s'"`\n]+)/gi,
    /(?:File|Path):\s+([^\s'"`\n]+)/gi,
  ]

  const files = new Set<string>()

  for (const msg of messages) {
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(msg.content)) !== null) {
        const file = match[1].trim()
        if (
          file.length > 1 &&
          !BLOCKED_PREFIXES.some(p => file.startsWith(p)) &&
          !file.startsWith('http') &&
          !file.match(/^[0-9a-f]{8,}/i)
        ) {
          files.add(file)
        }
      }
    }
  }

  return Array.from(files).slice(0, 10)
}

/**
 * Extract errors from messages
 */
function extractErrors(messages: Array<{ content: string, isError?: boolean }>): string[] {
  const errors: string[] = []
  
  for (const msg of messages) {
    const errText = typeof msg.content === 'string' ? msg.content : ''
    if (msg.isError || /error|failed|exception/i.test(errText)) {
      const firstLine = errText.split('\n')[0] || ''
      errors.push(firstLine.slice(0, 80))
    }
  }
  
  return errors
}

/**
 * Compress long tool results
 * Keep the beginning (most informative) and summarize the rest
 */
function compressToolResult(content: string): string {
  const lines = content.split('\n')

  // If content is short enough, keep it as-is
  if (lines.length <= 20) return content

  // Keep first 5 lines as context (command/header)
  const keptLines = lines.slice(0, 5)
  const droppedLines = lines.slice(5)

  // Build a concise summary of the truncated portion
  const lastLines = lines.slice(-3)
  const summary = `[... ${droppedLines.length} lines omitted ...]
` +
    `Last ${lastLines.length} lines: ${lastLines.join(' | ').slice(0, 150)}`

  return [...keptLines, summary].join('\n')
}

/**
 * Auto-compact if needed (called periodically or after tool execution)
 */
export function maybeCompact(
  messages: Array<{
    role: string
    content: string
    timestamp?: string
    tool_call_id?: string
    name?: string
    isError?: boolean
  }>,
  sessionId: string
): boolean {
  if (!feature('AUTO_COMPACT')) return false
  if (!needsCompaction(messages)) return false
  
  compactSession(messages, sessionId)
  return true
}
