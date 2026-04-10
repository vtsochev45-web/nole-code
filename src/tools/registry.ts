// Nole Code - Tool Registry
// All tools registered here for LLM use
// Adapted from Nole Code's tool architecture

import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'
import { homedir } from 'os'
import { webSearch, webFetch } from './web.js'
import { mcpRegistry } from '../mcp/client.js'
import { spawnAgent, onAgentMessage } from '../agents/spawner.js'
import { createTeam } from '../agents/team.js'
import { checkCommandSecurity, validatePath } from '../permissions/bash-security.js'
import { logToolCall } from '../utils/audit.js'
import { checkPermission, type PermissionContext } from '../permissions/rules-engine.js'
import { feature } from '../feature-flags/index.js'
import type { ToolDefinition } from '../api/llm.js'

const execAsync = promisify(exec)

// Interactive permission prompt
async function promptPermission(toolName: string, input: Record<string, unknown>, reason: string): Promise<boolean> {
  const preview = toolName === 'Bash' && input.command
    ? String(input.command).slice(0, 80)
    : JSON.stringify(input).slice(0, 80)

  return new Promise((resolve) => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout })
    const prompt = `\n\x1b[33m⚠ Permission required:\x1b[0m ${toolName}(${preview})\n  Reason: ${reason}\n  Allow? [y/n]: `
    rl.question(prompt, (answer: string) => {
      rl.close()
      const yes = ['y', 'yes', ''].includes(answer.trim().toLowerCase())
      resolve(yes)
    })
  })
}

// ============ Tool Definitions ============

export interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>
}

export interface ToolContext {
  cwd: string
  sessionId: string
}

// Tool registry
const tools = new Map<string, Tool>()

export function registerTool(tool: Tool) {
  tools.set(tool.name, tool)
}

export function getToolDefinitions(): ToolDefinition[] {
  const defs: ToolDefinition[] = Array.from(tools.values()).map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))

  // Add MCP tools (if registry has tools)
  const mcpTools = mcpRegistry.getTools()
  if (mcpTools.length > 0) {
    defs.push(...mcpTools)
  }

  return defs
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ content: string; isError?: boolean }> {
  const toolStart = Date.now()

  // Permission check
  if (feature('PERMISSION_RULES')) {
    const permCtx: PermissionContext = {
      mode: 'default',
      toolName: name,
      input,
      cwd: ctx.cwd,
    }
    const perm = checkPermission(permCtx)
    if (perm.result === 'deny') {
      return { content: `Permission denied: ${perm.reason}`, isError: true }
    }
    if (perm.result === 'ask') {
      const allowed = await promptPermission(name, input, perm.reason)
      if (!allowed) {
        return { content: `Permission denied by user: ${name}`, isError: true }
      }
    }
  }

  // Bash security check
  if (name === 'Bash' && typeof input.command === 'string') {
    const security = checkCommandSecurity(input.command)
    if (!security.allowed && security.risk === 'critical') {
      return {
        content: `Blocked: ${security.reason}\nDangerous patterns: ${security.dangerousPatterns?.join(', ') || 'unknown'}`,
        isError: true,
      }
    }
  }

  // Execute and audit log
  let result: { content: string; isError?: boolean }

  // Check if it's an MCP tool
  const mcpParsed = mcpRegistry.parseMCPToolName(name)
  if (mcpParsed) {
    try {
      const content = await mcpRegistry.callTool(mcpParsed.server, mcpParsed.tool, input)
      result = { content }
    } catch (err) {
      result = { content: `MCP error: ${err}`, isError: true }
    }
  } else {
    const tool = tools.get(name)
    if (!tool) {
      result = { content: `Tool ${name} not found`, isError: true }
    } else {
      try {
        const content = await tool.execute(input, ctx)
        result = { content }
      } catch (err) {
        result = { content: `Error: ${err}`, isError: true }
      }
    }
  }

  // Audit log
  logToolCall({
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    tool: name,
    input,
    resultLength: result.content.length,
    isError: result.isError || false,
    durationMs: Date.now() - toolStart,
  })

  return result
}

// ============ Built-in Shell ============

async function runBash(command: string, timeout = 30000): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      cwd: process.cwd(),
      shell: '/bin/bash',
      maxBuffer: 10 * 1024 * 1024,
    })
    let out = stdout
    if (stderr) out += `\nSTDERR: ${stderr}`
    return out || '(no output)'
  } catch (e: unknown) {
    const err = e as { message?: string; stdout?: string; stderr?: string }
    let out = err.message || 'Unknown error'
    if (err.stdout) out += `\n${err.stdout}`
    if (err.stderr) out += `\n${err.stderr}`
    return out
  }
}

// ============ File Tools ============

registerTool({
  name: 'Bash',
  description: 'Execute a shell command and return the output. Use for git, npm, file operations, and running scripts.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['command'],
  },
  execute: async (input, _ctx) => {
    return runBash(input.command as string, input.timeout as number)
  },
})

