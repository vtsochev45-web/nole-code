/**
 * Loop Spawner — Spawns and manages loop-agent as background process
 * 
 * Handles:
 * - Spawning loop-agent as detached child
 * - Piping stdout JSON for IPC
 * - /pause sends SIGTERM
 * - /abort sends SIGKILL
 * - Progress display in REPL
 */

import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { c, bold, dim } from '../ui/output/styles.js'

// ============ Types ============

export interface LoopProcess {
  id: string
  checkpointId: string
  goal: string
  child: ChildProcess
  startTime: number
  onComplete?: (result: { success: boolean; errors: number }) => void
}

type IPCEvent =
  | { type: 'plan_ready'; total: number; goal: string }
  | { type: 'step_start'; step: number; total: number; description: string }
  | { type: 'step_complete'; step: number; duration: number; description: string; total?: number }
  | { type: 'step_failed'; step: number; error: string; retry: number; maxRetries: number }
  | { type: 'step_skipped'; step: number; reason: string }
  | { type: 'checkpoint_saved'; checkpointId: string }
  | { type: 'loop_complete'; steps: number; duration: number; errors: number }
  | { type: 'loop_paused'; reason: string; checkpointId: string }
  | { type: 'loop_aborted'; reason: string; checkpointId: string }
  | { type: 'error'; message: string }

// ============ Active Loops ============

let activeLoop: LoopProcess | null = null
let currentTotal: number = 0

export function getActiveLoop(): LoopProcess | null {
  return activeLoop
}

export function isLoopRunning(): boolean {
  return activeLoop !== null && !activeLoop.child.killed
}

// ============ Display ============

function clearLine(): void {
  process.stdout.write('\r' + '\x1b[K')
}

function displayProgress(event: IPCEvent): void {
  clearLine()
  
  switch (event.type) {
    case 'plan_ready':
      currentTotal = event.total
      process.stdout.write(
        `${c.cyan('◉')} ${bold('Planning')} ` +
        dim(`${event.total} steps`))
      break
      
    case 'step_start':
      const total = event.total || currentTotal || 0
      process.stdout.write(
        `${c.cyan('◉')} ${bold(event.description.slice(0, 50))} ` +
        `[${event.step}/${total}] ` +
        dim('running...')
      )
      break
      
    case 'step_complete':
      const elapsed = event.duration > 1000 
        ? `${(event.duration / 1000).toFixed(1)}s` 
        : `${event.duration}ms`
      process.stdout.write(
        `${c.cyan('◉')} ${event.description.slice(0, 50)} ` +
        `[${event.step}/${event.total || '?'}] ` +
        `${c.green('✓')} ${dim(elapsed)}`
      )
      break
      
    case 'step_failed':
      process.stdout.write(
        `${c.cyan('◉')} Step ${event.step} ` +
        `${c.red('✗')} ${event.error.slice(0, 50)} ` +
        dim(`retry ${event.retry}/${event.maxRetries}`)
      )
      break
      
    case 'checkpoint_saved':
      process.stdout.write(
        `${dim('Checkpoint:')} ${event.checkpointId}`
      )
      break
      
    case 'loop_complete':
      process.stdout.write(
        `\n${c.green('✓')} Loop complete ` +
        dim(`(${event.steps} steps, ${(event.duration / 1000).toFixed(0)}s)`)
      )
      break
      
    case 'loop_paused':
      process.stdout.write(
        `\n${c.yellow('⏸')} Loop paused ` +
        dim(`(${event.reason})`)
      )
      break
      
    case 'loop_aborted':
      process.stdout.write(
        `\n${c.red('✗')} Loop aborted ` +
        dim(`(${event.reason})`)
      )
      break
      
    case 'error':
      process.stdout.write(
        `\n${c.red('!')} Loop error: ${event.message}`
      )
      break
  }
  
  process.stdout.write('\n')
}

// ============ Parse IPC ============

function parseIPC(line: string): IPCEvent | null {
  try {
    return JSON.parse(line) as IPCEvent
  } catch {
    return null
  }
}

// ============ Spawn ============

