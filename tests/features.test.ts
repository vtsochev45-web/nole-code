// Tests for new features: export, changes, plugins, @file
import { describe, test, expect } from 'bun:test'
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
    const path = createNoleMd('/tmp/nole-code')
    expect(path).toContain('NOLE.md')

    const { readFileSync } = require('fs')
    const content = readFileSync(path, 'utf-8')
    // Should detect nole-code project info
    expect(content).toContain('nole-code')
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
