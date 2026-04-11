// /pipe <cmd> — Pipe last output through shell command
import { exec } from 'child_process'
import { promisify } from 'util'
import { Command, CommandContext, registerCommand } from './index.js'
import * as indexModule from '../index.js'

const execAsync = promisify(exec)

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

      try {
        const { stdout, stderr } = await execAsync(shellCmd, {
          input: lastOutput,
          encoding: 'utf-8',
          timeout: 10000,
        })

        if (stdout) return stdout
        if (stderr) return stderr
        return '(no output)'
      } catch (err: unknown) {
        const error = err as { message?: string; stdout?: string; stderr?: string }
        return error.stdout || error.stderr || `Error: ${error.message || String(err)}`
      }
    },
  })
}