// Tests for the OAuth credential bridge (src/auth/oauth-bridge.ts) and its
// CLI wrapper (src/commands/auth.ts). Uses isolated tmp files for both the
// auth.json store and the fake vendor credential sources — never touches the
// real ~/.nole-code/auth.json or ~/.minimax-code / ~/.claude credential files.
import { describe, test, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, statSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  configureOAuthProvider,
  resolveOAuthCredential,
  getOAuthStatus,
} from '../src/auth/oauth-bridge.js'
import { runAuthCli } from '../src/commands/auth.js'

const tmpDirs: string[] = []
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'nole-auth-test-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

function writeMiniMaxSource(dir: string, expires: number): string {
  const sourcePath = join(dir, 'minimax-oauth-profile.json')
  writeFileSync(sourcePath, JSON.stringify({
    profiles: {
      'minimax-portal:default': { type: 'oauth', provider: 'minimax', access: 'fake-minimax-token', refresh: 'r', expires },
    },
  }))
  return sourcePath
}

function writeAnthropicSource(dir: string, expiresAt: number): string {
  const sourcePath = join(dir, 'claude-credentials.json')
  writeFileSync(sourcePath, JSON.stringify({
    claudeAiOauth: { accessToken: 'faketok', refreshToken: 'r', expiresAt, scopes: [] },
  }))
  return sourcePath
}

describe('oauth-bridge: store round-trip', () => {
  test('configureOAuthProvider persists metadata, resolveOAuthCredential reads it back', () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const sourcePath = writeMiniMaxSource(dir, Date.now() + 60 * 60 * 1000)

    configureOAuthProvider('minimax', { authPath, sourcePath })

    const credential = resolveOAuthCredential('minimax', { authPath })
    expect(credential).not.toBeNull()
    expect(credential!.accessToken).toBe('fake-minimax-token')
    expect(credential!.provider).toBe('minimax')
    expect(credential!.apiMode).toBe('anthropic_messages')
  })

  test('supports both minimax and anthropic in the same store', () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const minimaxSource = writeMiniMaxSource(dir, Date.now() + 60 * 60 * 1000)
    const anthropicSource = writeAnthropicSource(dir, Date.now() + 60 * 60 * 1000)

    configureOAuthProvider('minimax', { authPath, sourcePath: minimaxSource })
    configureOAuthProvider('anthropic', { authPath, sourcePath: anthropicSource })

    const status = getOAuthStatus({ authPath })
    expect(status.minimax.configured).toBe(true)
    expect(status.minimax.valid).toBe(true)
    expect(status.anthropic.configured).toBe(true)
    expect(status.anthropic.valid).toBe(true)

    const store = JSON.parse(readFileSync(authPath, 'utf8'))
    expect(store.version).toBe(1)
    expect(store.providers.minimax.sourcePath).toBe(minimaxSource)
    expect(store.providers.anthropic.sourcePath).toBe(anthropicSource)
    // Never persist token material into the store, only source metadata.
    expect(JSON.stringify(store)).not.toContain('fake-minimax-token')
    expect(JSON.stringify(store)).not.toContain('faketok')
  })

  test('resolveOAuthCredential returns null when provider is not configured', () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    expect(resolveOAuthCredential('minimax', { authPath })).toBeNull()
    expect(resolveOAuthCredential('anthropic', { authPath })).toBeNull()
  })
})

describe('oauth-bridge: expired-token rejection', () => {
  test('configureOAuthProvider rejects an already-expired source before persisting', () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const sourcePath = writeMiniMaxSource(dir, Date.now() - 1000) // expired 1s ago

    expect(() => configureOAuthProvider('minimax', { authPath, sourcePath })).toThrow(/expired/)
    // Nothing should have been persisted.
    expect(resolveOAuthCredential('minimax', { authPath })).toBeNull()
  })

  test('resolveOAuthCredential throws once a previously-valid source expires', () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const sourcePath = writeAnthropicSource(dir, Date.now() + 60 * 60 * 1000)

    configureOAuthProvider('anthropic', { authPath, sourcePath })

    // Simulate the vendor CLI's token expiring after it was bridged.
    writeAnthropicSource(dir, Date.now() - 1000)
    // writeAnthropicSource() above wrote to the same path (deterministic name).

    expect(() => resolveOAuthCredential('anthropic', { authPath })).toThrow(/expired/)
  })

  test('getOAuthStatus reports "invalid or expired" without throwing', () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const sourcePath = writeMiniMaxSource(dir, Date.now() + 60 * 60 * 1000)
    configureOAuthProvider('minimax', { authPath, sourcePath })

    writeMiniMaxSource(dir, Date.now() - 1000)

    const status = getOAuthStatus({ authPath })
    expect(status.minimax.configured).toBe(true)
    expect(status.minimax.valid).toBe(false)
  })
})

