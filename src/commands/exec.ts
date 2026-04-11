// Nole Code - /exec command: Quick code evaluator

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

function isPythonExpression(expr: string): boolean {
  const trimmed = expr.trim()
  return (
    trimmed.startsWith('print(') ||
    trimmed.startsWith('print ') ||
    /^\s*def\s+/.test(trimmed) ||
    /^\s*class\s+/.test(trimmed) ||
    /^\s*from\s+\w+\s+import/.test(trimmed) ||
    /^\s*import\s+\w/.test(trimmed)
  )
}

async function evalJs(expr: string): Promise<string> {
  try {
    // Run in isolated subprocess — no access to REPL process globals
    const escaped = expr.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const { stdout, stderr } = await execAsync(
      `node -e 'try { const r = (0, eval)(\`${escaped}\`); console.log(r === undefined ? "undefined" : String(r)) } catch(e) { console.error(e.message); process.exit(1) }'`,
      { timeout: 5000 }
    )
    if (stderr) return `Error: ${stderr.trim()}`
    return stdout.trim() || 'undefined'
  } catch (e: any) {
    const stderr = e.stderr?.trim()
    return stderr ? `Error: ${stderr}` : `Error: ${e.message}`
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

      // Default to JS — run in isolated subprocess
      return await evalJs(expr)
    },
  })
}