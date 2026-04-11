// /recent [n] — Show recently modified files
import { exec } from 'child_process'
import { promisify } from 'util'
import { Command, CommandContext, registerCommand } from './index.js'

const execAsync = promisify(exec)

export function registerRecentCommand(register: typeof registerCommand) {
  register({
    name: 'recent',
    description: 'Show recently modified files (default: last 10, last 7 days)',
    execute: async (args: string[], ctx: CommandContext): Promise<string> => {
      const count = parseInt(args[0]) || 10

      if (count < 1 || count > 100) {
        return 'Usage: /recent [n] — n between 1 and 100 (default: 10)'
      }

      try {
        // Find files modified in last 7 days, excluding certain directories
        const findCmd = `find . -type f \\( -path '*/.git/*' -o -path '*/node_modules/*' -o -path '*/.nole-code/*' -o -path '*/dist/*' -o -path '*/build/*' \\) -prune -o -type f -mtime -7 -print`
        
        const { stdout: findOutput } = await execAsync(findCmd, {
          encoding: 'utf-8',
          cwd: ctx.cwd,
          timeout: 10000,
        })

        if (!findOutput.trim()) {
          return 'No files modified in the last 7 days.'
        }

        // Get file details: path, mtime, size, and git status
        const files = findOutput.trim().split('\n').filter(Boolean)

        // Sort by mtime (newest first) and take top N
        const sortedFiles = files
          .map(f => {
            try {
              const stat = require('fs').statSync(require('path').resolve(ctx.cwd, f))
              return {
                path: f,
                mtime: stat.mtime,
                size: stat.size,
              }
            } catch {
              return null
            }
          })
          .filter(Boolean)
          .sort((a, b) => b!.mtime.getTime() - a!.mtime.getTime())
          .slice(0, count) as Array<{ path: string; mtime: Date; size: number }>

        if (sortedFiles.length === 0) {
          return 'No files found.'
        }

        // Get git status for each file
        const gitStatus: Record<string, string> = {}
        try {
          const { stdout: gitOut } = await execAsync('git status --short', {
            encoding: 'utf-8',
            cwd: ctx.cwd,
            timeout: 5000,
          })
          
          for (const line of gitOut.trim().split('\n')) {
            if (!line) continue
            const match = line.match(/^([ MADRC]{1,2})\s+(.+)$/)
            if (match) {
              const status = match[1].trim()
              const filePath = match[2].trim()
              gitStatus[filePath] = status
            }
          }
        } catch {
          // Not a git repo or git not available
        }

        // Format output
        const lines: string[] = [`Recent files (${sortedFiles.length}):\n`]

        for (const file of sortedFiles) {
          // Try to find git status with various possible paths
          let status = ''
          const gitStatusKey = Object.keys(gitStatus).find(k => 
            k === file.path || k.endsWith(file.path) || file.path.endsWith(k)
          )
          
          if (gitStatusKey) {
            const code = gitStatus[gitStatusKey]
            if (code.includes('M')) status = ' [M]'
            else if (code.includes('??')) status = ' [??]'
            else if (code.includes('A')) status = ' [A]'
            else if (code.includes('D')) status = ' [D]'
          }

          // Format size
          const size = file.size
          let sizeStr = ''
          if (size < 1024) sizeStr = `${size}B`
          else if (size < 1024 * 1024) sizeStr = `${(size / 1024).toFixed(1)}K`
          else sizeStr = `${(size / (1024 * 1024)).toFixed(1)}M`

          // Format mtime
          const mtime = file.mtime.toISOString().slice(0, 16).replace('T', ' ')

          // Truncate long paths
          const displayPath = file.path.length > 50 
            ? '...' + file.path.slice(-47) 
            : file.path

          lines.push(`  ${sizeStr.padStart(6)}  ${mtime}  ${displayPath}${status}`)
        }

        return lines.join('\n')
      } catch (err: unknown) {
        const error = err as { message?: string }
        return `Error: ${error.message || String(err)}`
      }
    },
  })
}