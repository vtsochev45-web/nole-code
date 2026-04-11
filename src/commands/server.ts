// Nole Code - Server Command
// /server start|stop|status

import { spawn } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, unlinkSync } from 'fs'

function getPidFile(): string {
  return join(homedir(), '.nole-code', 'server.pid')
}

function readPidFile(): number | null {
  try {
    if (existsSync(getPidFile())) {
      const pid = parseInt(readFileSync(getPidFile(), 'utf-8').trim(), 10)
      return isNaN(pid) ? null : pid
    }
  } catch {}
  return null
}

function checkServerStatus(): { running: boolean; pid: number | null } {
  const pid = readPidFile()
  if (!pid) {
    return { running: false, pid: null }
  }
  
  try {
    process.kill(pid, 0) // Signal 0 just checks if process exists
    return { running: true, pid }
  } catch {
    // Process doesn't exist
    return { running: false, pid: null }
  }
}

export function registerServerCommand(register: (cmd: {
  name: string
  description: string
  aliases?: string[]
  execute: (args: string[], ctx: { cwd: string; sessionId: string }) => Promise<string>
}) => void) {
  register({
    name: 'server',
    description: 'Server management: /server start|stop|status',
    aliases: ['srv'],
    execute: async (args, ctx) => {
      const action = args[0] || 'status'
      const noleCodeDir = join(homedir(), 'nole-code')
      
      switch (action) {
        case 'start': {
          const { running } = checkServerStatus()
          if (running) {
            return 'Server already running'
          }
          
          // Start server in background
          const child = spawn('bun', ['run', 'src/server/index.ts', 'start'], {
            cwd: noleCodeDir,
            detached: true,
            stdio: 'ignore',
          })
          child.unref()
          
          // Give it a moment to start
          await new Promise(resolve => setTimeout(resolve, 500))
          
          const status = checkServerStatus()
          if (status.running) {
            return `Server started (PID: ${status.pid})`
          } else {
            return 'Server started (checking status...)'
          }
        }
        
        case 'stop': {
          const status = checkServerStatus()
          if (!status.running || !status.pid) {
            return 'Server not running'
          }
          
          try {
            process.kill(status.pid, 'SIGTERM')
            // Clear PID file immediately
            try {
              unlinkSync(getPidFile())
            } catch {}
            return `Server stopped (PID: ${status.pid})`
          } catch (e) {
            return `Failed to stop server: ${String(e)}`
          }
        }
        
        case 'status': {
          const status = checkServerStatus()
          if (status.running && status.pid) {
            const port = process.env.SERVER_PORT || '18792'
            return `Server running (PID: ${status.pid}, port: ${port})`
          } else {
            return 'Server not running'
          }
        }
        
        default:
          return `Unknown action: ${action}. Use start, stop, or status`
      }
    },
  })
}