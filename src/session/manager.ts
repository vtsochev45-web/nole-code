// Nole Code - Session Management
// Handles session persistence, fork, compact, resume
// Adapted from Nole Code's session architecture

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  renameSync,
} from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface SessionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
  timestamp: string
}

export interface Session {
  id: string
  messages: SessionMessage[]
  createdAt: string
  updatedAt: string
  parentId?: string  // For forked sessions
  model?: string
  cwd?: string
}

const SESSION_DIR = join(homedir(), '.nole-code', 'sessions')

function ensureSessionDir() {
  mkdirSync(SESSION_DIR, { recursive: true })
}

export function listSessions(limit = 20): Session[] {
  ensureSessionDir()
  const files = readdirSync(SESSION_DIR).filter(f => f.endsWith('.json'))

  const sessions = files
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(SESSION_DIR, f), 'utf-8')) as Session
      } catch { return null }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return sessions.slice(0, limit)
}

export function loadSession(id: string): Session | null {
  const file = join(SESSION_DIR, `${id}.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch { return null }
}

export function saveSession(session: Session): void {
  ensureSessionDir()
  session.updatedAt = new Date().toISOString()
  const file = join(SESSION_DIR, `${session.id}.json`)
  const tmp = file + `.tmp.${Date.now()}`
  writeFileSync(tmp, JSON.stringify(session, null, 2), 'utf-8')
  renameSync(tmp, file)
}

export function deleteSession(id: string): boolean {
  const file = join(SESSION_DIR, `${id}.json`)
  if (existsSync(file)) {
    unlinkSync(file)
    return true
  }
  return false
}

export function createSession(cwdOrOpts?: string | {
  parentId?: string
  cwd?: string
  model?: string
}): Session {
  const opts = typeof cwdOrOpts === 'string' ? { cwd: cwdOrOpts } : (cwdOrOpts || {})
  const id = `nole-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()

  const session: Session = {
    id,
    messages: [],
    createdAt: now,
    updatedAt: now,
    cwd: opts.cwd || process.cwd(),
    model: opts.model || 'MiniMax-Text-01',
  }

  if (opts.parentId) {
    session.parentId = opts.parentId
  }

  saveSession(session)
  return session
}

// Fork a session (creates a new session with the same history)
export function forkSession(parentId: string, reason?: string): Session | null {
  const parent = loadSession(parentId)
  if (!parent) return null

  const forked = createSession({
    parentId,
    cwd: parent.cwd,
    model: parent.model,
  })

  // Copy messages from parent
  forked.messages = [...parent.messages]

  // Add a system message noting the fork
  forked.messages.push({
    role: 'system',
    content: `Session forked from ${parentId}${reason ? `: ${reason}` : ''}`,
    timestamp: new Date().toISOString(),
  })

  saveSession(forked)
  return forked
}

// Compact a session (removes intermediate tool results to save tokens)
export function compactSession(id: string, keepMessages = 10): Session | null {
  const session = loadSession(id)
  if (!session) return null

  // Count tool results and determine which to keep (the last N)
  const toolIndices: number[] = []
  for (let i = 0; i < session.messages.length; i++) {
    if (session.messages[i].role === 'tool') toolIndices.push(i)
  }

  // Keep only the last `keepMessages` tool results
  const indicesToRemove = new Set(toolIndices.slice(0, Math.max(0, toolIndices.length - keepMessages)))
  const removedCount = indicesToRemove.size

  if (removedCount === 0) {
    return session
  }

  const newMessages: SessionMessage[] = []
  let addedSummary = false

  for (let i = 0; i < session.messages.length; i++) {
    if (indicesToRemove.has(i)) {
      if (!addedSummary) {
        addedSummary = true
        newMessages.push({
          role: 'system',
          content: `[${removedCount} older tool results omitted during compaction]`,
          timestamp: new Date().toISOString(),
        })
      }
    } else {
      newMessages.push(session.messages[i])
    }
  }

  session.messages = newMessages
  saveSession(session)
  return session
}

// Get session metadata
export function getSessionMeta(id: string): {
  messageCount: number
  createdAt: string
  age: string
  parentId?: string
} | null {
  const session = loadSession(id)
  if (!session) return null

  const created = new Date(session.createdAt)
  const now = new Date()
  const ageMs = now.getTime() - created.getTime()
  const ageHours = Math.round(ageMs / (1000 * 60 * 60))

  return {
    messageCount: session.messages.length,
    createdAt: created.toLocaleString(),
    age: `${ageHours}h ago`,
    parentId: session.parentId,
  }
}

// Export session as text transcript
export function exportSession(id: string): string | null {
  const session = loadSession(id)
  if (!session) return null

  const lines: string[] = [`# Nole Code Session - ${session.id}`, `Created: ${session.createdAt}`, '']

  for (const msg of session.messages) {
    if (msg.role === 'system') continue

    const label = msg.role === 'user' ? '➜ you' : msg.role === 'nole' ? '🤖 nole' : '🔧 tool'
    lines.push(`**${label}**`)
    lines.push(msg.content.slice(0, 2000)) // Truncate long outputs
    lines.push('')
  }

  return lines.join('\n')
}
