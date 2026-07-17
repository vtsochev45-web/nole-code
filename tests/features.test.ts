// Tests for new features: export, changes, plugins, @file
import { describe, test, expect } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getCommand, parseCommand } from '../src/commands/index.js'
import { getToolDefinitions } from '../src/tools/registry.js'

describe('New Commands', () => {
  test('/export command exists', () => {
    const cmd = getCommand('export')
    expect(cmd).toBeTruthy()
    expect(cmd!.description).toContain('markdown')
  })

  test('/changes command exists', () => {
    const cmd = getCommand('changes')
    expect(cmd).toBeTruthy()
  })

  test('/review alias works', () => {
    expect(getCommand('review')).toBe(getCommand('changes'))
  })

  test('/new command exists', () => {
    const cmd = getCommand('new')
    expect(cmd).toBeTruthy()
  })

  test('/reset alias works', () => {
    expect(getCommand('reset')).toBe(getCommand('new'))
  })

  test('/plugins command exists', () => {
    const cmd = getCommand('plugins')
    expect(cmd).toBeTruthy()
  })

  test('/plugins runs without error', async () => {
    const cmd = getCommand('plugins')!
    const result = await cmd.execute([], { cwd: '/tmp', sessionId: 'test' })
    expect(result).toBeTruthy()
  })
})

describe('@file syntax', () => {
  test('file references are detected', () => {
    const input = 'review @src/index.ts and fix the bug'
    const refs = input.match(/@([\w.\/\-]+)/g)
    expect(refs).toEqual(['@src/index.ts'])
  })

  test('multiple file refs detected', () => {
    const input = 'compare @file1.ts with @file2.ts'
    const refs = input.match(/@([\w.\/\-]+)/g)
    expect(refs).toHaveLength(2)
  })

  test('no refs in normal text', () => {
    const input = 'fix the email validation'
    const refs = input.match(/@([\w.\/\-]+)/g)
    expect(refs).toBeNull()
  })
})

describe('NOLE.md auto-generation', () => {
  test('createNoleMd detects package.json', () => {
    const { createNoleMd } = require('../src/project/onboarding.js')
    const fixture = mkdtempSync(join(tmpdir(), 'nole-feature-test-'))

    try {
      writeFileSync(join(fixture, 'package.json'), JSON.stringify({
        name: 'fixture-app',
        description: 'isolated fixture project',
        dependencies: { react: '19.0.0' },
        devDependencies: { typescript: '5.9.3' },
        scripts: { test: 'bun test' },
      }))

      const path = createNoleMd(fixture)
      const content = readFileSync(path, 'utf-8')

      expect(path).toBe(join(fixture, 'NOLE.md'))
      expect(content).toContain('isolated fixture project')
      expect(content).toContain('React, TypeScript')
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  test('refuses to overwrite an existing NOLE.md', () => {
    const { createNoleMd } = require('../src/project/onboarding.js')
    const fixture = mkdtempSync(join(tmpdir(), 'nole-feature-test-'))
    const path = join(fixture, 'NOLE.md')
    writeFileSync(path, 'operator-owned context\n')

    try {
      expect(() => createNoleMd(fixture)).toThrow('already exists')
      expect(readFileSync(path, 'utf8')).toBe('operator-owned context\n')
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  test('refuses an existing NOLE.md symlink without creating its target', () => {
    const { createNoleMd } = require('../src/project/onboarding.js')
    const fixture = mkdtempSync(join(tmpdir(), 'nole-feature-test-'))
    const target = join(fixture, 'outside.md')
    symlinkSync(target, join(fixture, 'NOLE.md'))

    try {
      expect(() => createNoleMd(fixture)).toThrow('already exists')
      expect(existsSync(target)).toBe(false)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })
})

describe('Plugin loader', () => {
  test('loadPlugins returns empty for no plugins dir', async () => {
    const { loadPlugins } = await import('../src/plugins/loader.js')
    // May or may not have plugins dir — should not throw
    const result = await loadPlugins()
    expect(Array.isArray(result)).toBe(true)
  })
})
