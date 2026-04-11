/**
 * Read Command — Smart file reader with glob support, syntax highlighting, and metadata.
 */

import { existsSync, readFileSync, statSync, readdirSync } from 'fs'
import { join, basename, extname } from 'path'
import { glob } from 'glob'
import { registerCommand, type CommandContext } from '../commands/index.js'

// Syntax highlighting patterns (ANSI escape codes)
const SYNTAX_COLORS: Record<string, string> = {
  default: '\x1b[37m',
  keyword: '\x1b[36m',
  string: '\x1b[32m',
  number: '\x1b[33m',
  comment: '\x1b[90m',
  function: '\x1b[35m',
  reset: '\x1b[0m',
}

function getLanguage(ext: string): string {
  const langMap: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.sh': 'Shell',
    '.bash': 'Shell',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.yml': 'YAML',
    '.yaml': 'YAML',
    '.html': 'HTML',
    '.css': 'CSS',
    '.sql': 'SQL',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.c': 'C',
    '.cpp': 'C++',
  }
  return langMap[ext.toLowerCase()] || 'Text'
}

function getFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function highlightLine(line: string, ext: string): string {
  // Simple syntax highlighting
  const keywords = /\b(const|let|var|function|class|import|export|from|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|async|await|def|class|import|from|print|return|if|elif|else|for|while|true|false|None|const|let|var|function|=>|=>|public|private|static|void|int|string|bool)\b/g
  const strings = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g
  const numbers = /\b\d+\.?\d*\b/g
  const comments = /(\/\/.*$|#.*$)/gm

  let highlighted = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Apply basic highlighting
  highlighted = highlighted.replace(comments, `${SYNTAX_COLORS.comment}$1${SYNTAX_COLORS.reset}`)
  highlighted = highlighted.replace(strings, `${SYNTAX_COLORS.string}$&${SYNTAX_COLORS.reset}`)
  highlighted = highlighted.replace(numbers, `${SYNTAX_COLORS.number}$&${SYNTAX_COLORS.reset}`)
  highlighted = highlighted.replace(keywords, `${SYNTAX_COLORS.keyword}$&${SYNTAX_COLORS.reset}`)

  return highlighted
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function readFile(filePath: string, options: { lines?: number; offset?: number } = {}): string {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  const start = options.offset ? Math.max(1, options.offset) - 1 : 0
  const end = options.lines ? start + options.lines : lines.length
  
  const selectedLines = lines.slice(start, end)
  
  const ext = extname(filePath)
  const stats = statSync(filePath)
  const language = getLanguage(ext)
  
  const output: string[] = []
  output.push(`\x1b[1;34m${basename(filePath)}\x1b[0m \x1b[90m(${language})\x1b[0m`)
  output.push(`  Size: ${getFileSize(stats.size)} | Modified: ${formatDate(stats.mtimeMs)}`)
  output.push('')
  
  for (let i = 0; i < selectedLines.length; i++) {
    const lineNum = start + i + 1
    const line = selectedLines[i]
    const highlighted = highlightLine(line, ext)
    output.push(`\x1b[90m${String(lineNum).padStart(4)}\x1b[0m │ ${highlighted}`)
  }
  
  if (end < lines.length) {
    output.push(`\x1b[90m  ... ${lines.length - end} more lines\x1b[0m`)
  }
  
  return output.join('\n')
}

async function execute(args: string[], ctx: CommandContext): Promise<string> {
  // Parse args for options
  let filePattern = ''
  let linesLimit: number | undefined
  let offset: number | undefined
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--lines' || arg === '-n') {
      linesLimit = parseInt(args[i + 1])
      i++
    } else if (arg === '--offset' || arg === '-o') {
      offset = parseInt(args[i + 1])
      i++
    } else {
      filePattern = arg
    }
  }
  
  if (!filePattern) {
    return `Usage: /read <file|glob> [--lines N] [--offset N]

Examples:
  /read package.json
  /read src/*.ts
  /read readme.md --lines 20
  /read app.py --offset 100 --lines 50

Supported: .ts, .js, .py, .sh, .json, .md, .yml, .html, .css, .sql, .go, .rs, .java, .c, .cpp`
  }
  
  // Resolve relative to cwd
  const resolved = filePattern.startsWith('/') ? filePattern : join(ctx.cwd, filePattern)
  
  // Check if it's a glob pattern
  if (resolved.includes('*') || resolved.includes('?')) {
    try {
      const files = await glob(resolved)
      if (files.length === 0) return `No files match: ${filePattern}`
      if (files.length === 1) {
        return readFile(files[0], { lines: linesLimit, offset })
      }
      
      // Multiple files
      const output: string[] = []
      output.push(`\x1b[1;32m${files.length} files matching ${filePattern}:\x1b[0m\n`)
      
      for (const file of files) {
        const stats = statSync(file)
        output.push(`  \x1b[37m${basename(file)}\x1b[0m ${getFileSize(stats.size)}`)
      }
      
      return output.join('\n')
    } catch (e) {
      return `Error reading files: ${(e as Error).message}`
    }
  }
  
  // Single file
  if (!existsSync(resolved)) {
    return `File not found: ${filePattern}`
  }
  
  try {
    return readFile(resolved, { lines: linesLimit, offset })
  } catch (e) {
    return `Error reading ${filePattern}: ${(e as Error).message}`
  }
}

export function registerReadCommand(registerCmd: typeof registerCommand) {
  registerCmd({
    name: 'read',
    description: 'Read file(s) with syntax highlighting. Use glob patterns.',
    aliases: ['cat', 'view'],
    execute: async (args: string[], ctx: CommandContext): Promise<string> => {
      return execute(args, ctx)
    },
  })
}