registerTool({
  name: 'Read',
  description: 'Read file contents with line numbers. Supports images (base64), PDFs (text extraction), and binary detection.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read' },
      limit: { type: 'number', description: 'Max lines to read' },
      offset: { type: 'number', description: 'Line offset (1-indexed)' },
    },
    required: ['path'],
  },
  execute: async (input, _ctx) => {
    const path = resolve(process.cwd(), input.path as string)
    const pathCheck = validatePath(input.path as string, process.cwd())
    if (!pathCheck.valid) return `Access denied: ${pathCheck.reason}`
    if (!existsSync(path)) return `File not found: ${path}`

    // Image files — return base64 + metadata
    const ext = path.split('.').pop()?.toLowerCase() || ''
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp']
    if (imageExts.includes(ext)) {
      try {
        const buf = readFileSync(path)
        const size = statSync(path).size
        const base64 = buf.toString('base64').slice(0, 1000)
        return `[Image: ${ext.toUpperCase()}, ${formatSize(size)}]\nBase64 preview: ${base64}...\nPath: ${path}`
      } catch (err) {
        return `Error reading image: ${err}`
      }
    }

    // Binary detection
    const binaryExts = ['zip', 'tar', 'gz', 'exe', 'dll', 'so', 'o', 'wasm', 'pdf']
    if (binaryExts.includes(ext)) {
      const size = statSync(path).size
      if (ext === 'pdf') {
        // Try basic PDF text extraction
        try {
          const pdfText = await runBash(`pdftotext "${path}" - 2>/dev/null | head -200`)
          if (pdfText.trim()) return `[PDF: ${formatSize(size)}]\n\n${pdfText}`
        } catch {}
      }
      return `[Binary file: ${ext.toUpperCase()}, ${formatSize(size)}] — cannot display contents`
    }

    try {
      const raw = readFileSync(path, 'utf-8')
      const allLines = raw.split('\n')
      const offset = (input.offset as number) || 1
      const limit = input.limit as number

      const start = Math.max(0, offset - 1)
      const end = limit ? Math.min(start + limit, allLines.length) : allLines.length
      const slice = allLines.slice(start, end)

      // Add line numbers (cat -n style)
      const padWidth = String(end).length
      const numbered = slice.map((line, i) => {
        const lineNum = String(start + i + 1).padStart(padWidth)
        return `${lineNum}\t${line}`
      })

      let content = numbered.join('\n')
      if (start > 0) content = `... (from line ${offset})\n${content}`
      if (end < allLines.length) content += `\n... (${allLines.length - end} more lines)`
      if (content.length > 100000) content = content.slice(0, 100000) + '\n... (truncated)'
      return content
    } catch (err) {
      return `Error reading ${path}: ${err}`
    }
  },
})

registerTool({
  name: 'Write',
  description: 'Write content to a file. Creates the file if it does not exist.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['path', 'content'],
  },
  execute: async (input, _ctx) => {
    const path = resolve(process.cwd(), input.path as string)
    const pathCheck = validatePath(input.path as string, process.cwd())
    if (!pathCheck.valid) return `Access denied: ${pathCheck.reason}`
    try {
      const dir = join(path, '..')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(path, input.content as string, 'utf-8')
      return `Written ${(input.content as string).length} chars to ${path}`
    } catch (err) {
      return `Error writing ${path}: ${err}`
    }
  },
})

registerTool({
  name: 'Edit',
  description: 'Edit a file by replacing exact text. Use when you need to change specific parts of a file.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File to edit' },
      old_text: { type: 'string', description: 'Exact text to replace' },
      new_text: { type: 'string', description: 'Replacement text' },
    },
    required: ['path', 'old_text', 'new_text'],
  },
  execute: async (input, _ctx) => {
    const path = resolve(process.cwd(), input.path as string)
    const pathCheck = validatePath(input.path as string, process.cwd())
    if (!pathCheck.valid) return `Access denied: ${pathCheck.reason}`
    if (!existsSync(path)) return `File not found: ${path}`

    try {
      let content = readFileSync(path, 'utf-8')
      const oldText = input.old_text as string
      const newText = input.new_text as string
      if (!content.includes(oldText)) {
        return `Could not find the specified text in ${path}. Make sure you use exact text match.`
      }
      content = content.replace(oldText, newText)
      writeFileSync(path, content, 'utf-8')

      // Show colored diff
      const relPath = relative(process.cwd(), path) || path
      const oldLines = oldText.split('\n')
      const newLines = newText.split('\n')
      const diffLines = [relPath + ':']
      for (const line of oldLines) diffLines.push(`\x1b[31m- ${line}\x1b[0m`)
      for (const line of newLines) diffLines.push(`\x1b[32m+ ${line}\x1b[0m`)

      // Self-verify: confirm the new text actually exists in the file
      const verify = readFileSync(path, 'utf-8')
      if (!verify.includes(newText)) {
        diffLines.push(`\x1b[31m⚠ VERIFICATION FAILED: new text not found after edit\x1b[0m`)
      }

      return diffLines.join('\n')
    } catch (err) {
      return `Error editing ${path}: ${err}`
    }
  },
})

