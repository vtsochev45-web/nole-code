/**
 * Spinner & Verb System
 * Fun loading messages inspired by Nole Code's spinnerVerbs
 * 
 * Features:
 * - Cycling spinner frames (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏)
 * - Verb rotation (Channelling, Processing, Brewed Fresh, etc.)
 * - Mode-specific display (thinking, working, waiting)
 * - Verbose indicators for tool execution
 */

import { feature } from '../../feature-flags/index.js'

// Spinner frames
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPINNER_ARROW = '⟳'
const SPINNER_DOTS = ['⠋', '⠙', '⠹']

// Fun verbs inspired by Nole Code's SPINNER_VERBS
const SPINNER_VERBS = [
  'Architecting',
  'Brewing',
  'Channeling',
  'Cogitating',
  'Concocting',
  'Crafting',
  'Crunching',
  'Deciphering',
  'Forging',
  'Noodling',
  'Orchestrating',
  'Percolating',
  'Pondering',
  'Scheming',
  'Synthesizing',
  'Tinkering',
  'Weaving',
  // Fun ones
  'Herding tokens',
  'Milking the API',
  'Ploughing through',
  'Consulting the oracle',
  'Summoning wisdom',
  'Warming up hamsters',
  'Feeding the squirrels',
  'Reticulating splines',
  'Allocating braincells',
  'Polishing crystal ball',
  'Interrogating electrons',
  'Deploying neurons',
  'Defragmenting thoughts',
  'Asking nicely',
  'Winging it',
  'Faking confidence',
  'Making it look easy',
  'Bribing the AI gods',
  'Staring at ceiling',
  'Definitely not guessing',
  'Almost there probably',
  'Pretending to work',
  'Garbage collecting ideas',
]

// Verbose-specific verbs (for when tools are running)
const VERBOSE_VERBS = [
  'Executing',
  'Channeling',
  'Routing',
  'Dispatching',
  'Processing',
  'Marshalling',
  'Orchestrating',
  'Coordinating',
  'Directing',
  'Managing',
]

let spinnerFrame = 0
let verbIndex = 0
let lastUpdate = 0

/**
 * Get the current spinner frame
 */
export function getSpinnerFrame(): string {
  if (!feature('TOOL_RESULT_STREAMING')) {
    return SPINNER_DOTS[spinnerFrame % SPINNER_DOTS.length]
  }
  return SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]
}

/**
 * Get a random or cycling verb
 */
export function getSpinnerVerb(): string {
  return SPINNER_VERBS[verbIndex % SPINNER_VERBS.length]
}

/**
 * Get a verbose-specific verb
 */
export function getVerboseVerb(): string {
  return VERBOSE_VERBS[verbIndex % VERBOSE_VERBS.length]
}

/**
 * Advance the spinner frame
 */
export function advanceSpinner(): void {
  spinnerFrame++
  // Rotate verb every 5 frames
  if (spinnerFrame % 5 === 0) {
    verbIndex = (verbIndex + 1) % SPINNER_VERBS.length
  }
}

/**
 * Format a spinner line
 */
export function formatSpinner(
  verb?: string,
  message?: string,
  options: {
    color?: string
    verbose?: boolean
    arrow?: boolean
  } = {}
): string {
  const { color = 'cyan', verbose = false, arrow = false } = options
  
  const frame = getSpinnerFrame()
  const v = verb || (verbose ? getVerboseVerb() : getSpinnerVerb())
  const icon = arrow ? '⇒' : frame
  
  const colors: Record<string, string> = {
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
  }
  
  const col = colors[color] || colors.cyan
  const reset = '\x1b[0m'
  
  let line = `${col}${icon}${reset} ${col}${v}${reset}`
  if (message) {
    line += ` ${message}`
  }
  
  return line
}

/**
 * Format a tool execution spinner line
 * Shows "⟳ Channeling…" while a tool is running
 */
