// Nole Code - Memory Consolidation
// Session summarization and memory optimization
// Adapted from Nole Code's autoDream service

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { join, homedir } from 'path'
import { loadSession, saveSession, type Session } from '../session/manager.js'

interface MemoryEntry {
  id: string
  sessionId: string
  summary: string
  keyFindings: string[]
  decisions: string[]
  toolsUsed: string[]
  timestamp: string
  accessedAt: string
}

const MEMORY_DIR = join(homedir(), '.nole-code', 'memory')

function ensureMemoryDir() {
  mkdirSync(MEMORY_DIR, { recursive: true })
}

export async function consolidateSession(
  sessionId: string,
  llmClient: unknown,
): Promise<MemoryEntry | null> {
  const session = loadSession(sessionId)
  if (!session) return null

  ensureMemoryDir()

  // Extract key information from session
  const messages = session.messages
  const userMessages = messages.filter((m: { role: string }) => m.role === 'user')
  const assistantMessages = messages.filter((m: { role: string }) => m.role === 'assistant')
  const toolMessages = messages.filter((m: { role: string }) => m.role === 'tool')

  // Get unique tools used
  const toolsUsed = [...new Set(toolMessages.map((m: { name?: string }) => m.name || 'unknown'))]

  // Create summary
  const summary = `Session ${sessionId}: ${userMessages.length} user messages, ${assistantMessages.length} assistant responses, ${toolMessages.length} tool calls`

  // Extract key decisions and findings (simplified - in production would use LLM)
  const keyFindings: string[] = []
  const decisions: string[] = []

  for (const msg of assistantMessages) {
    const content = msg.content as string
    if (content.includes('Decision:') || content.includes('Chose:')) {
      decisions.push(content.slice(0, 200))
    }
    if (content.includes('Found:') || content.includes('Discovered:')) {
      keyFindings.push(content.slice(0, 200))
    }
  }

  const entry: MemoryEntry = {
    id: `mem_${Date.now()}`,
    sessionId,
    summary,
    keyFindings: keyFindings.slice(0, 5),
    decisions: decisions.slice(0, 5),
    toolsUsed,
    timestamp: new Date().toISOString(),
    accessedAt: new Date().toISOString(),
  }

  // Save memory entry
  const file = join(MEMORY_DIR, `${entry.id}.json`)
  writeFileSync(file, JSON.stringify(entry, null, 2))

  return entry
}

export function getMemory(id: string): MemoryEntry | null {
  try {
    const file = join(MEMORY_DIR, `${id}.json`)
    if (existsSync(file)) {
      const entry = JSON.parse(readFileSync(file, 'utf-8')) as MemoryEntry
      entry.accessedAt = new Date().toISOString()
      writeFileSync(file, JSON.stringify(entry, null, 2))
      return entry
    }
  } catch {}
  return null
}

export function searchMemory(query: string): MemoryEntry[] {
  const results: MemoryEntry[] = []
  const queryLower = query.toLowerCase()

  try {
    const { readdirSync } = require('fs')
    const files = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'))

    for (const file of files) {
      try {
        const entry = JSON.parse(readFileSync(join(MEMORY_DIR, file), 'utf-8')) as MemoryEntry
        if (
          entry.summary.toLowerCase().includes(queryLower) ||
          entry.keyFindings.some(f => f.toLowerCase().includes(queryLower)) ||
          entry.decisions.some(d => d.toLowerCase().includes(queryLower))
        ) {
          results.push(entry)
        }
      } catch {}
    }
  } catch {}

  return results.slice(0, 10)
}

export function listMemory(): MemoryEntry[] {
  const entries: MemoryEntry[] = []

  try {
    const { readdirSync } = require('fs')
    const files = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'))

    for (const file of files) {
      try {
        const entry = JSON.parse(readFileSync(join(MEMORY_DIR, file), 'utf-8')) as MemoryEntry
        entries.push(entry)
      } catch {}
    }
  } catch {}

  return entries.sort((a, b) =>
    new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime()
  )
}

export function deleteMemory(id: string): boolean {
  try {
    const file = join(MEMORY_DIR, `${id}.json`)
    if (existsSync(file)) {
      unlinkSync(file)
      return true
    }
  } catch {}
  return false
}

export function pruneMemory(keepLast = 50): number {
  const entries = listMemory()
  let pruned = 0

  for (let i = keepLast; i < entries.length; i++) {
    if (deleteMemory(entries[i].id)) {
      pruned++
    }
  }

  return pruned
}

// Add memory context to system prompt
export function buildMemoryContext(): string {
  const recent = listMemory().slice(0, 5)
  if (recent.length === 0) return ''

  const lines = ['\n## Recent Context\n']

  for (const entry of recent) {
    lines.push(`### Session ${entry.sessionId.slice(0, 8)}`)
    lines.push(`- ${entry.summary}`)
    if (entry.keyFindings.length > 0) {
      lines.push('- Key findings:')
      for (const finding of entry.keyFindings.slice(0, 2)) {
        lines.push(`  - ${finding.slice(0, 100)}...`)
      }
    }
    if (entry.decisions.length > 0) {
      lines.push('- Decisions:')
      for (const decision of entry.decisions.slice(0, 2)) {
        lines.push(`  - ${decision.slice(0, 100)}...`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}