registerTool({
  name: 'Glob',
  description: 'Find files matching a glob pattern. Use ** for recursive, * for any characters.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. **/*.ts, src/*.js)' },
      cwd: { type: 'string', description: 'Directory to search in' },
    },
    required: ['pattern'],
  },
  execute: async (input, _ctx) => {
    const cwd = (input.cwd as string) || process.cwd()
    const pattern = input.pattern as string

    // Extract the filename pattern from glob (e.g., "**/*.ts" -> "*.ts")
    const parts = pattern.split('/')
    const filePattern = parts[parts.length - 1] || '*'
    // Get directory prefix if specified (e.g., "src/**/*.ts" -> "src")
    const dirParts = parts.slice(0, -1).filter(p => p !== '**' && p !== '*')
    const searchDir = dirParts.length > 0 ? join(cwd, ...dirParts) : cwd
    const isRecursive = pattern.includes('**')

    let cmd: string
    if (isRecursive) {
      cmd = `find "${searchDir}" -type f -name "${filePattern}" 2>/dev/null | head -100`
    } else {
      cmd = `find "${searchDir}" -maxdepth 1 -type f -name "${filePattern}" 2>/dev/null | head -100`
    }

    return runBash(cmd)
  },
})

registerTool({
  name: 'Grep',
  description: 'Search for text or regex patterns in files.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex or text pattern to search' },
      path: { type: 'string', description: 'File or directory to search' },
      context: { type: 'number', description: 'Lines of context around matches' },
      file_only: { type: 'boolean', description: 'Only show filenames with matches' },
    },
    required: ['pattern', 'path'],
  },
  execute: async (input, _ctx) => {
    const flags = input.file_only ? '-rl' : '-rn'
    const ctxFlag = input.context ? `-C ${Number(input.context)}` : ''
    const pattern = input.pattern as string
    const searchPath = resolve(process.cwd(), input.path as string)

    // Use -- to prevent pattern being interpreted as flags
    // Use single quotes with proper escaping for the pattern
    const safePattern = pattern.replace(/'/g, "'\"'\"'")
    const cmd = `grep ${flags} ${ctxFlag} -- '${safePattern}' '${searchPath}' 2>/dev/null | head -100`
    return runBash(cmd)
  },
})

// ============ Web Tools ============

registerTool({
  name: 'WebSearch',
  description: 'Search the web for information. Always cite sources with [Title](URL) links.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      count: { type: 'number', description: 'Number of results (default: 5)' },
    },
    required: ['query'],
  },
  execute: async (input, _ctx) => {
    const { query, count = 5 } = input
    return webSearch(query as string, count as number)
  },
})

registerTool({
  name: 'WebFetch',
  description: 'Fetch and extract readable content from a URL.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      max_chars: { type: 'number', description: 'Max characters to return' },
    },
    required: ['url'],
  },
  execute: async (input, _ctx) => {
    const { url, max_chars = 10000 } = input
    return webFetch(url as string, max_chars as number)
  },
})

// ============ Todo Tool ============

registerTool({
  name: 'TodoWrite',
  description: 'Create and manage a todo list for tracking tasks.',
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'List of todos',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Task description' },
            status: { type: 'string', enum: ['in_progress', 'pending', 'completed'], description: 'Task status' },
            activeForm: { type: 'string', description: 'Current action being taken' },
          },
        },
      },
    },
    required: ['todos'],
  },
  execute: async (input, _ctx) => {
    const todos = input.todos as Array<{
      content: string
      status: string
      activeForm?: string
    }>

    const lines = todos.map(t => {
      const icon = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜'
      const active = t.activeForm ? ` — ${t.activeForm}` : ''
      return `${icon} ${t.content}${active}`
    })

    return lines.join('\n')
  },
})

// ============ Task Management ============

interface Task {
  id: string
  description: string
  status: 'pending' | 'running' | 'done'
  createdAt: Date
  result?: string
}

const TASKS_FILE = join(homedir(), '.nole-code', 'tasks.json')

function loadTasks(): Map<string, Task> {
  try {
    if (existsSync(TASKS_FILE)) {
      const data = JSON.parse(readFileSync(TASKS_FILE, 'utf-8'))
      return new Map(Object.entries(data))
    }
  } catch {}
  return new Map()
}

function saveTasks(tasks: Map<string, Task>) {
  const dir = join(TASKS_FILE, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const obj = Object.fromEntries(tasks)
  writeFileSync(TASKS_FILE, JSON.stringify(obj, null, 2))
}

registerTool({
  name: 'TaskCreate',
  description: 'Create a new background task and get a task ID.',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Task description' },
    },
    required: ['description'],
  },
  execute: async (input, _ctx) => {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const tasks = loadTasks()
    tasks.set(id, {
      id,
      description: input.description as string,
      status: 'pending',
      createdAt: new Date(),
    })
    saveTasks(tasks)
    return id
  },
})

registerTool({
  name: 'TaskList',
  description: 'List all background tasks and their status.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (_input, _ctx) => {
    const tasks = loadTasks()
    if (tasks.size === 0) return 'No tasks'

    return Array.from(tasks.values())
      .map(t => `[${t.status.toUpperCase()}] ${t.id}: ${t.description}${t.result ? `\n  Result: ${t.result}` : ''}`)
      .join('\n')
  },
})

