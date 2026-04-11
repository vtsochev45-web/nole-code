// Nole Code - /debug command: Attach to Node.js/Python process

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync } from 'fs'
import { execFileSync } from 'child_process'

const execAsync = promisify(exec)

interface ProcessInfo {
  pid: number
  language: string
  cmdline: string[]
  memoryRss?: string
  status?: string
  uptime?: number
}

async function getProcessInfo(pid: number): Promise<ProcessInfo | null> {
  try {
    // Check if process exists
    process.kill(pid, 0)
  } catch {
    return null
  }

  const cmdlinePath = `/proc/${pid}/cmdline`
  if (!existsSync(cmdlinePath)) {
    return { pid, language: 'unknown', cmdline: [] }
  }

  const cmdline = readFileSync(cmdlinePath, 'utf-8').split('\0').filter(Boolean)
  const statusPath = `/proc/${pid}/status`
  let memoryRss: string | undefined
  let status: string | undefined

  if (existsSync(statusPath)) {
    const statusContent = readFileSync(statusPath, 'utf-8')
    const rssMatch = statusContent.match(/VmRSS:\s+(\d+)\s+kB/)
    if (rssMatch) {
      memoryRss = `${Math.round(parseInt(rssMatch[1]) / 1024)} MB`
    }
    const stateMatch = statusContent.match(/State:\s+(\S)/)
    if (stateMatch) {
      status = stateMatch[1]
    }
  }

  // Detect language from cmdline
  let language = 'unknown'
  const firstCmd = cmdline[0]?.toLowerCase() || ''
  if (firstCmd.includes('node') || firstCmd.includes('nodejs')) {
    language = 'node'
  } else if (firstCmd.includes('python') || firstCmd.includes('python3')) {
    language = 'python'
  } else if (firstCmd.includes('bun')) {
    language = 'bun'
  } else if (firstCmd.includes('deno')) {
    language = 'deno'
  }

  // Calculate uptime from stat
  let uptime: number | undefined
  try {
    const statContent = readFileSync('/proc/' + pid + '/stat', 'utf-8')
    const startTime = parseInt(statContent.split(' ')[21])
    const clkTck = 100 // seconds
    const bootTime = Date.now() / 1000 - parseInt(readFileSync('/proc/uptime', 'utf-8').split(' ')[0])
    uptime = Math.floor((bootTime + startTime / clkTck))
  } catch {}

  return { pid, language, cmdline, memoryRss, status, uptime }
}

async function attachNodejs(pid: number): Promise<string> {
  const info = await getProcessInfo(pid)
  if (!info || info.language !== 'node') {
    return `Process ${pid} is not a Node.js process (language: ${info?.language || 'unknown'})`
  }

  try {
    // Send SIGUSR1 to enable inspector
    process.kill(pid, 'SIGUSR1')
  } catch (e) {
    return `Failed to send SIGUSR1 to ${pid}: ${e}`
  }

  // Wait a bit for the debugger to start
  await new Promise(r => setTimeout(r, 500))

  try {
    // Try to connect to the inspector
    const wsUrl = 'http://localhost:9229/json'
    const response = await fetch(wsUrl, { signal: AbortSignal.timeout(2000) })
    if (response.ok) {
      const data = await response.json()
      if (data && data[0]) {
        const info = data[0]
        return `✅ Node.js Inspector Attached

  PID:        ${pid}
  Debugger:   ws://localhost:9229
  WebSocket:  ${info.webSocketDebuggerUrl}
  Type:       ${info.type}
  Title:      ${info.title}
  URL:        ${info.devtoolsFrontendUrl}

Connect with Chrome DevTools or:
  node --inspect ${pid}
`
      }
    }
  } catch {
    // Inspector might not be enabled
  }

  return `🔍 Process ${pid} is Node.js but inspector may not be enabled.

To enable, add --inspect flag when starting:
  node --inspect server.js

Or send SIGUSR1 to running process:
  kill -USR1 ${pid}

Then connect to ws://localhost:9229`
}

async function attachPython(pid: number): Promise<string> {
  const info = await getProcessInfo(pid)
  if (!info || info.language !== 'python') {
    return `Process ${pid} is not a Python process (language: ${info?.language || 'unknown'})`
  }

  // Check if py-spy is available
  let pySpyVersion = ''
  try {
    const { stdout } = await execAsync('py-spy --version')
    pySpyVersion = stdout.trim()
  } catch {
    // py-spy not available
  }

  if (!pySpyVersion) {
    return `🔍 Process ${pid} is Python but py-spy is not installed.

Install py-spy for profile data:
  pip install py-spy

Quick info from /proc:
${info.memoryRss ? `  Memory:    ${info.memoryRss}` : ''}
${info.status ? `  State:    ${info.status}` : ''}
${info.uptime ? `  Uptime:   ${info.uptime}s` : ''}
  Command:  ${info.cmdline.join(' ').slice(0, 60)}`
  }

  // Use py-spy dump
  try {
    const { stdout, stderr } = await execAsync(`py-spy dump --pid ${pid}`, { timeout: 5000 })
    if (stdout) {
      return `✅ Python Process Info (py-spy)

  PID:       ${pid}
  Memory:    ${info.memoryRss || 'N/A'}
  State:     ${info.status || 'N/A'}
  Uptime:    ${info.uptime ? `${info.uptime}s` : 'N/A'}

${stdout.slice(0, 2000)}`
    }
  } catch (e) {
    return `py-spy failed: ${e}`
  }

  return `Could not get py-spy data for ${pid}`
}

async function showBasicInfo(pid: number): Promise<string> {
  const info = await getProcessInfo(pid)
  if (!info) {
    return `Process ${pid} not found or not accessible`
  }

  return `Process ${pid} Info:

  Language:  ${info.language}
  State:     ${info.status || '?'}
  Memory:    ${info.memoryRss || 'N/A'}
  Uptime:    ${info.uptime ? `${info.uptime}s` : 'N/A'}
  Command:   ${info.cmdline.join(' ').slice(0, 80)}`
}

export function registerDebugCommand(registerCmd: (cmd: import('./index.js').Command) => void) {
  registerCmd({
    name: 'debug',
    description: 'Attach to Node.js/Python process for debugging',
    execute: async (args) => {
      const pidStr = args[0]
      if (!pidStr) {
        return `Usage: /debug <pid>

Attaches to a running Node.js or Python process.

Examples:
  /debug 12345           - Show basic process info
  /debug 12345 node      - Attach Node.js inspector
  /debug 12345 python    - Get Python stack with py-spy
`
      }

      const pid = parseInt(pidStr)
      if (isNaN(pid)) {
        return `Invalid PID: ${pidStr}`
      }

      const mode = args[1] || 'info'

      if (mode === 'node' || mode === 'js') {
        return attachNodejs(pid)
      }

      if (mode === 'python' || mode === 'py') {
        return attachPython(pid)
      }

      // Default: show basic info
      return showBasicInfo(pid)
    },
  })
}