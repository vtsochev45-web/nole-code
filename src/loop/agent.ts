/**
 * Loop Agent — Background loop executor with JSON IPC
 * 
 * Runs executor.ts in background, emits JSON lines to stdout for parent to parse.
 * Parent process handles display, this handles execution.
 */

import { runLoop } from './executor.js'
import { Checkpoint } from './checkpoint.js'

// ============ IPC Protocol ============

type IPCEvent =
  | { type: 'plan_ready'; total: number; goal: string }
  | { type: 'step_start'; step: number; total: number; description: string }
  | { type: 'step_complete'; step: number; duration: number; description: string }
  | { type: 'step_failed'; step: number; error: string; retry: number; maxRetries: number }
  | { type: 'step_skipped'; step: number; reason: string }
  | { type: 'checkpoint_saved'; checkpointId: string }
  | { type: 'loop_complete'; steps: number; duration: number; errors: number }
  | { type: 'loop_paused'; reason: string; checkpointId: string }
  | { type: 'loop_aborted'; reason: string; checkpointId: string }
  | { type: 'error'; message: string }

function emit(event: IPCEvent): void {
  process.stdout.write(JSON.stringify(event) + '\n')
}

// ============ Intercept Executor ============

// We need to intercept executor events. Since executor is synchronous-ish,
// we'll wrap the checkpoint loading to detect step transitions.

let lastCheckpoint: Checkpoint | null = null
let stepCheckInterval: ReturnType<typeof setInterval> | null = null

function startStepWatcher(checkpointId: string): void {
  // Poll checkpoint every 500ms and detect changes
  stepCheckInterval = setInterval(async () => {
    const { loadCheckpoint } = await import('./checkpoint.js')
    const cp = loadCheckpoint(checkpointId)
    if (!cp) return
    
    const total = cp.steps.length
    
    // Check each step for status changes
    for (let i = 0; i < cp.steps.length; i++) {
      const step = cp.steps[i]
      const lastStep = lastCheckpoint?.steps[i]
      
      // Detect new running state
      if (step.status === 'running' && lastStep?.status !== 'running') {
        emit({
          type: 'step_start',
          step: i,
          total,
          description: step.description,
        })
      }
      
      // Detect completion
      if (step.status === 'complete' && lastStep?.status !== 'complete') {
        const started = step.startedAt ? new Date(step.startedAt).getTime() : 0
        const completed = step.completedAt ? new Date(step.completedAt).getTime() : Date.now()
        emit({
          type: 'step_complete',
          step: i,
          duration: completed - started,
          description: step.description,
        })
      }
      
      // Detect failure
      if (step.status === 'failed' && lastStep?.status !== 'failed') {
        emit({
          type: 'step_failed',
          step: i,
          error: step.error || 'Unknown error',
          retry: step.retryCount,
          maxRetries: cp.settings.maxRetries,
        })
      }
      
      // Detect skip
      if (step.status === 'skipped' && lastStep?.status !== 'skipped') {
        emit({
          type: 'step_skipped',
          step: i,
          reason: step.error || 'User skipped',
        })
      }
    }
    
    // Detect state changes
    if (lastCheckpoint && cp.state !== lastCheckpoint.state) {
      if (cp.state === 'complete') {
        emit({
          type: 'loop_complete',
          steps: total,
          duration: Date.now() - new Date(cp.createdAt).getTime(),
          errors: cp.context.errorsEncountered.length,
        })
        cleanup()
      } else if (cp.state === 'paused') {
        emit({
          type: 'loop_paused',
          reason: 'Checkpoint saved',
          checkpointId: cp.id,
        })
        cleanup()
      } else if (cp.state === 'aborted') {
        emit({
          type: 'loop_aborted',
          reason: cp.context.errorsEncountered.length > 0 
            ? 'Max retries exceeded' 
            : 'User aborted',
          checkpointId: cp.id,
        })
        cleanup()
      }
    }
    
    lastCheckpoint = cp
    
    // Check if done
    if (cp.state === 'complete' || cp.state === 'aborted' || cp.state === 'paused') {
      cleanup()
    }
  }, 500)
}

