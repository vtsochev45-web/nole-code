/**
 * Session Compaction System
 * Token budget management + message pruning
 * Fixed: smarter thresholds, deduplication, and compaction targeting
 */

import { estimateTotalTokens, estimateMessageTokens } from '../../utils/count-tokens.js'
import { loadMemory, saveMemory, addToWorklog } from '../../session-memory/index.js'
import { feature } from '../../feature-flags/index.js'

// Token budget configuration
const COMPACT_CONFIG = {
  // Trigger compaction when context exceeds this percentage of 100k
  triggerPercent: 0.75,        // 75% = 75k tokens
  // Target tokens after compaction
  targetTokens: 40000,          // Aggressive: aim for ~40k tokens
  // Keep more messages for working context
  keepRecentMessages: 25,         // Increased from 10
  // System prompt tokens (approximate)
  systemPromptTokens: 2000,
  // Minimum gap (in tokens) between compactions to avoid rapid re-triggering
  minTokensBetweenCompacts: 15000,
}

// Track last compaction for cooldown
let lastCompactTokens = 0
let lastCompactAt = 0
const COMPACT_COOLDOWN_MS = 30000 // 30 second cooldown

// FIX: File read deduplication cache to avoid reading same file multiple times
interface FileCache {
  content: string
  readAt: number
  size: number
}
const fileCache = new Map<string, FileCache>()
const FILE_CACHE_TTL_MS = 30_000 // 30 second deduplication window

/**
 * Get cached file content if still fresh
 */
export function getCachedFile(path: string): string | null {
  const cached = fileCache.get(path)
  if (!cached) return null
  if (Date.now() - cached.readAt > FILE_CACHE_TTL_MS) {
    fileCache.delete(path)
    return null
  }
  return cached.content
}

/**
 * Cache file content
 */
export function cacheFile(path: string, content: string): void {
  fileCache.set(path, { content, readAt: Date.now(), size: content.length })
}

/**
 * Invalidate cache for a specific file (call when file is written)
 */
export function invalidateCache(path: string): void {
  fileCache.delete(path)
}

/**
 * Clear all file cache
 */
export function clearFileCache(): void {
  fileCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { entries: number; oldestMs: number } {
  let oldest = 0
  for (const c of fileCache.values()) {
    if (oldest === 0 || c.readAt < oldest) oldest = c.readAt
  }
  return { entries: fileCache.size, oldestMs: oldest ? Date.now() - oldest : 0 }
}

export interface CompactResult {
  originalTokens: number
  compactedTokens: number
  messagesPruned: number
  summary: string
}

/**
 * Check if session needs compaction
 * Now uses actual token count vs trigger threshold, with cooldown guard
 */
export function needsCompaction(messages: Array<{ role: string; content: string }>): boolean {
  if (!feature('SESSION_COMPACT')) return false

  const totalTokens = estimateTotalTokens(messages)

  // Don't re-trigger too soon after last compaction
  const now = Date.now()
  if (lastCompactAt > 0 && now - lastCompactAt < COMPACT_COOLDOWN_MS) {
    // Within cooldown period - check if we REALLY need it (over 90%)
    if (totalTokens < COMPACT_CONFIG.triggerPercent * 100000 * 1.2) {
      return false
    }
  }

  // Trigger when over triggerPercent (75% of 100k = 75k)
  return totalTokens > COMPACT_CONFIG.triggerPercent * 100000
}

/**
 * Get token budget status
 */
export function getTokenBudget(messages: Array<{ role: string; content: string }>): {
  used: number
  max: number
  percent: number
  needsCompact: boolean
} {
  const used = estimateTotalTokens(messages)
  const max = 100000 // hardcoded max for context window
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
 * 1. Keep recent N messages (increased to 25 for better context)
 * 2. Summarize older messages into a single "session summary" message
 * 3. Compress long tool results
 * 4. Target a specific token count rather than arbitrary pruning
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

  // Target: reduce to ~40k tokens
  const targetTokens = COMPACT_CONFIG.targetTokens

  // If already under target, skip
  if (originalTokens < targetTokens) {
    return {
      originalTokens,
      compactedTokens: originalTokens,
      messagesPruned: 0,
      summary: 'No compaction needed',
    }
  }

  // Find the cutoff point
  // Strategy: keep recent messages + system prompt
  const systemMessages = messages.filter(m => m.role === 'system')
  const recentCutoff = COMPACT_CONFIG.keepRecentMessages

  // Keep more messages if tokens are still high
  const recentMessages = messages.slice(-recentCutoff)
  const olderMessages = messages.slice(0, -recentCutoff)

  // Generate summary of older messages
  const summary = generateSessionSummary(olderMessages)

  // Compress tool results in recent messages
  const compressedRecent = recentMessages.map(msg => {
    if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 2000) {
      return {
        ...msg,
        content: compressToolResult(msg.content),
      }
    }
    return msg
  })

  // Sanitize recent messages — remove orphaned tool results at the boundary
  sanitizeToolPairs(compressedRecent)

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

  let compactedTokens = estimateTotalTokens(compactedMessages)

  // If still over target, compress recent tool results more aggressively
  if (compactedTokens > targetTokens) {
    for (let i = 0; i < compactedMessages.length; i++) {
      const msg = compactedMessages[i]
      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 500) {
        compactedMessages[i] = { ...msg, content: compressToolResult(msg.content, 3) }
      }
    }
    compactedTokens = estimateTotalTokens(compactedMessages)
  }

  // If STILL over target, drop oldest non-system messages
  while (compactedTokens > targetTokens && compactedMessages.length > systemMessages.length + 6) {
    const idx = compactedMessages.findIndex(m => m.role !== 'system')
    if (idx >= 0) {
      compactedMessages.splice(idx, 1)
      compactedTokens = estimateTotalTokens(compactedMessages)
    } else break
  }

  // CRITICAL: Sanitize message pairs — remove orphaned tool results and tool_use
  // MiniMax requires: assistant with tool_calls → tool results with matching IDs
  sanitizeToolPairs(compactedMessages)

  const messagesPruned = messages.length - compactedMessages.length

  // Track compaction for cooldown
  lastCompactTokens = compactedTokens
  lastCompactAt = Date.now()

  // Replace the messages array contents
  messages.length = 0
  messages.push(...compactedMessages)

  // Update memory with summary
  addToWorklog(sessionId, `Session compacted: ${originalTokens - compactedTokens} tokens saved`)

  console.log(`\n📦 Session compacted:`)
  console.log(`   Before: ${originalTokens} tokens`)
  console.log(`   After: ${compactedTokens} tokens`)
  console.log(`   Pruned: ${messagesPruned} messages`)

  return {
    originalTokens,
    compactedTokens,
    messagesPruned,
    summary,
  }
}

