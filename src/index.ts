#!/usr/bin/env node
// Nole Code - Main Entry Point
// Rich terminal UI inspired by Nole Code's REPL

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as readline from 'readline'
import { LLMClient } from './api/llm.js'
import { getToolDefinitions, executeTool } from './tools/registry.js'
import { loadMCPServers } from './mcp/client.js'
import { parseCommand, getCommand } from './commands/index.js'
import { spawnAgent, onAgentMessage } from './agents/spawner.js'
import { createTeam } from './agents/team.js'
import { loadSession, saveSession, createSession, listSessions, deleteSession, forkSession, compactSession } from './session/manager.js'
import { loadProjectContext, loadSettings } from './project/onboarding.js'
import { costTracker } from './utils/cost.js'
import { enableFeature, feature, setFeature } from './feature-flags/index.js'
import {
  c, divider, bold, dim, italic,
  statusIndicator, spin, tokenBudgetDisplay,
  formatToolResult, table, diff, box
} from './ui/output/styles.js'
import {
  initVerboseOutput, setVerbose, setShowTimings,
  formatToolHeader, formatProgress, printTokenBudget,
  printContextHeader, printPermissionCheck, printError,
  printSuccess, printWarning, printInfo, printStep,
  streamResult, clearLine, updateLine, printTable,
  printDiff, printBox, createProgressTracker
} from './ui/output/verbose.js'
import {
  getSpinnerFrame, advanceSpinner, formatToolSpinner,
  formatThinking, formatVerboseTool, formatVerboseResult
} from './ui/output/spinner.js'
import {
  formatToolStart, formatHook, formatWorking, formatComplete,
  formatSummary, formatShortcuts, formatTopBar, formatCancelled
} from './ui/output/streaming.js'
import { renderMarkdown, createStreamingMarkdown } from './ui/markdown.js'

// Cancel flag — Ctrl+C during LLM call cancels the current request, not the process
let cancelRequested = false
let isProcessing = false
let lastUserMessage = ''

// Global client reference for live model switching
export let activeClient: InstanceType<typeof LLMClient> | null = null

// Stream output lines with small delays for progressive display
async function streamOutput(lines: string[], maxLines: number, delayMs = 10): Promise<{ shown: string[]; truncated: boolean; total: number }> {
  const shown: string[] = []
  const truncated = lines.length > maxLines
  const toShow = truncated ? lines.slice(0, maxLines) : lines
  
  for (let i = 0; i < toShow.length; i++) {
    shown.push(toShow[i])
    if (i > 0 || delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs))
    }
    // Only print after first line to avoid blank at start
    if (i === 0) {
      process.stdout.write('  ' + toShow[i])
    } else {
      process.stdout.write('\n  ' + toShow[i])
    }
  }
  
  if (truncated) {
    const more = lines.length - maxLines
    const moreHint = more > 5 ? ' (ctrl+o to expand)' : ''
    process.stdout.write('\n  ' + dim('+' + more + ' more lines' + moreHint))
  }
  
  return { shown, truncated, total: lines.length }
}

// ============ Token Loading ============
function getMiniMaxToken(): string {
  try {
    const authPath = join(homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json')
    if (existsSync(authPath)) {
      const auth = JSON.parse(readFileSync(authPath, 'utf-8'))
      return auth.profiles?.['minimax-portal:default']?.access || ''
    }
  } catch {}
  return process.env.MINIMAX_API_KEY || ''
}

// ============ Plan Intent Detection ============
const PLAN_INTENT_PATTERNS = [
  /^let['’]?s?\s+(make\s+a\s+plan|plan|break\s+this\s+down|walk\s+me\s+through)/i,
  /^plan\s+(this|it|that|out|for|our|the)/i,
  /^make\s+a\s+plan/i,
  /^step\s+by\s+step/i,
  /^enter\s+plan\s*mode/i,
  /^walk\s+me\s+through/i,
  /^go\s+through\s+(it|this)\s+step\s+by\s+step/i,
  /^outline\s+the\s+steps/i,
  /^what\s+are\s+the\s+steps?/i,
  /^list\s+the\s+steps?/i,
  /^break\s+(this|it)\s+down/i,
  /^plan\s+out/i,
  /^can\s+(we|you)\s+plan/i,
  /^should\s+we\s+plan/i,
  /^approach\s+(this|it)\s+step\s+by\s+step/i,
]

/**
 * Detect if user wants to enter plan mode from natural language
 * Returns the goal/description if detected, null otherwise
 */
function detectPlanIntent(input: string): string | null {
  const trimmed = input.trim()
  
  // Check explicit patterns first
  for (const pattern of PLAN_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return trimmed
    }
  }
  
  // Check if it starts with plan-related phrases
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('plan ') && trimmed.length > 10) {
    // "plan this out" or "plan it step by step"
    return trimmed
  }
  
  return null
}

