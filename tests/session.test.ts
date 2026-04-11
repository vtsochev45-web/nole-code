// Tests for session management
import { describe, test, expect, afterEach } from 'bun:test'
import { createSession, loadSession, saveSession, deleteSession, forkSession, compactSession, listSessions } from '../src/session/manager.js'

const testSessions: string[] = []

afterEach(() => {
  // Cleanup test sessions
  for (const id of testSessions) {
    try { deleteSession(id) } catch {}
  }
  testSessions.length = 0
})

describe('Session Management', () => {
  test('creates a new session', () => {
    const session = createSession('/tmp')
    testSessions.push(session.id)

    expect(session.id).toMatch(/^nole-/)
    expect(session.messages).toEqual([])
    expect(session.cwd).toBe('/tmp')
    expect(session.createdAt).toBeTruthy()
  })

  test('creates session from options object', () => {
    const session = createSession({ cwd: '/home', model: 'test-model' })
    testSessions.push(session.id)

    expect(session.cwd).toBe('/home')
    expect(session.model).toBe('test-model')
  })

  test('saves and loads session', () => {
    const session = createSession('/tmp')
    testSessions.push(session.id)

    session.messages.push({
      role: 'user',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    })
    saveSession(session)

    const loaded = loadSession(session.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.messages.length).toBe(1)
    expect(loaded!.messages[0].content).toBe('Hello')
  })

  test('returns null for missing session', () => {
    const loaded = loadSession('nonexistent-session-id')
    expect(loaded).toBeNull()
  })

  test('deletes a session', () => {
    const session = createSession('/tmp')
    const id = session.id

    const deleted = deleteSession(id)
    expect(deleted).toBe(true)

    const loaded = loadSession(id)
    expect(loaded).toBeNull()
  })

  test('forks a session', () => {
    const parent = createSession('/tmp')
    testSessions.push(parent.id)
    parent.messages.push({ role: 'user', content: 'Test', timestamp: new Date().toISOString() })
    saveSession(parent)

    const forked = forkSession(parent.id, 'test fork')
    expect(forked).not.toBeNull()
    testSessions.push(forked!.id)

    expect(forked!.parentId).toBe(parent.id)
    // Forked session should have parent messages + fork system message
    expect(forked!.messages.length).toBe(parent.messages.length + 1)
    expect(forked!.messages[forked!.messages.length - 1].content).toContain('forked')
  })

  test('lists sessions', () => {
    const s1 = createSession('/tmp')
    const s2 = createSession('/tmp')
    testSessions.push(s1.id, s2.id)

    const sessions = listSessions()
    expect(sessions.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Session Compaction', () => {
  test('keeps last N tool results', () => {
    const session = createSession('/tmp')
    testSessions.push(session.id)

    // Add system + several tool results
    session.messages.push({ role: 'system', content: 'System prompt', timestamp: '' })
    for (let i = 0; i < 10; i++) {
      session.messages.push({ role: 'user', content: `Question ${i}`, timestamp: '' })
      session.messages.push({ role: 'assistant', content: `Answer ${i}`, tool_calls: [{ id: `tc_${i}`, name: 'Bash', input: {} }], timestamp: '' })
      session.messages.push({ role: 'tool', content: `Tool result ${i}`, tool_call_id: `tc_${i}`, name: 'Bash', timestamp: '' })
    }
    saveSession(session)

    const compacted = compactSession(session.id, 3)
    expect(compacted).not.toBeNull()

    // Should have kept last 3 tool results
    const toolResults = compacted!.messages.filter(m => m.role === 'tool')
    expect(toolResults.length).toBe(3)

    // Last tool result should be "Tool result 9"
    expect(toolResults[toolResults.length - 1].content).toBe('Tool result 9')

    // Should have a compaction summary
    const summary = compacted!.messages.find(m => m.role === 'system' && m.content.includes('omitted'))
    expect(summary).toBeTruthy()
  })

  test('does nothing when fewer tool results than keep limit', () => {
    const session = createSession('/tmp')
    testSessions.push(session.id)

    session.messages.push({ role: 'system', content: 'System', timestamp: '' })
    session.messages.push({ role: 'assistant', content: 'Running tool', tool_calls: [{ id: 'tc1', name: 'Bash', input: {} }], timestamp: '' })
    session.messages.push({ role: 'tool', content: 'Result 1', tool_call_id: 'tc1', name: 'Bash', timestamp: '' })
    saveSession(session)

    const compacted = compactSession(session.id, 5)
    expect(compacted).not.toBeNull()
    expect(compacted!.messages.length).toBe(session.messages.length)
  })
})
