// LocalShellTask — Run a shell command as a background task

import { spawn, ChildProcess } from 'child_process'
import { type LocalShellTaskState } from './types.js'
import { EventEmitter } from 'events'

export interface ShellTaskOptions {
  command: string
  cwd?: string
  description?: string
  env?: Record<string, string>
}

export class LocalShellTask extends EventEmitter {
  private task: LocalShellTaskState
  private proc?: ChildProcess
  private startTime?: number

  constructor(options: ShellTaskOptions) {
    super()
    const id = `shell_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.task = {
      id,
      type: 'LocalShellTask',
      status: 'pending',
      description: options.description || options.command,
      createdAt: Date.now(),
      command: options.command,
      cwd: options.cwd,
      output: [],
    }
  }

  get id(): string {
    return this.task.id
  }

  get state(): LocalShellTaskState {
    return { ...this.task }
  }

  start(): void {
    if (this.task.status !== 'pending' && this.task.status !== 'stopped') {
      throw new Error(`Cannot start task in status: ${this.task.status}`)
    }

    this.task.status = 'running'
    this.task.startedAt = Date.now()
    this.startTime = Date.now()

    const { command, cwd, env } = this.task
    
    // Parse command for spawn
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command]
    
    this.proc = spawn(shell, shellArgs, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.task.pid = this.proc.pid

    this.proc.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        this.task.output.push(line)
        this.emit('output', line)
      }
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
      // Force kill after 5s if still running
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

export function createShellTask(options: ShellTaskOptions): LocalShellTask {
  return new LocalShellTask(options)
}
