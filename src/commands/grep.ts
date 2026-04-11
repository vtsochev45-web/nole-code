/**
 * Grep Command — Search file contents with regex support and colored output.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import { registerCommand, type CommandContext } from '../commands/index.js'

const MAX_MATCHES = 100

async function execute(args: string[], ctx: CommandContext): Promise<string> {
  if (args.length === 0) {
    return `Usage: /grep <pattern> [file...]

Search for pattern in files with regex support.
Show matching lines with line numbers and highlighted matches.

Examples:
  /grep "function" src/
  /grep "TODO" *.ts
  /grep "^import.*from" --include "*.js"

Options:
  --include <pattern>  Filter files by glob pattern
  --exclude <pattern>  Exclude files by glob pattern
  -i                    Case insensitive search
  -n                    Show line numbers (default)
  -v                    Invert match (show non-matching lines)
  --limit N             Limit matches (default: ${MAX_MATCHES})`
  }

  // Parse options
  let pattern = ''
  let files: string[] = []
  let includePattern: string | undefined
  let excludePattern: string | undefined
  let caseInsensitive = false
  let invertMatch = false
  let limit = MAX_MATCHES

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--include' || arg === '-i' && args[i + 1] && !args[i + 1].startsWith('-')) {
      includePattern = args[i + 1]
      i++
    } else if (arg === '--exclude') {
      excludePattern = args[i + 1]
      i++
    } else if (arg === '-i' && !args[i + 1]?.startsWith('-')) {
      caseInsensitive = true
    } else if (arg === '-v') {
      invertMatch = true
    } else if (arg === '--limit' || arg === '-l') {
      limit = parseInt(args[i + 1]) || MAX_MATCHES
      i++
    } else if (!arg.startsWith('-')) {
      if (!pattern) {
        pattern = arg
      } else {
        files.push(arg)
      }
    }
  }

  if (!pattern) {
    return 'Error: No search pattern provided'
  }

  // Build regex
  let regex: RegExp
  try {
    const flags = (caseInsensitive ? 'i' : '') + 'g'
    regex = new RegExp(pattern, flags)
  } catch (e) {
    return `Invalid regex: ${(e as Error).message}`
  }

  // If no files specified, search in current directory
  if (files.length === 0) {
    files = [ctx.cwd]
  }

  const results: Array<{ file: string; line: number; content: string }> = []
  const searchedFiles: string[] = []

  // Process each file/directory
  for (const filePath of files) {
    const resolved = filePath.startsWith('/') ? filePath : join(ctx.cwd, filePath)
    const stat = statSync(resolved)

    if (stat.isDirectory()) {
      // Search directory recursively
      const { glob } = await import('glob')
      let pattern = '**/*'
      if (includePattern) pattern = `**/${includePattern}`
      if (excludePattern) pattern = `!**/${excludePattern}`
      
      const dirFiles = await glob(pattern, { cwd: resolved, absolute: true })
      
      for (const f of dirFiles) {
        if (results.length >= limit) break
        try {
          const content = readFileSync(f, 'utf-8')
          const lines = content.split('\n')
          searchedFiles.push(f)
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const matches = invertMatch ? !regex.test(line) : regex.test(line)
            if (matches && line.trim()) {
              results.push({ file: f, line: i + 1, content: line })
              if (results.length >= limit) break
            }
            regex.lastIndex = 0 // Reset regex for next line
          }
        } catch {
          // Skip unreadable files
        }
      }
    } else if (stat.isFile()) {
      try {
        const content = readFileSync(resolved, 'utf-8')
        const lines = content.split('\n')
        searchedFiles.push(resolved)

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const matches = invertMatch ? !regex.test(line) : regex.test(line)
          if (matches && line.trim()) {
            results.push({ file: resolved, line: i + 1, content: line })
            if (results.length >= limit) break
          }
          regex.lastIndex = 0
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  if (results.length === 0) {
    return `No matches found for "${pattern}" in ${searchedFiles.length} file(s)`
  }

  // Format output
  const uniqueFiles = [...new Set(results.map(r => r.file))]
  const showFileHeaders = uniqueFiles.length > 1

  const output: string[] = []
  output.push(`\x1b[1;32m${results.length} match${results.length === 1 ? '' : 'es'} found\x1b[0m in ${searchedFiles.length} file(s)${results.length >= limit ? ` (limited to ${limit})` : ''}\n`)

  let currentFile = ''
  for (const result of results) {
    if (showFileHeaders && result.file !== currentFile) {
      currentFile = result.file
      output.push(`\n\x1b[1;35m${result.file}\x1b[0m:`)
    }
    
    // Highlight match in red
    const highlightedContent = result.content.replace(regex, `\x1b[31m$&\x1b[0m`)
    const prefix = showFileHeaders ? '' : `\x1b[90m${String(result.line).padStart(4)}:\x1b[0m `
    output.push(`${prefix}${highlightedContent}`)
  }

  return output.join('\n')
}

export function registerGrepCommand(registerCmd: typeof registerCommand) {
  registerCmd({
    name: 'grep',
    description: 'Search file contents with regex and colored output',
    aliases: ['find', 'search'],
    execute: async (args: string[], ctx: CommandContext): Promise<string> => {
      return execute(args, ctx)
    },
  })
}