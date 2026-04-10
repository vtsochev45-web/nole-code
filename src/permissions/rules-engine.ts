/**
 * Permission Rules Engine
 * Pattern-based permission system for tools
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { feature } from '../feature-flags/index.js'

export type PermissionMode = 'default' | 'ask' | 'bypass' | 'readonly' | 'auto'
export type PermissionResult = 'allow' | 'deny' | 'ask'

export interface PermissionRule {
  pattern: string  // e.g., "Bash(git *)" or "Bash(rm *)"
  action: 'allow' | 'deny' | 'ask'
  reason?: string
  tool?: string    // Tool name (Bash, Edit, Read, etc.)
}

const PERMISSIONS_DIR = join(homedir(), '.nole-code')
const PERMISSIONS_FILE = join(PERMISSIONS_DIR, 'permissions.json')

// Default rules
const DEFAULT_RULES: PermissionRule[] = [
  // Safe read operations
  { pattern: 'Bash(ls *)', action: 'allow', reason: 'Listing directories is safe' },
  { pattern: 'Bash(cat *)', action: 'allow', reason: 'Reading files is safe' },
  { pattern: 'Bash(grep *)', action: 'allow', reason: 'Searching is safe' },
  { pattern: 'Bash(find *)', action: 'allow', reason: 'Finding files is safe' },
  { pattern: 'Read(*)', action: 'allow', reason: 'Reading files is safe' },
  { pattern: 'Glob(*)', action: 'allow', reason: 'Finding patterns is safe' },
  { pattern: 'WebSearch(*)', action: 'allow', reason: 'Web searches are safe' },
  { pattern: 'WebFetch(*)', action: 'allow', reason: 'Fetching URLs is safe' },
  
  // Git operations (safe)
  { pattern: 'Bash(git status *)', action: 'allow', reason: 'Git status is read-only' },
  { pattern: 'Bash(git log *)', action: 'allow', reason: 'Git log is read-only' },
  { pattern: 'Bash(git diff *)', action: 'allow', reason: 'Git diff is read-only' },
  { pattern: 'Bash(git branch *)', action: 'allow', reason: 'Git branch listing is safe' },
  
  // Package managers
  { pattern: 'Bash(npm install *)', action: 'ask', reason: 'Installing packages modifies node_modules' },
  { pattern: 'Bash(bun install *)', action: 'ask', reason: 'Installing packages modifies node_modules' },
  { pattern: 'Bash(yarn install *)', action: 'ask', reason: 'Installing packages modifies node_modules' },
  { pattern: 'Bash(pnpm install *)', action: 'ask', reason: 'Installing packages modifies node_modules' },
  
  // Destructive operations
  { pattern: 'Bash(rm *)', action: 'ask', reason: 'Removing files is destructive', tool: 'Bash' },
  { pattern: 'Bash(rmdir *)', action: 'ask', reason: 'Removing directories is destructive', tool: 'Bash' },
  { pattern: 'Bash(mv *)', action: 'ask', reason: 'Moving files can overwrite', tool: 'Bash' },
  { pattern: 'Bash(chmod *)', action: 'ask', reason: 'Changing permissions can break access', tool: 'Bash' },
  { pattern: 'Bash(chown *)', action: 'ask', reason: 'Changing ownership can lock out access', tool: 'Bash' },
  { pattern: 'Bash(sudo *)', action: 'deny', reason: 'Privilege escalation is dangerous', tool: 'Bash' },
  { pattern: 'Bash(curl http*)', action: 'ask', reason: 'Network requests have risks', tool: 'Bash' },
  
  // Code editing
  { pattern: 'Write(*)', action: 'ask', reason: 'Creating files modifies the project', tool: 'Write' },
  { pattern: 'Edit(*)', action: 'ask', reason: 'Editing files modifies the project', tool: 'Edit' },
  { pattern: 'Bash(npm run build *)', action: 'ask', reason: 'Build commands execute code', tool: 'Bash' },
  { pattern: 'Bash(bun run *)', action: 'ask', reason: 'Running scripts executes code', tool: 'Bash' },
]

export interface PermissionContext {
  mode: PermissionMode
  toolName: string
  input: Record<string, unknown>
  cwd: string
}

let permissionRules: PermissionRule[] = [...DEFAULT_RULES]
let currentMode: PermissionMode = 'default'

/**
 * Load permissions from file
 */
export function loadPermissions(): void {
  if (!existsSync(PERMISSIONS_FILE)) {
    permissionRules = [...DEFAULT_RULES]
    savePermissions()
    return
  }
  
  try {
    const data = JSON.parse(readFileSync(PERMISSIONS_FILE, 'utf-8'))
    permissionRules = data.rules || [...DEFAULT_RULES]
    currentMode = data.mode || 'default'
  } catch {
    permissionRules = [...DEFAULT_RULES]
  }
}

