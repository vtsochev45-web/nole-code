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

import { existsSync, readFileSync } from 'fs'
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

let cachedHooks: HooksConfig | null = null

export function loadHooks(): HooksConfig {
  if (cachedHooks) return cachedHooks

  if (!existsSync(HOOKS_FILE)) {
    cachedHooks = { pre: [], post: [] }
    return cachedHooks
  }

  try {
    const data = JSON.parse(readFileSync(HOOKS_FILE, 'utf-8'))
    cachedHooks = {
      pre: Array.isArray(data.pre) ? data.pre : [],
      post: Array.isArray(data.post) ? data.post : [],
    }
  } catch {
    cachedHooks = { pre: [], post: [] }
  }

  return cachedHooks
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
      // Replace ${variable} in command
      let cmd = hook.command
      for (const [key, val] of Object.entries(context.input)) {
        cmd = cmd.replace(`\${${key}}`, String(val))
      }
      cmd = cmd.replace('${tool}', context.tool)

      const output = execFileSync('/bin/bash', ['-c', cmd], {
        encoding: 'utf-8',
        cwd: hook.cwd || context.cwd,
        timeout: 10000,
      }).trim()

      if (output) results.push(output)
    } catch (err: any) {
      results.push(`Hook error: ${err.message || err}`)
    }
  }

  return results
}