registerTool({
  name: 'TaskUpdate',
  description: 'Update a task status or result.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Task ID' },
      status: { type: 'string', enum: ['pending', 'running', 'done'], description: 'New status' },
      result: { type: 'string', description: 'Task result/output' },
    },
    required: ['task_id'],
  },
  execute: async (input, _ctx) => {
    const tasks = loadTasks()
    const task = tasks.get(input.task_id as string)
    if (!task) return `Task not found: ${input.task_id}`

    if (input.status) task.status = input.status as Task['status']
    if (input.result) task.result = input.result as string
    saveTasks(tasks)
    return `Updated ${input.task_id}`
  },
})

registerTool({
  name: 'TaskGet',
  description: 'Get the status and result of a specific task.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Task ID' },
    },
    required: ['task_id'],
  },
  execute: async (input, _ctx) => {
    const tasks = loadTasks()
    const task = tasks.get(input.task_id as string)
    if (!task) return `Task not found: ${input.task_id}`

    return `Status: ${task.status}\nDescription: ${task.description}\n${task.result ? `Result: ${task.result}` : ''}`
  },
})

registerTool({
  name: 'TaskStop',
  description: 'Stop a running task by marking it as cancelled.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Task ID to stop' },
    },
    required: ['task_id'],
  },
  execute: async (input, _ctx) => {
    const tasks = loadTasks()
    const task = tasks.get(input.task_id as string)
    if (!task) return `Task not found: ${input.task_id}`
    task.status = 'done'
    task.result = 'Stopped by user'
    saveTasks(tasks)
    return `Stopped ${input.task_id}`
  },
})

// ============ Agent / Team Tools ============

registerTool({
  name: 'Agent',
  description: 'Spawn a sub-agent to perform a task in parallel. Results are returned when complete.',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Short description of the task (3-5 words)' },
      prompt: { type: 'string', description: 'Detailed task for the agent to perform' },
      run_in_background: { type: 'boolean', description: 'Run in background (returns immediately)' },
      cwd: { type: 'string', description: 'Working directory for the agent' },
    },
    required: ['description', 'prompt'],
  },
  execute: async (input, ctx) => {
    const { description, prompt, cwd, run_in_background } = input
    const agentCwd = (cwd as string) || ctx.cwd

    try {
      const agent = await spawnAgent({
        name: description as string,
        description: description as string,
        prompt: prompt as string,
        cwd: agentCwd,
        background: run_in_background as boolean,
      })

      if (run_in_background) {
        return `[AGENT SPAWNED] ${description}\nAgent ID: ${agent.id}\nPID: ${agent.pid}\nRunning in background. Check status with /agents`
      }

      // Wait for agent to complete (up to 120s)
      const result = await new Promise<string>((resolve) => {
        const timeout = setTimeout(() => resolve(`Agent ${agent.id} timed out after 120s`), 120000)
        const unsub = onAgentMessage((msg) => {
          if (msg.agentId === agent.id && (msg.type === 'done' || msg.type === 'error')) {
            clearTimeout(timeout)
            unsub()
            resolve(String(msg.payload || 'Agent completed'))
          }
        })
      })

      return result
    } catch (err) {
      return `Agent spawn error: ${err}`
    }
  },
})

registerTool({
  name: 'TeamCreate',
  description: 'Create a team of agents that can communicate with each other.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Team name' },
      agents: {
        type: 'array',
        description: 'List of agent names to create',
        items: { type: 'string' },
      },
    },
    required: ['name'],
  },
  execute: async (input, ctx) => {
    const team = await createTeam({
      name: input.name as string,
      members: (input.agents as string[] || []).map(name => ({
        name,
        role: name,
      })),
      parentSessionId: ctx.sessionId,
    })
    return `[TEAM CREATED] ${team.name} (${team.id})\nMembers: ${team.members.size}\nManage with /team list or /team send`
  },
})

registerTool({
  name: 'SendMessage',
  description: 'Send a message to a teammate agent.',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient agent name' },
      message: { type: 'string', description: 'Message content' },
    },
    required: ['to', 'message'],
  },
  execute: async (input, _ctx) => {
    const { sendToAgent, getAgent, getAllAgents } = await import('../agents/spawner.js')
    // Find agent by name or ID
    const target = String(input.to)
    const agents = getAllAgents()
    const agent = agents.find(a => a.id === target || a.name === target)
    if (!agent) {
      return `Agent "${target}" not found. Active agents: ${agents.map(a => a.name || a.id).join(', ') || 'none'}`
    }
    sendToAgent(agent.id, String(input.message))
    return `[MESSAGE SENT to ${agent.name || agent.id}]: ${input.message}`
  },
})

// ============ Code Tools ============

registerTool({
  name: 'NotebookEdit',
  description: 'Edit a Jupyter notebook cell.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to .ipynb file' },
      cell_index: { type: 'number', description: 'Cell index to edit' },
      new_text: { type: 'string', description: 'New cell content' },
      cell_type: { type: 'string', enum: ['code', 'markdown'], description: 'Cell type' },
    },
    required: ['path', 'cell_index', 'new_text'],
  },
  execute: async (input, _ctx) => {
    const path = resolve(process.cwd(), input.path as string)
    if (!existsSync(path)) return `Notebook not found: ${path}`

    try {
      const nb = JSON.parse(readFileSync(path, 'utf-8'))
      const idx = input.cell_index as number
      if (!nb.cells || !nb.cells[idx]) return `Cell ${idx} not found`

      nb.cells[idx].source = input.new_text as string
      if (input.cell_type) nb.cells[idx].cell_type = input.cell_type

      writeFileSync(path, JSON.stringify(nb, null, 2))
      return `Edited cell ${idx} in ${path}`
    } catch (err) {
      return `Error: ${err}`
    }
  },
})

