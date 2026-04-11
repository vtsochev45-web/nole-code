/**
 * Hooks System — pre/post tool execution hooks.
 *
 * Load from ~/.nole-code/hooks.json:
 * {
 *   "pre": [
 *     { "tool": "Edit", "command": "echo 'About to edit'" },
 *     { "tool": "GitCommit", "command": "npm test" }
 *   ],
 *   "post": [
 *     { "tool": "Write", "command": "prettier --write ${path}" }
 *   ]
 * }
 */

import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface Hook {
  tool: string      // tool name to match (or "*" for all)
  command: string   // shell command to run
  cwd?: string
}

export interface HooksConfig {
  pre: Hook[]
  post: Hook[]
}

const HOOKS_FILE = join(homedir(), '.nole-code', 'hooks.json')

// FIX: Cache with mtime-based invalidation
let cachedHooks: HooksConfig | null = null
let cachedHooksMtime: number = 0

function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[Hooks] ${context}: ${message}`)
}

/**
 * Escape special shell characters to prevent command injection.
 * Allows safe use of user input in hook commands.
 */
function escapeShellArg(input: string): string {
  // Escape $, `, \, and " to prevent command injection
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/"/g, '\\"')
}

export function loadHooks(): HooksConfig {
  // FIX: Invalidate cache if file was modified
  try {
    if (existsSync(HOOKS_FILE)) {
      const stats = statSync(HOOKS_FILE)
      if (cachedHooks && stats.mtimeMs > cachedHooksMtime) {
        // File was modified, clear cache
        cachedHooks = null
      }
    } else if (cachedHooks !== null) {
      // File was deleted, clear cache
      cachedHooks = null
    }
  } catch {
    // If we can't check stats, clear cache to be safe
    cachedHooks = null
  }

  if (cachedHooks) return cachedHooks

  if (!existsSync(HOOKS_FILE)) {
    cachedHooks = { pre: [], post: [] }
    cachedHooksMtime = 0
    return cachedHooks
  }

  try {
    const stats = statSync(HOOKS_FILE)
    cachedHooksMtime = stats.mtimeMs

    const data = JSON.parse(readFileSync(HOOKS_FILE, 'utf-8'))
    cachedHooks = {
      pre: Array.isArray(data.pre) ? data.pre : [],
      post: Array.isArray(data.post) ? data.post : [],
    }
  } catch (error) {
    logError('Failed to load hooks', error)
    cachedHooks = { pre: [], post: [] }
    cachedHooksMtime = 0
  }

  return cachedHooks
}

/**
 * Clear the hooks cache. Call this after modifying hooks.json.
 */
export function clearHooksCache(): void {
  cachedHooks = null
  cachedHooksMtime = 0
}

export function getPreHooks(toolName: string): Hook[] {
  const hooks = loadHooks()
  return hooks.pre.filter(h => h.tool === toolName || h.tool === '*')
}

export function getPostHooks(toolName: string): Hook[] {
  const hooks = loadHooks()
  return hooks.post.filter(h => h.tool === toolName || h.tool === '*')
}

export async function runHooks(
  hooks: Hook[],
  context: { tool: string; input: Record<string, unknown>; cwd: string },
): Promise<string[]> {
  const results: string[] = []
  const { execFileSync } = require('child_process')

  for (const hook of hooks) {
    try {
      // Replace ${variable} in command with ESCAPED values to prevent injection
      let cmd = hook.command
      for (const [key, val] of Object.entries(context.input)) {
        const escaped = escapeShellArg(String(val))
        cmd = cmd.replace(`\${${key}}`, escaped)
      }
      // Also replace ${tool} with escaped value
      cmd = cmd.replace('${tool}', escapeShellArg(context.tool))

      const output = execFileSync('/bin/bash', ['-c', cmd], {
        encoding: 'utf-8',
        cwd: hook.cwd || context.cwd,
        timeout: 10000,
      }).trim()

      if (output) results.push(output)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logError(`Hook execution failed for ${context.tool}`, err)
      results.push(`Hook error: ${message}`)
    }
  }

  return results
}