describe('oauth-bridge: missing-source error', () => {
  test('configureOAuthProvider throws a clear error when the source file does not exist', () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const missingSource = join(dir, 'does-not-exist.json')

    expect(() => configureOAuthProvider('minimax', { authPath, sourcePath: missingSource }))
      .toThrow(/Cannot read OAuth credential source/)
  })

  test('resolveOAuthCredential surfaces the error if the source disappears after configuring', () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const sourcePath = writeMiniMaxSource(dir, Date.now() + 60 * 60 * 1000)
    configureOAuthProvider('minimax', { authPath, sourcePath })

    rmSync(sourcePath)

    expect(() => resolveOAuthCredential('minimax', { authPath })).toThrow(/Cannot read OAuth credential source/)
  })
})

describe('oauth-bridge: file mode', () => {
  test('auth.json is written with mode 0600', () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const sourcePath = writeMiniMaxSource(dir, Date.now() + 60 * 60 * 1000)

    configureOAuthProvider('minimax', { authPath, sourcePath })

    const mode = statSync(authPath).mode & 0o777
    expect(mode).toBe(0o600)
  })
})

describe('commands/auth.ts CLI', () => {
  test('`auth status` reports unconfigured providers before anything is imported', async () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const lines: string[] = []

    const code = await runAuthCli(['status', '--auth-path', authPath], { log: (l) => lines.push(l) })

    expect(code).toBe(0)
    expect(lines.some(l => l.includes('minimax: not configured'))).toBe(true)
    expect(lines.some(l => l.includes('anthropic: not configured'))).toBe(true)
  })

  test('`auth import minimax` configures the bridge and `auth status` reflects it', async () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const sourcePath = writeMiniMaxSource(dir, Date.now() + 60 * 60 * 1000)
    const lines: string[] = []

    const importCode = await runAuthCli(['import', 'minimax', '--auth-path', authPath, '--source', sourcePath], { log: (l) => lines.push(l) })
    expect(importCode).toBe(0)
    expect(lines.some(l => l.includes('minimax OAuth bridge configured'))).toBe(true)
    expect(lines.some(l => l.includes('No access or refresh token was copied'))).toBe(true)

    lines.length = 0
    const statusCode = await runAuthCli(['status', '--auth-path', authPath], { log: (l) => lines.push(l) })
    expect(statusCode).toBe(0)
    expect(lines.some(l => l.includes('minimax: valid'))).toBe(true)
  })

  test('`auth import claude` aliases to the anthropic provider', async () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const sourcePath = writeAnthropicSource(dir, Date.now() + 60 * 60 * 1000)
    const lines: string[] = []

    const code = await runAuthCli(['import', 'claude', '--auth-path', authPath, '--source', sourcePath], { log: (l) => lines.push(l) })
    expect(code).toBe(0)
    expect(lines.some(l => l.includes('anthropic OAuth bridge configured'))).toBe(true)
  })

  test('`auth import codex` is rejected with a clear message (v1 has no codex client)', async () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const lines: string[] = []

    const code = await runAuthCli(['import', 'codex', '--auth-path', authPath], { log: (l) => lines.push(l) })
    expect(code).toBe(1)
    expect(lines.some(l => /no codex\/OpenAI OAuth client/i.test(l))).toBe(true)
    expect(resolveOAuthCredential('minimax', { authPath })).toBeNull()
  })

  test('`auth import` with an unknown provider is rejected', async () => {
    const dir = makeTmpDir()
    const authPath = join(dir, 'auth.json')
    const lines: string[] = []

    const code = await runAuthCli(['import', 'not-a-provider', '--auth-path', authPath], { log: (l) => lines.push(l) })
    expect(code).toBe(1)
    expect(lines.some(l => l.includes('Unsupported OAuth provider'))).toBe(true)
  })
})
