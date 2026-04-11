/**
 * Test Command — Run tests using detected framework (jest, mocha, pytest).
 */

import { existsSync, readFileSync, statSync } from 'fs'
import { join, basename } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { registerCommand, type CommandContext } from '../commands/index.js'

const execAsync = promisify(exec)

interface TestResult {
  passed: number
  failed: number
  total: number
  duration: string
  output: string
}

async function detectTestFramework(cwd: string): Promise<string | null> {
  // Check for jest (package.json with jest or *.test.ts files)
  const packageJsonPath = join(cwd, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      if (pkg.devDependencies?.jest || pkg.dependencies?.jest || pkg.scripts?.test?.includes('jest')) {
        return 'jest'
      }
      if (pkg.scripts?.test?.includes('vitest')) {
        return 'vitest'
      }
      if (pkg.devDependencies?.mocha || pkg.scripts?.test?.includes('mocha')) {
        return 'mocha'
      }
    } catch {}
  }

  // Check for jest test files
  const jestFiles = ['*.test.ts', '*.test.js', '*.spec.ts', '*.spec.js']
  for (const pattern of jestFiles) {
    const { glob } = await import('glob')
    const files = await glob(pattern, { cwd, absolute: true })
    if (files.length > 0) return 'jest'
  }

  // Check for pytest (pytest.ini, setup.cfg, or test_*.py)
  const pytestConfigs = ['pytest.ini', 'setup.cfg', 'pyproject.toml']
  for (const config of pytestConfigs) {
    if (existsSync(join(cwd, config))) {
      try {
        const content = readFileSync(join(cwd, config), 'utf-8')
        if (content.includes('[tool.pytest') || content.includes('[pytest]')) {
          return 'pytest'
        }
      } catch {}
    }
  }

  // Check for test_*.py files
  const { glob } = await import('glob')
  const pyFiles = await glob('test_*.py', { cwd, absolute: true })
  if (pyFiles.length > 0) return 'pytest'

  return null
}

async function runJestTests(cwd: string, args: string[]): Promise<TestResult> {
  const testArgs = args.length > 0 ? args.join(' ') : ''
  const cmd = `npx jest ${testArgs} --passWithNoTests 2>&1`
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 120000 })
    const output = stdout + stderr
    return parseJestOutput(output)
  } catch (e: any) {
    const output = e.stdout + e.stderr
    return parseJestOutput(output, true)
  }
}

async function runVitestTests(cwd: string, args: string[]): Promise<TestResult> {
  const testArgs = args.length > 0 ? args.join(' ') : ''
  const cmd = `npx vitest run ${testArgs} 2>&1`
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 120000 })
    const output = stdout + stderr
    return parseJestOutput(output) // Vitest output similar to Jest
  } catch (e: any) {
    const output = e.stdout + e.stderr
    return parseJestOutput(output, true)
  }
}

async function runMochaTests(cwd: string, args: string[]): Promise<TestResult> {
  const testArgs = args.length > 0 ? args.join(' ') : ''
  const cmd = `npx mocha ${testArgs} --timeout 30000 2>&1`
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 120000 })
    const output = stdout + stderr
    return parseMochaOutput(output)
  } catch (e: any) {
    const output = e.stdout + e.stderr
    return parseMochaOutput(output, true)
  }
}

async function runPytest(cwd: string, args: string[]): Promise<TestResult> {
  const testArgs = args.length > 0 ? args.join(' ') : ''
  const cmd = `python -m pytest ${testArgs} -v 2>&1`
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 120000 })
    const output = stdout + stderr
    return parsePytestOutput(output)
  } catch (e: any) {
    const output = e.stdout + e.stderr
    return parsePytestOutput(output, true)
  }
}

