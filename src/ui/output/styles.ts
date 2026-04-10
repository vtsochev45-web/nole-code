/**
 * Terminal Output Styling
 * Color utilities and styled output formatters
 */

const ESC = '\x1b['
const RESET = '${ESC}0m'
const BOLD = '${ESC}1m'
const DIM = '${ESC}2m'
const ITALIC = '${ESC}3m'
const UNDERLINE = '${ESC}4m'

// Colors
const colors = {
  black: '0',
  red: '1',
  green: '2',
  yellow: '3',
  blue: '4',
  magenta: '5',
  cyan: '6',
  white: '7',
  gray: '8',
  brightRed: '9',
  brightGreen: '10',
  brightYellow: '11',
  brightBlue: '12',
  brightMagenta: '13',
  brightCyan: '14',
} as const

// Background colors
const bgColors = {
  black: '40',
  red: '41',
  green: '42',
  yellow: '43',
  blue: '44',
  magenta: '45',
  cyan: '46',
  white: '47',
} as const

type ColorName = keyof typeof colors | keyof typeof bgColors

function color(code: string): (text: string) => string {
  return (text: string) => `${ESC}${code}m${text}${ESC}0m`
}

function bold(text: string): string {
  return `${ESC}1m${text}${ESC}0m`
}

function dim(text: string): string {
  return `${ESC}2m${text}${ESC}0m`
}

function italic(text: string): string {
  return `${ESC}3m${text}${ESC}0m`
}

function underline(text: string): string {
  return `${ESC}4m${text}${ESC}0m`
}

// Foreground colors
const c = {
  // Basic colors
  black: (text: string) => `${ESC}30m${text}${ESC}0m`,
  red: (text: string) => `${ESC}31m${text}${ESC}0m`,
  green: (text: string) => `${ESC}32m${text}${ESC}0m`,
  yellow: (text: string) => `${ESC}33m${text}${ESC}0m`,
  blue: (text: string) => `${ESC}34m${text}${ESC}0m`,
  magenta: (text: string) => `${ESC}35m${text}${ESC}0m`,
  cyan: (text: string) => `${ESC}36m${text}${ESC}0m`,
  white: (text: string) => `${ESC}37m${text}${ESC}0m`,
  gray: (text: string) => `${ESC}90m${text}${ESC}0m`,
  
  // Bright colors
  brightRed: (text: string) => `${ESC}91m${text}${ESC}0m`,
  brightGreen: (text: string) => `${ESC}92m${text}${ESC}0m`,
  brightYellow: (text: string) => `${ESC}93m${text}${ESC}0m`,
  brightBlue: (text: string) => `${ESC}94m${text}${ESC}0m`,
  brightMagenta: (text: string) => `${ESC}95m${text}${ESC}0m`,
  brightCyan: (text: string) => `${ESC}96m${text}${ESC}0m`,
  
  // Semantic colors
  primary: (text: string) => `${ESC}96m${text}${ESC}0m`,    // Cyan
  secondary: (text: string) => `${ESC}33m${text}${ESC}0m`,  // Yellow/Orange
  success: (text: string) => `${ESC}92m${text}${ESC}0m`,    // Green
  error: (text: string) => `${ESC}91m${text}${ESC}0m`,      // Red
  warning: (text: string) => `${ESC}93m${text}${ESC}0m`,    // Yellow
  info: (text: string) => `${ESC}94m${text}${ESC}0m`,        // Blue
  
  // Role colors
  user: (text: string) => `${ESC}94m${text}${ESC}0m`,       // Blue
  assistant: (text: string) => `${ESC}95m${text}${ESC}0m`,   // Magenta
  tool: (text: string) => `${ESC}93m${text}${ESC}0m`,        // Yellow
  system: (text: string) => `${ESC}90m${text}${ESC}0m`,      // Gray
  
  // Style modifiers
  bold,
  dim,
  italic,
  underline,
  
  // Reset
  reset: () => `${ESC}0m`,
}

// Divider line
function divider(char = '─', length = 80): string {
  return `${ESC}2m${char.repeat(length)}${ESC}0m`
}

