// /port command - Show what's using a port
import { execSync } from 'child_process'

interface PortInfo {
  pid: string
  process: string
  port: number
  address: string
}

function parseListeningPorts(): PortInfo[] {
  try {
    const output = execSync('ss -tlnp', { encoding: 'utf-8' })
    const lines = output.split('\n').slice(1) // Skip header
    const ports: PortInfo[] = []

    for (const line of lines) {
      const match = line.match(/:\s*(\d+)\s+\d+\.\d+\.\d+\.\d+:(\d+)/)
      if (!match) continue

      const localAddr = match[0].split(/\s+/)[3] || ''
      const port = parseInt(match[1])
      const addr = localAddr.includes('127.0.0.1') ? '127.0.0.1' : 
                   localAddr.includes('0.0.0.0') ? '0.0.0.0' : 
                   localAddr.includes('::') ? '::' : localAddr

      // Extract PID if available
      const pidMatch = line.match(/pid=(\d+)/)
      const pid = pidMatch ? pidMatch[1] : ''

      // Get process name if we have a PID
      let processName = ''
      if (pid) {
        try {
          const procOutput = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf-8' })
          processName = procOutput.trim()
        } catch {}
      }

      ports.push({ pid, process: processName, port, address: addr })
    }

    return ports
  } catch {
    return []
  }
}

function getPortProcess(port: number): PortInfo | null {
  try {
    const output = execSync(`ss -tlnp | grep :${port}`, { encoding: 'utf-8' })
    const lines = output.trim().split('\n')
    if (lines.length === 0 || lines[0] === '') return null

    const line = lines[0]
    const addrMatch = line.match(/(?:0\.0\.0\.0|127\.0\.0\.1|::|\*):(\d+)/)
    const addr = line.includes('127.0.0.1') ? '127.0.0.1' : 
                 line.includes('0.0.0.0') ? '0.0.0.0' : 
                 line.includes('::') ? '::' : '*'
    const pidMatch = line.match(/pid=(\d+)/)
    const pid = pidMatch ? pidMatch[1] : ''

    let processName = ''
    if (pid) {
      try {
        const procOutput = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf-8' })
        processName = procOutput.trim()
      } catch {}
    }

    return { pid, process: processName, port, address: addr }
  } catch {
    return null
  }
}

function killProcess(pid: string): boolean {
  try {
    execSync(`kill ${pid}`, { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

export function registerPortCommand(registerCommand: (cmd: any) => void) {
  registerCommand({
    name: 'port',
    description: 'Show listening ports or kill process on a port',
    execute: async (args: string[]) => {
      // No args: list all listening ports
      if (args.length === 0) {
        const ports = parseListeningPorts()
        if (ports.length === 0) {
          return 'No listening ports found'
        }
        
        const lines = ['Listening Ports:\n']
        lines.push('  PID       Process          Port   Address')
        lines.push('  ' + '-'.repeat(45))
        
        for (const p of ports) {
          const pid = (p.pid || '-').padEnd(8)
          const proc = (p.process || '-').padEnd(16)
          const port = String(p.port).padEnd(7)
          const addr = p.address
          lines.push(`  ${pid} ${proc} ${port} ${addr}`)
        }
        
        return lines.join('\n')
      }

      // Check for --kill flag
      const killIndex = args.indexOf('--kill')
      const portArg = killIndex >= 0 ? args.slice(0, killIndex)[0] : args[0]
      const shouldKill = killIndex >= 0

      const port = parseInt(portArg)
      if (isNaN(port)) {
        return 'Invalid port number'
      }

      const info = getPortProcess(port)
      if (!info) {
        return `No process found on port ${port}`
      }

      const lines = [`Port ${port}:`, '']
      lines.push(`  PID:      ${info.pid || 'unknown'}`)
      lines.push(`  Process:  ${info.process || 'unknown'}`)
      lines.push(`  Address:  ${info.address}:${port}`)

      if (shouldKill && info.pid) {
        const confirmed = args.includes('--yes') || args.includes('-y')
        if (!confirmed) {
          lines.push('')
          lines.push(`Run with --yes to confirm killing PID ${info.pid}`)
          return lines.join('\n')
        }
        const killed = killProcess(info.pid)
        if (killed) {
          lines.push('')
          lines.push(`✅ Killed process ${info.pid}`)
        } else {
          lines.push('')
          lines.push(`❌ Failed to kill process ${info.pid}`)
        }
      }

      return lines.join('\n')
    },
  })
}