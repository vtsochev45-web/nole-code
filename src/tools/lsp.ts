// Nole Code - LSP Tool
// Language Server Protocol integration for intelligent code editing
// Adapted from Nole Code's LSPTool

import { spawn, execSync, ChildProcess } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { EventEmitter } from 'events'

// LSP message types
interface LSPMessage {
  jsonrpc: '2.0'
  id?: number
  method: string
  params?: unknown
}

interface LSPResponse {
  jsonrpc: '2.0'
  id?: number
  result?: unknown
  error?: { code: number; message: string }
}

type LSPClientCallback = (msg: LSPResponse) => void

export interface LSPConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  rootUri?: string
  documentSelector?: string[]
}

class LSPClient {
  private proc: ChildProcess | null = null
  private callbacks = new Map<number, LSPClientCallback>()
  private messageId = 0
  private emitter = new EventEmitter()
  private initialized = false

  constructor(private config: LSPConfig) {}

  async start(): Promise<void> {
    const { command, args = [], env = {}, rootUri } = this.config

    this.proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })

    // Handle stderr (LSP logs)
    this.proc.stderr?.on('data', (data: Buffer) => {
      // LSP servers log to stderr - we can ignore or log them
    })

    // Handle stdout (LSP messages)
    let buffer = ''
    this.proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString()
      this.processBuffer(buffer)
    })

    // Initialize the LSP
    await this.initialize(rootUri)
  }

  private processBuffer(buffer: string) {
    // LSP messages are separated by Content-Length header
    const lines = buffer.split('\r\n')
    let i = 0
    while (i < lines.length) {
      if (lines[i]?.startsWith('Content-Length:')) {
        const length = parseInt(lines[i].split(':')[1].trim(), 10)
        if (lines[i + 1] === '') {
          const body = lines.slice(i + 2, i + 2 + Math.ceil(length / 100)).join('')
          if (body.length >= length) {
            try {
              const msg = JSON.parse(body) as LSPResponse
              this.handleMessage(msg)
              buffer = lines.slice(i + 2 + Math.ceil(length / 100)).join('\r\n')
              i = 0
            } catch {}
          } else {
            i++
          }
        } else {
          i++
        }
      } else {
        i++
      }
    }
  }

  private handleMessage(msg: LSPResponse) {
    if (msg.id !== undefined && this.callbacks.has(msg.id)) {
      const cb = this.callbacks.get(msg.id)!
      this.callbacks.delete(msg.id)
      cb(msg)
    }
    this.emitter.emit('message', msg)
  }

  private send(msg: Omit<LSPMessage, 'jsonrpc'>, callback?: LSPClientCallback): void {
    if (!this.proc || !this.proc.stdin) return

    if (callback) {
      const id = ++this.messageId
      msg.id = id
      this.callbacks.set(id, callback)
    }

    const body = JSON.stringify({ jsonrpc: '2.0', ...msg })
    const header = `Content-Length: ${body.length}\r\n\r\n`

    this.proc.stdin.write(header + body)
  }

  private async initialize(rootUri?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.send({
        method: 'initialize',
        params: {
          processId: process.pid,
          rootUri: rootUri || `file://${process.cwd()}`,
          capabilities: {
            textDocument: {
              synchronization: { didSave: true },
              completion: { resolveProvider: true },
              hover: { provider: true },
              definition: { provider: true },
              references: { provider: true },
              rename: { provider: true },
            },
            workspace: {
              applyEdit: true,
              workspaceFolders: true,
            },
          },
        },
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error.message))
        } else {
          this.initialized = true
          // Send initialized notification
          this.send({ method: 'initialized', params: {} })
          resolve()
        }
      })
    })
  }

  // Text document methods
  async textDocumentDidOpen(uri: string, languageId: string, content: string): Promise<void> {
    this.send({
      method: 'textDocument/didOpen',
      params: {
        textDocument: { uri, languageId, version: 1, text: content },
      },
    })
  }

  async textDocumentDidChange(uri: string, content: string, version = 1): Promise<void> {
    this.send({
      method: 'textDocument/didChange',
      params: {
        textDocument: { uri, version },
        contentChanges: [{ text: content }],
      },
    })
  }

  async textDocumentDidSave(uri: string, content?: string): Promise<void> {
    this.send({
      method: 'textDocument/didSave',
      params: {
        textDocument: { uri },
        text: content,
      },
    })
  }

  async textDocumentHover(uri: string, line: number, character: number): Promise<string | null> {
    return this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    }) as Promise<string | null>
  }

  async textDocumentDefinition(uri: string, line: number, character: number): Promise<unknown> {
    return this.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position: { line, character },
    })
  }

  async textDocumentCompletion(uri: string, line: number, character: number): Promise<unknown> {
    return this.sendRequest('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    })
  }

  async textDocumentRename(uri: string, line: number, character: number, newName: string): Promise<unknown> {
    return this.sendRequest('textDocument/rename', {
      textDocument: { uri },
      position: { line, character },
      newName,
    })
  }

  async textDocumentReferences(uri: string, line: number, character: number): Promise<unknown> {
    return this.sendRequest('textDocument/references', {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: true },
    })
  }

  private sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.send({ method, params }, (response) => {
        if (response.error) {
          reject(new Error(response.error.message))
        } else {
          resolve(response.result || null)
        }
      })
    })
  }

  onNotification(method: string, handler: (params: unknown) => void): void {
    this.emitter.on(method, handler)
  }

  stop(): void {
    if (this.proc) {
      this.send({ method: 'shutdown' })
      this.proc.kill()
      this.proc = null
      this.initialized = false
    }
  }
}

// LSP tool registry
const lspClients = new Map<string, LSPClient>()

export async function startLSP(name: string, config: LSPConfig): Promise<void> {
  const client = new LSPClient(config)
  await client.start()
  lspClients.set(name, client)
}

export function getLSP(name: string): LSPClient | undefined {
  return lspClients.get(name)
}

export function stopLSP(name: string): void {
  const client = lspClients.get(name)
  if (client) {
    client.stop()
    lspClients.delete(name)
  }
}

// Auto-detect LSP for a language
export function detectLSP(languageId: string): LSPConfig | null {
  const languageServers: Record<string, LSPConfig> = {
    typescript: {
      command: 'typescript-language-server',
      args: ['--stdio'],
    },
    javascript: {
      command: 'typescript-language-server',
      args: ['--stdio'],
    },
    python: {
      command: 'python-language-server',
      args: ['--stdio'],
    },
    rust: {
      command: 'rust-analyzer',
      args: [],
    },
    go: {
      command: 'gopls',
      args: [],
    },
    java: {
      command: 'jdtls',
      args: [],
    },
    c: {
      command: 'clangd',
      args: ['--background-index'],
    },
    cpp: {
      command: 'clangd',
      args: ['--background-index'],
    },
    css: {
      command: 'vscode-css-language-server',
      args: ['--stdio'],
    },
    html: {
      command: 'vscode-html-language-server',
      args: ['--stdio'],
    },
    json: {
      command: 'vscode-json-language-server',
      args: ['--stdio'],
    },
    markdown: {
      command: 'markdown-language-server',
      args: ['--stdio'],
    },
    yaml: {
      command: 'yaml-language-server',
      args: ['--stdio'],
    },
  }

  return languageServers[languageId] || null
}
