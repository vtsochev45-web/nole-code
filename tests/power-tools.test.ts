// Tests for power tools
import { describe, test, expect } from 'bun:test'
import { getToolDefinitions, executeTool } from '../src/tools/registry.js'
import { writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'node:os'
import { join } from 'path'

const TEST_DIR = '/tmp/nole-power-test-' + Date.now()
const PROJECT_ROOT = join(import.meta.dir, '..')
const PROJECT_SRC = join(PROJECT_ROOT, 'src')

describe('Power Tools Registration', () => {
  test('all new tools are registered', () => {
    const defs = getToolDefinitions()
    const names = defs.map(d => d.name)
    expect(names).toContain('LS')
    expect(names).toContain('Tree')
    expect(names).toContain('MultiEdit')
    expect(names).toContain('HttpRequest')
    expect(names).toContain('FindReplace')
    expect(names).toContain('GitStatus')
    expect(names).toContain('GitCommit')
    expect(names).toContain('GitDiff')
    expect(names).toContain('RunTests')
    expect(names).toContain('Spawn')
    expect(names).toContain('Diff')
    expect(names).toContain('Rename')
    expect(names).toContain('Delete')
  })

  test('total tool count is 30+', () => {
    const defs = getToolDefinitions()
    expect(defs.length).toBeGreaterThanOrEqual(30)
  })
})

describe('LS Tool', () => {
  test('lists current directory', async () => {
    const result = await executeTool('LS', { path: PROJECT_SRC }, { cwd: PROJECT_ROOT, sessionId: 'test' })
    expect(result.content).toContain('index.ts')
    expect(result.content).toContain('api/')
  })

  test('shows file sizes in long format', async () => {
    const result = await executeTool('LS', { path: PROJECT_ROOT, long: true }, { cwd: PROJECT_ROOT, sessionId: 'test' })
    expect(result.content).toMatch(/\d+\.\d+[KMG]/)
  })
})

describe('Tree Tool', () => {
  test('shows directory tree', async () => {
    const result = await executeTool('Tree', { path: PROJECT_SRC, depth: 2 }, { cwd: PROJECT_ROOT, sessionId: 'test' })
    expect(result.content).toContain('├──')
    expect(result.content).toContain('directories')
    expect(result.content).toContain('files')
  })
})

describe('MultiEdit Tool', () => {
  test('applies multiple edits', async () => {
    const path = '/tmp/nole-multi-edit-test.txt'
    writeFileSync(path, 'hello world\nfoo bar\nbaz qux')

    const result = await executeTool('MultiEdit', {
      path,
      edits: [
        { old_text: 'hello', new_text: 'goodbye' },
        { old_text: 'foo', new_text: 'FOO' },
      ],
    }, { cwd: '/tmp', sessionId: 'test' })

    expect(result.content).toContain('2/2 edits applied')
    expect(result.content).toContain('- hello')
    expect(result.content).toContain('+ goodbye')

    const { readFileSync } = require('fs')
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('goodbye')
    expect(content).toContain('FOO')

    unlinkSync(path)
  })
})

describe('FindReplace Tool', () => {
  test('dry run shows matches without changing files', async () => {
    const fixture = mkdtempSync(join(tmpdir(), 'nole-find-replace-test-'))
    const path = join(fixture, 'llm.ts')
    const original = 'export class LLMClient {}\n'
    writeFileSync(path, original)

    try {
      const result = await executeTool('FindReplace', {
        pattern: 'LLMClient',
        replacement: 'AIClient',
        path: fixture,
        glob: '*.ts',
        dry_run: true,
      }, { cwd: fixture, sessionId: 'test' })

      expect(result.content).toContain('Would replace')
      expect(result.content).toContain('llm.ts')
      expect(readFileSync(path, 'utf8')).toBe(original)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })
})

describe('GitStatus Tool', () => {
  test('shows branch info', async () => {
    const result = await executeTool('GitStatus', {}, { cwd: PROJECT_ROOT, sessionId: 'test' })
    expect(result.content).toContain('Branch:')
    // Branch name is environment-dependent (feature branch locally, detached HEAD in CI),
    // so assert that branch info is reported rather than a specific branch name.
  })
})

describe('GitDiff Tool', () => {
  test('runs without error', async () => {
    const result = await executeTool('GitDiff', { stat: true }, { cwd: PROJECT_ROOT, sessionId: 'test' })
    expect(result.isError).toBeFalsy()
  })
})

describe('Rename Tool', () => {
  test('renames a file', async () => {
    const from = '/tmp/nole-rename-test-' + Date.now() + '.txt'
    const to = from.replace('.txt', '-renamed.txt')
    writeFileSync(from, 'test')

    const result = await executeTool('Rename', { from, to }, { cwd: '/tmp', sessionId: 'test' })
    expect(result.content).toContain('Renamed')
    expect(existsSync(to)).toBe(true)
    expect(existsSync(from)).toBe(false)

    unlinkSync(to)
  })
})

describe('Delete Tool', () => {
  test('deletes a file', async () => {
    const path = '/tmp/nole-delete-test-' + Date.now() + '.txt'
    writeFileSync(path, 'test')

    const result = await executeTool('Delete', { path }, { cwd: '/tmp', sessionId: 'test' })
    expect(result.content).toContain('Deleted')
    expect(existsSync(path)).toBe(false)
  })

  test('requires recursive flag for directories', async () => {
    const dir = '/tmp/nole-delete-dir-' + Date.now()
    mkdirSync(dir)

    const result = await executeTool('Delete', { path: dir }, { cwd: '/tmp', sessionId: 'test' })
    expect(result.content).toContain('recursive')

    rmdirSync(dir)
  })
})

describe('Diff Tool', () => {
  test('compares two files', async () => {
    const f1 = '/tmp/nole-diff-1-' + Date.now() + '.txt'
    const f2 = '/tmp/nole-diff-2-' + Date.now() + '.txt'
    writeFileSync(f1, 'line1\nline2\nline3\n')
    writeFileSync(f2, 'line1\nchanged\nline3\n')

    const result = await executeTool('Diff', { file1: f1, file2: f2 }, { cwd: '/tmp', sessionId: 'test' })
    expect(result.content).toContain('-line2')
    expect(result.content).toContain('+changed')

    unlinkSync(f1)
    unlinkSync(f2)
  })
})

describe('RunTests Tool', () => {
  test('runs custom test command', async () => {
    const result = await executeTool('RunTests', { command: 'echo "3 tests passed"' }, { cwd: '/tmp', sessionId: 'test' })
    expect(result.content).toContain('3 tests passed')
  })
})