/**
 * Save permissions to file
 */
export function savePermissions(): void {
  const data = {
    rules: permissionRules,
    mode: currentMode,
    updated: new Date().toISOString(),
  }
  writeFileSync(PERMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Set permission mode
 */
export function setPermissionMode(mode: PermissionMode): void {
  currentMode = mode
  savePermissions()
  console.log(`Permission mode: ${mode}`)
}

/**
 * Get current permission mode
 */
export function getPermissionMode(): PermissionMode {
  return currentMode
}

/**
 * Add a permission rule
 */
export function addRule(rule: PermissionRule): void {
  // Remove existing rule with same pattern
  permissionRules = permissionRules.filter(r => r.pattern !== rule.pattern)
  permissionRules.push(rule)
  savePermissions()
}

/**
 * Remove a permission rule
 */
export function removeRule(pattern: string): void {
  permissionRules = permissionRules.filter(r => r.pattern !== pattern)
  savePermissions()
}

/**
 * Match a pattern against a tool call
 * Supports wildcards: * matches anything, () groups tool names
 * Example: "Bash(git *)" matches "Bash", "git status"
 */
function matchPattern(pattern: string, toolName: string, input: Record<string, unknown>): boolean {
  // Parse pattern: ToolName(input_pattern)
  const match = pattern.match(/^(\w+)\((.*)\)$/)
  
  if (!match) {
    // Simple pattern - just tool name
    return toolName === pattern || pattern === '*'
  }
  
  const [, patternTool, patternInput] = match
  
  // Check tool name
  if (patternTool !== toolName && patternTool !== '*') {
    return false
  }
  
  // Check input pattern
  if (patternInput === '*') {
    return true
  }
  
  // For Bash commands, check against command string
  if (toolName === 'Bash' && typeof input.command === 'string') {
    const command = input.command
    // Wildcard matching
    const regex = new RegExp(
      '^' + patternInput.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    )
    return regex.test(command)
  }
  
  // For other tools, check if input contains the pattern
  const inputStr = JSON.stringify(input)
  return inputStr.includes(patternInput)
}

/**
 * Check permission for a tool call
 */
export function checkPermission(context: PermissionContext): {
  result: PermissionResult
  reason: string
  rule?: PermissionRule
} {
  if (!feature('PERMISSION_RULES')) {
    return { result: 'allow', reason: 'Permission rules disabled' }
  }
  
  // Mode-based overrides
  if (currentMode === 'bypass') {
    return { result: 'allow', reason: 'Bypass mode enabled' }
  }
  
  if (currentMode === 'readonly') {
    const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Bash']
    const isReadOnly = readOnlyTools.includes(context.toolName) &&
      context.toolName !== 'Bash' ||
      (context.toolName === 'Bash' && /^(ls|cat|grep|find|pwd|git status|git log|git diff)/.test(
        (context.input.command as string) || ''
      ))
    
    if (!isReadOnly) {
      return { result: 'deny', reason: 'Read-only mode enabled' }
    }
  }
  
  // Find matching rule (last matching rule wins)
  let matchingRule: PermissionRule | undefined
  
  for (const rule of permissionRules) {
    if (matchPattern(rule.pattern, context.toolName, context.input)) {
      matchingRule = rule
    }
  }
  
  if (matchingRule) {
    return {
      result: matchingRule.action,
      reason: matchingRule.reason || `Rule: ${matchingRule.pattern}`,
      rule: matchingRule,
    }
  }
  
  // No matching rule
  if (currentMode === 'auto') {
    // Auto mode: allow safe-looking commands, ask for others
    const safeTools = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch']
    if (safeTools.includes(context.toolName)) {
      return { result: 'allow', reason: 'Auto-allowed safe tool' }
    }
    return { result: 'ask', reason: 'No rule found, prompting user' }
  }
  
  return { result: 'ask', reason: 'No matching rule found' }
}

/**
 * Get all permission rules
 */
export function getRules(): PermissionRule[] {
  return [...permissionRules]
}

/**
 * Reset to default rules
 */
export function resetRules(): void {
  permissionRules = [...DEFAULT_RULES]
  savePermissions()
}

/**
 * Format permission for display
 */
export function formatPermission(
  toolName: string,
  input: Record<string, unknown>,
  result: PermissionResult,
  reason: string
): string {
  const icon = result === 'allow' ? '✅' : result === 'deny' ? '❌' : '⚠️'
  const cmd = input.command ? ` ${(input.command as string).slice(0, 50)}` : ''
  return `${icon} ${toolName}${cmd}: ${result} (${reason})`
}
