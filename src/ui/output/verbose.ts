/**
 * Streaming Output System
 * Streams tool results to UI in real-time with verbose execution info
 * 
 * Features:
 * - TOOL_RESULT_STREAMING: Stream tool output to UI as they arrive
 * - VERBOSE_OUTPUT: Show detailed execution info
 * - TOOL_TIMING: Show execution time per tool
 * - Progress indicators and token budget display
 */

import { c, spin, tokenBudgetDisplay, divider } from './styles.js'
import { feature } from '../../feature-flags/index.js'
import { getTokenBudget } from '../../services/compact/index.js'

// Verbose output state
let isVerbose = false
let showTimings = false
let streamingEnabled = false

/**
 * Initialize verbose output system
 */
export function initVerboseOutput(): void {
  isVerbose = feature('VERBOSE_OUTPUT')
  showTimings = feature('TOOL_TIMING')
  streamingEnabled = feature('TOOL_RESULT_STREAMING')
  
  if (isVerbose) {
    console.log(c.dim('\n🔍 Verbose output enabled\n'))
  }
}

/**
 * Enable/disable verbose output
 */
export function setVerbose(enabled: boolean): void {
  isVerbose = enabled
}

/**
 * Enable/disable timing display
 */
export function setShowTimings(enabled: boolean): void {
  showTimings = enabled
}

/**
 * Format a tool execution header
 */
export function formatToolHeader(
  toolName: string,
  input: Record<string, unknown>,
  options: {
    showInput?: boolean
    maxInputWidth?: number
  } = {}
): string {
  const { showInput = isVerbose, maxInputWidth = 80 } = options
  
  const parts: string[] = []
  
  // Tool name with icon
  const icon = streamingEnabled ? c.cyan('⟳') : c.cyan('●')
  parts.push(`\n${icon} ${c.bold(toolName)}`)
  
  // Show command for Bash tools
  if (toolName === 'Bash' && input.command) {
    const cmd = String(input.command)
    const preview = cmd.length > maxInputWidth 
      ? cmd.slice(0, maxInputWidth - 3) + '...' 
      : cmd
    parts.push(` ${c.dim(preview)}`)
  }
  
  // Show full input in verbose mode
  if (showInput) {
    const inputPreview = JSON.stringify(input).slice(0, maxInputWidth)
    if (inputPreview.length > maxInputWidth - 10) {
      parts.push(`\n  ${c.dim('Input: ' + inputPreview)}`)
    }
  }
  
  return parts.join('')
}

/**
 * Format tool result with optional streaming
 */
export function formatToolResult(
  toolName: string,
  result: string,
  options: {
    isError?: boolean
    maxLines?: number
    streaming?: boolean
    startTime?: number
  } = {}
): string {
  const { 
    isError = false, 
    maxLines = isVerbose ? 50 : 20,
    streaming = streamingEnabled,
    startTime 
  } = options
  
  const parts: string[] = []
  
  // Icon
  const icon = isError 
    ? c.red('✗') 
    : streaming 
      ? c.green('✓') 
      : c.green('●')
  
  // Timing info
  if (showTimings && startTime) {
    const elapsed = Date.now() - startTime
    const timing = elapsed > 1000 
      ? `${(elapsed / 1000).toFixed(1)}s` 
      : `${elapsed}ms`
    parts.push(` ${c.dim(`[${timing}]`)}`)
  }
  
  // Result content
  const lines = result.split('\n')
  const truncated = lines.length > maxLines
  const displayLines = truncated
    ? lines.slice(0, maxLines)
    : lines
  
  if (displayLines.length > 0) {
    parts.push('\n')
    
    if (streaming && !isError) {
      // Progressive display for streaming
      parts.push(...displayLines.map(line => `  ${line}`))
    } else {
      // Standard display
      const joined = displayLines.join('\n')
      parts.push(`  ${c.dim(joined.slice(0, 500))}`)
    }
    
    if (truncated) {
      const more = lines.length - maxLines
      parts.push(`\n  ${c.dim(`+${more} more lines`)}`)
    }
  }
  
  return parts.join('')
}

/**
 * Format a progress indicator
 */
export function formatProgress(
  message: string,
  options: {
    type?: 'spinner' | 'dots' | 'progress'
    frame?: number
  } = {}
): string {
  const { type = 'spinner', frame = 0 } = options
  
  switch (type) {
    case 'spinner':
      return `${spin()} ${message}`
    case 'dots':
      return `${c.dim('.'.repeat(frame % 3 + 1))} ${message}`
    default:
      return `⏳ ${message}`
  }
}

/**
 * Stream tool result lines to stdout
 */
export function streamResult(
  lines: string[],
  options: {
    prefix?: string
    delayMs?: number
    onComplete?: () => void
  } = {}
): () => void {
  const { prefix = '  ', delayMs = 5, onComplete } = options
  
  let index = 0
  let cancelled = false
  
  // Stream each line with small delay
  const streamNext = () => {
    if (cancelled || index >= lines.length) {
      if (onComplete) onComplete()
      return
    }
    
    console.log(`${prefix}${lines[index]}`)
    index++
    
    if (!cancelled) {
      setTimeout(streamNext, delayMs)
    }
  }
  
  // Start streaming
  if (lines.length > 0) {
    streamNext()
  } else {
    if (onComplete) onComplete()
  }
  
  // Return cancellation function
  return () => {
    cancelled = true
  }
}

/**
 * Print token budget status
 */
export function printTokenBudget(messages: Array<{ role: string, content: string }>): void {
  if (!feature('AUTO_COMPACT') && !feature('SESSION_COMPACT')) return
  
  const budget = getTokenBudget(messages)
  console.log(c.dim(`\n${tokenBudgetDisplay(budget.used, budget.max)}\n`))
}

