// Task Types — Unified task state for background task system

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped'

// Base task interface
export interface BaseTask {
  id: string
  status: TaskStatus
  description: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  output: string[]
  error?: string
}

// LocalShellTask — runs a shell command in the background
export interface LocalShellTaskState extends BaseTask {
  type: 'LocalShellTask'
  command: string
  cwd?: string
  pid?: number
}

// LocalAgentTask — runs nole-code itself as a background task
export interface LocalAgentTaskState extends BaseTask {
  type: 'LocalAgentTask'
  sessionId?: string
  prompt?: string
  runtime?: string
}

// RemoteAgentTask — runs a task on a remote agent (future)
export interface RemoteAgentTaskState extends BaseTask {
  type: 'RemoteAgentTask'
  target: string
  task: string
}

// DreamTask — a "dream" task that runs in background with optional LLM generation
export interface DreamTaskState extends BaseTask {
  type: 'DreamTask'
  prompt: string
  model?: string
  generatedContent?: string
}

// Union type for all task states
export type TaskState = LocalShellTaskState | LocalAgentTaskState | RemoteAgentTaskState | DreamTaskState
