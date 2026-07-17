import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const projectRoot = join(import.meta.dir, '..')
const cliEntry = join(projectRoot, 'src', 'index.ts')
const packageVersion = JSON.parse(
  readFileSync(join(projectRoot, 'package.json'), 'utf8'),
).version as string

let sandbox = ''

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'nole-cli-test-'))
})

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

function runCli(...args: string[]) {
  const env = { ...process.env, HOME: sandbox }
  delete env.MINIMAX_API_KEY
  delete env.OPENROUTER_API_KEY
  delete env.OPENAI_API_KEY

  const result = Bun.spawnSync({
    cmd: ['bun', 'run', cliEntry, ...args],
    cwd: sandbox,
    env,
    stdin: null,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: result.exitCode,
    stdout: Buffer.from(result.stdout).toString('utf8'),
    stderr: Buffer.from(result.stderr).toString('utf8'),
  }
}

describe('CLI metadata flags', () => {
  test.each(['--version', '-v'])('%s reports the package version', flag => {
    const result = runCli(flag)

    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe(`Nole Code v${packageVersion}`)
    expect(result.stderr).toBe('')
  })

  test('--help is read-only in the selected working directory', () => {
    const contextPath = join(sandbox, 'NOLE.md')
    writeFileSync(contextPath, 'operator-owned context\n')

    const result = runCli('--help')

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Nole Code')
    expect(readFileSync(contextPath, 'utf8')).toBe('operator-owned context\n')
  })

  test('init refuses to overwrite an existing NOLE.md', () => {
    const contextPath = join(sandbox, 'NOLE.md')
    writeFileSync(contextPath, 'operator-owned context\n')

    const result = runCli('init')

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('already exists')
    expect(readFileSync(contextPath, 'utf8')).toBe('operator-owned context\n')
  })
})
