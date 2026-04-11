// Nole Code - Permissions System
// Tool-level permission management
// Adapted from Nole Code's permissions architecture

import { EventEmitter } from 'events'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'

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

export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[Permissions] ${context}: ${message}`)
}

class PermissionManager {
  private rules: PermissionRule[] = []
  private mode: PermissionMode = 'ask'  // Default: ask for permission
  private emitter = new EventEmitter()
  private pendingRequests = new Map<string, {
    resolve: (result: PermissionResult) => void
    reject: (err: Error) => void
    timeoutId?: ReturnType<typeof setTimeout>
  }>()

  constructor() {
    this.emitter.setMaxListeners(50) // Prevent memory leak
    this.loadRules()
  }

  private rulesFile(): string {
    return join(homedir(), '.nole-code', 'permissions.json')
  }

  private loadRules(): void {
    try {
      const rulesFile = this.rulesFile()
      if (existsSync(rulesFile)) {
        const data = JSON.parse(readFileSync(rulesFile, 'utf-8'))
        this.rules = data.rules || []
        this.mode = data.mode || 'ask'
      }
    } catch (error) {
      logError('Failed to load rules', error)
      // Fallback to defaults
      this.rules = []
      this.mode = 'ask'
    }
  }

  saveRules(): void {
    try {
      const rulesFile = this.rulesFile()
      mkdirSync(dirname(rulesFile), { recursive: true })
      writeFileSync(rulesFile, JSON.stringify({ rules: this.rules, mode: this.mode }, null, 2))
    } catch (error) {
      logError('Failed to save rules', error)
    }
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

    // Default behavior based on mode
    if (this.mode === 'allow') return 'allow'
    if (this.mode === 'deny') return 'deny'

    // Ask mode - show prompt
    return this.requestPermission(tool, input)
  }

  // Request permission from user
  private requestPermission(tool: string, input: Record<string, unknown>): Promise<PermissionResult> {
    return new Promise((resolve) => {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const preview = JSON.stringify(input).slice(0, 100)

      // Store the pending request
      this.pendingRequests.set(requestId, { resolve, reject: () => {} })

      // Timeout after 60 seconds - FIXED: clear pending request on timeout
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          console.warn(`[Permissions] Request timed out for tool: ${tool}`)
          resolve(false)
        }
      }, 60000)

      // Store timeout ID for cleanup
      const pending = this.pendingRequests.get(requestId)
      if (pending) {
        pending.timeoutId = timeoutId
      }

      // Emit the request event
      this.emitter.emit('permission-request', {
        id: requestId,
        tool,
        input,
        reason: `Tool ${tool} requires permission with input: ${preview}`,
      })
    })
  }

  // Approve or deny a pending request
  respond(requestId: string, approved: boolean): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      // Clear timeout if still pending
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId)
      }
      this.pendingRequests.delete(requestId)
      pending.resolve(approved)
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

  // Clear all pending requests (for cleanup)
  clearPendingRequests(): void {
    for (const [id, pending] of this.pendingRequests) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId)
      }
      pending.resolve(false)
    }
    this.pendingRequests.clear()
  }

  // Get pending request count
  getPendingCount(): number {
    return this.pendingRequests.size
  }
}

// Export singleton
const permissionManager = new PermissionManager()
export { permissionManager }

// For backwards compatibility
export function addRule(rule: PermissionRule): void {
  permissionManager.addRule(rule)
}

export function removeRule(tool: string): void {
  permissionManager.removeRule(tool)
}

export function listRules(): PermissionRule[] {
  return permissionManager.listRules()
}

export function checkPermission(tool: string, input: Record<string, unknown>): Promise<PermissionResult> {
  return permissionManager.check(tool, input)
}

export function onPermissionRequest(handler: (request: {
  id: string
  tool: string
  input: Record<string, unknown>
  reason?: string
}) => void): () => void {
  return permissionManager.onPermissionRequest(handler)
}

export function respondToRequest(requestId: string, approved: boolean): void {
  permissionManager.respond(requestId, approved)
}

// Default deny if no explicit allow
export function enforcePermission(tool: string, input: Record<string, unknown>): Promise<void> {
  return permissionManager.check(tool, input).then(result => {
      if (result !== 'allow') {
        throw new Error(`Permission denied for tool: ${tool}`)
      }
  })
}