// ============ Banner ============
function getBanner(cwd: string, verbose = false) {
  const v = verbose ? `${dim('· ')}verbose` : ''
  return `
${bold(c.cyan('▐▛███▜▌'))} ${bold('Nole Code v1.13')} ${dim('· MiniMax')}
${dim('▝▜█████▛▘')} ${dim(cwd)} ${v}

${divider()}
${formatShortcuts()}
`
}

// ============ Main REPL ============
interface CliOptions {
  cwd?: string
  session?: string
  message?: string
  verbose?: boolean
  compact?: boolean
  'list-sessions'?: boolean
  'delete-session'?: string
  settings?: boolean
}

async function runRepl(opts: CliOptions) {
  // Initialize verbose output system
  if (opts.verbose || feature('VERBOSE_OUTPUT')) {
    setFeature('VERBOSE_OUTPUT', true)
    setVerbose(true)
    setShowTimings(feature('TOOL_TIMING'))
    initVerboseOutput()
  }

  // Load user settings
  const settings = loadSettings()

  // Initialize LLM client
  const token = getMiniMaxToken()
  if (!token) {
    printError('MINIMAX_API_KEY not found', {
      details: 'Set MINIMAX_API_KEY or ensure ~/.openclaw/agents/main/agent/auth-profiles.json exists'
    })
    process.exit(1)
  }
  const client = new LLMClient(token, settings.model || 'MiniMax-M2.7')
  activeClient = client

  // Load MCP servers
  try {
    await loadMCPServers()
  } catch {}

  // Load plugins
  try {
    const { loadPlugins } = await import('./plugins/loader.js')
    const plugins = await loadPlugins()
    if (plugins.length > 0) {
      console.log(dim(`  Loaded ${plugins.length} plugin${plugins.length > 1 ? 's' : ''}: ${plugins.join(', ')}`))
    }
  } catch {}

  // Load or create session — auto-resume last session for same cwd
  const cwd = opts.cwd || process.cwd()
  let session: ReturnType<typeof createSession>

  if (opts.session) {
    session = loadSession(opts.session) || createSession(cwd)
  } else {
    // Try to resume the most recent session for this working directory
    const recent = listSessions(5)
    const lastForCwd = recent.find(s => s.cwd === cwd && s.messages.length > 1)
    if (lastForCwd) {
      session = lastForCwd
      console.log(dim(`  Resuming session ${session.id.slice(0, 20)}... (${session.messages.length} messages)`))
      console.log(dim(`  Use /fork to branch off, /compact to shrink context\n`))
    } else {
      session = createSession(cwd)
    }
  }

  costTracker.startSession(session.id)

  // Load project context
  const projectContext = loadProjectContext(opts.cwd || process.cwd())

  // Load session memory for context
  const { getMemorySummary } = await import('./session-memory/index.js')
  const memorySummary = getMemorySummary(session.id)

  // Detect git context
  let gitContext = ''
  try {
    const { execFileSync } = require('child_process')
    const cwd = opts.cwd || process.cwd()
    const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf-8', cwd }).trim()
    const status = execFileSync('git', ['status', '--short'], { encoding: 'utf-8', cwd }).trim()
    const changed = status ? status.split('\n').length : 0
    const lastCommit = execFileSync('git', ['log', '--oneline', '-1'], { encoding: 'utf-8', cwd }).trim()
    if (branch) {
      gitContext = `\n- Git branch: ${branch}${changed ? ` (${changed} files changed)` : ' (clean)'}`
      if (lastCommit) gitContext += `\n- Last commit: ${lastCommit}`
    }
  } catch {}

  // Session resume context — build a compact summary of prior conversation
  let resumeContext = ''
  if (session.messages.length > 1) {
    const userMsgs = session.messages.filter(m => m.role === 'user')
    const assistantMsgs = session.messages.filter(m => m.role === 'assistant')
    const toolMsgs = session.messages.filter(m => m.role === 'tool')

    // Summarize: last 3 user requests + what tools were used
    const recentRequests = userMsgs.slice(-3).map(m => {
      const text = typeof m.content === 'string' ? m.content : ''
      return `- "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`
    })

    // Collect unique tools used
    const toolsUsed = new Set<string>()
    for (const m of toolMsgs) {
      if (m.name) toolsUsed.add(m.name)
    }

    // Files mentioned in tool results
    const filesEdited = new Set<string>()
    for (const m of session.messages) {
      const content = typeof (m as any).content === 'string' ? (m as any).content : ''
      const editMatch = content.match(/^([^\n:]+):$/m)
      if (editMatch && (content.includes('\x1b[31m-') || content.includes('\x1b[32m+'))) {
        filesEdited.add(editMatch[1])
      }
    }

    resumeContext = `\n\n# Resumed Session (${session.messages.length} messages, ${userMsgs.length} turns)`
    resumeContext += `\nRecent requests:\n${recentRequests.join('\n')}`
    if (toolsUsed.size > 0) resumeContext += `\nTools used: ${Array.from(toolsUsed).join(', ')}`
    if (filesEdited.size > 0) resumeContext += `\nFiles edited: ${Array.from(filesEdited).slice(0, 10).join(', ')}`
  }

  // System prompt — modeled after Claude Code's approach
  const systemPrompt = `You are Nole, an expert AI coding assistant built by Nole Code. You help users with software engineering tasks. You are NOT a model name — never say you are "MiniMax" or any model identifier.

# Environment
- Working directory: ${opts.cwd || process.cwd()}
- Platform: ${process.platform}
- Shell: ${process.env.SHELL || '/bin/bash'}
- Node: ${process.version}${gitContext}

# Tools
You have access to these tools. Call them when needed — do not ask for permission:

**File operations:**
- Read: Read file contents with line numbers (supports offset/limit)
- Write: Create or overwrite files
- Edit: Replace exact text in a file — shows colored diff
- MultiEdit: Make multiple edits to a file in one operation
- Glob: Find files matching a pattern (e.g., **/*.ts)
- Grep: Search file contents with regex
- LS: List directory contents with sizes and dates
- Tree: Show directory tree structure
- Rename: Move or rename files/directories
- Delete: Delete files (recursive for directories)
- Diff: Compare two files side by side
- FindReplace: Search and replace across multiple files (dry-run by default)

**Shell & processes:**
- Bash: Execute shell commands
- Spawn: Start background processes (dev servers, watchers)
- RunTests: Auto-detect and run project tests (jest, vitest, pytest, bun, cargo, go)

**Git (dedicated — safer than raw bash):**
- GitStatus: Branch, changes, ahead/behind, recent commits
- GitDiff: Staged/unstaged diffs, compare refs
- GitCommit: Stage files and commit (injection-safe)

**Web & HTTP:**
- WebSearch: Search the web. Always cite sources with [Title](URL)
- WebFetch: Fetch and extract readable content from a URL
- HttpRequest: Full HTTP client — GET/POST/PUT/DELETE with headers and body

**Task management:**
- TodoWrite: Track tasks with status (pending/in_progress/completed)
- TaskCreate/TaskList/TaskUpdate/TaskGet/TaskStop: Background tasks

**Multi-agent:**
- Agent: Spawn a sub-agent for parallel work
- TeamCreate: Create a team of coordinating agents
- SendMessage: Send message to a running agent

# Guidelines
- Be concise and direct. Lead with the answer, not the reasoning.
- Write real working code — no placeholders, no TODOs, no "implement here"
- Read files before editing them. Understand existing code before modifying.
- Don't add features beyond what was asked. A bug fix doesn't need surrounding cleanup.
- When running commands, prefer dedicated tools over Bash (Read over cat, Grep over grep)
- For multi-step tasks, use TodoWrite to track progress
- Report errors clearly with what went wrong and how to fix it
- Users can reference files with @filename — the contents are inlined into the message
${projectContext ? `\n# Project Context (from NOLE.md)\n${projectContext}` : ''}
${memorySummary ? `\n# Session Memory\n${memorySummary}` : ''}${resumeContext}`

  // Initialize messages
  if (session.messages.length === 0) {
    session.messages.push({ role: 'system', content: systemPrompt, timestamp: new Date().toISOString() })
  }

  saveSession(session)

  console.clear()
  const providerName = client.getActiveProviderName()
  console.log(getBanner(opts.cwd || process.cwd(), opts.verbose))

  // Print verbose context
  if (opts.verbose) {
    printContextHeader({
      sessionId: session.id,
      cwd: opts.cwd || process.cwd(),
      model: 'MiniMax-M2.7',
    })
  }

  // Tab completion for /commands and file paths
  const completer = (line: string): [string[], string] => {
    if (line.startsWith('/')) {
      const { getAllCommands } = require('./commands/index.js')
      const cmds = getAllCommands().map((c: any) => '/' + c.name)
      const hits = cmds.filter((c: string) => c.startsWith(line))
      return [hits.length ? hits : cmds, line]
    }
    // File path completion
    const parts = line.split(/\s+/)
    const last = parts[parts.length - 1] || ''
    if (last.includes('/') || last.includes('.')) {
      try {
        const dir = last.includes('/') ? last.substring(0, last.lastIndexOf('/') + 1) : './'
        const prefix = last.includes('/') ? last.substring(last.lastIndexOf('/') + 1) : last
        const { readdirSync, statSync } = require('fs')
        const { resolve: resolvePath } = require('path')
        const fullDir = resolvePath(process.cwd(), dir)
        const entries = readdirSync(fullDir).filter((f: string) => f.startsWith(prefix))
        const completions = entries.map((f: string) => {
          try {
            const isDir = statSync(resolvePath(fullDir, f)).isDirectory()
            return dir + f + (isDir ? '/' : '')
          } catch { return dir + f }
        })
        const withContext = parts.slice(0, -1).join(' ')
        const hits = completions.map((c: string) => withContext ? withContext + ' ' + c : c)
        return [hits, line]
      } catch {}
    }
    return [[], line]
  }

  // Create readline interface with tab completion
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  })

  const prompt = () => process.stdout.write(`${dim('❯')} `)

  let toolCallId = 0

  // Subscribe to agent messages
  const unsubAgent = onAgentMessage((msg) => {
    if (msg.type === 'output') {
      console.log(`\n${c.magenta('🤖 Agent:')} ${msg.payload}`)
    }
  })

  // Ctrl+C handling — cancel current call OR exit if idle
  let sigintCount = 0
  process.on('SIGINT', () => {
    if (isProcessing) {
      // Cancel current LLM call / tool execution
      cancelRequested = true
      isProcessing = false
      sigintCount = 0
      console.log(`\n${c.yellow('⏹')} Cancelled`)
      prompt()
      return
    }
    sigintCount++
    if (sigintCount >= 2) {
      // Double Ctrl+C to exit
      unsubAgent()
      const { getAllAgents, killAgent: ka } = require('./agents/spawner.js')
      for (const agent of getAllAgents()) {
        if (agent.status === 'running') ka(agent.id)
      }
      costTracker.endSession()
      saveSession(session)
      console.log(`\n${dim('👋 Goodbye!')}\n`)
      process.exit(0)
    }
    console.log(`\n${dim('Press Ctrl+C again to exit, or type a message.')}`)
    prompt()
    // Reset after 2 seconds
    setTimeout(() => { sigintCount = 0 }, 2000)
  })

  // Process line input
  const processInput = async (input: string) => {
    if (!input.trim()) {
      prompt()
      return
    }

  // Check for plan intent in natural language
    const planIntent = detectPlanIntent(input)
    if (planIntent) {
      const { generatePlanSteps, enterPlanMode } = await import('./plan/index.js')
      const steps = generatePlanSteps(planIntent)
      const plan = enterPlanMode(planIntent, steps)
      console.log(`\n${c.cyan('📋 PLAN MODE')} — triggered by "${input.slice(0, 50)}..."`)
      console.log(`${plan.steps.length} steps identified. Use /plan approve to proceed.`)
      prompt()
      return
    }

    // Shell escape: ! command runs directly
    if (input.startsWith('!')) {
      const shellCmd = input.slice(1).trim()
      if (!shellCmd) {
        console.log(`\n${dim('Usage: ! <command>')}`)
        prompt()
        return
      }
      try {
        const { execSync: execS } = require('child_process')
        const output = execS(shellCmd, {
          encoding: 'utf-8',
          cwd: opts.cwd || process.cwd(),
          timeout: 30000,
          stdio: ['inherit', 'pipe', 'pipe'],
        })
        if (output) process.stdout.write(output)
      } catch (err: any) {
        if (err.stdout) process.stdout.write(err.stdout)
        if (err.stderr) process.stderr.write(err.stderr)
      }
      console.log('')
      prompt()
      return
    }

    // Check for commands
    const parsed = parseCommand(input)
    if (parsed) {
      const cmd = getCommand(parsed.cmd)
      if (cmd) {
        try {
          const result = await cmd.execute(parsed.args, {
            cwd: opts.cwd || process.cwd(),
            sessionId: session!.id
          })
          if (result) console.log(`\n${result}\n`)
        } catch (err) {
          printError(String(err))
        }
        prompt()
        return
      } else {
        console.log(`\n${c.yellow('❓ Unknown command:')} /${parsed.cmd}`)
        prompt()
        return
      }
    }

    // ========== USER MESSAGE ==========
    cancelRequested = false
    isProcessing = true
    const sessionStartTime = Date.now()
    let toolErrorCount = 0

    // Store for Tab to amend
    lastUserMessage = input

    // @file syntax: inline file contents into the message
    let expandedInput = input
    const fileRefs = input.match(/@([\w.\/\-]+)/g)
    if (fileRefs) {
      for (const ref of fileRefs) {
        const filePath = ref.slice(1)
        const fullPath = resolve(opts.cwd || process.cwd(), filePath)
        if (existsSync(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf-8')
            const truncated = content.length > 5000 ? content.slice(0, 5000) + '\n... (truncated)' : content
            expandedInput = expandedInput.replace(ref, `\n\`\`\`${filePath}\n${truncated}\n\`\`\``)
            console.log(dim(`  Attached ${filePath} (${content.split('\n').length} lines)`))
          } catch {}
        }
      }
    }

    console.log(`${c.blue('➜ you')} │ ${input}`)

    session!.messages.push({
      role: 'user',
      content: expandedInput,
      timestamp: new Date().toISOString(),
    })

    const toolDefs = getToolDefinitions()
    let responseText = ''
    let toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

    // Stream response
    console.log(`\n${divider()}\n`)
    console.log(`${c.magenta('🤖 nole')} │ `)

    const startTime = Date.now()

    try {
      // ========== AGENTIC LOOP ==========
      // Keep calling the LLM until it stops requesting tools
      const MAX_TURNS = parseInt(process.env.NOLE_MAX_TURNS || '') || settings.maxTurns || 50
      let turn = 0

      while (turn < MAX_TURNS) {
        turn++
        responseText = ''
        toolCalls = []

        if (cancelRequested) break

        // Animated spinner during LLM call
        let spinnerInterval: ReturnType<typeof setInterval> | null = null
        let hasOutput = false
        const SPINNER_CHARS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        const VERBS = ['Thinking', 'Reasoning', 'Crafting', 'Computing', 'Processing', 'Analyzing', 'Working']
        let spinFrame = 0
        spinnerInterval = setInterval(() => {
          if (!hasOutput) {
            const frame = SPINNER_CHARS[spinFrame % SPINNER_CHARS.length]
            const verb = VERBS[Math.floor(spinFrame / 5) % VERBS.length]
            const elapsed = ((Date.now() - sessionStartTime) / 1000).toFixed(0)
            process.stdout.write(`\r${c.cyan(frame)} ${dim(verb + '...')} ${dim(`(${elapsed}s)`)}  `)
            spinFrame++
          }
        }, 100)

        const mdStream = createStreamingMarkdown()

        const usage = await client.chatStream(
          session!.messages.map(m => {
            const msg: any = { role: m.role, content: m.content }
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
            if (m.name) msg.name = m.name
            if ((m as any).tool_calls) msg.tool_calls = (m as any).tool_calls
            return msg
          }),
          { tools: toolDefs, max_tokens: settings.maxTokens || 4096 },
          (chunk) => {
            if (!hasOutput && spinnerInterval) {
              clearInterval(spinnerInterval)
              spinnerInterval = null
              process.stdout.write('\r\x1b[K') // Clear spinner line
            }
            hasOutput = true
            responseText += chunk
            mdStream.write(chunk)
          },
          (tc) => {
            toolCalls.push({ id: tc.id || `tool_${Date.now()}`, name: tc.name, input: tc.input })
          },
        )

        // Stop spinner if still running
        if (spinnerInterval) {
          clearInterval(spinnerInterval)
          spinnerInterval = null
          process.stdout.write('\r\x1b[K')
        }

        // Flush any remaining markdown
        mdStream.flush()
        console.log('')

        // Save assistant response with tool_calls if present
        const assistantMsg: any = {
          role: 'assistant',
          content: responseText,
          timestamp: new Date().toISOString(),
        }
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            input: tc.input,
          }))
        }
        session!.messages.push(assistantMsg)

        // Track API usage
        if (usage) {
          costTracker.trackRequest(settings.model || 'MiniMax-M2.7', usage.input, usage.output)
        }

        // No tool calls — LLM is done, exit loop
        if (toolCalls.length === 0) break

        // Auto-compact if approaching token limit
        const { maybeCompact } = await import('./services/compact/index.js')
        if (maybeCompact(session!.messages, session!.id)) {
          saveSession(session!)
        }

        // Print token budget if enabled
        if (feature('AUTO_COMPACT') || feature('SESSION_COMPACT')) {
          printTokenBudget(session!.messages)
        }

        // ========== TOOL EXECUTION ==========
        for (const tc of toolCalls) {
          const toolStartTime = Date.now()

          // Verbose tool header with spinner
          if (opts.verbose) {
            process.stdout.write('\r' + formatToolSpinner(tc.name, tc.input.command as string || undefined, { verbose: true }))
            advanceSpinner()
            console.log('')
          } else {
            const preview = tc.input.command
              ? tc.input.command.toString().slice(0, 60)
              : JSON.stringify(tc.input).slice(0, 60)
            process.stdout.write('\r' + formatToolSpinner(tc.name, preview, { verbose: false }))
            advanceSpinner()
            console.log('')
          }

          // Check for cancel
          if (cancelRequested) {
            console.log(formatCancelled('Skipped remaining tools'))
            break
          }

          // Execute tool
          const result = await executeTool(tc.name, tc.input, {
            cwd: opts.cwd || process.cwd(),
            sessionId: session!.id,
          })

          // Save tool result
          session!.messages.push({
            role: 'tool',
            content: result.content,
            tool_call_id: tc.id,
            name: tc.name,
            timestamp: new Date().toISOString(),
          })

          // Format tool result
          const lines = result.content.split('\n')
          const maxLines = opts.verbose ? 50 : 10

          if (opts.verbose) {
            console.log(formatVerboseResult(tc.name, result.content, {
              isError: result.isError,
              timestamp: toolStartTime,
              maxLines,
            }))
          } else {
            if (result.isError) toolErrorCount++
            void streamOutput(lines, maxLines, lines.length > 20 ? 5 : 0)
          }

          const status = result.isError ? '❌' : '✅'
          console.log(`  ${status} ${tc.name}\n`)
        }

        // If cancelled during tool execution, stop the loop
        if (cancelRequested) break
      }

      if (turn >= MAX_TURNS) {
        console.log(`\n${c.yellow('⚠')} Reached maximum ${MAX_TURNS} turns in agentic loop.\n`)
      }

      // Show context usage after each interaction
      const { estimateTotalTokens } = await import('./utils/count-tokens.js')
      const totalTokens = estimateTotalTokens(session!.messages)
      const maxCtx = 128000  // MiniMax M2.7 context window
      const pct = Math.min(100, Math.round((totalTokens / maxCtx) * 100))
      const elapsed = ((Date.now() - sessionStartTime) / 1000).toFixed(1)
      const turnInfo = turn > 1 ? ` · ${turn} turns` : ''
      const warning = pct > 80 ? ' ⚠ context filling up' : ''
      console.log(dim(`${elapsed}s · ~${totalTokens} tokens (${pct}%)${turnInfo}${warning}`))

      saveSession(session!)

      // Extract session memory in background
      const { extractMemoryFromConversation } = await import('./session-memory/index.js')
      extractMemoryFromConversation(session!.messages, session!.id).catch(() => {})

    } catch (err) {
      const msg = String(err)
      if (msg.includes('overloaded')) {
        printWarning('API is overloaded. Try again in a moment.')
      } else if (msg.includes('authentication')) {
        printError('Invalid API key. Check your MINIMAX_API_KEY in ~/.nole-code/.env or environment.')
      } else if (msg.includes('rate_limit') || msg.includes('429')) {
        printWarning('Rate limited. Wait a few seconds and try again.')
      } else {
        printError(msg.replace('Error: ', ''))
      }
    } finally {
      isProcessing = false
    }

    console.log('')
    prompt()
  }

  // REPL loop
  rl.on('line', async (line: string) => {
    await processInput(line)
  })

  // Load and run single message if provided
  if (opts.message) {
    await processInput(opts.message)
    process.exit(0)
  }

  prompt()
}

