// Tasks Module — Background task system
// 
// Provides: LocalShellTask, LocalAgentTask, DreamTask, TaskManager
// 
// Usage:
//   const { taskManager } = await import('./tasks/index.js')
//   const taskId = taskManager.addShellTask('npm run build')
//   taskManager.listTasks()
//   taskManager.stopTask(taskId)
//   taskManager.getTaskOutput(taskId)

export { taskManager, TaskManager } from './manager.js'
export type { TaskState, TaskStatus, BaseTask, LocalShellTaskState, LocalAgentTaskState, RemoteAgentTaskState, DreamTaskState } from './types.js'
export { createShellTask, LocalShellTask } from './LocalShellTask/index.js'
export { createAgentTask, LocalAgentTask } from './LocalAgentTask/index.js'
export { createDreamTask, DreamTask } from './DreamTask/index.js'
