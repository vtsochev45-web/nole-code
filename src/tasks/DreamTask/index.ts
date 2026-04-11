// DreamTask — A "dream" task that runs in background with optional LLM generation

import { EventEmitter } from 'events'
import { type DreamTaskState } from './types.js'

export interface DreamTaskOptions {
  prompt: string
  description?: string
  model?: string
}

export class DreamTask extends EventEmitter {
  private task: DreamTaskState
  private running = false

  constructor(options: DreamTaskOptions) {
    super()
    const id = `dream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.task = {
      id,
      type: 'DreamTask',
      status: 'pending',
      description: options.description || options.prompt.slice(0, 100),
      createdAt: Date.now(),
      prompt: options.prompt,
      model: options.model,
      output: [],
    }
  }

  get id(): string {
    return this.task.id
  }

  get state(): DreamTaskState {
    return { ...this.task }
  }

  async start(): Promise<void> {
    if (this.task.status !== 'pending' && this.task.status !== 'stopped') {
      throw new Error(`Cannot start task in status: ${this.task.status}`)
    }

    this.task.status = 'running'
    this.task.startedAt = Date.now()
    this.running = true

    this.task.output.push(`[Dream] Starting dream task: ${this.task.prompt.slice(0, 50)}...`)
    this.emit('output', this.task.output[this.task.output.length - 1])

    try {
      // Dynamically import to avoid circular deps
      const { chat } = await import('../api/llm.js')
      
      const model = this.task.model || 'MiniMax-M2.7'
      
      this.task.output.push(`[Dream] Generating content with ${model}...`)
      this.emit('output', this.task.output[this.task.output.length - 1])

      // Run the LLM call
      const result = await chat({
        messages: [
          { role: 'system', content: 'You are a creative assistant. Generate content based on the user prompt.' },
          { role: 'user', content: this.task.prompt }
        ],
        model,
      })

      this.task.generatedContent = result.content
      this.task.output.push(`[Dream] Generated ${result.content.length} chars`)
      this.emit('output', this.task.output[this.task.output.length - 1])

      this.task.status = 'completed'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.task.status = 'failed'
      this.task.error = msg
      this.task.output.push(`[Dream] Error: ${msg}`)
      this.emit('error', msg)
    }

    this.task.completedAt = Date.now()
    this.running = false
    this.emit('close', this.task.status === 'completed' ? 0 : 1)
  }

  stop(): boolean {
    if (!this.running || this.task.status !== 'running') {
      return false
    }

    // Note: Cannot actually stop async LLM call, but we mark as stopped
    this.task.status = 'stopped'
    this.task.completedAt = Date.now()
    this.running = false
    this.emit('close', 130) // SIGTERM
    return true
  }

  getOutput(tail = 50): string[] {
    return this.task.output.slice(-tail)
  }
}

export function createDreamTask(options: DreamTaskOptions): DreamTask {
  return new DreamTask(options)
}
