// Nole Code - Analytics
// Usage tracking (stripped of Google/GrowthBook)
// Option to disable completely

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs'
import { join, homedir } from 'path'

interface AnalyticsEvent {
  event: string
  properties?: Record<string, unknown>
  timestamp: string
}

const ANALYTICS_FILE = join(homedir(), '.nole-code', 'analytics.jsonl')

// Analytics configuration
let analyticsEnabled = true
let analytics: Analytics = null as any

class Analytics {
  private queue: AnalyticsEvent[] = []
  private flushInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Flush queue every 30 seconds
    this.flushInterval = setInterval(() => this.flush(), 30000)

    // Flush on exit
    process.on('exit', () => this.flush())
  }

  // Track an event
  track(event: string, properties?: Record<string, unknown>): void {
    if (!analyticsEnabled) return

    this.queue.push({
      event,
      properties,
      timestamp: new Date().toISOString(),
    })

    // Flush immediately if queue is large
    if (this.queue.length >= 10) {
      this.flush()
    }
  }

  // Flush queue to disk
  flush(): void {
    if (this.queue.length === 0) return

    const events = this.queue.splice(0)
    mkdirSync(join(homedir(), '.nole-code'), { recursive: true })

    const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n'
    appendFileSync(ANALYTICS_FILE, lines)
  }

  // Get analytics summary
  summary(): { totalEvents: number; eventsByType: Record<string, number> } {
    try {
      if (!existsSync(ANALYTICS_FILE)) {
        return { totalEvents: 0, eventsByType: {} }
      }

      const content = readFileSync(ANALYTICS_FILE, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)

      const counts: Record<string, number> = {}
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as AnalyticsEvent
          counts[event.event] = (counts[event.event] || 0) + 1
        } catch {}
      }

      return {
        totalEvents: lines.length,
        eventsByType: counts,
      }
    } catch {
      return { totalEvents: 0, eventsByType: {} }
    }
  }

  // Clear all analytics
  clear(): void {
    const { unlinkSync } = require('fs')
    try {
      if (existsSync(ANALYTICS_FILE)) {
        unlinkSync(ANALYTICS_FILE)
      }
    } catch {}
  }

  // Disable analytics
  disable(): void {
    analyticsEnabled = false
    this.flush()
  }

  enable(): void {
    analyticsEnabled = true
  }

  isEnabled(): boolean {
    return analyticsEnabled
  }
}

// Lazy singleton
function getAnalytics(): Analytics {
  if (!analytics) {
    analytics = new Analytics()
  }
  return analytics
}

// Public API
export function track(event: string, properties?: Record<string, unknown>): void {
  getAnalytics().track(event, properties)
}

export function trackSessionStart(sessionId: string, cwd: string): void {
  track('session_start', { sessionId, cwd })
}

export function trackSessionEnd(sessionId: string, messageCount: number, durationMs: number): void {
  track('session_end', { sessionId, messageCount, durationMs })
}

export function trackToolUse(toolName: string, durationMs: number, success: boolean): void {
  track('tool_use', { toolName, durationMs, success })
}

export function trackError(errorType: string, message: string): void {
  track('error', { errorType, message })
}

export function trackCommand(command: string): void {
  track('command', { command })
}

export function getSummary() {
  return getAnalytics().summary()
}

export function disableAnalytics() {
  getAnalytics().disable()
}

export function enableAnalytics() {
  getAnalytics().enable()
}

export function clearAnalytics() {
  getAnalytics().clear()
}

// Check if analytics is enabled (reads from config)
export function loadAnalyticsSetting(): boolean {
  try {
    const { existsSync, readFileSync } = require('fs')
    const configFile = join(homedir(), '.nole-code', 'settings.json')
    if (existsSync(configFile)) {
      const settings = JSON.parse(readFileSync(configFile, 'utf-8'))
      return settings.enableAnalytics !== false
    }
  } catch {}
  return true  // Default enabled
}
