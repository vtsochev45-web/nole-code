/**
 * MCP Client - Multi-Transport Support
 * Supports: stdio, SSE, streamable HTTP, WebSocket
 */

import { spawn, execSync, type ChildProcess } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { 
  StdioClientTransport, 
  type StdioClientTransportOptions 
} from '@modelcontextprotocol/sdk/client/stdio.js'
import {
  SSEClientTransport,
  type SSEClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/sse.js'
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { 
  CallToolResultSchema, 
  type ListToolsResult,
  type JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js'
import { homedir } from 'os'

export type TransportType = 'stdio' | 'sse' | 'streamable-http' | 'websocket'

export interface MCPServerConfig {
  name: string
  transport: TransportType
  command?: string           // For stdio: the command to run
  args?: string[]            // For stdio: command arguments
  url?: string               // For SSE/streamable-http/websocket
  env?: Record<string, string>
  headers?: Record<string, string>
  auth?: {
    type: 'bearer' | 'basic'
    token?: string
    username?: string
    password?: string
  }
}

export interface MCPServer {
  name: string
  client: Client
  transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport | null
  process?: ChildProcess
  tools: ListToolsResult['tools']
  status: 'connecting' | 'connected' | 'error' | 'disconnected'
  error?: string
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  serverName: string
}

class MCPClientManager {
  private servers: Map<string, MCPServer> = new Map()
  private configPath: string

  constructor() {
    this.configPath = join(homedir(), '.nole-code', 'mcp.json')
  }

  /**
   * Load MCP server configurations
   */
  loadConfigs(): MCPServerConfig[] {
    if (!existsSync(this.configPath)) {
      return this.getDefaultServers()
    }

    try {
      const data = JSON.parse(readFileSync(this.configPath, 'utf-8'))
      // Accept both { servers: [...] } and bare array [...]
      if (Array.isArray(data)) return data
      return data.servers || this.getDefaultServers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`\n\x1b[33m⚠ Failed to parse ${this.configPath}: ${msg}\x1b[0m`)
      return this.getDefaultServers()
    }
  }

  /**
   * Get default servers (e.g., built-in ones)
   */
  getDefaultServers(): MCPServerConfig[] {
    return []
  }

  /**
   * Connect to an MCP server
   */
  async connect(config: MCPServerConfig): Promise<MCPServer> {
    if (this.servers.has(config.name)) {
      return this.servers.get(config.name)!
    }

    const server: MCPServer = {
      name: config.name,
      client: new Client({
        name: 'nole-code',
        version: '1.0.0',
      }),
      transport: null,
      tools: [],
      status: 'connecting',
    }

    try {
      switch (config.transport) {
        case 'stdio':
          await this.connectStdio(server, config)
          break
        case 'sse':
          await this.connectSSE(server, config)
          break
        case 'streamable-http':
          await this.connectStreamableHTTP(server, config)
          break
        case 'websocket':
          await this.connectWebSocket(server, config)
          break
        default:
          throw new Error(`Unknown transport type: ${config.transport}`)
      }

      // List available tools
      const toolsResult = await server.client.request(
        { method: 'tools/list' },
        ListToolsResultSchema
      )
      server.tools = toolsResult.tools || []

      server.status = 'connected'
      this.servers.set(config.name, server)

      console.log(`\n✅ MCP server "${config.name}" connected with ${server.tools.length} tools`)
      
    } catch (error) {
      server.status = 'error'
      server.error = error instanceof Error ? error.message : String(error)
      console.error(`\n❌ MCP server "${config.name}" failed: ${server.error}`)
    }

    return server
  }

  /**
   * Connect via stdio (local subprocess)
   */
  private async connectStdio(server: MCPServer, config: MCPServerConfig): Promise<void> {
    if (!config.command) {
      throw new Error('stdio transport requires command')
    }

    const options: StdioClientTransportOptions = {
      command: config.command,
      args: config.args || [],
      env: {
        ...process.env,
        ...config.env,
      },
      stderr: 'pipe',
    }

    const transport = new StdioClientTransport(options)
    server.transport = transport

    // Handle stderr output (often useful for debugging)
    transport.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n')
      for (const line of lines) {
        if (line) {
          console.error(`[${config.name}] ${line}`)
        }
      }
    })

    // Spawn the process
    transport.onclose = () => {
      console.log(`[${config.name}] Process closed`)
      server.status = 'disconnected'
    }

    await server.client.connect(transport)

    // Store the process for cleanup
    server.process = transport.stdin ? (transport as any)._proc : undefined
  }

  /**
   * Connect via SSE (Server-Sent Events)
   */
  private async connectSSE(server: MCPServer, config: MCPServerConfig): Promise<void> {
    if (!config.url) {
      throw new Error('SSE transport requires URL')
    }

    const options: SSEClientTransportOptions = {
      url: config.url,
      eventSourceInitDict: {
        headers: config.headers,
      },
    }

    const transport = new SSEClientTransport(options)
    server.transport = transport
    await server.client.connect(transport)
  }

  /**
   * Connect via Streamable HTTP
   */
  private async connectStreamableHTTP(server: MCPServer, config: MCPServerConfig): Promise<void> {
    if (!config.url) {
      throw new Error('streamable-http transport requires URL')
    }

    const headers: Record<string, string> = {
      ...config.headers,
    }

    // Add auth header if specified
    if (config.auth) {
      if (config.auth.type === 'bearer' && config.auth.token) {
        headers['Authorization'] = `Bearer ${config.auth.token}`
      } else if (config.auth.type === 'basic' && config.auth.username) {
        const credentials = Buffer.from(
          `${config.auth.username}:${config.auth.password || ''}`
        ).toString('base64')
        headers['Authorization'] = `Basic ${credentials}`
      }
    }

    const options: StreamableHTTPClientTransportOptions = {
      requestInit: {
        headers,
      },
    }

    const transport = new StreamableHTTPClientTransport(config.url, options)
    server.transport = transport
    await server.client.connect(transport)
  }

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(server: MCPServer, config: MCPServerConfig): Promise<void> {
    if (!config.url) {
      throw new Error('websocket transport requires URL')
    }

    // WebSocket support would require additional implementation
    // For now, fall back to streamable-http if URL looks like HTTP
    if (config.url.startsWith('ws://') || config.url.startsWith('wss://')) {
      console.warn(`WebSocket not yet fully implemented, using HTTP fallback`)
    }

    await this.connectStreamableHTTP(server, config)
  }

  /**
   * Call an MCP tool
   */
  async callTool(
    serverName: string,
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<{ content: string; isError?: boolean }> {
    const server = this.servers.get(serverName)
    if (!server || server.status !== 'connected') {
      throw new Error(`MCP server "${serverName}" not connected`)
    }

    try {
      const result = await server.client.request(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: arguments_,
          },
        },
        CallToolResultSchema
      )

      const content = result.content
        .map(block => {
          if (block.type === 'text') return block.text
          if (block.type === 'image') return `[Image: ${block.source?.mimeType || 'unknown'}]`
          if (block.type === 'resource') return `[Resource: ${block.resource?.uri || 'unknown'}]`
          return JSON.stringify(block)
        })
        .join('\n')

      // Trust the MCP server's authoritative `isError` flag. Heuristic
      // substring matching on "error" misclassifies content like "0 errors
      // found" and aborts healthy steps.
      const isError = Boolean(result.isError)

      return { content, isError }

    } catch (error) {
      return {
        content: `Error calling ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      }
    }
  }

  /**
   * List all available tools from all servers
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = []

    for (const [serverName, server] of this.servers) {
      if (server.status !== 'connected') continue

      for (const tool of server.tools) {
        tools.push({
          name: `mcp__${serverName}__${tool.name}`,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {},
          serverName,
        })
      }
    }

    return tools
  }

  /**
   * Get server status
   */
  getStatus(): Array<{ name: string; status: string; toolCount: number; error?: string }> {
    return Array.from(this.servers.values()).map(s => ({
      name: s.name,
      status: s.status,
      toolCount: s.tools.length,
      error: s.error,
    }))
  }

  /**
   * Disconnect a server
   */
  async disconnect(name: string): Promise<void> {
    const server = this.servers.get(name)
    if (!server) return

    await server.client.close()
    
    if (server.process) {
      server.process.kill()
    }

    this.servers.delete(name)
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    for (const name of this.servers.keys()) {
      await this.disconnect(name)
    }
  }
}

// Singleton instance
export const mcpClient = new MCPClientManager()

/**
 * Load and connect all configured MCP servers
 */
export async function loadMCPServers(): Promise<void> {
  const configs = mcpClient.loadConfigs()
  
  for (const config of configs) {
    await mcpClient.connect(config)
  }
}

/**
 * Get MCP tool definitions for LLM
 */
export function getMCPToolDefs() {
  return mcpClient.getAllTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }))
}

// ============ Registry Singleton (for tool registry compatibility) ============
export class MCPRegistry {
  private client = mcpClient
  
  getTools() {
    return this.client.getAllTools().map(tool => ({
      name: tool.name,  // Already prefixed by getAllTools()
      description: tool.description,
      input_schema: tool.inputSchema,
    }))
  }
  
  parseMCPToolName(name: string) {
    // Split on first __ and second __ to support underscored names
    const firstSep = name.indexOf('__')
    if (firstSep < 0 || !name.startsWith('mcp__')) return null
    const rest = name.slice(firstSep + 2)
    const secondSep = rest.indexOf('__')
    if (secondSep < 0) return null
    return { server: rest.slice(0, secondSep), tool: rest.slice(secondSep + 2) }
  }
  
  async callTool(server: string, tool: string, input: Record<string, unknown>) {
    const result = await this.client.callTool(server, tool, input)
    return result.content
  }
}

export const mcpRegistry = new MCPRegistry()
