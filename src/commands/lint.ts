// /lint command - Run ESLint on the project

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export function registerLintCommand(registerCommand: (cmd: any) => void) {
  registerCommand({
    name: 'lint',
    description: 'Run ESLint to check code quality (/lint [path|fix])',
    aliases: ['eslint', 'check'],
    execute: async (args, ctx) => {
      const [target, ...rest] = args
      const cwd = (ctx as any).cwd || process.cwd()
      const isFix = target === 'fix' || rest.includes('fix')

      const eslintConfigs = ['eslint.config.js', '.eslintrc.js', '.eslintrc.json']
      const hasConfig = eslintConfigs.some(f => existsSync(join(cwd, f)))
      if (!hasConfig) {
        return '⚠️  ESLint config not found. Run: npm init @eslint/config'
      }

      let cmd = 'npx eslint'
      if (isFix) cmd += ' --fix'
      cmd += target && !isFix ? ` ${target}` : ' .'

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