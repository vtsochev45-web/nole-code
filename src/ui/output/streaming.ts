/**
 * Streaming Tool Display - Real-time tool output streaming
 */

import { getSpinnerFrame, advanceSpinner, getVerboseVerb } from './spinner.js'

const HOOK = '⎿'
const WORKING = '⏱'
const CANCELLED = '⏱ Cancelled'
const SUCCESS = '✓'
const ERROR = '✗'
const EXPAND = '(ctrl+o to expand)'

const dim = '\x1b[2m'
const reset = '\x1b[0m'
const cyan = '\x1b[36m'
const yellow = '\x1b[33m'
const green = '\x1b[32m'
const red = '\x1b[31m'
const magenta = '\x1b[35m'

export function formatToolStart(name: string, input: Record<string, unknown>, opts: { verbose?: boolean; parallel?: boolean; hook?: string } = {}): string {
  const { verbose = false, parallel = false, hook } = opts
  const frame = getSpinnerFrame()
  advanceSpinner()
  
  let cmd = ''
  if (input.command) cmd = String(input.command).slice(0, 60)
  else if (input.description) cmd = String(input.description).slice(0, 60)
  
  let line = parallel 
    ? `${dim}${WORKING}${reset} ${cyan}${frame}${reset} ${name}`
    : `${cyan}${frame}${reset} ${name}`
  
  if (cmd) line += ` ${dim}(${cmd})${reset}`
  if (hook) line += `\n${dim}${HOOK} ${hook}${reset}`
  
  return line
}

export function formatHook(name: string, msg: string, err = false): string {
  return `  ${err ? red : dim}${HOOK}${reset} PreToolUse:${name}: ${msg}`
}

export function formatWorking(info: { dir?: string; path?: string; msg?: string }): string {
  const parts: string[] = []
  if (info.dir) parts.push(`${dim}${WORKING} Working Directory: ${info.dir}${reset}`)
  if (info.path) parts.push(`${dim}${WORKING} Full Path: ${info.path}${reset}`)
  if (info.msg) parts.push(`${dim}${WORKING} ${info.msg}${reset}`)
  return parts.join('\n')
}

export function formatCancelled(reason: string): string {
  return `${yellow}${CANCELLED}: ${reason}${reset}`
}

export function formatComplete(name: string, ms: number, opts: { success?: boolean; error?: string; lines?: number; maxLines?: number } = {}): string {
  const { success = true, error, lines = 0, maxLines = 10 } = opts
  
  if (!success) {
    let out = `  ${red}${ERROR}${reset} ${name}`
    if (error) out += `\n  ${dim}${error.slice(0, 80)}${reset}`
    const elapsed = ms > 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`
    out += ` ${dim}[${elapsed}]${reset}`
    return out
  }
  
  const elapsed = ms > 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`
  let out = `  ${green}${SUCCESS}${reset} ${name} ${dim}[${elapsed}]${reset}`
  
  if (lines > maxLines) {
    out += ` ${dim}… +${lines - maxLines} lines ${EXPAND}${reset}`
  }
  
  return out
}

export function formatSummary(ms: number, tools: number, errors: number): string {
  const time = (ms / 1000).toFixed(0)
  if (errors === 0) {
    return `${magenta}✻${reset} Worked for ${time}s · ${dim}${green}${tools}/${tools} tools${reset}`
  }
  return `${yellow}⚠${reset} Completed in ${time}s (${errors} error${errors > 1 ? 's' : ''}) · ${tools} tools`
}

export function formatShortcuts(): string {
  return `${dim}Esc to cancel · ctrl+e to explain · ctrl+o to expand${reset}`
}

export function formatTopBar(version: string, model: string, cwd: string): string {
  return `${cyan}▐▛███▜▌${reset} Nole Code ${version} · ${dim}${model}${reset} · ${dim}${cwd}${reset}`
}
