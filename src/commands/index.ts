// Nole Code - Built-in Commands
// Like Nole Code's slash commands (/help, /commit, /diff, etc.)

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { MINIMAX_API_KEY } from '../utils/env.js'

const execAsync = promisify(exec)

function getAge(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

export interface Command {
  name: string
  description: string
  aliases?: string[]
  execute: (args: string[], ctx: CommandContext) => Promise<string>
}

export interface CommandContext {
  cwd: string
  sessionId: string
}

const commands = new Map<string, Command>()

export function registerCommand(cmd: Command) {
  commands.set(cmd.name, cmd)
  cmd.aliases?.forEach(a => commands.set(a, cmd))
}

export function getCommand(name: string): Command | undefined {
  return commands.get(name)
}

export function getAllCommands(): Command[] {
  return Array.from(commands.values()).filter((c, i, arr) => arr.indexOf(c) === i)
}

export function parseCommand(input: string): { cmd: string; args: string[] } | null {
  if (!input.startsWith('/')) return null
  const parts = input.slice(1).split(/\s+/)
  return { cmd: parts[0], args: parts.slice(1) }
}

// ============ Built-in Commands ============

registerCommand({
  name: 'help',
  description: 'Show available commands',
  aliases: ['h', '?'],
  execute: async () => {
    const cmds = getAllCommands()
    return `🦞 NOLE CODE — Available Commands:

` + cmds.map(c =>
      `  /${c.name}${c.aliases?.length ? ` (${c.aliases.join(', ')})` : ''}\n    ${c.description}`
    ).join('\n\n') + `

💡 Regular chat: Just type your message without /
   Tools are called automatically when needed.
`
  },
})

registerCommand({
  name: 'clear',
  description: 'Clear screen. Use /clear context to also reset conversation history.',
  aliases: ['cls'],
  execute: async (args, ctx) => {
    process.stdout.write('\x1b[2J\x1b[H')
    if (args[0] === 'context' || args[0] === 'all') {
      const { loadSession: load, saveSession: save } = await import('../session/manager.js')
      const session = load(ctx.sessionId)
      if (session) {
        // Keep only system prompt
        session.messages = session.messages.filter(m => m.role === 'system')
        save(session)
        return 'Screen and context cleared.'
      }
    }
    return ''
  },
})

registerCommand({
  name: 'sessions',
  description: 'List all sessions with details',
  aliases: ['session'],
  execute: async (_args, ctx) => {
    const { listSessions } = await import('../session/manager.js')
    const sessions = listSessions(15)

    if (sessions.length === 0) return 'No sessions found'

    const lines = sessions.map(s => {
      const current = s.id === ctx.sessionId ? ' \x1b[32m← current\x1b[0m' : ''
      const userMsgs = s.messages.filter(m => m.role === 'user').length
      const dir = s.cwd ? s.cwd.split('/').pop() : '?'
      const age = getAge(s.updatedAt)
      return `  ${s.id.slice(0, 20).padEnd(20)} ${String(userMsgs).padStart(3)} msgs  ${dir?.padEnd(15)}  ${age}${current}`
    })

    return `Sessions:\n\n  ${'ID'.padEnd(20)} ${'Msgs'.padStart(4)}  ${'Directory'.padEnd(15)}  Age\n${lines.join('\n')}`
  },
})

registerCommand({
  name: 'commit',
  description: 'Git commit with message',
  aliases: ['ci'],
  execute: async (args) => {
    if (args.length === 0) return 'Usage: /commit <message>'
    const msg = args.join(' ')
    // Use git add first, then commit with message passed via env to avoid injection
    await execAsync('git add -A', { cwd: process.cwd() })
    const { stdout, stderr } = await execAsync('git commit -m "$COMMIT_MSG"', {
      cwd: process.cwd(),
      env: { ...process.env, COMMIT_MSG: msg },
    })
    return (stdout + stderr).trim() || 'Committed'
  },
})

registerCommand({
  name: 'diff',
  description: 'Show git diff',
  aliases: ['d'],
  execute: async (args) => {
    const target = args[0] || ''
    const { stdout } = await execAsync('git diff -- ' + (target ? `"${target.replace(/'/g, "'\"'\"'")}"` : ''), { cwd: process.cwd() })
    return stdout || 'No changes'
  },
})

registerCommand({
  name: 'status',
  description: 'Show git status',
  aliases: ['st'],
  execute: async () => {
    const { stdout } = await execAsync('git status --short', { cwd: process.cwd() })
    return stdout || 'Clean working tree'
  },
})

registerCommand({
  name: 'log',
  description: 'Show recent git commits',
  aliases: ['lg'],
  execute: async (args) => {
    const n = args[0] || '10'
    const { stdout } = await execAsync('git log --oneline -n ' + String(n), { cwd: process.cwd() })
    return stdout || 'No commits'
  },
})

registerCommand({
  name: 'branch',
  description: 'Show git branches',
  aliases: ['br'],
  execute: async () => {
    const { stdout } = await execAsync('git branch -v', { cwd: process.cwd() })
    return stdout || 'No branches'
  },
})

registerCommand({
  name: 'checkout',
  description: 'Git checkout a branch or file',
  execute: async (args) => {
    if (args.length === 0) return 'Usage: /checkout <branch|file>'
    try {
      const { stdout, stderr } = await execAsync('git checkout -- ' + args.map(a => `'${a.replace(/'/g, "'\"'\"'")}'`).join(' '), { cwd: process.cwd() })
      return (stdout + stderr).trim() || `Checked out ${args[0]}`
    } catch (e: unknown) {
      const err = e as { message?: string }
      return `Checkout failed: ${err.message || String(e)}`
    }
  },
})

registerCommand({
  name: 'lsof',
  description: 'Show open ports or file handles',
  execute: async (args) => {
    const port = args[0] || ''
    const cmd = port ? `lsof -i :${port}` : 'lsof -i -P'
    try {
      const { stdout } = await execAsync(cmd)
      return stdout || 'No results'
    } catch { return 'lsof not available' }
  },
})

registerCommand({
  name: 'ps',
  description: 'Show running processes',
  execute: async (args) => {
    const filter = args.join(' ') || 'aux'
    const { stdout } = await execAsync(`ps ${filter} | head -20`)
    return stdout || 'No processes'
  },
})

registerCommand({
  name: 'env',
  description: 'Show environment variables (filtered)',
  aliases: ['environment'],
  execute: async (args) => {
    const filter = (args[0] || '').toLowerCase()
    const SENSITIVE_KEYS = ['KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'CREDENTIAL', 'AUTH', 'PASS']
    const env = Object.entries(process.env)
      .filter(([k]) => !filter || k.toLowerCase().includes(filter))
      .map(([k, v]) => {
        const isSensitive = SENSITIVE_KEYS.some(s => k.toUpperCase().includes(s))
        return `${k}=${isSensitive ? '***' : v}`
      })
      .join('\n')
    return env || 'No matching variables'
  },
})

registerCommand({
  name: 'exit',
  description: 'Exit Nole Code',
  aliases: ['quit', 'q'],
  execute: async () => {
    console.log('\n👋 Goodbye!\n')
    process.exit(0)
  },
})

registerCommand({
  name: 'cost',
  description: 'Show estimated API usage for this session',
  execute: async (_args, ctx) => {
    const sessionFile = join(homedir(), '.nole-code', 'sessions', `${ctx.sessionId}.json`)
    if (!existsSync(sessionFile)) return 'Session not found'

    try {
      const session = JSON.parse(readFileSync(sessionFile, 'utf-8'))
      const msgs = session.messages?.length || 0
      return `Session: ${ctx.sessionId}
Messages: ${msgs}
Estimated turns: ${Math.ceil(msgs / 2)}
Note: Actual token usage available in provider dashboard.`
    } catch {
      return 'Could not read session'
    }
  },
})

registerCommand({
  name: 'doctor',
  description: 'Check Nole Code setup health',
  execute: async () => {
    const checks = [
      ['Node.js', process.version],
      ['API Key', MINIMAX_API_KEY ? '✅ set' : '❌ missing'],
      ['Session Dir', existsSync(join(homedir(), '.nole-code')) ? '✅ exists' : '❌ missing'],
    ]

    return `🦞 NOLE CODE — Health Check:\n\n` +
      checks.map(([name, status]) => `  ${status.startsWith('❌') ? '❌' : '✅'} ${name}: ${status}`).join('\n')
  },
})

registerCommand({
  name: 'init',
  description: 'Create a NOLE.md project context file in current directory',
  aliases: ['init-project'],
  execute: async (_args, ctx) => {
    const { createNoleMd } = await import('../project/onboarding.js')
    const path = createNoleMd(ctx.cwd)
    return `✅ Created ${path}\nEdit this file to configure project context for Nole Code.`
  },
})

registerCommand({
  name: 'fork',
  description: 'Fork the current session',
  aliases: ['session-fork'],
  execute: async (args, ctx) => {
    const { forkSession, loadSession } = await import('../session/manager.js')
    const parent = loadSession(ctx.sessionId)
    if (!parent) return '❌ Session not found'
    const reason = args.join(' ') || undefined
    const forked = forkSession(ctx.sessionId, reason)
    if (forked) {
      return `✅ Forked session: ${forked.id}\nResume with: nole-code --session ${forked.id}`
    }
    return '❌ Failed to fork session'
  },
})

registerCommand({
  name: 'team',
  description: 'Create or manage a team of agents',
  execute: async (args, ctx) => {
    const { createTeam, getAllTeams, sendTeamMessage } = await import('../agents/team.js')
    const action = args[0]

    if (action === 'create') {
      const name = args[1] || 'my-team'
      const team = await createTeam({ name, parentSessionId: ctx.sessionId })
      return `✅ Team created: ${team.name} (${team.id})`
    }

    if (action === 'list') {
      const allTeams = getAllTeams()
      if (allTeams.length === 0) return 'No teams created yet'
      return allTeams.map(t => `${t.name} (${t.id}) - ${t.members.size} members`).join('\n')
    }

    if (action === 'send') {
      // team send <to> <message>
      const [to, ...msgParts] = args.slice(1)
      if (!to || msgParts.length === 0) return 'Usage: /team send <to> <message>'
      // Would need team ID from context
      return '⚠️ Send requires specifying a team ID'
    }

    return `Usage:\n  /team create <name>\n  /team list\n  /team send <to> <message>`
  },
})

registerCommand({
  name: 'agents',
  description: 'List and manage running agents',
  aliases: ['tasks'],
  execute: async (args, ctx) => {
    const { getAllAgents, killAgent } = await import('../agents/spawner.js')
    const action = args[0]
    const agents = getAllAgents()

    if (action === 'kill' && args[1]) {
      const killed = killAgent(args[1])
      return killed ? `✅ Killed ${args[1]}` : `❌ Agent ${args[1]} not found`
    }

    if (agents.length === 0) return 'No active agents'

    return agents.map(a =>
      `[${a.status.toUpperCase()}] ${a.id}: ${a.description} (PID: ${a.pid || 'N/A'})`
    ).join('\n')
  },
})

registerCommand({
  name: 'plan',
  description: 'Enter plan mode for step-by-step approval',
  aliases: ['steps'],
  execute: async (args, ctx) => {
    const goal = args.join(' ') || 'Build and verify the requested feature'
    const { enterPlanMode, getCurrentPlan, displayPlan, isPlanModeActive } = await import('../plan/index.js')

    if (isPlanModeActive()) {
      const plan = getCurrentPlan()
      if (plan) {
        displayPlan(plan)
        return 'Use /plan approve, /plan deny, /plan skip, or /plan abort'
      }
    }
    const { generatePlanSteps } = await import('../plan/index.js')
    const steps = generatePlanSteps(goal)
    const plan = enterPlanMode(goal, steps)
    return `📋 Plan created: ${plan.title}\n${plan.steps.length} steps identified.\nUse /plan approve to proceed step by step.`
  },
})


registerCommand({
  name: 'compact',
  description: 'Compact session to reduce token usage',
  aliases: ['compress'],
  execute: async (_args, ctx) => {
    const { compactSession } = await import('../session/manager.js')
    const compacted = compactSession(ctx.sessionId, 5)
    if (compacted) {
      const before = compacted.messages.length
      return `✅ Session compacted (kept last 5 tool results)`
    }
    return '❌ Failed to compact session'
  },
})

registerCommand({
  name: 'onboarding',
  description: 'Show project onboarding status',
  aliases: ['setup'],
  execute: async (_args, ctx) => {
    const { getOnboardingSteps, isOnboardingComplete } = await import('../project/onboarding.js')
    const steps = getOnboardingSteps(ctx.cwd)
    const done = isOnboardingComplete(ctx.cwd)

    const lines = ['🦞 Project Setup:\n']
    for (const s of steps) {
      const icon = s.isComplete ? '✅' : s.isEnabled ? '⬜' : '🔒'
      lines.push(`  ${icon} ${s.text}`)
    }
    if (done) lines.push('\n✅ Project setup complete!')

    return lines.join('\n')
  },
})



// ============ New Commands ============

registerCommand({
  name: 'export',
  description: 'Export conversation as markdown file',
  aliases: ['save-chat'],
  execute: async (_args, ctx) => {
    const { loadSession: load, exportSession } = await import('../session/manager.js')
    const { writeFileSync } = require('fs')
    const { join } = require('path')

    const transcript = exportSession(ctx.sessionId)
    if (!transcript) return 'Session not found'

    const filename = `nole-session-${ctx.sessionId.slice(5, 15)}.md`
    const outPath = join(ctx.cwd, filename)
    writeFileSync(outPath, transcript, 'utf-8')
    return `Exported to ${filename} (${transcript.split('\n').length} lines)`
  },
})

registerCommand({
  name: 'changes',
  description: 'Show all files changed in this session (git diff from session start)',
  aliases: ['review'],
  execute: async (_args, ctx) => {
    const { execFileSync } = require('child_process')
    try {
      // Show all changes since session start
      const stat = execFileSync('git', ['diff', '--stat'], { encoding: 'utf-8', cwd: ctx.cwd }).trim()
      const diffOutput = execFileSync('git', ['diff', '--name-status'], { encoding: 'utf-8', cwd: ctx.cwd }).trim()

      if (!stat && !diffOutput) {
        // Check staged too
        const staged = execFileSync('git', ['diff', '--cached', '--name-status'], { encoding: 'utf-8', cwd: ctx.cwd }).trim()
        if (!staged) return 'No changes detected.'
        return `Staged changes:\n${staged}`
      }

      const lines: string[] = ['Files changed:\n']
      for (const line of diffOutput.split('\n')) {
        if (!line) continue
        const [status, ...fileParts] = line.split('\t')
        const file = fileParts.join('\t')
        const icon = status === 'M' ? '\x1b[33mM\x1b[0m' :
                     status === 'A' ? '\x1b[32mA\x1b[0m' :
                     status === 'D' ? '\x1b[31mD\x1b[0m' :
                     status === 'R' ? '\x1b[36mR\x1b[0m' : status
        lines.push(`  ${icon} ${file}`)
      }
      lines.push(`\n${stat.split('\n').pop() || ''}`)
      return lines.join('\n')
    } catch {
      return 'Not a git repository or no changes.'
    }
  },
})

registerCommand({
  name: 'new',
  description: 'Start a fresh session (discards current context)',
  aliases: ['reset'],
  execute: async (_args, ctx) => {
    const { createSession: create, saveSession: save } = await import('../session/manager.js')
    const session = create(ctx.cwd)
    // Return the new session ID so the REPL can switch
    return `New session: ${session.id}\nRestart nole to use it, or /fork to keep the current one.`
  },
})

registerCommand({
  name: 'settings',
  description: 'View or change settings (model, temperature, maxTokens)',
  aliases: ['config', 'set'],
  execute: async (args) => {
    const { loadSettings, saveSettings } = await import('../project/onboarding.js')
    const current = loadSettings()

    if (args.length === 0) {
      return `Current Settings:\n\n` +
        `  model:        ${current.model || 'MiniMax-M2.7'}\n` +
        `  temperature:  ${current.temperature ?? 0.7}\n` +
        `  maxTokens:    ${current.maxTokens ?? 4096}\n` +
        `  maxTurns:     ${current.maxTurns ?? 50}\n` +
        `  shell:        ${current.shell || '/bin/bash'}\n` +
        `  autoSave:     ${current.autoSaveSession ?? true}\n` +
        `  permissions:  ${current.toolPermissions || 'all'}\n` +
        `\nUsage: /settings <key> <value>`
    }

    const [key, ...valueParts] = args
    const value = valueParts.join(' ')

    if (!value) return `Usage: /settings ${key} <value>`

    const updates: Record<string, unknown> = {}
    switch (key) {
      case 'model':
        updates.model = value
        break
      case 'temperature':
      case 'temp':
        const temp = parseFloat(value)
        if (isNaN(temp) || temp < 0 || temp > 2) return 'Temperature must be 0-2'
        updates.temperature = temp
        break
      case 'maxTokens':
      case 'max_tokens':
      case 'tokens':
        const tokens = parseInt(value)
        if (isNaN(tokens) || tokens < 256) return 'maxTokens must be >= 256'
        updates.maxTokens = tokens
        break
      case 'maxTurns':
      case 'max_turns':
      case 'turns':
        const turns = parseInt(value)
        if (isNaN(turns) || turns < 5) return 'maxTurns must be >= 5'
        updates.maxTurns = turns
        break
      case 'permissions':
        if (!['all', 'ask', 'none'].includes(value)) return 'permissions must be: all, ask, or none'
        updates.toolPermissions = value
        break
      default:
        return `Unknown setting: ${key}. Available: model, temperature, maxTokens, maxTurns, permissions`
    }

    saveSettings(updates)
    return `Updated ${key} = ${value}`
  },
})

registerCommand({
  name: 'undo',
  description: 'Remove the last user message and assistant response',
  aliases: ['pop'],
  execute: async (_args, ctx) => {
    const { loadSession: load, saveSession: save } = await import('../session/manager.js')
    const session = load(ctx.sessionId)
    if (!session) return 'Session not found'

    // Find and remove last user+assistant+tool turn
    let removed = 0
    while (session.messages.length > 1) {
      const last = session.messages[session.messages.length - 1]
      if (last.role === 'system') break
      if (last.role === 'user' && removed > 0) {
        session.messages.pop()
        removed++
        break
      }
      session.messages.pop()
      removed++
    }

    if (removed === 0) return 'Nothing to undo'
    save(session)
    return `Removed ${removed} messages. Session rolled back.`
  },
})

registerCommand({
  name: 'model',
  description: 'Switch the LLM model mid-session',
  execute: async (args) => {
    if (args.length === 0) {
      const { loadSettings } = await import('../project/onboarding.js')
      const s = loadSettings()
      const provider = (() => { try { const { activeClient: c } = require('../index.js'); return c?.getActiveProviderName() || '?' } catch { return '?' } })()
      return `Current model: ${s.model || 'MiniMax-M2.7'} (${provider})\n\nUsage: /model <name>\n\nExamples:\n  /model google/gemini-2.5-flash    (OpenRouter)\n  /model anthropic/claude-sonnet-4  (OpenRouter)\n  /model meta-llama/llama-4-scout   (OpenRouter)\n  /model gpt-4o-mini                (OpenAI)\n  /model MiniMax-M2.7               (MiniMax)\n\nProvider auto-detected from model name.`
    }

    const { saveSettings } = await import('../project/onboarding.js')
    const model = args.join(' ')
    saveSettings({ model })
    // Switch the live client immediately
    try {
      const { activeClient } = await import('../index.js')
      if (activeClient) activeClient.setModel(model)
    } catch {}
    return `Model switched to: ${model} (active now)`
  },
})

registerCommand({
  name: 'replay',
  description: 'Replay a session — shows the conversation without re-executing',
  execute: async (args, ctx) => {
    const { loadSession: load } = await import('../session/manager.js')
    const id = args[0] || ctx.sessionId
    const session = load(id)
    if (!session) return `Session not found: ${id}`

    const lines: string[] = [`Session: ${session.id}`, `Created: ${session.createdAt}`, '']

    for (const msg of session.messages) {
      if (msg.role === 'system') continue
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

      if (msg.role === 'user') {
        lines.push(`\x1b[34m> ${content.slice(0, 200)}\x1b[0m`)
      } else if (msg.role === 'assistant') {
        lines.push(`\x1b[35m${content.slice(0, 300)}\x1b[0m`)
      } else if (msg.role === 'tool') {
        lines.push(`\x1b[33m  [${msg.name}] ${content.slice(0, 100)}\x1b[0m`)
      }
    }

    lines.push(`\n${session.messages.length} messages total.`)
    return lines.join('\n')
  },
})

registerCommand({
  name: 'audit',
  description: 'Show recent tool execution log',
  execute: async (args, ctx) => {
    const { getAuditLog } = await import('../utils/audit.js')
    const limit = parseInt(args[0]) || 20
    const entries = getAuditLog(limit, args.includes('--session') ? ctx.sessionId : undefined)

    if (entries.length === 0) return 'No audit entries.'

    const lines = entries.map(e => {
      const time = e.timestamp.slice(11, 19)
      const err = e.isError ? ' \x1b[31mERR\x1b[0m' : ''
      const preview = Object.values(e.input)[0]
      const inputStr = preview ? String(preview).slice(0, 40) : ''
      return `  ${time} ${e.tool.padEnd(12)} ${e.durationMs}ms ${inputStr}${err}`
    })

    return `Audit log (last ${entries.length}):\n\n${lines.join('\n')}`
  },
})

registerCommand({
  name: 'plugins',
  description: 'List installed plugins',
  execute: async () => {
    const { existsSync, readdirSync } = require('fs')
    const { join } = require('path')
    const { homedir } = require('os')
    const dir = join(homedir(), '.nole-code', 'plugins')

    if (!existsSync(dir)) {
      return `No plugins directory.\nCreate ~/.nole-code/plugins/ and add .js files.\n\nExample plugin:\n  module.exports = {\n    name: 'Hello',\n    description: 'Say hello',\n    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },\n    execute: async (input) => 'Hello, ' + input.name\n  }`
    }

    const files = readdirSync(dir).filter((f: string) => f.endsWith('.js'))
    if (files.length === 0) return 'No plugins installed.\nAdd .js files to ~/.nole-code/plugins/'

    return `Installed plugins:\n${files.map((f: string) => '  ' + f).join('\n')}`
  },
})

registerCommand({
  name: 'context',
  description: 'Show current session context — tokens, messages, model, git',
  aliases: ['info', 'stats'],
  execute: async (_args, ctx) => {
    const { loadSession: load } = await import('../session/manager.js')
    const { estimateTotalTokens } = await import('../utils/count-tokens.js')
    const { loadSettings } = await import('../project/onboarding.js')
    const { costTracker } = await import('../utils/cost.js')
    const { execFileSync } = require('child_process')

    const session = load(ctx.sessionId)
    if (!session) return 'Session not found'

    const settings = loadSettings()
    const tokens = estimateTotalTokens(session.messages)
    const maxTokens = 50000
    const percent = Math.round((tokens / maxTokens) * 100)
    const bar = '\u2588'.repeat(Math.floor(percent / 5)) + '\u2591'.repeat(20 - Math.floor(percent / 5))

    const userMsgs = session.messages.filter(m => m.role === 'user').length
    const assistantMsgs = session.messages.filter(m => m.role === 'assistant').length
    const toolMsgs = session.messages.filter(m => m.role === 'tool').length

    const sessionCost = costTracker.getCurrentSession()

    let git = ''
    try {
      const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf-8', cwd: ctx.cwd }).trim()
      const status = execFileSync('git', ['status', '--short'], { encoding: 'utf-8', cwd: ctx.cwd }).trim()
      const changed = status ? status.split('\n').length : 0
      if (branch) git = `\n  Git:       ${branch}${changed ? ` (${changed} changed)` : ' (clean)'}`
    } catch {}

    return `Session Context:\n\n` +
      `  Session:   ${session.id}\n` +
      `  Model:     ${settings.model || 'MiniMax-M2.7'}\n` +
      `  CWD:       ${session.cwd || ctx.cwd}${git}\n` +
      `  Messages:  ${session.messages.length} (${userMsgs} user, ${assistantMsgs} assistant, ${toolMsgs} tool)\n` +
      `  Tokens:    [${bar}] ~${tokens}/${maxTokens} (${percent}%)\n` +
      `  Created:   ${new Date(session.createdAt).toLocaleString()}\n` +
      (sessionCost ? `  Requests:  ${sessionCost.requests} (${sessionCost.inputTokens} in, ${sessionCost.outputTokens} out)\n` : '') +
      (session.parentId ? `  Forked:    ${session.parentId}\n` : '')
  },
})

// ============ Loop Commands ============

registerCommand({
  name: 'loop',
  description: 'Start autonomous loop: /loop <goal> or /loop --resume <id>',
  aliases: ['autonomous', 'run'],
  execute: async (args, ctx) => {
    if (args[0] === '--resume' || args[0] === '-r') {
      const id = args[1]
      if (!id) {
        // List checkpoints
        const { listCheckpoints } = await import('../loop/checkpoint.js')
        const checkpoints = listCheckpoints(10)
        if (checkpoints.length === 0) return 'No checkpoints found.\nStart a loop with /loop <goal>'
        const lines = ['Available checkpoints:\n']
        for (const cp of checkpoints) {
          const progress = `${cp.currentStep}/${cp.steps.length}`
          const state = cp.state
          lines.push(`  ${cp.id} — ${cp.goal.slice(0, 50)} [${state}] ${progress}`)
        }
        return lines.join('\n') + '\n\nUse /loop --resume <id> to continue'
      }
      
      const { resumeLoop } = await import('../loop/spawner.js')
      resumeLoop(id)
      return `Resuming loop ${id} in background...\nUse /progress to check status.`
    }
    
    const goal = args.join(' ')
    if (!goal) return 'Usage: /loop <goal>\nExample: /loop build a REST API with authentication\n\nResume: /loop --resume <checkpoint-id>\nPause: /pause\nAbort: /abort'
    
    const { spawnLoop, isLoopRunning } = await import('../loop/spawner.js')
    if (isLoopRunning()) {
      return 'Loop already running. Use /pause or /abort first.'
    }
    
    const checkpointId = spawnLoop(goal, ctx.cwd)
    return `Starting loop in background...\nCheckpoint: ${checkpointId}\n\nUse /progress to check status.\nPause: /pause  |  Abort: /abort`
  },
})

registerCommand({
  name: 'checkpoints',
  description: 'List saved loop checkpoints',
  aliases: ['cp', 'checkpoint'],
  execute: async (args, ctx) => {
    const { listCheckpoints, loadCheckpoint } = await import('../loop/checkpoint.js')
    const checkpoints = listCheckpoints(parseInt(args[0]) || 10)
    
    if (checkpoints.length === 0) return 'No checkpoints found.\nStart a loop with /loop <goal>'
    
    const lines = ['Loop Checkpoints:\n']
    
    for (const cp of checkpoints) {
      const progress = `${cp.currentStep}/${cp.steps.length}`
      const errors = cp.context.errorsEncountered.length
      const files = cp.context.filesCreated.length
      const age = getAge(cp.updatedAt)
      
      lines.push(`${cp.id}`)
      lines.push(`  Goal: ${cp.goal.slice(0, 60)}`)
      lines.push(`  State: ${cp.state} | Progress: ${progress} | Age: ${age}`)
      if (files > 0) lines.push(`  Files: ${files} created`)
      if (errors > 0) lines.push(`  Errors: ${errors}`)
      lines.push('')
    }
    
    lines.push('Resume with: /loop --resume <id>')
    return lines.join('\n')
  },
})

registerCommand({
  name: 'progress',
  description: 'Show current loop progress',
  aliases: ['status'],
  execute: async (args, ctx) => {
    const { loadLatestCheckpoint, getProgress } = await import('../loop/index.js')
    const cp = loadLatestCheckpoint()
    
    if (!cp) return 'No active loop.\nStart one with /loop <goal>'
    
    const progress = getProgress(cp)
    const lines = [
      `${cp.state === 'running' ? '🔄' : cp.state === 'complete' ? '✅' : '⏸'} Loop Progress`,
      '',
      `Goal: ${cp.goal}`,
      `State: ${cp.state}`,
      `Progress: ${progress.current}/${progress.total} (${progress.percent}%)`,
      '',
    ]
    
    for (let i = 0; i < cp.steps.length; i++) {
      const step = cp.steps[i]
      const prefix = i < progress.current ? '✓' : i === progress.current ? '▶' : '○'
      const color = step.status === 'failed' ? '\x1b[31m' : step.status === 'complete' ? '\x1b[32m' : '\x1b[90m'
      const status = step.status === 'failed' ? ' (FAILED)' : ''
      lines.push(`  ${color}${prefix}\x1b[0m Step ${i + 1}: ${step.description.slice(0, 60)}${status}`)
    }
    
    if (cp.context.errorsEncountered.length > 0) {
      lines.push('')
      lines.push(`\x1b[31m${cp.context.errorsEncountered.length} error(s)\x1b[0m`)
    }
    
    return lines.join('\n')
  },
})

registerCommand({
  name: 'pause',
  description: 'Pause running loop (SIGTERM, 2s to checkpoint)',
  aliases: ['suspend'],
  execute: async (args, ctx) => {
    const { pauseLoop, isLoopRunning, getActiveLoop } = await import('../loop/spawner.js')
    
    if (!isLoopRunning()) {
      return 'No loop running.'
    }
    
    const loop = getActiveLoop()
    pauseLoop()
    return `Pausing loop... checkpoint will be saved.\\nResume with: /loop --resume ${loop?.checkpointId}`
  },
})

registerCommand({
  name: 'abort',
  description: 'Abort running loop immediately (SIGKILL)',
  aliases: ['kill', 'stop'],
  execute: async (args, ctx) => {
    const { abortLoop, isLoopRunning, getActiveLoop } = await import('../loop/spawner.js')
    
    if (!isLoopRunning()) {
      return 'No loop running.'
    }
    
    const loop = getActiveLoop()
    abortLoop()
    return `Aborted loop.\\nCheckpoint saved at: ${loop?.checkpointId}\\nResume with: /loop --resume ${loop?.checkpointId}`
  },
})

// ============ Task Commands ============

registerCommand({
  name: 'tasks',
  description: 'List all background tasks',
  aliases: ['task'],
  execute: async () => {
    const { taskManager } = await import('../tasks/index.js')
    const tasks = taskManager.listTasks()
    
    if (tasks.length === 0) return 'No background tasks running.'
    
    const lines = ['Background Tasks:\n']
    for (const t of tasks) {
      const statusIcon = t.status === 'running' ? '🔄' : t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : t.status === 'stopped' ? '⏹' : '○'
      lines.push(`${statusIcon} ${t.id} [${t.type}] ${t.status}`)
      lines.push(`    ${t.description}`)
    }
    return lines.join('\n')
  },
})

registerCommand({
  name: 'task',
  description: 'Manage background tasks: stop <id>, log <id>',
  aliases: [],
  execute: async (args) => {
    const { taskManager } = await import('../tasks/index.js')
    const action = args[0]
    const taskId = args[1]
    
    if (!action || !taskId) {
      return 'Usage: /task <stop|log> <task-id>'
    }
    
    if (action === 'stop') {
      const result = taskManager.stopTask(taskId)
      return result ? `Stopped task ${taskId}` : `Failed to stop task ${taskId}`
    }
    
    if (action === 'log') {
      const output = taskManager.getTaskOutput(taskId, 30)
      if (output.length === 0) return `No output for task ${taskId}`
      return `Task ${taskId} output (last ${output.length} lines):\n` + output.join('\n')
    }
    
    return `Unknown action: ${action}. Use 'stop' or 'log'.`
  },
})

// Server commands
import { registerServerCommand } from './server.js'
registerServerCommand(registerCommand)

// Buddy commands
import { registerBuddyCommands } from '../buddy/commands.js'
registerBuddyCommands(registerCommand)
