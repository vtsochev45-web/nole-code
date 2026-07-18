/**
 * Terminal Output Styling
 * Color utilities and styled output formatters
 */

const ESC = '\x1b['
// All styling is disabled when stdout is not a TTY (piped -m output, CI,
// harnesses): machine consumers must receive plain text with no ANSI.
const wrap = (code: string, text: string): string =>
  process.stdout.isTTY ? `${wrap(code, text)}` : text
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
  return (text: string) => `${wrap(code, text)}`
}

function bold(text: string): string {
  return wrap('1', `${text}`)
}

function dim(text: string): string {
  return wrap('2', `${text}`)
}

function italic(text: string): string {
  return wrap('3', `${text}`)
}

function underline(text: string): string {
  return wrap('4', `${text}`)
}

// Foreground colors
const c = {
  // Basic colors
  black: (text: string) => wrap('30', `${text}`),
  red: (text: string) => wrap('31', `${text}`),
  green: (text: string) => wrap('32', `${text}`),
  yellow: (text: string) => wrap('33', `${text}`),
  blue: (text: string) => wrap('34', `${text}`),
  magenta: (text: string) => wrap('35', `${text}`),
  cyan: (text: string) => wrap('36', `${text}`),
  white: (text: string) => wrap('37', `${text}`),
  gray: (text: string) => wrap('90', `${text}`),
  
  // Bright colors
  brightRed: (text: string) => wrap('91', `${text}`),
  brightGreen: (text: string) => wrap('92', `${text}`),
  brightYellow: (text: string) => wrap('93', `${text}`),
  brightBlue: (text: string) => wrap('94', `${text}`),
  brightMagenta: (text: string) => wrap('95', `${text}`),
  brightCyan: (text: string) => wrap('96', `${text}`),
  
  // Semantic colors
  primary: (text: string) => wrap('96', `${text}`),    // Cyan
  secondary: (text: string) => wrap('33', `${text}`),  // Yellow/Orange
  success: (text: string) => wrap('92', `${text}`),    // Green
  error: (text: string) => wrap('91', `${text}`),      // Red
  warning: (text: string) => wrap('93', `${text}`),    // Yellow
  info: (text: string) => wrap('94', `${text}`),        // Blue
  
  // Role colors
  user: (text: string) => wrap('94', `${text}`),       // Blue
  assistant: (text: string) => wrap('95', `${text}`),   // Magenta
  tool: (text: string) => wrap('93', `${text}`),        // Yellow
  system: (text: string) => wrap('90', `${text}`),      // Gray
  pink: (text: string) => wrap('38;5;206', `${text}`), // Pink (256-colour)
  
  // Style modifiers
  bold,
  dim,
  italic,
  underline,
  
  // Reset
  reset: () => (process.stdout.isTTY ? `${ESC}0m` : ''),
}

// Divider line
function divider(char = '─', length = 80): string {
  return wrap('2', `${char.repeat(length)}`)
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
  const icon = success ? wrap('92', `✓`) : wrap('91', `✗`)
  const text = label ? ` ${label}` : ''
  return icon + text
}

// Progress spinner frames
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

let spinnerIndex = 0
function spin(): string {
  const frame = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length]
  spinnerIndex++
  return wrap('94', `${frame}`)
}

// Token budget display
function tokenBudgetDisplay(used: number, max: number): string {
  const percent = Math.round((used / max) * 100)
  const barLength = 20
  const filled = Math.round((used / max) * barLength)
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled)
  
  const color = percent > 80 ? '91' : percent > 60 ? '93' : '92'
  
  return `${c.dim('[')}${wrap(color, bar)}${c.dim(`] ${used}/${max} tokens (${percent}%)`)}`
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
    parts.push(wrap('91', `- ${line}`))
  }
  
  for (const line of additions) {
    parts.push(wrap('92', `+ ${line}`))
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