/**
 * Sanitize tool pairs — remove orphaned tool results and tool_use blocks.
 * MiniMax/Anthropic API requires: assistant with tool_calls → matching tool results.
 * After compaction, some tool_use blocks may have lost their tool_result, or vice versa.
 * Mutates the array in place.
 */
function sanitizeToolPairs(messages: Array<{ role: string; tool_call_id?: string; [key: string]: unknown }>): void {
  // Collect all tool_use IDs from assistant messages
  const toolUseIds = new Set<string>()
  for (const msg of messages) {
    const tc = (msg as any).tool_calls as Array<{ id?: string }> | undefined
    if (msg.role === 'assistant' && tc) {
      for (const call of tc) {
        if (call.id) toolUseIds.add(call.id)
      }
    }
  }

  // Collect all tool_result IDs
  const toolResultIds = new Set<string>()
  for (const msg of messages) {
    if (msg.role === 'tool' && msg.tool_call_id) {
      toolResultIds.add(msg.tool_call_id)
    }
  }

  // Remove tool results that have no matching tool_use
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'tool' && msg.tool_call_id && !toolUseIds.has(msg.tool_call_id)) {
      messages.splice(i, 1)
    }
  }

  // Remove tool_calls from assistant messages that have no matching tool_result
  for (const msg of messages) {
    const tc = (msg as any).tool_calls as Array<{ id?: string }> | undefined
    if (msg.role === 'assistant' && tc && tc.length > 0) {
      const validCalls = tc.filter(call => call.id && toolResultIds.has(call.id))
      if (validCalls.length === 0) {
        delete (msg as any).tool_calls
      } else if (validCalls.length < tc.length) {
        (msg as any).tool_calls = validCalls
      }
    }
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
function extractErrors(messages: Array<{ content: string; isError?: boolean }>): string[] {
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
  const summary = `[... ${droppedLines.length} lines omitted ...]\n` +
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

  const result = compactSession(messages, sessionId)

  // If still needs compaction after this run, log warning
  if (needsCompaction(messages)) {
    console.warn(`[Compact] Warning: Still over threshold after compaction (${result.compactedTokens} tokens). Consider increasing keepRecentMessages or targetTokens.`)
  }

  return true
}

/**
 * Reset compaction state (call when starting fresh session)
 */
export function resetCompactionState(): void {
  lastCompactTokens = 0
  lastCompactAt = 0
}
