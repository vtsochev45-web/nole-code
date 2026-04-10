// Nole Code - Cost Tracker
// Track API usage and estimate costs
// Adapted from Nole Code's cost-tracker

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

interface CostEntry {
  date: string
  inputTokens: number
  outputTokens: number
  model: string
  cost: number
  requests: number
}

interface SessionCost {
  sessionId: string
  inputTokens: number
  outputTokens: number
  requests: number
  startTime: string
  endTime?: string
}

// MiniMax pricing (approximate, in USD per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  'MiniMax-Text-01': { input: 0.01, output: 0.01 },  // Very approximate
  'MiniMax-M2.7': { input: 0.01, output: 0.01 },
  'MiniMax-M2.5': { input: 0.005, output: 0.005 },
  default: { input: 0.01, output: 0.01 },
}

const COST_FILE = join(homedir(), '.nole-code', 'costs.jsonl')

class CostTracker {
  private sessionCosts: Map<string, SessionCost> = new Map()
  private currentSession: SessionCost | null = null

  startSession(sessionId: string): void {
    this.currentSession = {
      sessionId,
      inputTokens: 0,
      outputTokens: 0,
      requests: 0,
      startTime: new Date().toISOString(),
    }
    this.sessionCosts.set(sessionId, this.currentSession)
  }

  trackRequest(model: string, inputTokens: number, outputTokens: number): void {
    const entry: CostEntry = {
      date: new Date().toISOString().split('T')[0],
      inputTokens,
      outputTokens,
      model,
      cost: this.calculateCost(model, inputTokens, outputTokens),
      requests: 1,
    }

    // Append to cost file
    mkdirSync(dirname(COST_FILE), { recursive: true })
    appendFileSync(COST_FILE, JSON.stringify(entry) + '\n')

    // Update session
    if (this.currentSession) {
      this.currentSession.inputTokens += inputTokens
      this.currentSession.outputTokens += outputTokens
      this.currentSession.requests++
    }
  }

  endSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = new Date().toISOString()
      this.currentSession = null
    }
  }

  private calculateCost(model: string, input: number, output: number): number {
    const prices = PRICING[model] || PRICING.default
    return (input * prices.input + output * prices.output) / 1_000_000
  }

  // Get summary for a date range
  getSummary(startDate?: string, endDate?: string): {
    totalCost: number
    totalRequests: number
    totalInputTokens: number
    totalOutputTokens: number
    byModel: Record<string, { cost: number; requests: number }>
  } {
    const summary = {
      totalCost: 0,
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byModel: {} as Record<string, { cost: number; requests: number }>,
    }

    if (!existsSync(COST_FILE)) return summary

    const lines = readFileSync(COST_FILE, 'utf-8').trim().split('\n')

    for (const line of lines) {
      try {
        const entry: CostEntry = JSON.parse(line)

        if (startDate && entry.date < startDate) continue
        if (endDate && entry.date > endDate) continue

        summary.totalCost += entry.cost
        summary.totalRequests += entry.requests
        summary.totalInputTokens += entry.inputTokens
        summary.totalOutputTokens += entry.outputTokens

        if (!summary.byModel[entry.model]) {
          summary.byModel[entry.model] = { cost: 0, requests: 0 }
        }
        summary.byModel[entry.model].cost += entry.cost
        summary.byModel[entry.model].requests += entry.requests
      } catch {}
    }

    return summary
  }

  // Get today's costs
  getToday(): { cost: number; requests: number } {
    const today = new Date().toISOString().split('T')[0]
    const summary = this.getSummary(today, today)
    return { cost: summary.totalCost, requests: summary.totalRequests }
  }

  // Format cost for display
  formatCost(cost: number): string {
    if (cost < 0.001) return `$${(cost * 1000).toFixed(4)}m`
    if (cost < 1) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(2)}`
  }

  // Get current session summary
  getCurrentSession(): SessionCost | null {
    return this.currentSession
  }

  // Clear all cost data
  clearHistory(): void {
    const { unlinkSync } = require('fs')
    try {
      if (existsSync(COST_FILE)) {
        unlinkSync(COST_FILE)
      }
    } catch {}
  }
}

export const costTracker = new CostTracker()

// ============ Output Styles ============
// Format terminal output with styles
// Adapted from Nole Code's outputStyles

export interface StyleConfig {
  color?: string
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
}

const STYLES: Record<string, StyleConfig> = {
  user: { color: '#60A5FA' },
  nole: { color: '#A78BFA' },
  tool: { color: '#F472B6' },
  error: { color: '#EF4444', bold: true },
  success: { color: '#22C55E' },
  warning: { color: '#F59E0B' },
  dim: { dim: true },
  bold: { bold: true },
}

export function applyStyle(text: string, styleName: string): string {
  const style = STYLES[styleName]
  if (!style) return text

  const codes: string[] = []

  // ANSI color codes
  const colors: Record<string, number> = {
    '#60A5FA': 39,  // blue-ish
    '#A78BFA': 35,  // purple
    '#F472B6': 35,  // pink
    '#EF4444': 31,  // red
    '#22C55E': 32,  // green
    '#F59E0B': 33,  // yellow
  }

  if (style.color && colors[style.color]) {
    codes.push(`\x1b[${colors[style.color]}m`)
  }
  if (style.bold) codes.push('\x1b[1m')
  if (style.dim) codes.push('\x1b[2m')
  if (style.italic) codes.push('\x1b[3m')
  if (style.underline) codes.push('\x1b[4m')

  const reset = '\x1b[0m'
  return codes.join('') + text + reset
}

// Color helpers
export const c = {
  user: (text: string) => applyStyle(text, 'user'),
  nole: (text: string) => applyStyle(text, 'nole'),
  tool: (text: string) => applyStyle(text, 'tool'),
  error: (text: string) => applyStyle(text, 'error'),
  success: (text: string) => applyStyle(text, 'success'),
  warning: (text: string) => applyStyle(text, 'warning'),
  dim: (text: string) => applyStyle(text, 'dim'),
  bold: (text: string) => applyStyle(text, 'bold'),

  // Chainable
  hex: (text: string, color: string) => {
    const colors: Record<string, number> = {
      red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36,
    }
    const code = colors[color.toLowerCase()] || 36
    return `\x1b[${code}m${text}\x1b[0m`
  },
}

// Progress spinner frames
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function spinner(frame: number): string {
  return STYLES[frame % SPINNER_FRAMES.length]
}

// Box drawing helpers
export function box(text: string, options: { border?: boolean; color?: string } = {}): string {
  const border = options.border ? '│' : ''
  const lines = text.split('\n')
  const width = Math.max(...lines.map(l => l.length), 40)

  if (!options.border) {
    return lines.map(l => `${border} ${l.padEnd(width)} ${border}`).join('\n')
  }

  const top = `┌${'─'.repeat(width + 2)}┐`
  const bottom = `└${'─'.repeat(width + 2)}┘`
  const middle = lines.map(l => `${border} ${l.padEnd(width)} ${border}`).join('\n')

  return [top, middle, bottom].join('\n')
}

// Table formatting
export function table(headers: string[], rows: string[][], options: {
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
} = {}): string {
  const { maxWidth = 100, align = 'left' } = options

  // Calculate column widths
  const widths = headers.map((h, i) => Math.max(
    h.length,
    ...rows.map(r => (r[i] || '').length)
  ))

  // Truncate if too wide
  const totalWidth = widths.reduce((a, w) => a + w + 3, 1)
  if (totalWidth > maxWidth) {
    const scale = maxWidth / totalWidth
    widths.forEach((w, i) => { widths[i] = Math.floor(w * scale) })
  }

  // Format row
  function formatRow(cells: string[]): string {
    return cells.map((cell, i) => {
      const padded = cell.padEnd(widths[i]).slice(0, widths[i])
      return `  ${padded}`
    }).join('│') + '│'
  }

  const sep = widths.map(w => '─'.repeat(w)).join('─┼─')

  return [
    formatRow(headers).replace(/│/g, '├').replace(/^├/, '┌').replace(/│$/, '┐') + '\n' +
    '├' + sep + '┤',
    ...rows.map(r => formatRow(r)),
    '└' + sep + '┘',
  ].join('\n')
}
