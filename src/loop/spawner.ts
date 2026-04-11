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
  | { type: 'step_start'; step: number; total: number; description: string }
  | { type: 'step_complete'; step: number; duration: number; description: string }
  | { type: 'step_failed'; step: number; error: string; retry: number; maxRetries: number }
  | { type: 'step_skipped'; step: number; reason: string }
  | { type: 'checkpoint_saved'; checkpointId: string }
  | { type: 'loop_complete'; steps: number; duration: number; errors: number }
  | { type: 'loop_paused'; reason: string; checkpointId: string }
  | { type: 'loop_aborted'; reason: string; checkpointId: string }
  | { type: 'error'; message: string }

// ============ Active Loops ============

let activeLoop: LoopProcess | null = null

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
    case 'step_start':
      process.stdout.write(
        `${c.cyan('◉')} ${bold(event.description.slice(0, 50))} ` +
        `[${event.step}/${event.total}] ` +
        dim('running...')
      )
      break
      
    case 'step_complete':
      const elapsed = event.duration > 1000 
        ? `${(event.duration / 1000).toFixed(1)}s` 
        : `${event.duration}ms`
      process.stdout.write(
        `${c.cyan('◉')} ${event.description.slice(0, 50)} ` +
        `[${event.step}/${event.total}] ` +
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
  const agentPath = join(process.cwd(), 'dist', 'loop', 'agent.js')
  
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
        
        // Update checkpoint ID when saved
        if (event.type === 'checkpoint_saved') {
          if (activeLoop) {
            activeLoop.checkpointId = event.checkpointId
          }
        }
        
        // Handle completion
        if (event.type === 'loop_complete' || event.type === 'loop_paused' || event.type === 'loop_aborted') {
          if (activeLoop) {
            activeLoop.onComplete?.({
              success: event.type === 'loop_complete',
              errors: event.type === 'loop_complete' 
                ? 0 // Will be in the event
                : activeLoop.child.exitCode !== 0 ? 1 : 0,
            })
          }
          activeLoop = null
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
  
  const agentPath = join(process.cwd(), 'dist', 'loop', 'agent.js')
  
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
        
        if (event.type === 'loop_complete' || event.type === 'loop_paused' || event.type === 'loop_aborted') {
          activeLoop = null
        }
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
  
  // SIGTERM gives child 2 seconds to checkpoint, then we SIGKILL
  activeLoop.child.kill('SIGTERM')
  
  // If still alive after 2s, SIGKILL
  setTimeout(() => {
    if (activeLoop && !activeLoop.child.killed) {
      activeLoop.child.kill('SIGKILL')
    }
  }, 2000)
  
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
  setTimeout(() => {
    if (activeLoop && !activeLoop.child.killed) {
      activeLoop.child.kill('SIGKILL')
    }
    activeLoop = null
  }, 2000)
  return true
}