// Box drawing
function box(content: string, options: {
  border?: boolean
  borderColor?: string
  padding?: number
  title?: string
} = {}): string {
  const {
    border = true,
    padding = 1,
    title,
  } = options
  
  if (!border) {
    return content
  }
  
  const lines = content.split('\n')
  const maxWidth = Math.max(...lines.map(l => l.length))
  
  const topBorder = title
    ? `┌─ ${title} ${'─'.repeat(maxWidth - title.length - 3)}─┐`
    : `┌${'─'.repeat(maxWidth + 2)}┐`
  
  const bottomBorder = `└${'─'.repeat(maxWidth + 2)}┘`
  
  const paddedLines = lines.map(line => {
    const paddingStr = ' '.repeat(padding)
    return `│${paddingStr}${line}${' '.repeat(maxWidth - line.length + padding)}${paddingStr}│`
  })
  
  return [topBorder, ...paddedLines, bottomBorder].join('\n')
}

// Tool result formatter
function formatToolResult(
  toolName: string,
  input: Record<string, unknown>,
  output: string,
  options: {
    showTiming?: boolean
    showInput?: boolean
    verbose?: boolean
    maxLines?: number
  } = {}
): string {
  const {
    showTiming = false,
    showInput = true,
    verbose = false,
    maxLines = 10,
  } = options
  
  const parts: string[] = []
  
  // Tool header
  const cmdPreview = input.command
    ? (input.command as string).toString().slice(0, 60)
    : JSON.stringify(input).slice(0, 60)
  
  parts.push(`\n${c.cyan('●')} ${c.bold(toolName)}${c.dim('(' + cmdPreview + ')')}`)
  
  if (showTiming && (input as {startTime?: number}).startTime) {
    const elapsed = Date.now() - ((input as {startTime?: number}).startTime || 0)
    parts.push(` ${c.dim(`[${elapsed}ms]`)}`)
  }
  
  // Output
  const outputLines = output.split('\n')
  const truncated = outputLines.length > maxLines
  const displayLines = truncated
    ? outputLines.slice(0, maxLines)
    : outputLines
  
  if (displayLines.length > 0) {
    parts.push('')
    parts.push(...displayLines.map(line => `  ${line}`))
    
    if (truncated) {
      parts.push(`  ${c.dim(`+${outputLines.length - maxLines} more lines`)}`)
    }
  }
  
  return parts.join('\n')
}

// Status indicator
function statusIndicator(success: boolean, label?: string): string {
  const icon = success ? `${ESC}92m✓${ESC}0m` : `${ESC}91m✗${ESC}0m`
  const text = label ? ` ${label}` : ''
  return icon + text
}

// Progress spinner frames
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

let spinnerIndex = 0
function spin(): string {
  const frame = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length]
  spinnerIndex++
  return `${ESC}94m${frame}${ESC}0m`
}

// Token budget display
function tokenBudgetDisplay(used: number, max: number): string {
  const percent = Math.round((used / max) * 100)
  const barLength = 20
  const filled = Math.round((used / max) * barLength)
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled)
  
  const color = percent > 80 ? '91' : percent > 60 ? '93' : '92'
  
  return `${c.dim('[')}${ESC}${color}m${bar}${ESC}0m${c.dim(`] ${used}/${max} tokens (${percent}%)`)}`
}

// Table formatter
function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRow = Math.max(...rows.map(r => (r[i] || '').length))
    return Math.max(h.length, maxRow)
  })
  
  const headerLine = headers.map((h, i) => {
    return `${c.bold(h)}${' '.repeat(colWidths[i] - h.length)}`
  }).join(' │ ')
  
  const separator = colWidths.map(w => '─'.repeat(w)).join('─┼─')
  
  const dataLines = rows.map(row => {
    return row.map((cell, i) => {
      return cell + ' '.repeat(colWidths[i] - cell.length)
    }).join(' │ ')
  })
  
  return [headerLine, separator, ...dataLines].join('\n')
}

// Diff formatter
function diff(
  additions: string[],
  deletions: string[]
): string {
  const parts: string[] = []
  
  for (const line of deletions) {
    parts.push(`${ESC}91m- ${line}${ESC}0m`)
  }
  
  for (const line of additions) {
    parts.push(`${ESC}92m+ ${line}${ESC}0m`)
  }
  
  return parts.join('\n')
}

export {
  c,
  divider,
  box,
  formatToolResult,
  statusIndicator,
  spin,
  tokenBudgetDisplay,
  table,
  diff,
  bold,
  dim,
  italic,
  underline,
}