function cleanup(): void {
  if (stepCheckInterval) {
    clearInterval(stepCheckInterval)
    stepCheckInterval = null
  }
}

// ============ Signal Handling ============

function setupSignalHandlers(checkpointId: string): void {
  const { pauseCheckpoint, saveCheckpoint, loadCheckpoint } = require('./checkpoint.js')
  
  // SIGTERM - checkpoint and exit gracefully
  process.on('SIGTERM', async () => {
    cleanup()
    const { loadCheckpoint, saveCheckpoint } = await import('./checkpoint.js')
    const cp = loadCheckpoint(checkpointId)
    if (cp) {
      const updated = { ...cp, state: 'paused' as const }
      saveCheckpoint(updated)
      emit({
        type: 'loop_paused',
        reason: 'SIGTERM received',
        checkpointId: cp.id,
      })
    }
    // Give time for emit to flush before exit
    await new Promise(r => setTimeout(r, 500))
    process.exit(0)
  })
  
  // SIGINT - same as SIGTERM
  process.on('SIGINT', async () => {
    cleanup()
    const { loadCheckpoint, saveCheckpoint } = await import('./checkpoint.js')
    const cp = loadCheckpoint(checkpointId)
    if (cp) {
      const updated = { ...cp, state: 'paused' as const }
      saveCheckpoint(updated)
      emit({
        type: 'loop_paused',
        reason: 'SIGINT received',
        checkpointId: cp.id,
      })
    }
    await new Promise(r => setTimeout(r, 500))
    process.exit(0)
  })
}

// ============ Main ============

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  
  if (args[0] === '--resume') {
    // Resume mode
    const checkpointId = args[1]
    if (!checkpointId) {
      emit({ type: 'error', message: 'Missing checkpoint ID' })
      process.exit(1)
    }
    
    setupSignalHandlers(checkpointId)
    startStepWatcher(checkpointId)
    
    try {
      const { resumeLoop } = await import('./executor.js')
      await resumeLoop(checkpointId)
    } catch (err) {
      emit({ type: 'error', message: String(err) })
      process.exit(1)
    }
  } else if (args[0] === '--goal') {
    // New goal mode
    const goal = args.slice(1).join(' ')
    if (!goal) {
      emit({ type: 'error', message: 'Missing goal' })
      process.exit(1)
    }
    
    const cwd = process.cwd()
    
    // Run planner first to get checkpoint ID
    try {
      const { createCheckpoint, setSteps } = await import('./checkpoint.js')
      const { getMiniMaxToken } = await import('../index.js')
      const { LLMClient } = await import('../api/llm.js')
      const { loadSettings } = await import('../project/onboarding.js')
      
      const settings = loadSettings()
      const token = getMiniMaxToken()
      const client = new LLMClient(token, settings.model || 'MiniMax-M2.7')
      
      const cp = createCheckpoint(goal, cwd)
      
      // Plan steps
      emit({ type: 'checkpoint_saved', checkpointId: cp.id })
      
      const { planSteps } = await import('./executor.js')
      const steps = await planSteps(goal, client, cwd)
      setSteps(cp, steps)
      
      // Emit plan_ready with total steps before any step_start
      emit({ type: 'plan_ready', total: steps.length, goal })
      
      setupSignalHandlers(cp.id)
      startStepWatcher(cp.id)
      
      const { runLoop } = await import('./executor.js')
      await runLoop({ goal, cwd, checkpointId: cp.id })
    } catch (err) {
      emit({ type: 'error', message: String(err) })
      process.exit(1)
    }
  } else {
    emit({ type: 'error', message: 'Usage: loop-agent --goal <goal> or --resume <checkpointId>' })
    process.exit(1)
  }
  
  cleanup()
  process.exit(0)
}

main()
