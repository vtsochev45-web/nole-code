// LocalAgentTask — Run nole-code itself as a background task

import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { EventEmitter } from 'events'
import { type LocalAgentTaskState } from './types.js'

export interface AgentTaskOptions {
  prompt?: string
  sessionId?: string
  runtime?: string
  description?: string
}

export class LocalAgentTask extends EventEmitter {
  private task: LocalAgentTaskState
  private proc?: ChildProcess

  constructor(options: AgentTaskOptions) {
    super()
    const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.task = {
      id,
      type: 'LocalAgentTask',
      status: 'pending',
      description: options.description || options.prompt?.slice(0, 100) || 'Agent task',
      createdAt: Date.now(),
      sessionId: options.sessionId,
      prompt: options.prompt,
      runtime: options.runtime,
      output: [],
    }
  }

  get id(): string {
    return this.task.id
  }

  get state(): LocalAgentTaskState {
    return { ...this.task }
  }

  start(): void {
    if (this.task.status !== 'pending' && this.task.status !== 'stopped') {
      throw new Error(`Cannot start task in status: ${this.task.status}`)
    }

    this.task.status = 'running'
    this.task.startedAt = Date.now()

    // Determine nole-code entry point
    const execPath = process.execPath
    const scriptPath = join(process.cwd(), 'dist/index.js')
    
    // Build args - run in loop mode
    const args = [scriptPath, '--loop']
    
    if (this.task.sessionId) {
      args.push('--session', this.task.sessionId)
    }
    if (this.task.prompt) {
      args.push('--prompt', this.task.prompt)
    }

    this.proc = spawn(execPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: process.cwd(),
    })

    this.task.pid = this.proc.pid

    this.proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n').filter(Boolean)
      lines.forEach(line => {
        this.task.output.push(line)
        this.emit('output', line)
      })
    })

    this.proc.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        this.task.output.push(`[stderr] ${line}`)
        this.emit('error', line)
      }
    })

    this.proc.on('close', (code) => {
      if (code === 0) {
        this.task.status = 'completed'
      } else if (this.task.status === 'running') {
        this.task.status = 'failed'
        this.task.error = `Process exited with code ${code}`
      }
      this.task.completedAt = Date.now()
      this.emit('close', code)
    })

    this.proc.on('error', (err) => {
      this.task.status = 'failed'
      this.task.error = err.message
      this.task.completedAt = Date.now()
      this.emit('error', err)
    })
  }

  stop(): boolean {
    if (!this.proc || this.task.status !== 'running') {
      return false
    }

    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(this.proc.pid), '/f', '/t'])
    } else {
      this.proc.kill('SIGTERM')
      setTimeout(() => {
        if (this.proc && !this.proc.killed) {
          this.proc.kill('SIGKILL')
        }
      }, 5000)
    }

    this.task.status = 'stopped'
    this.task.completedAt = Date.now()
    return true
  }

  getOutput(tail = 50): string[] {
    return this.task.output.slice(-tail)
  }
}

export function createAgentTask(options: AgentTaskOptions): LocalAgentTask {
  return new LocalAgentTask(options)
}
