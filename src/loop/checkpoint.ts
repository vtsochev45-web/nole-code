/**
 * Loop Checkpoint System
 * 
 * Persists autonomous loop state to disk for resume after kill/disconnect.
 * Uses the same atomic-write pattern as session manager.
 */

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

// ============ Types ============

export type LoopState = 
  | 'pending'      // Created, not started
  | 'running'       // Currently executing
  | 'paused'       // Manually paused (checkpoint saved)
  | 'waiting'      // Waiting for human confirmation
  | 'complete'      // All steps done
  | 'aborted'      // User aborted
  | 'failed'        // Max retries exceeded

export interface LoopStep {
  id: number
  description: string
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped'
  startedAt?: string
  completedAt?: string
  toolCalls?: Array<{
    name: string
    input: Record<string, unknown>
    result?: string
    success?: boolean
  }>
  error?: string
  retryCount: number
}

export interface Checkpoint {
  id: string
  goal: string                    // Original user goal
  state: LoopState
  steps: LoopStep[]
  currentStep: number
  context: {
    cwd: string
    filesCreated: string[]
    filesModified: string[]
    errorsEncountered: Array<{
      step: number
      error: string
      timestamp: string
    }>
    lastToolResult?: string
    sessionMessages?: Array<{
      role: string
      content: string
      name?: string
    }>
  }
  settings: {
    maxRetries: number
    confirmMajorPivots: boolean
    reportEveryNSteps: number
  }
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// ============ Constants ============

const CHECKPOINT_DIR = join(homedir(), '.nole-code', 'checkpoints')

function ensureCheckpointDir() {
  mkdirSync(CHECKPOINT_DIR, { recursive: true })
}

// ============ Core Operations ============

/**
 * Create a new checkpoint for a goal
 */
export function createCheckpoint(goal: string, cwd: string, settings?: Partial<Checkpoint['settings']>): Checkpoint {
  ensureCheckpointDir()
  
  const id = `loop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()

  const checkpoint: Checkpoint = {
    id,
    goal,
    state: 'pending',
    steps: [],
    currentStep: 0,
    context: {
      cwd,
      filesCreated: [],
      filesModified: [],
      errorsEncountered: [],
    },
    settings: {
      maxRetries: settings?.maxRetries ?? 2,
      confirmMajorPivots: settings?.confirmMajorPivots ?? true,
      reportEveryNSteps: settings?.reportEveryNSteps ?? 3,
    },
    createdAt: now,
    updatedAt: now,
  }

  saveCheckpoint(checkpoint)
  return checkpoint
}

/**
 * Load a checkpoint by ID
 */
export function loadCheckpoint(id: string): Checkpoint | null {
  const file = join(CHECKPOINT_DIR, `${id}.json`)
  if (!existsSync(file)) return null
  
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as Checkpoint
  } catch {
    return null
  }
}

/**
 * Load the most recent checkpoint
 */
export function loadLatestCheckpoint(): Checkpoint | null {
  ensureCheckpointDir()
  const files = readdirSync(CHECKPOINT_DIR).filter(f => f.startsWith('loop-') && f.endsWith('.json'))
  
  if (files.length === 0) return null

  // Sort by modification time, newest first
  files.sort((a, b) => b.localeCompare(a))

  return loadCheckpoint(files[0].replace('.json', ''))
}

/**
 * Save checkpoint with atomic write
 */
export function saveCheckpoint(checkpoint: Checkpoint): void {
  ensureCheckpointDir()
  checkpoint.updatedAt = new Date().toISOString()
  
  const file = join(CHECKPOINT_DIR, `${checkpoint.id}.json`)
  const tmp = file + `.tmp.${Date.now()}`
  
  writeFileSync(tmp, JSON.stringify(checkpoint, null, 2), 'utf-8')
  renameSync(tmp, file)
}

/**
 * Delete a checkpoint
 */
export function deleteCheckpoint(id: string): boolean {
  const file = join(CHECKPOINT_DIR, `${id}.json`)
  if (existsSync(file)) {
    unlinkSync(file)
    return true
  }
  return false
}

/**
 * List all checkpoints
 */
export function listCheckpoints(limit = 10): Checkpoint[] {
  ensureCheckpointDir()
  const files = readdirSync(CHECKPOINT_DIR).filter(f => f.startsWith('loop-') && f.endsWith('.json'))
  
  const checkpoints = files
    .map(f => loadCheckpoint(f.replace('.json', '')))
    .filter(Boolean) as Checkpoint[]
  
  // Sort by updatedAt, newest first
  checkpoints.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  
  return checkpoints.slice(0, limit)
}

// ============ Step Operations ============

/**
 * Add a step to the checkpoint
 */
export function addStep(checkpoint: Checkpoint, description: string): LoopStep {
  const step: LoopStep = {
    id: checkpoint.steps.length,
    description,
    status: 'pending',
    retryCount: 0,
  }
  checkpoint.steps.push(step)
  saveCheckpoint(checkpoint)
  return step
}

/**
 * Set steps from planner
 */
export function setSteps(checkpoint: Checkpoint, steps: string[]): void {
  checkpoint.steps = steps.map((description, i) => ({
    id: i,
    description,
    status: 'pending' as const,
    retryCount: 0,
  }))
  saveCheckpoint(checkpoint)
}

/**
 * Update current step status
 */
export function startStep(checkpoint: Checkpoint, stepId?: number): LoopStep {
  const id = stepId ?? checkpoint.currentStep
  const step = checkpoint.steps[id]
  if (!step) throw new Error(`Step ${id} not found`)
  
  step.status = 'running'
  step.startedAt = new Date().toISOString()
  checkpoint.currentStep = id
  checkpoint.state = 'running'
  saveCheckpoint(checkpoint)
  return step
}

/**
 * Complete a step
 */
export function completeStep(
  checkpoint: Checkpoint, 
  stepId: number, 
  toolCalls: LoopStep['toolCalls'] = []
): LoopStep {
  const step = checkpoint.steps[stepId]
  if (!step) throw new Error(`Step ${stepId} not found`)
  
  step.status = 'complete'
  step.completedAt = new Date().toISOString()
  step.toolCalls = toolCalls
  
  // Track created/modified files
  for (const tc of toolCalls ?? []) {
    if (tc.name === 'Write' || tc.name === 'Edit') {
      const path = tc.input.path as string
      if (path && !checkpoint.context.filesCreated.includes(path)) {
        checkpoint.context.filesCreated.push(path)
      }
    }
    if (tc.name === 'Bash') {
      const cmd = tc.input.command as string
      if (cmd?.includes('git commit')) {
        // Git commit = modified files
      }
    }
  }
  
  checkpoint.currentStep = stepId + 1
  saveCheckpoint(checkpoint)
  return step
}

/**
 * Fail a step with error
 */
export function failStep(
  checkpoint: Checkpoint,
  stepId: number,
  error: string,
  toolCalls: LoopStep['toolCalls'] = []
): LoopStep {
  const step = checkpoint.steps[stepId]
  if (!step) throw new Error(`Step ${stepId} not found`)
  
  step.status = 'failed'
  step.error = error
  step.completedAt = new Date().toISOString()
  step.toolCalls = toolCalls
  step.retryCount++
  
  checkpoint.context.errorsEncountered.push({
    step: stepId,
    error,
    timestamp: new Date().toISOString(),
  })
  
  checkpoint.context.lastToolResult = error
  saveCheckpoint(checkpoint)
  return step
}

/**
 * Skip a step
 */
export function skipStep(checkpoint: Checkpoint, stepId: number): LoopStep {
  const step = checkpoint.steps[stepId]
  if (!step) throw new Error(`Step ${stepId} not found`)
  
  step.status = 'skipped'
  step.completedAt = new Date().toISOString()
  checkpoint.currentStep = stepId + 1
  saveCheckpoint(checkpoint)
  return step
}

// ============ State Transitions ============

export function pauseCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.state = 'paused'
  saveCheckpoint(checkpoint)
}

export function resumeCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.state = 'running'
  saveCheckpoint(checkpoint)
}

export function waitForConfirmation(checkpoint: Checkpoint): void {
  checkpoint.state = 'waiting'
  saveCheckpoint(checkpoint)
}

export function completeCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.state = 'complete'
  checkpoint.completedAt = new Date().toISOString()
  saveCheckpoint(checkpoint)
}

export function abortCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.state = 'aborted'
  saveCheckpoint(checkpoint)
}

// ============ Query Helpers ============

/**
 * Get progress summary
 */
export function getProgress(checkpoint: Checkpoint): {
  current: number
  total: number
  percent: number
  currentStep?: LoopStep
} {
  const total = checkpoint.steps.length
  const current = checkpoint.currentStep
  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  
  return {
    current,
    total,
    percent,
    currentStep: checkpoint.steps[current],
  }
}

/**
 * Check if should continue or abort
 */
export function shouldContinue(checkpoint: Checkpoint): { continue: boolean; reason?: string } {
  const currentStep = checkpoint.steps[checkpoint.currentStep]
  
  if (!currentStep) {
    return { continue: true } // No more steps
  }
  
  if (currentStep.retryCount >= (checkpoint.settings?.maxRetries ?? 2)) {
    return { 
      continue: false, 
      reason: `Max retries (${checkpoint.settings?.maxRetries ?? 2}) exceeded on step ${checkpoint.currentStep}` 
    }
  }
  
  if (checkpoint.state === 'aborted') {
    return { continue: false, reason: 'Checkpoint aborted' }
  }
  
  return { continue: true }
}

/**
 * Build error context for retry prompt injection
 */
export function buildRetryContext(checkpoint: Checkpoint, stepId: number): string {
  const step = checkpoint.steps[stepId]
  if (!step) return ''
  
  const errors = checkpoint.context.errorsEncountered.filter(e => e.step === stepId)
  
  if (errors.length === 0) return ''
  
  const lastError = errors[errors.length - 1].error
  const lines: string[] = []
  
  lines.push(`\n<!-- Retry ${step.retryCount + 1}/${checkpoint.settings?.maxRetries ?? 2} -->`)
  lines.push(`\nPrevious attempt failed:`)
  lines.push(`  Error: ${lastError}`)
  
  // Extract actionable hints from common errors
  const hint = inferErrorHint(lastError)
  if (hint) {
    lines.push(`  Hint: ${hint}`)
  }
  
  lines.push(`\nTry a DIFFERENT approach this time:`)
  lines.push(`- Do NOT repeat the same command`)
  lines.push(`- Consider: create parent directories first, check permissions, use different tool`)
  lines.push(`- Goal: ${checkpoint.goal}`)
  
  return lines.join('\n')
}

function inferErrorHint(error: string): string | null {
  const e = error.toLowerCase()
  
  if (e.includes('enoent') || e.includes('no such file')) {
    if (e.includes('directory') || e.includes('/')) {
      return 'Parent directory may not exist. Try: mkdir -p first'
    }
    return 'File does not exist. Verify path or create file first'
  }
  if (e.includes('permission denied')) {
    return 'Check file/directory permissions or run with elevated access'
  }
  if (e.includes('eacces')) {
    return 'Permission issue. Try chmod or different location'
  }
  if (e.includes('enospc')) {
    return 'Disk space may be full. Check: df -h'
  }
  if (e.includes('etimedout') || e.includes('timeout')) {
    return 'Connection timed out. Check network or retry with longer timeout'
  }
  if (e.includes('econnrefused')) {
    return 'Connection refused. Check service is running'
  }
  if (e.includes('command not found') || e.includes('not found')) {
    return 'Command/tool not available. Try alternative approach'
  }
  if (e.includes('parse error') || e.includes('syntax')) {
    return 'Parse/syntax error. Check input format'
  }
  return null
}
