// Nole Code - Server Entry Point
// HTTP/WebSocket API server using Bun

import { handleApiRequest, setServer, addWsClient, removeWsClient, broadcastTaskEvent } from './api.js'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const DEFAULT_PORT = 18792

// Get port from SERVER_PORT env or default
function getPort(): number {
  const envPort = process.env.SERVER_PORT
  if (envPort) {
    const port = parseInt(envPort, 10)
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port
    }
  }
  return DEFAULT_PORT
}

// PID file for server management
function getPidFile(): string {
  return join(homedir(), '.nole-code', 'server.pid')
}

function writePidFile(pid: number): void {
  const dir = join(homedir(), '.nole-code')
  if (!existsSync(dir)) {
    // Simple mkdir -p equivalent
    import('fs').then(fs => fs.mkdirSync(dir, { recursive: true }))
  }
  writeFileSync(getPidFile(), String(pid))
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

function clearPidFile(): void {
  try {
    // Simple try-catch for file deletion
    import('fs').then(fs => fs.unlinkSync(getPidFile()))
  } catch {}
}

// Check if a port is in use
function isPortInUse(port: number): boolean {
  try {
    const net = require('net')
    const server = net.createServer()
    return new Promise<boolean>(resolve => {
      server.once('error', () => resolve(true))
      server.once('listening', () => {
        server.close()
        resolve(false)
      })
      server.listen(port, '127.0.0.1')
    }) as unknown as boolean
  } catch {
    return false
  }
}

// Start the server
async function startServer(): Promise<string> {
  const port = getPort()
  
  // Check if already running
  const existingPid = readPidFile()
  if (existingPid) {
    try {
      // Check if process exists
      process.kill(existingPid, 0)
      return `Server already running (PID: ${existingPid})`
    } catch {
      // Process doesn't exist, clear stale PID
      clearPidFile()
    }
  }
  
  // Check if port is in use
  // Note: isPortInUse is async, simplified check
  console.log(`Starting Nole Code server on port ${port}...`)
  
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    fetch(req, ctx) {
      // WebSocket upgrade handling
      const url = new URL(req.url)
      if (url.pathname === '/ws') {
        const upgraded = server.upgrade(req)
        if (upgraded) {
          return undefined // WebSocket handled
        }
      }
      
      return handleApiRequest(req)
    },
    websocket: {
      open(ws) {
        console.log('WebSocket client connected')
        addWsClient(ws)
      },
      message(ws, message) {
        // Handle incoming WebSocket messages
        try {
          const data = JSON.parse(message.toString())
          console.log('WebSocket message:', data)
        } catch {
          console.log('Received non-JSON message:', message.toString())
        }
      },
      close(ws) {
        console.log('WebSocket client disconnected')
        removeWsClient(ws)
      },
      error(ws, error) {
        console.error('WebSocket error:', error)
      },
    },
  })
  
  // Set the server instance for API
  setServer(server)
  
  // Write PID file
  writePidFile(process.pid)
  
  return `Server running at http://127.0.0.1:${port}`
}

// Stop the server
function stopServer(): string {
  const pid = readPidFile()
  if (!pid) {
    return 'Server not running (no PID file)'
  }
  
  try {
    process.kill(pid, 'SIGTERM')
    clearPidFile()
    return `Server stopped (PID: ${pid})`
  } catch (e) {
    clearPidFile()
    return `Server process not found, PID file cleared`
  }
}

// Check server status
function getServerStatus(): string {
  const pid = readPidFile()
  if (!pid) {
    return 'Server not running'
  }
  
  try {
    process.kill(pid, 0) // Signal 0 just checks if process exists
    const port = getPort()
    return `Server running (PID: ${pid}, port: ${port})`
  } catch {
    clearPidFile()
    return 'Server not running (stale PID file)'
  }
}

// CLI entry point
const args = process.argv.slice(2)
const command = args[0]

if (command === 'start') {
  startServer().then(msg => console.log(msg)).catch(e => {
    console.error('Failed to start server:', e)
    process.exit(1)
  })
} else if (command === 'stop') {
  console.log(stopServer())
} else if (command === 'status') {
  console.log(getServerStatus())
} else {
  // Default: start in background
  startServer().then(msg => console.log(msg)).catch(e => {
    console.error('Failed to start server:', e)
    process.exit(1)
  })
}

export { startServer, stopServer, getServerStatus, getPort }