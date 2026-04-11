// Nole Code - /context command: Show current REPL context state

import { existsSync, readFileSync } from 'fs'
import { cwd } from 'process'
import { homedir } from 'os'

interface SessionInfo {
  id: string
  cwd?: string
  messages: Array<{ role: string; content?: string }>
  updatedAt: string
}

function getAge(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

function loadSessionInfo(sessionId: string): SessionInfo | null {
  try {
    const sessionPath = `/home/tim/.nole/sessions/${sessionId}.json`
    if (!existsSync(sessionPath)) return null
    const data = readFileSync(sessionPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

function getGitBranch(): string {
  try {
    const cwdPath = cwd()
    const headPath = `${cwdPath}/.git/HEAD`
    if (!existsSync(headPath)) return 'not a git repo'
    const head = readFileSync(headPath, 'utf-8').trim()
    const match = head.match(/ref: refs\/heads\/(\S+)/)
    return match ? match[1] : 'detached'
  } catch {
    return 'unknown'
  }
}

function getTokenCount(messages: Array<{ role: string; content?: string }>): number {
  // Estimate: count all message content, assume ~4 chars/token average
  let totalChars = 0
  for (const msg of messages) {
    if (msg.content) {
      totalChars += msg.content.length
    }
  }
  return Math.floor(totalChars / 4)
}

export function registerContextCommand(registerCmd: (cmd: import('./index.js').Command) => void) {
  registerCmd({
    name: 'context',
    description: 'Show current REPL context state',
    aliases: ['ctx', 'status'],
    execute: async (_args, ctx) => {
      const session = loadSessionInfo(ctx.sessionId)
      const currentCwd = ctx.cwd || cwd()
      const branch = getGitBranch()
      const sessionAge = session ? getAge(session.updatedAt) : 'unknown'
      const tokenCount = session ? getTokenCount(session.messages) : 0
      const userMsgs = session ? session.messages.filter(m => m.role === 'user').length : 0

      // Check if loop is running
      let loopStatus = 'idle'
      try {
        const loopPath = '/tmp/.nole_loop_running'
        if (existsSync(loopPath)) {
          const pid = readFileSync(loopPath, 'utf-8').trim()
          loopStatus = `running (PID: ${pid})`
        }
      } catch {
        loopStatus = 'idle'
      }

      const info = `
📊 CONTEXT STATE
━━━━━━━━━━━━━━━━━━━━
  Session: ${ctx.sessionId.slice(0, 12)}...
  Age: ${sessionAge}
  Messages: ${userMsgs} user, ${session.messages.length - userMsgs} total
  Est. Tokens: ~${tokenCount.toLocaleString()}
  Branch: ${branch}
  Loop: ${loopStatus}

📁 DIRECTORY
━━━━━━━━━━━━━━━━━━━━
  ${currentCwd.replace(homedir(), '~')}
`
      return info.trim()
    },
  })
}