function parseJestOutput(output: string, hasError = false): TestResult {
  const passed = (output.match(/✓|PASS/g) || []).length
  const failed = (output.match(/✗|FAIL|failed/g) || []).length
  const timeMatch = output.match(/(\d+\.?\d*)\s*(s|ms)/)
  const duration = timeMatch ? timeMatch[0] : 'N/A'

  return {
    passed: hasError ? 0 : passed,
    failed,
    total: passed + failed,
    duration,
    output: output.slice(0, 2000),
  }
}

function parseMochaOutput(output: string, hasError = false): TestResult {
  const passed = (output.match(/passing/g) ? 1 : 0) || 0
  const failedMatch = output.match(/(\d+)\s+pending/)
  const failed = failedMatch ? parseInt(failedMatch[1]) : 0
  const timeMatch = output.match(/(\d+\.?\d*)\s*ms/)

  return {
    passed: hasError ? 0 : passed,
    failed,
    total: passed + failed,
    duration: timeMatch ? timeMatch[0] : 'N/A',
    output: output.slice(0, 2000),
  }
}

function parsePytestOutput(output: string, hasError = false): TestResult {
  const passed = (output.match(/PASSED/g) || []).length
  const failed = (output.match(/FAILED/g) || []).length
  const timeMatch = output.match(/(\d+\.?\d*)\s*s/)
  const duration = timeMatch ? timeMatch[0] : 'N/A'

  return {
    passed: hasError ? 0 : passed,
    failed,
    total: passed + failed,
    duration,
    output: output.slice(0, 2000),
  }
}

async function execute(args: string[], ctx: CommandContext): Promise<string> {
  let target = ctx.cwd
  
  // Parse options
  const options: string[] = []
  for (const arg of args) {
    if (arg.startsWith('--')) {
      options.push(arg)
    } else if (!arg.startsWith('-')) {
      // This is the target file/directory
      target = arg.startsWith('/') ? arg : join(ctx.cwd, arg)
    }
  }

  // Check if target exists
  if (!existsSync(target)) {
    return `Target not found: ${target}`
  }

  const stat = statSync(target)
  const cwd = stat.isDirectory() ? target : ctx.cwd

  // Detect framework
  const framework = await detectTestFramework(cwd)
  
  if (!framework) {
    return `No test framework detected.

Supported frameworks:
  - Jest ( *.test.ts, *.test.js )
  - Vitest ( *.test.ts, *.test.js )
  - Mocha ( test/*.js )
  - pytest ( test_*.py, conftest.py )

Or specify a test file directly:
  /test <file>

Make sure you have dependencies installed (npm install / pip install).`
  }

  const targetName = stat.isDirectory() ? basename(cwd) : basename(target)
  const result = framework === 'jest' ? await runJestTests(cwd, options) :
                framework === 'vitest' ? await runVitestTests(cwd, options) :
                framework === 'mocha' ? await runMochaTests(cwd, options) :
                await runPytest(cwd, options)

  // Format output
  const icon = result.failed > 0 ? '\x1b[31m✗' : '\x1b[32m✓'
  const status = result.failed > 0 ? 'FAILED' : 'PASSED'
  
  const output: string[] = []
  output.push(`\x1b[1mTest Results for ${targetName}\x1b[0m`)
  output.push(`  Framework: ${framework}`)
  output.push(`  Status:    ${icon} ${status}`)
  output.push(`  Passed:    \x1b[32m${result.passed}\x1b[0m`)
  output.push(`  Failed:    \x1b[31m${result.failed}\x1b[0m`)
  output.push(`  Total:     ${result.total}`)
  output.push(`  Duration:  ${result.duration}`)
  output.push('')
  output.push('\x1b[90m' + result.output.split('\n').slice(-10).join('\n') + '\x1b[0m')

  return output.join('\n')
}

export function registerTestCommand(registerCmd: typeof registerCommand) {
  registerCmd({
    name: 'test',
    description: 'Run tests (jest, mocha, pytest). Auto-detects framework.',
    aliases: ['t', 'run-tests'],
    execute: async (args: string[], ctx: CommandContext): Promise<string> => {
      return execute(args, ctx)
    },
  })
}