export function formatToolSpinner(
  toolName: string,
  inputPreview?: string,
  options: {
    verbose?: boolean
    frame?: number
  } = {}
): string {
  const { verbose = false, frame: customFrame } = options
  const f = customFrame !== undefined ? customFrame % SPINNER_FRAMES.length : spinnerFrame % SPINNER_FRAMES.length
  const frame = SPINNER_FRAMES[f]
  const verb = verbose ? getVerboseVerb() : getSpinnerVerb()
  
  const cyan = '\x1b[36m'
  const dim = '\x1b[2m'
  const reset = '\x1b[0m'
  
  let line = `${cyan}${frame}${reset} ${cyan}${verb}${reset}`
  
  if (inputPreview) {
    const preview = inputPreview.length > 60 
      ? inputPreview.slice(0, 57) + '...' 
      : inputPreview
    line += ` ${dim}(${preview})${reset}`
  } else {
    line += ` ${dim}[${toolName}]${reset}`
  }
  
  return line
}

/**
 * Format thinking indicator
 * Shows a pulsing/thinking state
 */
export function formatThinking(
  message?: string,
  options: {
    shimmer?: boolean
    elapsed?: number
  } = {}
): string {
  const { shimmer = true, elapsed } = options
  
  const cyan = '\x1b[36m'
  const dim = '\x1b[2m'
  const reset = '\x1b[0m'
  
  const frame = getSpinnerFrame()
  let line = `${cyan}${frame}${reset} Thinking`
  
  if (message) {
    line += ` about ${message}`
  }
  
  if (elapsed !== undefined && elapsed > 1000) {
    const seconds = (elapsed / 1000).toFixed(1)
    line += ` ${dim}[${seconds}s]${reset}`
  }
  
  // Add shimmer dots if enabled
  if (shimmer) {
    const dotCount = (spinnerFrame % 3) + 1
    line += dim + '.'.repeat(dotCount) + reset
  }
  
  return line
}

/**
 * Format waiting indicator
 */
export function formatWaiting(
  message?: string,
  options: {
    muted?: boolean
  } = {}
): string {
  const { muted = false } = options
  
  const dim = '\x1b[2m'
  const reset = '\x1b[0m'
  
  const frame = muted ? '○' : '◯'
  let line = `${dim}${frame}${reset}`
  
  if (message) {
    line += ` ${message}`
  }
  
  return line
}

/**
 * Format streaming output indicator
 * Shows real-time streaming content
 */
export function formatStreaming(
  content: string,
  options: {
    prefix?: string
    maxLines?: number
    truncate?: boolean
  } = {}
): string {
  const { prefix = '  ', maxLines = 5, truncate = true } = options
  
  const lines = content.split('\n')
  const displayLines = lines.slice(0, maxLines)
  
  if (truncate && lines.length > maxLines) {
    displayLines.push(`  ${lines.length - maxLines} more lines...`)
  }
  
  return displayLines.join('\n')
}

/**
 * Verbose tool execution header
 * Shows detailed tool execution state
 */
export function formatVerboseTool(
  toolName: string,
  input: Record<string, unknown>,
  options: {
    showInput?: boolean
    maxWidth?: number
    timestamp?: number
  } = {}
): string {
  const { showInput = true, maxWidth = 80, timestamp } = options
  
  const parts: string[] = []
  
  // Tool header with frame
  const frame = getSpinnerFrame()
  const verb = getVerboseVerb()
  
  const cyan = '\x1b[36m'
  const dim = '\x1b[2m'
  const reset = '\x1b[0m'
  const bold = '\x1b[1m'
  
  // Build the line
  parts.push(`${cyan}${frame}${reset} ${bold}${toolName}${reset}`)
  
  // Add input preview if available
  if (showInput && input.command) {
    const cmd = String(input.command)
    const preview = cmd.length > maxWidth - toolName.length - 10
      ? cmd.slice(0, maxWidth - toolName.length - 13) + '...'
      : cmd
    parts.push(` ${dim}(${preview})${reset}`)
  } else if (showInput) {
    const inputPreview = JSON.stringify(input).slice(0, maxWidth - toolName.length - 10)
    if (inputPreview.length > 0) {
      parts.push(` ${dim}(${inputPreview})${reset}`)
    }
  }
  
  // Add timestamp if provided
  if (timestamp !== undefined) {
    const elapsed = Date.now() - timestamp
    const elapsedStr = elapsed > 1000
      ? `${(elapsed / 1000).toFixed(1)}s`
      : `${elapsed}ms`
    parts.push(` ${dim}[${elapsedStr}]${reset}`)
  }
  
  return parts.join('')
}

