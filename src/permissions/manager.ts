// Nole Code - Permissions System
// Tool-level permission management
// Adapted from Nole Code's permissions architecture

import { EventEmitter } from 'events'

export type PermissionMode = 'allow' | 'deny' | 'ask'
export type PermissionResult = 'allow' | 'deny' | 'ask'

export interface PermissionCheck {
  tool: string
  input: Record<string, unknown>
  mode: PermissionMode
  reason?: string
}

export interface PermissionRule {
  tool: string
  pattern?: string
  action: 'allow' | 'deny' | 'ask'
  reason?: string
}

class PermissionManager {
  private rules: PermissionRule[] = []
  private mode: PermissionMode = 'ask'  // Default: ask for permission
  private emitter = new EventEmitter()
  private pendingRequests = new Map<string, {
    resolve: (result: PermissionResult) => void
    reject: (err: Error) => void
  }>()

  constructor() {
    this.loadRules()
  }

  private rulesFile(): string {
    const { join } = require('path')
    const { homedir } = require('os')
    return join(homedir(), '.nole-code', 'permissions.json')
  }

  private loadRules(): void {
    try {
      const { existsSync, readFileSync } = require('fs')
      const rulesFile = this.rulesFile()
      if (existsSync(rulesFile)) {
        const data = JSON.parse(readFileSync(rulesFile, 'utf-8'))
        this.rules = data.rules || []
        this.mode = data.mode || 'ask'
      }
    } catch {}
  }

  saveRules(): void {
    try {
      const { mkdirSync, writeFileSync } = require('fs')
      const { dirname } = require('path')
      const rulesFile = this.rulesFile()
      mkdirSync(dirname(rulesFile), { recursive: true })
      writeFileSync(rulesFile, JSON.stringify({ rules: this.rules, mode: this.mode }, null, 2))
    } catch {}
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode
    this.saveRules()
  }

  getMode(): PermissionMode {
    return this.mode
  }

  addRule(rule: PermissionRule): void {
    this.rules.push(rule)
    this.saveRules()
  }

  removeRule(tool: string): void {
    this.rules = this.rules.filter(r => r.tool !== tool)
    this.saveRules()
  }

  listRules(): PermissionRule[] {
    return [...this.rules]
  }

  // Check if a tool is allowed
  async check(tool: string, input: Record<string, unknown>): Promise<PermissionResult> {
    // Check rules first
    for (const rule of this.rules) {
      if (rule.tool === tool) {
        if (rule.pattern && JSON.stringify(input).includes(rule.pattern)) {
          return rule.action
        }
        if (!rule.pattern) {
          return rule.action
        }
      }
    }

    // Global mode
    switch (this.mode) {
      case 'allow':
        return 'allow'
      case 'deny':
        return 'deny'
      case 'ask':
        return 'ask'
    }
  }

  // Request permission interactively
  async requestPermission(check: PermissionCheck): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random()}`

      this.emitter.emit('permission-request', {
        id: requestId,
        tool: check.tool,
        input: check.input,
        reason: check.reason,
      })

      // Store the pending request
      this.pendingRequests.set(requestId, { resolve, reject })

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          resolve(false)
        }
      }, 60000)
    })
  }

  // Approve or deny a pending request
  respond(requestId: string, approved: boolean): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      pending.resolve(approved)
      this.pendingRequests.delete(requestId)
    }
  }

  // Subscribe to permission requests
  onPermissionRequest(handler: (request: {
    id: string
    tool: string
    input: Record<string, unknown>
    reason?: string
  }) => void): () => void {
    this.emitter.on('permission-request', handler)
    return () => this.emitter.off('permission-request', handler)
  }
}

export const permissions = new PermissionManager()

// Pre-configured permission rules for common tools
export const DEFAULT_ALLOW = [
  'Bash:ls',
  'Bash:cat',
  'Bash:pwd',
  'Bash:git status',
  'Bash:git log',
  'Bash:git diff',
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'TodoWrite',
  'TaskList',
  'TaskGet',
  'Sleep',
]

export const DEFAULT_DENY = [
  'Bash:sudo',
  'Bash:rm -rf /',
  'Bash:mkfs',
  'Bash:dd',
  'Bash:>:/dev/',
]

export const DANGEROUS_PATTERNS = [
  { pattern: 'rm -rf', reason: 'Recursive delete can remove important files' },
  { pattern: '>/dev/', reason: 'Writing to device files can be destructive' },
  { pattern: 'curl.*\|.*sh', reason: 'Pipe to shell is a common attack vector' },
  { pattern: 'wget.*\|.*sh', reason: 'Pipe to shell is a common attack vector' },
  { pattern: 'chmod 777', reason: 'World-writable permissions are insecure' },
  { pattern: ':(){ :|:& };:', reason: 'Fork bomb detected' },
]

// Permission-aware tool executor
export async function executeWithPermission(
  tool: string,
  input: Record<string, unknown>,
  executor: () => Promise<string>,
): Promise<string> {
  const result = await permissions.check(tool, input)

  switch (result) {
    case 'allow':
      return executor()

    case 'deny':
      throw new Error(`Permission denied for tool: ${tool}`)

    case 'ask':
      const allowed = await permissions.requestPermission({
        tool,
        input,
        mode: 'ask',
        reason: `Tool "${tool}" requires permission`,
      })
      if (allowed) {
        return executor()
      } else {
        throw new Error(`Permission denied for tool: ${tool}`)
      }
  }
}
