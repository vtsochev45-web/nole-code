// Nole Code - Plan Mode
// Enter/exit plan mode for step-by-step execution
// Adapted from Nole Code's EnterPlanModeTool/ExitPlanModeTool

import { EventEmitter } from 'events'

export type ExecutionMode = 'execute' | 'plan' | 'review'

interface PlanStep {
  id: string
  description: string
  status: 'pending' | 'approved' | 'rejected' | 'done'
  toolCalls?: Array<{ tool: string; input: Record<string, unknown> }>
}

class PlanMode {
  private mode: ExecutionMode = 'execute'
  private emitter = new EventEmitter()
  private steps: PlanStep[] = []
  private approvedCount = 0

  enter(): void {
    this.mode = 'plan'
    this.steps = []
    this.approvedCount = 0
    this.emitter.emit('modeChange', { mode: 'plan' })
  }

  exit(): void {
    this.mode = 'execute'
    this.steps = []
    this.approvedCount = 0
    this.emitter.emit('modeChange', { mode: 'execute' })
  }

  getMode(): ExecutionMode {
    return this.mode
  }

  isPlanMode(): boolean {
    return this.mode === 'plan'
  }

  // Add a step to the plan
  addStep(step: Omit<PlanStep, 'id' | 'status'>): string {
    const id = `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    this.steps.push({ ...step, id, status: 'pending' })
    this.emitter.emit('stepAdded', { id, step })
    return id
  }

  // Approve a step (or all pending steps)
  approveStep(stepId?: string): void {
    if (stepId) {
      const step = this.steps.find(s => s.id === stepId)
      if (step && step.status === 'pending') {
        step.status = 'approved'
        this.approvedCount++
        this.emitter.emit('stepApproved', { id: stepId })
      }
    } else {
      // Approve all pending steps
      for (const step of this.steps) {
        if (step.status === 'pending') {
          step.status = 'approved'
          this.approvedCount++
        }
      }
      this.emitter.emit('allApproved', {})
    }
  }

  // Reject a step
  rejectStep(stepId: string, reason?: string): void {
    const step = this.steps.find(s => s.id === stepId)
    if (step) {
      step.status = 'rejected'
      this.emitter.emit('stepRejected', { id: stepId, reason })
    }
  }

  // Get next pending step
  getNextStep(): PlanStep | null {
    return this.steps.find(s => s.status === 'pending') || null
  }

  // Get all steps
  getSteps(): PlanStep[] {
    return [...this.steps]
  }

  // Get approved steps
  getApprovedSteps(): PlanStep[] {
    return this.steps.filter(s => s.status === 'approved')
  }

  // Mark a step as done
  completeStep(stepId: string): void {
    const step = this.steps.find(s => s.id === stepId)
    if (step) {
      step.status = 'done'
      this.emitter.emit('stepDone', { id: stepId })
    }
  }

  // Check if plan is complete
  isComplete(): boolean {
    return this.steps.length > 0 && this.steps.every(s => s.status === 'done' || s.status === 'rejected')
  }

  // Get progress
  getProgress(): { total: number; done: number; approved: number; rejected: number } {
    return {
      total: this.steps.length,
      done: this.steps.filter(s => s.status === 'done').length,
      approved: this.steps.filter(s => s.status === 'approved').length,
      rejected: this.steps.filter(s => s.status === 'rejected').length,
    }
  }

  // Summarize plan for user
  summarize(): string {
    if (this.steps.length === 0) return 'No plan yet'

    const lines: string[] = ['📋 Plan:']
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i]
      const icon = step.status === 'done' ? '✅' :
        step.status === 'approved' ? '🔓' :
        step.status === 'rejected' ? '❌' : '⬜'
      lines.push(`  ${i + 1}. ${icon} ${step.description}`)
    }

    const prog = this.getProgress()
    lines.push(`\nProgress: ${prog.done}/${prog.total} done, ${prog.approved} approved`)

    return lines.join('\n')
  }

  // Subscribe to changes
  onModeChange(handler: (data: { mode: ExecutionMode }) => void): () => void {
    this.emitter.on('modeChange', handler)
    return () => this.emitter.off('modeChange', handler)
  }

  onStepApproved(handler: (data: { id: string }) => void): () => void {
    this.emitter.on('stepApproved', handler)
    return () => this.emitter.off('stepApproved', handler)
  }

  onStepDone(handler: (data: { id: string }) => void): () => void {
    this.emitter.on('stepDone', handler)
    return () => this.emitter.off('stepDone', handler)
  }
}

export const planMode = new PlanMode()

// Context management - system context that persists across sessions
export interface ContextEntry {
  key: string
  value: string
  source: 'user' | 'project' | 'session' | 'memory'
  timestamp: string
}

class ContextManager {
  private context: Map<string, ContextEntry> = new Map()
  private emitter = new EventEmitter()

  set(key: string, value: string, source: ContextEntry['source'] = 'session'): void {
    this.context.set(key, { key, value, source, timestamp: new Date().toISOString() })
    this.emitter.emit('change', { key, value })
  }

  get(key: string): string | undefined {
    return this.context.get(key)?.value
  }

  delete(key: string): void {
    this.context.delete(key)
  }

  has(key: string): boolean {
    return this.context.has(key)
  }

  // Get all entries, optionally filtered by source
  entries(source?: ContextEntry['source']): ContextEntry[] {
    const all = Array.from(this.context.values())
    if (source) return all.filter(e => e.source === source)
    return all
  }

  // Build context string for system prompt
  buildContextString(): string {
    const entries = this.entries()
    if (entries.length === 0) return ''

    const lines = ['\n## Context\n']
    for (const entry of entries) {
      lines.push(`**${entry.key}**: ${entry.value}`)
    }
    return lines.join('\n')
  }

  // Load from session
  loadFromSession(sessionContext: Record<string, string>): void {
    for (const [key, value] of Object.entries(sessionContext)) {
      this.set(key, value, 'session')
    }
  }

  // Clear context
  clear(source?: ContextEntry['source']): void {
    if (source) {
      for (const entry of this.entries(source)) {
        this.context.delete(entry.key)
      }
    } else {
      this.context.clear()
    }
  }

  onchange(handler: (data: { key: string; value: string }) => void): () => void {
    this.emitter.on('change', handler)
    return () => this.emitter.off('change', handler)
  }
}

export const context = new ContextManager()

// Environment details for system prompt
export function getEnvironmentDetails(): string {
  const details: string[] = []

  details.push(`Platform: ${process.platform}`)
  details.push(`Node.js: ${process.version}`)
  details.push(`CWD: ${process.cwd()}`)
  details.push(`Home: ${homedir()}`)

  // Git info
  try {
    const branch = execSync('git branch --show-current 2>/dev/null', { encoding: 'utf-8' }).trim()
    if (branch) details.push(`Git branch: ${branch}`)
  } catch {}

  return details.join('\n')
}