// ============ CLI Definition ============
function parseArgs(): CliOptions {
  const opts: CliOptions = { cwd: process.cwd() }
  const args = process.argv.slice(2)

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-s':
      case '--session':
        opts.session = args[++i]
        break
      case '-c':
      case '--cwd':
        opts.cwd = args[++i]
        break
      case '-m':
      case '--message':
        opts.message = args.slice(i + 1).join(' ')
        i = args.length
        break
      case '--verbose':
      case '-v':
        opts.verbose = true
        break
      case '--list-sessions':
        const sessions = listSessions()
        console.log('\nSessions:')
        for (const s of sessions) {
          console.log(`  ${s.id} — ${s.cwd} (${s.messages.length} messages)`)
        }
        console.log('')
        process.exit(0)
        break
      case '--delete-session':
        deleteSession(args[++i])
        console.log(`Deleted session ${args[i - 1]}`)
        process.exit(0)
        break
      case '--version':
        console.log('Nole Code v1.13.0')
        process.exit(0)
        break
      case '--help':
      case '-h':
        console.log(`
${bold('Nole Code')} — AI Coding Assistant

${dim('Usage:')}
  nole [options]

${dim('Options:')}
  -s, --session <id>    Resume a session
  -c, --cwd <path>       Working directory (default: cwd)
  -m, --message <text>   Run single message and exit
  --verbose              Verbose output with timings
  --list-sessions        List all sessions
  --delete-session <id>  Delete a session
  -v, --version          Show version
  -h, --help             Show this help

${dim('Commands (in REPL):')}
  /help       Show help
  /context    Session stats (tokens, git, model)
  /settings   View/change settings
  /model      Switch LLM model
  /undo       Roll back last turn
  /compact    Compact session context
  /fork       Fork current session
  /new        Start fresh session
  /export     Save conversation as markdown
  /changes    Review all file changes
  /plugins    List custom plugins
  /plan       Step-by-step approval mode
  /init       Create NOLE.md (auto-detects project)
  /quit       Exit

${dim('Shortcuts:')}
  ctrl+c     Cancel current / double to exit
  ctrl+l     Clear screen
  ! <cmd>    Run shell command inline
`)
        process.exit(0)
        break
    }
  }

  return opts
}

// ============ Main ============
async function main() {
  const opts = parseArgs()
  await runRepl(opts)
}

main().catch(err => {
  console.error('FATAL ERR:', err?.message, err?.stack?.split('\n').slice(0,3).join('|'))
  process.exit(1)
})