registerTool({
  name: 'GrepTool',
  description: 'Search for patterns in code (alias for Grep with code-focused defaults).',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Pattern to search' },
      path: { type: 'string', description: 'Directory to search' },
      context: { type: 'number', description: 'Lines of context' },
    },
    required: ['pattern', 'path'],
  },
  execute: async (input, _ctx) => {
    const ctx = input.context ? `-C ${input.context}` : '-C 2'
    const pattern = (input.pattern as string).replace(/'/g, "'\\''")
    const path = resolve(process.cwd(), input.path as string)
    return runBash(`grep ${ctx} -r -- "${pattern}" "${path}" 2>/dev/null | head -50`)
  },
})

registerTool({
  name: 'GlobTool',
  description: 'Find files by pattern (alias for Glob).',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern' },
      cwd: { type: 'string', description: 'Directory to search' },
    },
    required: ['pattern'],
  },
  execute: async (input, _ctx) => {
    const cwd = (input.cwd as string) || process.cwd()
    const pattern = input.pattern as string
    return runBash(`find "${cwd}" -type f -name "${pattern}" 2>/dev/null | head -100`)
  },
})

// ============ System Tools ============

registerTool({
  name: 'Sleep',
  description: 'Wait for a specified time in milliseconds.',
  inputSchema: {
    type: 'object',
    properties: {
      ms: { type: 'number', description: 'Milliseconds to sleep' },
    },
    required: ['ms'],
  },
  execute: async (input, _ctx) => {
    await new Promise(r => setTimeout(r, input.ms as number))
    return `Slept ${input.ms}ms`
  },
})

registerTool({
  name: 'Exit',
  description: 'End the current Nole Code session.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (_input, _ctx) => {
    return '[SESSION ENDED] Thank you for using Nole Code!'
  },
})

// ============ Power Tools ============