/**
 * Print session context header
 */
export function printContextHeader(
  sessionInfo: {
    sessionId: string
    cwd: string
    model: string
  }
): void {
  if (!isVerbose) return
  
  console.log(c.dim(divider()))
  console.log(`Session: ${sessionInfo.sessionId}`)
  console.log(`CWD: ${sessionInfo.cwd}`)
  console.log(`Model: ${sessionInfo.model}`)
  console.log(c.dim(divider()))
}

/**
 * Print tool permission check
 */
export function printPermissionCheck(
  toolName: string,
  input: Record<string, unknown>,
  result: 'allow' | 'deny' | 'ask',
  reason?: string
): void {
  if (!isVerbose) return
  
  const icon = result === 'allow' ? '✅' : result === 'deny' ? '❌' : '⚠️'
  const cmd = input.command 
    ? ` ${(input.command as string).slice(0, 50)}` 
    : ''
  
  console.log(`${icon} ${toolName}${cmd}: ${result}${reason ? ` (${reason})` : ''}`)
}

/**
 * Print error with optional details
 */
export function printError(
  message: string,
  options: {
    details?: string
    stack?: string
  } = {}
): void {
  const { details, stack } = options
  
  console.error(`\n${c.red('✗ Error:')} ${message}`)
  
  if (details && isVerbose) {
    console.error(`  ${c.dim(details)}`)
  }
  
  if (stack && isVerbose) {
    console.error(c.dim(stack))
  }
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(`\n${c.green('✓')} ${message}\n`)
}

/**
 * Print warning message
 */
export function printWarning(message: string): void {
  console.log(`\n${c.yellow('⚠')} ${message}\n`)
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  console.log(`\n${c.blue('ℹ')} ${message}\n`)
}

/**
 * Print step progress
 */
export function printStep(
  step: number,
  total: number,
  message: string
): void {
  const progress = `[${step}/${total}]`
  console.log(`${c.cyan(progress)} ${message}`)
}

/**
 * Create a multi-line progress tracker
 */
export function createProgressTracker(
  total: number,
  options: {
    prefix?: string
    onUpdate?: (percent: number) => void
  } = {}
) {
  const { prefix = '', onUpdate } = options
  let current = 0
  
  return {
    tick(message?: string): void {
      current++
      const percent = Math.round((current / total) * 100)
      const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5))
      
      console.log(`\r${prefix}${bar} ${percent}%${message ? ' ' + message : ''}`)
      
      if (onUpdate) onUpdate(percent)
      
      if (current >= total) {
        console.log('\n')
      }
    },
    
    progress(percent: number, message?: string): void {
      const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5))
      console.log(`\r${prefix}${bar} ${percent}%${message ? ' ' + message : ''}`)
    },
    
    done(message?: string): void {
      current = total
      console.log(`\r${prefix}${'█'.repeat(20)} 100%${message ? ' ' + message : ''}\n`)
      if (onUpdate) onUpdate(100)
    },
  }
}

/**
 * Print a table with aligned columns
 */
export function printTable(
  headers: string[],
  rows: string[][],
  options: {
    compact?: boolean
  } = {}
): void {
  const { compact = false } = options
  
  if (compact) {
    // Simple compact format
    console.log(headers.join('\t'))
    for (const row of rows) {
      console.log(row.join('\t'))
    }
    return
  }
  
  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxRow = Math.max(...rows.map(r => (r[i] || '').length))
    return Math.max(h.length, maxRow)
  })
  
  // Header line
  const headerLine = headers.map((h, i) => {
    return c.bold(h) + ' '.repeat(colWidths[i] - h.length)
  }).join(' │ ')
  
  console.log('')
  console.log(headerLine)
  console.log(colWidths.map(w => '─'.repeat(w)).join('─┼─'))
  
  // Data lines
  for (const row of rows) {
    const dataLine = row.map((cell, i) => {
      return cell + ' '.repeat(colWidths[i] - cell.length)
    }).join(' │ ')
    console.log(dataLine)
  }
  console.log('')
}

/**
 * Print diff output
 */
export function printDiff(
  additions: string[],
  deletions: string[]
): void {
  const parts: string[] = []
  
  for (const line of deletions) {
    parts.push(`${c.red('- ' + line)}`)
  }
  
  for (const line of additions) {
    parts.push(`${c.green('+ ' + line)}`)
  }
  
  console.log(parts.join('\n'))
}

/**
 * Print a box with content
 */
export function printBox(
  content: string,
  options: {
    title?: string
    color?: 'cyan' | 'green' | 'yellow' | 'red' | 'blue'
    border?: boolean
  } = {}
): void {
  const { title, color = 'cyan', border = true } = options
  
  if (!border) {
    console.log(content)
    return
  }
  
  const lines = content.split('\n')
  const maxWidth = Math.max(...lines.map(l => l.length))
  
  const borderColor = c[color]
  const topBorder = `┌─ ${borderColor(title || '')} ${'─'.repeat(Math.max(0, maxWidth - (title?.length || 0) - 3))}─┐`
  const bottomBorder = `└${'─'.repeat(maxWidth + 2)}┘`
  
  console.log('')
  console.log(topBorder)
  for (const line of lines) {
    console.log(`│ ${borderColor(line)}${' '.repeat(maxWidth - line.length)} │`)
  }
  console.log(bottomBorder)
  console.log('')
}

/**
 * Clear the current line (for progress updates)
 */
export function clearLine(): void {
  process.stdout.write('\r\x1b[K')
}

/**
 * Update progress on current line
 */
export function updateLine(message: string): void {
  clearLine()
  process.stdout.write(`\r${message}`)
}

// Re-export styles for convenience
export { c, divider, spin, tokenBudgetDisplay }
