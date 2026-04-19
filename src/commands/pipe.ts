// /pipe <cmd> — Pipe last output through shell command
import { spawn } from 'child_process'
import { Command, CommandContext, registerCommand } from './index.js'
import * as indexModule from '../index.js'

export function registerPipeCommand(register: typeof registerCommand) {
  register({
    name: 'pipe',
    description: 'Pipe last output through shell command',
    execute: async (args: string[], _ctx: CommandContext): Promise<string> => {
      const lastOutput = indexModule.lastOutput
      
      if (!lastOutput) {
        return 'No previous output to pipe. Send a message first.'
      }

      if (args.length === 0) {
        return 'Usage: /pipe <shell_command>\nExample: /pipe grep ERROR\nExample: /pipe wc -l\nExample: /pipe head -5'
      }

      const shellCmd = args.join(' ')

      return new Promise((resolve) => {
        const child = spawn('sh', ['-c', shellCmd], { timeout: 10000 })
        let stdout = ''
        let stderr = ''

        child.stdout?.on('data', (data) => { stdout += data })
        child.stderr?.on('data', (data) => { stderr += data })
        
        child.on('close', (code) => {
          if (stdout) resolve(stdout)
          else if (stderr) resolve(stderr)
          else resolve(code === 0 ? '(no output)' : `Exit code: ${code}`)
        })
        
        child.on('error', (err) => resolve(`Error: ${err.message}`))
        
        child.stdin?.write(lastOutput)
        child.stdin?.end()
      })
    },
  })
}