registerTool({
  name: 'LS',
  description: 'List directory contents with file sizes, types, and permissions.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path (default: cwd)' },
      all: { type: 'boolean', description: 'Show hidden files' },
      long: { type: 'boolean', description: 'Long format with sizes and dates' },
    },
    required: [],
  },
  execute: async (input, _ctx) => {
    const dir = resolve(process.cwd(), (input.path as string) || '.')
    if (!existsSync(dir)) return `Directory not found: ${dir}`

    try {
      const entries = readdirSync(dir)
      const showHidden = input.all as boolean
      const longFormat = input.long !== false // default to long

      const filtered = showHidden ? entries : entries.filter(e => !e.startsWith('.'))
      if (filtered.length === 0) return '(empty directory)'

      if (!longFormat) return filtered.join('\n')

      const lines = filtered.map(name => {
        try {
          const fullPath = join(dir, name)
          const stat = statSync(fullPath)
          const isDir = stat.isDirectory()
          const size = isDir ? '-' : formatSize(stat.size)
          const date = stat.mtime.toISOString().slice(0, 10)
          const type = isDir ? 'd' : '-'
          return `${type} ${size.padStart(8)} ${date} ${name}${isDir ? '/' : ''}`
        } catch { return `? ${name}` }
      })

      return lines.join('\n')
    } catch (err) {
      return `Error: ${err}`
    }
  },
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`
}

registerTool({
  name: 'Tree',
  description: 'Show directory tree structure. Use for understanding project layout.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Root directory (default: cwd)' },
      depth: { type: 'number', description: 'Max depth (default: 3)' },
      pattern: { type: 'string', description: 'Filter by file extension (e.g., .ts, .py)' },
    },
    required: [],
  },
  execute: async (input, _ctx) => {
    const root = resolve(process.cwd(), (input.path as string) || '.')
    const maxDepth = (input.depth as number) || 3
    const pattern = input.pattern as string

    const lines: string[] = []
    let fileCount = 0
    let dirCount = 0

    function walk(dir: string, prefix: string, depth: number) {
      if (depth > maxDepth) return
      try {
        const entries = readdirSync(dir)
          .filter(e => !e.startsWith('.') && e !== 'node_modules' && e !== '.git')
          .sort((a, b) => {
            const aIsDir = statSync(join(dir, a)).isDirectory()
            const bIsDir = statSync(join(dir, b)).isDirectory()
            if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
            return a.localeCompare(b)
          })

        for (let i = 0; i < entries.length; i++) {
          const name = entries[i]
          const fullPath = join(dir, name)
          const isLast = i === entries.length - 1
          const connector = isLast ? '└── ' : '├── '
          const childPrefix = isLast ? '    ' : '│   '

          try {
            const isDir = statSync(fullPath).isDirectory()
            if (isDir) {
              dirCount++
              lines.push(`${prefix}${connector}${name}/`)
              walk(fullPath, prefix + childPrefix, depth + 1)
            } else {
              if (pattern && !name.endsWith(pattern)) return
              fileCount++
              lines.push(`${prefix}${connector}${name}`)
            }
          } catch {}
        }
      } catch {}
    }

    const rootName = root.split('/').pop() || root
    lines.push(rootName + '/')
    walk(root, '', 1)
    lines.push(`\n${dirCount} directories, ${fileCount} files`)
    return lines.join('\n')
  },
})

registerTool({
  name: 'MultiEdit',
  description: 'Make multiple edits to a file in one operation. More efficient than multiple Edit calls.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File to edit' },
      edits: {
        type: 'array',
        description: 'List of edits to apply in order',
        items: {
          type: 'object',
          properties: {
            old_text: { type: 'string', description: 'Text to find' },
            new_text: { type: 'string', description: 'Replacement text' },
          },
          required: ['old_text', 'new_text'],
        },
      },
    },
    required: ['path', 'edits'],
  },
  execute: async (input, _ctx) => {
    const filePath = resolve(process.cwd(), input.path as string)
    const pathCheck = validatePath(input.path as string, process.cwd())
    if (!pathCheck.valid) return `Access denied: ${pathCheck.reason}`
    if (!existsSync(filePath)) return `File not found: ${filePath}`

    const edits = input.edits as Array<{ old_text: string; new_text: string }>
    let content = readFileSync(filePath, 'utf-8')
    const diffs: string[] = []
    let applied = 0

    for (const edit of edits) {
      if (!content.includes(edit.old_text)) {
        diffs.push(`\x1b[33m! Could not find: "${edit.old_text.slice(0, 40)}..."\x1b[0m`)
        continue
      }
      content = content.replace(edit.old_text, edit.new_text)
      applied++
      const oldLines = edit.old_text.split('\n')
      const newLines = edit.new_text.split('\n')
      for (const l of oldLines) diffs.push(`\x1b[31m- ${l}\x1b[0m`)
      for (const l of newLines) diffs.push(`\x1b[32m+ ${l}\x1b[0m`)
      diffs.push('')
    }

    writeFileSync(filePath, content, 'utf-8')

    // Self-verify: re-read and confirm all new_text fragments exist
    const verify = readFileSync(filePath, 'utf-8')
    let verified = 0
    for (const edit of edits) {
      if (verify.includes(edit.new_text)) verified++
    }
    if (verified < applied) {
      diffs.push(`\x1b[31m⚠ VERIFICATION: only ${verified}/${applied} edits confirmed in file\x1b[0m`)
    }

    const relPath = relative(process.cwd(), filePath)
    return `${relPath}: ${applied}/${edits.length} edits applied\n\n${diffs.join('\n')}`
  },
})

registerTool({
  name: 'HttpRequest',
  description: 'Make HTTP requests with full control over method, headers, and body. Use for APIs, webhooks, testing endpoints.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to request' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], description: 'HTTP method (default: GET)' },
      headers: { type: 'object', description: 'Request headers as key-value pairs' },
      body: { type: 'string', description: 'Request body (string or JSON)' },
      json: { type: 'object', description: 'JSON body (auto-sets Content-Type)' },
    },
    required: ['url'],
  },
  execute: async (input, _ctx) => {
    const url = input.url as string
    const method = (input.method as string) || 'GET'
    const headers: Record<string, string> = {
      'User-Agent': 'Nole-Code/1.12',
      ...(input.headers as Record<string, string> || {}),
    }

    let body: string | undefined
    if (input.json) {
      body = JSON.stringify(input.json)
      headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    } else if (input.body) {
      body = input.body as string
    }

    try {
      const response = await fetch(url, { method, headers, body })
      const status = response.status
      const contentType = response.headers.get('content-type') || ''
      const text = await response.text()

      const respHeaders = Array.from(response.headers.entries())
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n')

      let responseBody = text
      // Pretty-print JSON
      if (contentType.includes('json')) {
        try { responseBody = JSON.stringify(JSON.parse(text), null, 2) } catch {}
      }

      if (responseBody.length > 10000) {
        responseBody = responseBody.slice(0, 10000) + '\n... (truncated)'
      }

      return `HTTP ${status} ${response.statusText}\n\nHeaders:\n${respHeaders}\n\nBody:\n${responseBody}`
    } catch (err) {
      return `Request failed: ${err}`
    }
  },
})

registerTool({
  name: 'FindReplace',
  description: 'Search and replace text across multiple files. Like sed but safer — shows a preview of changes.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Text or regex pattern to find' },
      replacement: { type: 'string', description: 'Replacement text' },
      path: { type: 'string', description: 'Directory to search in (default: cwd)' },
      glob: { type: 'string', description: 'File pattern to match (e.g., *.ts, *.py)' },
      dry_run: { type: 'boolean', description: 'Preview changes without applying (default: true)' },
    },
    required: ['pattern', 'replacement'],
  },
  execute: async (input, _ctx) => {
    const searchDir = resolve(process.cwd(), (input.path as string) || '.')
    const pattern = input.pattern as string
    const replacement = input.replacement as string
    const fileGlob = (input.glob as string) || '*'
    const dryRun = input.dry_run !== false // default to dry run

    // Find matching files
    const result = await runBash(
      `find "${searchDir}" -type f -name "${fileGlob}" ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null | head -50`
    )
    const files = result.trim().split('\n').filter(Boolean)

    const changes: string[] = []
    let totalMatches = 0

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8')
        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        const matches = content.match(regex)

        if (matches && matches.length > 0) {
          totalMatches += matches.length
          const relPath = relative(process.cwd(), file)

          if (!dryRun) {
            const newContent = content.split(pattern).join(replacement)
            writeFileSync(file, newContent, 'utf-8')
          }

          changes.push(`  ${relPath}: ${matches.length} match${matches.length > 1 ? 'es' : ''}`)
        }
      } catch {}
    }

    if (changes.length === 0) {
      return `No matches found for "${pattern}" in ${fileGlob} files`
    }

    const action = dryRun ? 'Would replace' : 'Replaced'
    return `${action} "${pattern}" → "${replacement}"\n${totalMatches} matches in ${changes.length} files:\n\n${changes.join('\n')}${dryRun ? '\n\nRun with dry_run=false to apply.' : ''}`
  },
})

registerTool({
  name: 'GitStatus',
  description: 'Show git repository status — branch, staged/unstaged changes, ahead/behind.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (input, _ctx) => {
    const parts: string[] = []
    try {
      const branch = await runBash('git branch --show-current 2>/dev/null')
      const status = await runBash('git status --short 2>/dev/null')
      const log = await runBash('git log --oneline -5 2>/dev/null')
      const ahead = await runBash('git rev-list --count @{u}..HEAD 2>/dev/null')
      const behind = await runBash('git rev-list --count HEAD..@{u} 2>/dev/null')

      parts.push(`Branch: ${branch.trim()}`)

      const a = parseInt(ahead.trim()) || 0
      const b = parseInt(behind.trim()) || 0
      if (a || b) parts.push(`Ahead: ${a}, Behind: ${b}`)

      if (status.trim()) {
        parts.push(`\nChanges:\n${status.trim()}`)
      } else {
        parts.push('\nWorking tree clean')
      }

      parts.push(`\nRecent commits:\n${log.trim()}`)
    } catch (err) {
      return `Not a git repository or git error: ${err}`
    }
    return parts.join('\n')
  },
})

registerTool({
  name: 'GitCommit',
  description: 'Stage files and create a git commit. Safer than running git commands manually.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to stage (default: all changed files)',
      },
      all: { type: 'boolean', description: 'Stage all changes (git add -A)' },
    },
    required: ['message'],
  },
  execute: async (input, _ctx) => {
    const message = input.message as string
    const files = input.files as string[] | undefined
    const all = input.all as boolean

    try {
      if (files && files.length > 0) {
        for (const f of files) {
          await runBash(`git add "${f}"`)
        }
      } else if (all !== false) {
        await runBash('git add -A')
      }

      const staged = await runBash('git diff --cached --stat 2>/dev/null')
      if (!staged.trim()) return 'Nothing to commit (no staged changes)'

      // Use env var to avoid shell injection
      const { execFileSync } = require('child_process')
      execFileSync('git', ['commit', '-m', message], { encoding: 'utf-8', cwd: process.cwd() })

      const hash = await runBash('git log --oneline -1')
      return `Committed: ${hash.trim()}\n\n${staged.trim()}`
    } catch (err) {
      return `Commit failed: ${err}`
    }
  },
})

registerTool({
  name: 'GitDiff',
  description: 'Show git diff — staged, unstaged, or between refs.',
  inputSchema: {
    type: 'object',
    properties: {
      staged: { type: 'boolean', description: 'Show staged changes (--cached)' },
      ref: { type: 'string', description: 'Compare against ref (branch, commit, HEAD~N)' },
      file: { type: 'string', description: 'Limit to specific file' },
      stat: { type: 'boolean', description: 'Show stat summary only' },
    },
    required: [],
  },
  execute: async (input, _ctx) => {
    const parts = ['git', 'diff']
    if (input.staged) parts.push('--cached')
    if (input.stat) parts.push('--stat')
    if (input.ref) parts.push(String(input.ref))
    if (input.file) parts.push('--', String(input.file))

    const result = await runBash(parts.join(' ') + ' 2>/dev/null')
    return result.trim() || 'No differences'
  },
})

registerTool({
  name: 'RunTests',
  description: 'Run project tests and return results. Auto-detects test framework (jest, vitest, pytest, bun test, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Custom test command (overrides auto-detection)' },
      file: { type: 'string', description: 'Run tests for a specific file only' },
      filter: { type: 'string', description: 'Filter tests by name/pattern' },
    },
    required: [],
  },
  execute: async (input, _ctx) => {
    let cmd = input.command as string

    if (!cmd) {
      // Auto-detect test framework
      const cwd = process.cwd()
      if (existsSync(join(cwd, 'package.json'))) {
        const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
        const scripts = pkg.scripts || {}
        if (scripts.test) {
          cmd = 'npm test'
        } else if (existsSync(join(cwd, 'vitest.config.ts')) || existsSync(join(cwd, 'vitest.config.js'))) {
          cmd = 'npx vitest run'
        } else if (existsSync(join(cwd, 'jest.config.ts')) || existsSync(join(cwd, 'jest.config.js'))) {
          cmd = 'npx jest'
        } else if (existsSync(join(cwd, 'bun.lock')) || existsSync(join(cwd, 'bunfig.toml'))) {
          cmd = 'bun test'
        }
      }
      if (existsSync(join(process.cwd(), 'pytest.ini')) || existsSync(join(process.cwd(), 'pyproject.toml'))) {
        cmd = cmd || 'python -m pytest -v'
      }
      if (existsSync(join(process.cwd(), 'Cargo.toml'))) {
        cmd = cmd || 'cargo test'
      }
      if (existsSync(join(process.cwd(), 'go.mod'))) {
        cmd = cmd || 'go test ./...'
      }
      cmd = cmd || 'echo "No test framework detected. Use command parameter to specify."'
    }

    if (input.file) cmd += ` ${input.file}`
    if (input.filter) cmd += ` --filter "${input.filter}"`

    return runBash(cmd, 120000) // 2 minute timeout for tests
  },
})

registerTool({
  name: 'Spawn',
  description: 'Start a long-running background process (dev server, watcher, etc.). Returns process ID.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to run in background' },
      name: { type: 'string', description: 'Name for this process' },
    },
    required: ['command'],
  },
  execute: async (input, _ctx) => {
    const { spawn: spawnProc } = require('child_process')
    const command = input.command as string
    const name = (input.name as string) || command.split(' ')[0]

    const proc = spawnProc('/bin/bash', ['-c', command], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })

    // Capture first few lines of output
    let output = ''
    const timeout = setTimeout(() => {}, 3000)

    proc.stdout?.on('data', (data: Buffer) => {
      output += data.toString()
    })
    proc.stderr?.on('data', (data: Buffer) => {
      output += data.toString()
    })

    proc.unref()

    // Wait a moment to see if it crashes immediately
    await new Promise(r => setTimeout(r, 1000))
    clearTimeout(timeout)

    if (proc.exitCode !== null) {
      return `Process "${name}" exited immediately (code ${proc.exitCode})\n${output}`
    }

    return `Started "${name}" (PID: ${proc.pid})\nCommand: ${command}\n\nInitial output:\n${output.slice(0, 500) || '(no output yet)'}`
  },
})

registerTool({
  name: 'Diff',
  description: 'Compare two files and show differences.',
  inputSchema: {
    type: 'object',
    properties: {
      file1: { type: 'string', description: 'First file path' },
      file2: { type: 'string', description: 'Second file path' },
    },
    required: ['file1', 'file2'],
  },
  execute: async (input, _ctx) => {
    const f1 = resolve(process.cwd(), input.file1 as string)
    const f2 = resolve(process.cwd(), input.file2 as string)

    if (!existsSync(f1)) return `File not found: ${f1}`
    if (!existsSync(f2)) return `File not found: ${f2}`

    const result = await runBash(`diff --color=never -u "${f1}" "${f2}" 2>/dev/null`)
    if (!result.trim()) return 'Files are identical'

    // Colorize the diff
    const colored = result.split('\n').map(line => {
      if (line.startsWith('+') && !line.startsWith('+++')) return `\x1b[32m${line}\x1b[0m`
      if (line.startsWith('-') && !line.startsWith('---')) return `\x1b[31m${line}\x1b[0m`
      if (line.startsWith('@@')) return `\x1b[36m${line}\x1b[0m`
      return line
    }).join('\n')

    return colored
  },
})

registerTool({
  name: 'Rename',
  description: 'Rename or move a file/directory.',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Current path' },
      to: { type: 'string', description: 'New path' },
    },
    required: ['from', 'to'],
  },
  execute: async (input, _ctx) => {
    const from = resolve(process.cwd(), input.from as string)
    const to = resolve(process.cwd(), input.to as string)

    if (!existsSync(from)) return `Not found: ${from}`
    if (existsSync(to)) return `Target already exists: ${to}`

    const { renameSync } = require('fs')
    try {
      renameSync(from, to)
      return `Renamed: ${relative(process.cwd(), from)} → ${relative(process.cwd(), to)}`
    } catch (err) {
      return `Error: ${err}`
    }
  },
})

registerTool({
  name: 'Delete',
  description: 'Delete a file. Requires confirmation for directories.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File or directory to delete' },
      recursive: { type: 'boolean', description: 'Delete directory recursively (required for directories)' },
    },
    required: ['path'],
  },
  execute: async (input, _ctx) => {
    const targetPath = resolve(process.cwd(), input.path as string)
    const pathCheck = validatePath(input.path as string, process.cwd())
    if (!pathCheck.valid) return `Access denied: ${pathCheck.reason}`
    if (!existsSync(targetPath)) return `Not found: ${targetPath}`

    try {
      const stat = statSync(targetPath)
      if (stat.isDirectory()) {
        if (!input.recursive) return `"${input.path}" is a directory. Set recursive=true to delete.`
        const { rmSync } = require('fs')
        rmSync(targetPath, { recursive: true })
      } else {
        const { unlinkSync } = require('fs')
        unlinkSync(targetPath)
      }
      return `Deleted: ${relative(process.cwd(), targetPath)}`
    } catch (err) {
      return `Error: ${err}`
    }
  },
})

export { tools }