export function spawnLoop(goal: string, cwd?: string): string {
  // Kill existing loop if any
  if (activeLoop) {
    killLoop('new loop started')
  }
  
  // Build path to dist (compiled) or src (dev)
  const agentPath = '/home/tim/nole-code/dist/loop/agent.js'
  
  // Spawn child process
  const child = spawn('node', [agentPath, '--goal', goal], {
    cwd: cwd || process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: { ...process.env },
  })
  
  const checkpointId = `loop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  
  activeLoop = {
    id: checkpointId,
    checkpointId,
    goal,
    child,
    startTime: Date.now(),
  }
  
  // Handle stdout (IPC lines)
  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    for (const line of lines) {
      const event = parseIPC(line)
      if (event) {
        displayProgress(event)
        
        // Update checkpoint ID when saved. The child-emitted id flows into both
        // loadCheckpoint() (a path-join sink) and a git commit message, so only
        // accept it if it matches the known checkpoint-id format produced by
        // createCheckpoint(`loop-<ts>-<rand>`). Anything else is treated as
        // untrusted and ignored, keeping the trusted locally-generated id.
        if (event.type === 'checkpoint_saved') {
          if (activeLoop && /^loop-[0-9]+-[a-z0-9]+$/.test(event.checkpointId)) {
            activeLoop.checkpointId = event.checkpointId
          }
        }
        
        // Handle completion — capture checkpointId before clearing activeLoop
        if (event.type === 'loop_complete') {
          const cpId = activeLoop?.checkpointId
          const onComplete = activeLoop?.onComplete
          activeLoop = null
          if (cpId) notifyComplete(cpId, true, event.errors || 0).catch(() => {})
          onComplete?.({ success: true, errors: event.errors || 0 })
        } else if (event.type === 'loop_paused' || event.type === 'loop_aborted') {
          const cpId = activeLoop?.checkpointId
          activeLoop = null
          if (cpId) notifyComplete(cpId, false, 0).catch(() => {})
        }
      }
    }
  })
  
  // Handle stderr
  child.stderr?.on('data', (data: Buffer) => {
    console.error(dim(`[loop-agent] ${data.toString().trim()}`))
  })
  
  // Handle exit
  child.on('exit', (code) => {
    if (activeLoop) {
      if (code === 0) {
        console.log(dim(`\nLoop agent exited cleanly`))
      } else {
        console.log(dim(`\nLoop agent exited with code ${code}`))
      }
      activeLoop = null
    }
  })
  
  // Unref to allow parent to exit independently
  child.unref()
  
  return checkpointId
}

export function resumeLoop(checkpointId: string): void {
  // Kill existing loop if any
  if (activeLoop) {
    killLoop('resume new loop')
  }
  
  const agentPath = '/home/tim/nole-code/dist/loop/agent.js'
  
  const child = spawn('node', [agentPath, '--resume', checkpointId], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: { ...process.env },
  })
  
  activeLoop = {
    id: checkpointId,
    checkpointId,
    goal: 'resumed',
    child,
    startTime: Date.now(),
  }
  
  // Handle stdout (IPC lines)
  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    for (const line of lines) {
      const event = parseIPC(line)
      if (event) {
        displayProgress(event)
        

      }
    }
  })
  
  child.stderr?.on('data', (data: Buffer) => {
    console.error(dim(`[loop-agent] ${data.toString().trim()}`))
  })
  
  child.on('exit', () => {
    activeLoop = null
  })
  
  child.unref()
}

// ============ Control ============

export function pauseLoop(): boolean {
  if (!activeLoop) return false

  // Send SIGTERM to process group (child + detached grandchild)
  // -pid sends to entire group, catching the detached loop-agent
  const childPid = activeLoop.child.pid
  try {
    if (childPid !== undefined) process.kill(-childPid, 'SIGTERM')
  } catch (e) {
    // Fallback to direct kill if group kill fails
    activeLoop.child.kill('SIGTERM')
  }

  // If still alive after 5s, SIGKILL
  const killTimeout = setTimeout(() => {
    if (activeLoop && !activeLoop.child.killed) {
      const pid = activeLoop.child.pid
      try {
        if (pid !== undefined) process.kill(-pid, 'SIGKILL')
      } catch (error) {
        console.error(`[Loop] Failed to kill process group:`, error instanceof Error ? error.message : String(error))
        activeLoop.child.kill('SIGKILL')
      }
    }
    activeLoop = null
  }, 5000)

  // Return true and let caller clear timeout if needed
  return true
}

export function abortLoop(): boolean {
  if (!activeLoop) return false
  activeLoop.child.kill('SIGKILL')
  activeLoop = null
  return true
}

export function killLoop(reason: string): boolean {
  if (!activeLoop) return false
  console.log(dim(`\nKilling active loop: ${reason}`))
  activeLoop.child.kill('SIGTERM')
  const killTimeout = setTimeout(() => {
    if (activeLoop && !activeLoop.child.killed) {
      activeLoop.child.kill('SIGKILL')
    }
    activeLoop = null
  }, 5000)
  // Return true and let caller clear timeout if needed
  return true
}

// ============ Notification on Loop Complete ============

async function notifyComplete(checkpointId: string, success: boolean, errors: number): Promise<void> {
  const fs = await import('fs')
  const path = await import('path')
  const { getMiniMaxToken } = await import('../index.js')
  const { loadCheckpoint } = await import('./checkpoint.js')
  
  const cp = loadCheckpoint(checkpointId)
  if (!cp) return
  
  const elapsed = ((Date.now() - new Date(cp.createdAt).getTime()) / 1000).toFixed(0)
  const status = success ? '✓ COMPLETE' : '✗ FAILED'
  
  const msg = `[Nole Loop] ${status} in ${elapsed}s\nGoal: ${cp.goal.slice(0, 80)}\nSteps: ${cp.steps.length} | Errors: ${errors}`
  
  // Write to LOOP_COMPLETE.md for grep
  const logPath = path.join(process.env.HOME || '/home/tim', 'LOOP_COMPLETE.md')
  const entry = `\n## ${new Date().toISOString()} — ${status}\n\nGoal: ${cp.goal}\nCheckpoint: ${checkpointId}\nSteps: ${cp.steps.length} | Errors: ${errors} | Duration: ${elapsed}s\n`
  
  try {
    const existing = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''
    fs.writeFileSync(logPath, existing + entry)
  } catch {}
  
  // Auto-commit on successful loop completion
  let commitHash = ''
  if (success) {
    try {
      const { execSync, execFileSync } = require('child_process')
      const cwd = cp.context?.cwd || process.cwd()

      // Check for changes
      const status = execSync('git status --short', { encoding: 'utf-8', cwd }).trim()
      if (status) {
        execSync('git add -A', { cwd })
        // checkpointId is the locally-generated id (see startLoop) and is no
        // longer overwritten by child-emitted values, but use execFileSync with
        // an arg array regardless so the commit message can never be a shell
        // injection vector.
        const commitMsg = `feat: complete loop ${checkpointId}`
        commitHash = execFileSync('git', ['commit', '-m', commitMsg], { encoding: 'utf-8', cwd }).trim()
        
        // Get the actual commit hash
        const hashResult = execSync('git rev-parse HEAD', { encoding: 'utf-8', cwd }).trim()
        commitHash = hashResult.slice(0, 7)
        console.log(dim(`  Auto-committed: ${commitHash}`))
      }
    } catch (e) {
      // Git commit failed (no changes or not a repo) - ignore
    }
  }
  
  // Send Telegram notification (include commit hash if available)
  const tgToken = process.env.TELEGRAM_BOT_TOKEN
  const tgChat = process.env.TELEGRAM_CHAT_ID
  if (tgToken && tgChat) {
    const fullMsg = commitHash 
      ? `${msg}\nCommit: ${commitHash}` 
      : msg
    const url = `https://api.telegram.org/bot${tgToken}/sendMessage`
    fetch(`${url}?chat_id=${tgChat}&text=${encodeURIComponent(fullMsg)}`).catch(() => {})
  }
}
