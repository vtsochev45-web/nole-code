// Nole Code - /exec command: Quick code evaluator

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

function isPythonExpression(expr: string): boolean {
  return (
    expr.startsWith('print') ||
    expr.startsWith('def ') ||
    expr.startsWith('import ') ||
    expr.startsWith('class ') ||
    expr.includes('print(') ||
    expr.includes('def ') ||
    /\s+def\s+/.test(expr) ||
    /\s+import\s+/.test(expr) ||
    /\s+class\s+/.test(expr)
  )
}

async function evalJs(expr: string): Promise<string> {
  try {
    // Use eval in a worker-like context
    const result = eval(expr)
    if (result === undefined) return 'undefined'
    if (result === null) return 'null'
    return String(result)
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

async function evalPython(expr: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`python3 -c "${expr.replace(/"/g, '\\"')}"`, { timeout: 5000 })
    if (stderr && !stderr.includes('Warning')) {
      return `Error: ${stderr}`
    }
    return stdout.trim() || '(no output)'
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

export function registerExecCommand(registerCmd: (cmd: import('./index.js').Command) => void) {
  registerCmd({
    name: 'exec',
    description: 'Evaluate a code expression (JS or Python)',
    aliases: ['eval', 'evaljs'],
    execute: async (args) => {
      if (args.length === 0) {
        return 'Usage: /exec <expression>\nEvaluates JavaScript or Python expressions.\nExamples:\n  /exec 2 + 2\n  /exec "hello".toUpperCase()\n  /exec print(1 + 2)'
      }

      const expr = args.join(' ')

      // Detect Python vs JS
      if (isPythonExpression(expr)) {
        return await evalPython(expr)
      }

      // Default to JS
      // Wrap in parentheses if it's an expression
      let js = expr
      if (!expr.includes('=') && !expr.includes('return') && !expr.match(/^(if|for|while|function|class|import|export)/)) {
        try {
          // Try as expression first
          const result = eval(js)
          return `${result}`
        } catch {
          // Fall back to statement
          js = `(function() { return ${expr} })()`
          try {
            const result = eval(js)
            return `${result}`
          } catch (e: any) {
            return `Error: ${e.message}`
          }
        }
      }

      // For statements
      try {
        const result = eval(js)
        return `${result}`
      } catch (e: any) {
        return `Error: ${e.message}`
      }
    },
  })
}