// TaskManager — Manages all background tasks

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'
import { type TaskState, type TaskStatus } from './types.js'
import { LocalShellTask, createShellTask } from './LocalShellTask/index.js'
import { LocalAgentTask, createAgentTask } from './LocalAgentTask/index.js'
import { DreamTask, createDreamTask } from './DreamTask/index.js'

const TASKS_FILE = join(homedir(), '.nole-code', 'tasks.json')

interface TaskEntry {
  task: TaskState
  type: 'shell' | 'agent' | 'dream'
}

// Ensure tasks file exists
function ensureTasksFile(): void {
  const dir = dirname(TASKS_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  if (!existsSync(TASKS_FILE)) {
    writeFileSync(TASKS_FILE, JSON.stringify({}, null, 2))
  }
}

function loadTasksFile(): Record<string, TaskEntry> {
  try {
    ensureTasksFile()
    const data = readFileSync(TASKS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

function saveTasksFile(tasks: Record<string, TaskEntry>): void {
  ensureTasksFile()
  writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2))
}

export class TaskManager extends EventEmitter {
  private tasks = new Map<string, TaskState>()
  private runners = new Map<string, LocalShellTask | LocalAgentTask | DreamTask>()
  private fileData: Record<string, TaskEntry> = {}

  constructor() {
    super()
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    this.fileData = loadTasksFile()
    for (const [id, entry] of Object.entries(this.fileData)) {
      // Only load non-running tasks from disk
      if (entry.task.status !== 'running') {
        this.tasks.set(id, entry.task)
      }
    }
  }

  private saveToDisk(): void {
    const data: Record<string, TaskEntry> = {}
    for (const [id, task] of this.tasks) {
      const entry = this.fileData[id]
      const type = entry?.type || this.inferType(task)
      data[id] = { task, type }
    }
    saveTasksFile(data)
    this.fileData = data
  }

  private inferType(task: TaskState): 'shell' | 'agent' | 'dream' {
    switch (task.type) {
      case 'LocalShellTask': return 'shell'
      case 'LocalAgentTask': return 'agent'
      case 'DreamTask': return 'dream'
      default: return 'shell'
    }
  }

  addShellTask(command: string, cwd?: string, description?: string): string {
    const shellTask = createShellTask({ command, cwd, description })
    const state = shellTask.state
    
    this.tasks.set(state.id, state)
    this.runners.set(state.id, shellTask)
    this.saveToDisk()

    shellTask.on('output', (line: string) => this.emit('output', state.id, line))
    shellTask.on('error', (line: string) => this.emit('error', state.id, line))
    shellTask.on('close', (code: number) => {
      this.updateTaskState(state.id)
      this.emit('close', state.id, code)
    })

    shellTask.start()
    this.updateTaskState(state.id)
    
    return state.id
  }

  addAgentTask(prompt?: string, sessionId?: string, runtime?: string, description?: string): string {
    const agentTask = createAgentTask({ prompt, sessionId, runtime, description })
    const state = agentTask.state
    
    this.tasks.set(state.id, state)
    this.runners.set(state.id, agentTask)
    this.saveToDisk()

    agentTask.on('output', (line: string) => this.emit('output', state.id, line))
    agentTask.on('error', (line: string) => this.emit('error', state.id, line))
    agentTask.on('close', (code: number) => {
      this.updateTaskState(state.id)
      this.emit('close', state.id, code)
    })

    agentTask.start()
    this.updateTaskState(state.id)
    
    return state.id
  }

  async addDreamTask(prompt: string, model?: string, description?: string): Promise<string> {
    const dreamTask = createDreamTask({ prompt, model, description })
    const state = dreamTask.state
    
    this.tasks.set(state.id, state)
    this.runners.set(state.id, dreamTask)
    this.saveToDisk()

    dreamTask.on('output', (line: string) => this.emit('output', state.id, line))
    dreamTask.on('error', (line: string) => this.emit('error', state.id, line))
    dreamTask.on('close', (code: number) => {
      this.updateTaskState(state.id)
      this.emit('close', state.id, code)
    })

    await dreamTask.start()
    this.updateTaskState(state.id)
    
    return state.id
  }

  private updateTaskState(id: string): void {
    const runner = this.runners.get(id)
    const task = this.tasks.get(id)
    if (runner && task) {
      const state = runner.state
      task.status = state.status
      task.output = state.output
      task.error = state.error
      task.startedAt = state.startedAt
      task.completedAt = state.completedAt
      if ('generatedContent' in state) {
        task.generatedContent = state.generatedContent
      }
      this.saveToDisk()
    }
  }

  getTask(id: string): TaskState | undefined {
    return this.tasks.get(id)
  }

  listTasks(): Array<{ id: string; status: TaskStatus; description: string; type: string }> {
    return Array.from(this.tasks.values()).map(t => ({
      id: t.id,
      status: t.status,
      description: t.description,
      type: t.type,
    }))
  }

  stopTask(id: string): boolean {
    const runner = this.runners.get(id)
    if (!runner) return false
    
    const result = runner.stop()
    this.updateTaskState(id)
    return result
  }

  removeTask(id: string): boolean {
    const existed = this.tasks.has(id)
    this.tasks.delete(id)
    this.runners.delete(id)
    
    // Also remove from disk
    const data = loadTasksFile()
    delete data[id]
    saveTasksFile(data)
    this.fileData = data
    
    return existed
  }

  getTaskOutput(id: string, tail = 50): string[] {
    const runner = this.runners.get(id)
    if (runner) {
      return runner.getOutput(tail)
    }
    const task = this.tasks.get(id)
    return task?.output.slice(-tail) || []
  }
}

// Singleton
export const taskManager = new TaskManager()
