// Tests for slash commands
import { describe, test, expect } from 'bun:test'
import { parseCommand, getCommand, getAllCommands } from '../src/commands/index.js'

describe('Command Parsing', () => {
  test('parses slash commands', () => {
    expect(parseCommand('/help')).toEqual({ cmd: 'help', args: [] })
    expect(parseCommand('/commit fix bug')).toEqual({ cmd: 'commit', args: ['fix', 'bug'] })
    expect(parseCommand('/settings model grok')).toEqual({ cmd: 'settings', args: ['model', 'grok'] })
  })

  test('returns null for non-commands', () => {
    expect(parseCommand('hello')).toBeNull()
    expect(parseCommand('fix the bug')).toBeNull()
    expect(parseCommand('')).toBeNull()
  })
})

describe('Command Registry', () => {
  test('all expected commands exist', () => {
    const names = ['help', 'clear', 'commit', 'diff', 'status', 'log', 'branch',
      'exit', 'cost', 'doctor', 'init', 'fork', 'compact', 'plan',
      'settings', 'undo', 'model', 'context']

    for (const name of names) {
      const cmd = getCommand(name)
      expect(cmd).toBeTruthy()
      expect(cmd!.description).toBeTruthy()
    }
  })

  test('aliases resolve to commands', () => {
    expect(getCommand('h')).toBe(getCommand('help'))
    expect(getCommand('q')).toBe(getCommand('exit'))
    expect(getCommand('ci')).toBe(getCommand('commit'))
    expect(getCommand('st')).toBe(getCommand('status'))
    expect(getCommand('config')).toBe(getCommand('settings'))
    expect(getCommand('pop')).toBe(getCommand('undo'))
    expect(getCommand('info')).toBe(getCommand('context'))
  })

  test('getAllCommands returns unique commands', () => {
    const cmds = getAllCommands()
    const names = cmds.map(c => c.name)
    const unique = [...new Set(names)]
    expect(names.length).toBe(unique.length)
  })
})

describe('Command Execution', () => {
  test('/doctor runs without error', async () => {
    const cmd = getCommand('doctor')!
    const result = await cmd.execute([], { cwd: '/tmp', sessionId: 'test' })
    expect(result).toContain('Health Check')
  })

  test('/settings shows current settings', async () => {
    const cmd = getCommand('settings')!
    const result = await cmd.execute([], { cwd: '/tmp', sessionId: 'test' })
    expect(result).toContain('model')
    expect(result).toContain('temperature')
  })

  test('/model shows current model', async () => {
    const cmd = getCommand('model')!
    const result = await cmd.execute([], { cwd: '/tmp', sessionId: 'test' })
    expect(result).toContain('Current model')
  })
})
