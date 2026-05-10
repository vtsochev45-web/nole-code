// /lint command - Run ESLint on the project

import { exec } from 'child_process'
import { promisify } from 'util'
import type { Command, CommandContext } from './index.js'

const execAsync = promisify(exec)

export function registerLintCommand(registerCommand: (cmd: Command) => void) {
  registerCommand({
    name: 'lint',
    description: 'Run ESLint to check code quality (/lint [path|fix])',
    aliases: ['eslint', 'check'],
    execute: async (args: string[], ctx: CommandContext) => {
      const [target, ...rest] = args
      const cwd = ctx.cwd || process.cwd()
      const isFix = target === 'fix' || rest.includes('fix')
      const cleanRest = isFix ? rest.filter((a: string) => a !== 'fix') : rest

      let cmd = 'npx eslint'
      if (isFix) cmd += ' --fix'
      const targetArg = cleanRest.join(' ') || (target && !isFix ? target : '')
      cmd += targetArg ? ` ${targetArg}` : ' .'

      try {
        const { stdout, stderr } = await execAsync(cmd, {
          cwd,
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        })
        if (!stdout && !stderr) return '✅ No lint errors'
        return (stdout + stderr).slice(0, 3000)
      } catch (e: any) {
        if (e.stdout) return e.stdout.slice(0, 3000)
        if (e.stderr) return `Error: ${e.stderr.slice(0, 1000)}`
        return `Lint failed: ${e.message.slice(0, 500)}`
      }
    },
  })
}