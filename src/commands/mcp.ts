// Nole Code - /mcp command: MCP server mode (JSON-RPC 2.0 over stdin/stdout)

import * as readline from 'readline'
import { exec, execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

// MCP Protocol Types
interface JSONRPCRequest {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

// Tool definitions for MCP
const MCP_TOOLS = [
  {
    name: 'bash',
    description: 'Execute shell commands',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string' as const, description: 'Shell command to execute' },
        timeout: { type: 'number' as const, description: 'Timeout in seconds', default: 30 }
      },
      required: ['command']
    }
  },
  {
    name: 'read',
    description: 'Read a file',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string' as const, description: 'File path to read' },
        offset: { type: 'number' as const, description: 'Line offset', default: 1 },
        limit: { type: 'number' as const, description: 'Line limit', default: 100 }
      },
      required: ['path']
    }
  },
  {
    name: 'write',
    description: 'Write content to a file',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string' as const, description: 'File path to write' },
        content: { type: 'string' as const, description: 'Content to write' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit',
    description: 'Edit a file with targeted replacement',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string' as const, description: 'File path' },
        oldText: { type: 'string' as const, description: 'Text to replace' },
        newText: { type: 'string' as const, description: 'Replacement text' }
      },
      required: ['path', 'oldText', 'newText']
    }
  },
  {
    name: 'glob',
    description: 'Find files matching pattern',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string' as const, description: 'Glob pattern' },
        cwd: { type: 'string' as const, description: 'Working directory' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'grep',
    description: 'Search for pattern in files',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string' as const, description: 'Search pattern' },
        path: { type: 'string' as const, description: 'File or directory path' },
        ignoreCase: { type: 'boolean' as const, description: 'Case insensitive' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'web_search',
    description: 'Search the web',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' as const, description: 'Search query' },
        count: { type: 'number' as const, description: 'Number of results', default: 5 }
      },
      required: ['query']
    }
  },
  {
    name: 'web_fetch',
    description: 'Fetch a URL',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string' as const, description: 'URL to fetch' },
        extractMode: { type: 'string' as const, description: 'markdown or text', default: 'markdown' }
      },
      required: ['url']
    }
  }
]

// Server state
let isRunning = false
let rl: readline.Interface | null = null
let requestIdCounter = 0

// Initialize MCP server
function initializeServer(): {
  protocolVersion: string
  capabilities: {
    tools: {}
  }
  serverInfo: {
    name: string
    version: string
  }
} {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: 'nole-code',
      version: '1.0.0'
    }
  }
}

// List available tools
function listTools(): { tools: typeof MCP_TOOLS } {
  return { tools: MCP_TOOLS }
}

