// Nole Code - Server API
// HTTP endpoints using Bun.serve()

import { TaskManager, type Task, type TaskType } from '../tasks/manager.js'
import { requireAuth, authenticate } from './auth.js'

const VERSION = '0.1.0'
const startTime = Date.now()

function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000)
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}

// Task storage (in-memory for now)
const taskManager = new TaskManager()
const wsClients = new Set<Bun.WebSocket>()

export function addWsClient(ws: Bun.WebSocket) {
  wsClients.add(ws)
}

export function removeWsClient(ws: Bun.WebSocket) {
  wsClients.delete(ws)
}

export function broadcastTaskEvent(event: unknown) {
  const message = JSON.stringify(event)
  wsClients.forEach(ws => {
    if (ws.readyState === Bun.WebSocket.OPEN) {
      ws.send(message)
    }
  })
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method
  const path = url.pathname

  // Health check (public)
  if (path === '/health' && method === 'GET') {
    return jsonResponse({
      status: 'ok',
      version: VERSION,
      uptime: getUptime(),
    })
  }

  // WebSocket upgrade
  if (path === '/ws') {
    // Handle WebSocket upgrade
    const success = server.upgrade(request)
    if (!success) {
      return errorResponse(400, 'WebSocket upgrade failed')
    }
    return new Response(null)
  }

  // All other routes require auth
  const authError = requireAuth(request)
  if (authError) return authError

  // API Routes
  try {
    // GET /tasks - List all tasks
    if (path === '/tasks' && method === 'GET') {
      const tasks = taskManager.listTasks()
      return jsonResponse({ tasks })
    }

    // POST /tasks - Create a new task
    if (path === '/tasks' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { goal, type = 'shell' } = body as { goal?: string; type?: TaskType }
      
      if (!goal) {
        return errorResponse(400, 'Missing required field: goal')
      }
      
      if (type !== 'loop' && type !== 'shell') {
        return errorResponse(400, 'Invalid type: must be "loop" or "shell"')
      }
      
      const task = taskManager.createTask(goal, type)
      
      // Broadcast task creation
      broadcastTaskEvent({
        type: 'task:created',
        task: { id: task.id, goal: task.goal, type: task.type, status: task.status },
      })
      
      return jsonResponse({ task })
    }

    // GET /tasks/:id - Get task status
    const taskIdMatch = path.match(/^\/tasks\/([^/]+)$/)
    if (path.startsWith('/tasks/') && method === 'GET' && taskIdMatch) {
      const taskId = taskIdMatch[1]
      const task = taskManager.getTask(taskId)
      
      if (!task) {
        return errorResponse(404, `Task not found: ${taskId}`)
      }
      
      return jsonResponse({ task })
    }

    // DELETE /tasks/:id - Stop and remove task
    if (path.startsWith('/tasks/') && method === 'DELETE' && taskIdMatch) {
      const taskId = taskIdMatch[1]
      const stopped = taskManager.stopTask(taskId)
      
      if (!stopped) {
        return errorResponse(404, `Task not found: ${taskId}`)
      }
      
      // Broadcast task deletion
      broadcastTaskEvent({
        type: 'task:deleted',
        taskId,
      })
      
      return jsonResponse({ success: true, taskId })
    }

    // POST /chat - Send message to REPL
    if (path === '/chat' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { message } = body as { message?: string }
      
      if (!message) {
        return errorResponse(400, 'Missing required field: message')
      }
      
      // TODO: Integrate with REPL/message system
      // For now, return the message that would be sent
      return jsonResponse({
        success: true,
        message: 'Message queued',
        original: message,
      })
    }

    // 404 for unknown routes
    return errorResponse(404, 'Not found')
  } catch (e) {
    const err = e as Error
    return errorResponse(500, err.message || 'Internal server error')
  }
}

// Bun server instance (set from index.ts)
let server: Bun.Server

export function setServer(s: Bun.Server) {
  server = s
}