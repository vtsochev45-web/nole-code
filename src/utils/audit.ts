/**
 * Audit Log — records every tool execution for debugging and accountability
 * Writes to ~/.nole-code/audit.jsonl (append-only)
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'

const AUDIT_FILE = join(homedir(), '.nole-code', 'audit.jsonl')

export interface AuditEntry {
  timestamp: string
  sessionId: string
  tool: string
  input: Record<string, unknown>
  resultLength: number
  isError: boolean
  durationMs: number
}

export function logToolCall(entry: AuditEntry): void {
  try {
    const dir = dirname(AUDIT_FILE)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    // Truncate large inputs for audit (keep it manageable)
    const safeInput: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(entry.input)) {
      const str = String(v)
      safeInput[k] = str.length > 200 ? str.slice(0, 200) + '...' : v
    }

    const line = JSON.stringify({
      t: entry.timestamp,
      s: entry.sessionId,
      tool: entry.tool,
      input: safeInput,
      len: entry.resultLength,
      err: entry.isError || undefined,
      ms: entry.durationMs,
    })

    appendFileSync(AUDIT_FILE, line + '\n')
  } catch {}
}

export function getAuditLog(limit = 50, sessionId?: string): AuditEntry[] {
  if (!existsSync(AUDIT_FILE)) return []

  try {
    const lines = readFileSync(AUDIT_FILE, 'utf-8').trim().split('\n').filter(Boolean)
    const entries = lines
      .slice(-limit * 2) // read more than needed to filter
      .map(line => {
        try {
          const d = JSON.parse(line)
          return {
            timestamp: d.t,
            sessionId: d.s,
            tool: d.tool,
            input: d.input,
            resultLength: d.len,
            isError: d.err || false,
            durationMs: d.ms,
          } as AuditEntry
        } catch { return null }
      })
      .filter(Boolean) as AuditEntry[]

    const filtered = sessionId
      ? entries.filter(e => e.sessionId === sessionId)
      : entries

    return filtered.slice(-limit)
  } catch {
    return []
  }
}