/**
 * Verbose output formatter for tool results
 */
export function formatVerboseResult(
  toolName: string,
  result: string,
  options: {
    isError?: boolean
    timestamp?: number
    maxLines?: number
    streaming?: boolean
  } = {}
): string {
  const { 
    isError = false, 
    timestamp,
    maxLines = 50,
    streaming = false 
  } = options
  
  const parts: string[] = []
  
  const green = '\x1b[32m'
  const red = '\x1b[31m'
  const dim = '\x1b[2m'
  const reset = '\x1b[0m'
  const bold = '\x1b[1m'
  
  // Status indicator
  const status = isError ? `${red}✗${reset}` : `${green}✓${reset}`
  
  // Timing info
  let timingStr = ''
  if (timestamp !== undefined) {
    const elapsed = Date.now() - timestamp
    timingStr = elapsed > 1000
      ? ` ${dim}[${(elapsed / 1000).toFixed(1)}s]${reset}`
      : ` ${dim}[${elapsed}ms]${reset}`
  }
  
  parts.push(`  ${status} ${bold}${toolName}${reset}${timingStr}`)
  
  // Result content
  const lines = result.split('\n')
  const truncated = lines.length > maxLines
  const displayLines = truncated ? lines.slice(0, maxLines) : lines
  
  if (displayLines.length > 0) {
    parts.push('')
    for (const line of displayLines) {
      const displayLine = line.length > 120 ? line.slice(0, 117) + '...' : line
      parts.push(`  ${dim}${displayLine}${reset}`)
    }
    
    if (truncated) {
      parts.push(`  ${dim}+${lines.length - maxLines} more lines${reset}`)
    }
  }
  
  return parts.join('\n')
}

/**
 * Progress bar formatter
 */
export function formatProgressBar(
  current: number,
  total: number,
  options: {
    width?: number
    showPercent?: boolean
    prefix?: string
  } = {}
): string {
  const { width = 30, showPercent = true, prefix = '' } = options
  
  const percent = Math.round((current / total) * 100)
  const filled = Math.round((current / total) * width)
  const empty = width - filled
  
  const cyan = '\x1b[36m'
  const dim = '\x1b[2m'
  const reset = '\x1b[0m'
  
  const bar = cyan + '█'.repeat(filled) + dim + '░'.repeat(empty) + reset
  const percentStr = showPercent ? ` ${percent}%` : ''
  const countStr = ` (${current}/${total})`
  
  return `${prefix}${bar}${percentStr}${dim}${countStr}${reset}`
}

/**
 * Update the spinner (call this periodically)
 */
export function tickSpinner(): void {
  advanceSpinner()
  lastUpdate = Date.now()
}

/**
 * Get elapsed time since last spinner update
 */
export function getSpinnerElapsed(): number {
  return Date.now() - lastUpdate
}

/**
 * Create an animated spinner that updates on interval
 */
export function createSpinner(
  options: {
    verb?: string
    message?: string
    color?: string
    interval?: number
  } = {}
): {
  tick: () => string
  stop: () => string
  current: () => string
} {
  const { verb, message, color = 'cyan', interval = 100 } = options
  let frame = 0
  let running = true
  
  return {
    tick(): string {
      if (!running) return ''
      frame++
      return formatSpinner(verb, message, { color })
    },
    stop(): string {
      running = false
      return formatSpinner(verb, message, { color })
    },
    current(): string {
      return formatSpinner(verb, message, { color })
    },
  }
}