// Execute a tool
async function callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'bash': {
      const { command, timeout = 30 } = arguments_ as { command: string; timeout?: number }
      try {
        const { stdout, stderr } = await execAsync(command, { timeout })
        return { stdout, stderr, error: null }
      } catch (e: unknown) {
        const err = e as { message?: string; stdout?: string; stderr?: string }
        return { stdout: err.stdout || '', stderr: err.stderr || err.message || '', error: err.message }
      }
    }

    case 'read': {
      const { path, offset = 1, limit = 100 } = arguments_ as { path: string; offset?: number; limit?: number }
      if (!existsSync(path)) {
        return { error: `File not found: ${path}` }
      }
      const content = readFileSync(path, 'utf-8')
      const lines = content.split('\n')
      const start = Math.max(0, offset - 1)
      const end = Math.min(lines.length, start + limit)
      return { content: lines.slice(start, end).join('\n'), lines: lines.length }
    }

    case 'write': {
      const { path, content } = arguments_ as { path: string; content: string }
      writeFileSync(path, content, 'utf-8')
      return { success: true, path }
    }

    case 'edit': {
      const { path, oldText, newText } = arguments_ as { path: string; oldText: string; newText: string }
      if (!existsSync(path)) {
        return { error: `File not found: ${path}` }
      }
      const content = readFileSync(path, 'utf-8')
      if (!content.includes(oldText)) {
        return { error: 'oldText not found in file' }
      }
      const newContent = content.replace(oldText, newText)
      writeFileSync(path, newContent, 'utf-8')
      return { success: true, path }
    }

    case 'glob': {
      const { pattern, cwd = process.cwd() } = arguments_ as { pattern: string; cwd?: string }
      try {
        const { stdout } = await execAsync(`ls -la`, { cwd })
        // Simple glob - just find matching files manually
        const files = stdout.split('\n')
          .filter(l => l.includes(pattern.replace('*', '')))
          .map(l => l.split(' ').pop())
          .filter(Boolean)
        return { files }
      } catch {
        return { files: [] }
      }
    }

    case 'grep': {
      const { pattern, path = '.', ignoreCase = false } = arguments_ as { pattern: string; path?: string; ignoreCase?: boolean }
      try {
        const flags = ignoreCase ? '-i' : ''
        const { stdout } = await execAsync(`grep ${flags} -r "${pattern}" "${path}" | head -20`)
        return { matches: stdout }
      } catch {
        return { matches: '' }
      }
    }

    case 'web_search': {
      const { query, count = 5 } = arguments_ as { query: string; count?: number }
      // Simple web search simulation - in real impl, use Brave API
      return { results: [{ title: query, url: `https://example.com/?q=${encodeURIComponent(query)}` }], count }
    }

    case 'web_fetch': {
      const { url, extractMode = 'markdown' } = arguments_ as { url: string; extractMode?: string }
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
        const content = await response.text()
        return { content: content.slice(0, 5000), mode: extractMode }
      } catch (e: unknown) {
        return { error: String(e) }
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// Handle a single JSON-RPC request
async function handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { method, params, id } = request

  try {
    let result: unknown

    if (method === 'initialize') {
      result = initializeServer()
    } else if (method === 'tools/list') {
      result = listTools()
    } else if (method === 'tools/call') {
      const { name, arguments: args } = (params as { name: string; arguments?: Record<string, unknown> }) || {}
      if (!name) {
        return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Missing tool name' }, id }
      }
      result = await callTool(name, args || {})
    } else {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      }
    }

    return { jsonrpc: '2.0', id, result }
  } catch (e: unknown) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: String(e) }
    }
  }
}

// Main MCP server loop
async function runMCPServer(): Promise<void> {
  isRunning = true

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })

  const responses: JSONRPCResponse[] = []

  rl.on('line', async (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return

    try {
      const request: JSONRPCRequest = JSON.parse(trimmed)
      const response = await handleRequest(request)
      
      // Write response as JSON-RPC
      process.stdout.write(JSON.stringify(response) + '\n')
    } catch (e) {
      const errorResponse: JSONRPCResponse = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: `Parse error: ${e}` }
      }
      process.stdout.write(JSON.stringify(errorResponse) + '\n')
    }
  })

  rl.on('close', () => {
    isRunning = false
    process.exit(0)
  })

  // Handle process signals
  process.on('SIGINT', () => {
    isRunning = false
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    isRunning = false
    process.exit(0)
  })
}

export function registerMCPCommand(registerCmd: (cmd: import('./index.js').Command) => void) {
  registerCmd({
    name: 'mcp',
    description: 'Start MCP server mode (JSON-RPC 2.0 over stdin/stdout)',
    execute: async (args) => {
      const action = args[0]

      if (action === 'start') {
        return 'Starting MCP server on stdin/stdout...\nUse JSON-RPC 2.0 requests.'
      }

      if (action === 'stop') {
        if (isRunning) {
          isRunning = false
          return 'MCP server stopped.'
        }
        return 'MCP server not running.'
      }

      if (action === 'list') {
        const tools = listTools()
        return 'Available MCP tools:\n\n' +
          tools.tools.map(t => `  ${t.name}\n    ${t.description}`).join('\n')
      }

      return `Usage: /mcp <action>

Actions:
  start   - Start MCP server on stdin/stdout
  stop    - Stop MCP server
  list    - List available MCP tools

MCP Server Protocol (JSON-RPC 2.0):

Example initialize:
  {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}

Example tools/list:
  {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}

Example tools/call:
  {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {
    "name": "bash",
    "arguments": {"command": "ls -la"}
  }}
`
    },
  })

  // Actually start the server if requested
  setTimeout(() => {
    if (process.argv.includes('--mcp') || process.env.MCP_MODE === 'true') {
      runMCPServer()
    }
  }, 100)
}