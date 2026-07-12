// OAuth credential bridge — ports vendor CLI OAuth tokens (MiniMax, Claude)
// into Nole without ever copying access/refresh tokens into Nole's own
// storage. Nole stores only *source metadata* (which file to read); the live
// token is read from the owning CLI's credential file at call time.
//
// Ported from nole-code-v2/src/auth/oauth-bridge.ts. v1 has no codex_responses
// client, so 'openai-codex' is intentionally not supported here.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'

export type OAuthProvider = 'minimax' | 'anthropic'
export type OAuthApiMode = 'anthropic_messages'

interface ProviderMetadata {
  sourcePath: string
  profile?: string
}
interface OAuthBridgeStore {
  version: 1
  providers: Partial<Record<OAuthProvider, ProviderMetadata>>
}
export interface OAuthCredential {
  provider: OAuthProvider
  accessToken: string
  expiresAt?: number
  apiMode: OAuthApiMode
  baseUrl: string
}
interface ResolveOptions {
  authPath?: string
  nowMs?: number
}
interface ConfigureOptions extends ResolveOptions {
  sourcePath: string
  profile?: string
}

const DEFAULT_AUTH_PATH = join(homedir(), '.nole-code', 'auth.json')
const EXPIRY_SKEW_MS = 60_000

function readJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Cannot read OAuth credential source ${path}: ${detail}`)
  }
}

function readStore(authPath: string): OAuthBridgeStore {
  if (!existsSync(authPath)) return { version: 1, providers: {} }
  const raw = readJson(authPath)
  if (raw?.version !== 1 || !raw.providers || typeof raw.providers !== 'object') {
    throw new Error(`Invalid Nole OAuth metadata store: ${authPath}`)
  }
  return raw as OAuthBridgeStore
}

function writeStore(authPath: string, store: OAuthBridgeStore): void {
  mkdirSync(dirname(authPath), { recursive: true, mode: 0o700 })
  const tempPath = join(dirname(authPath), `.auth.json.${process.pid}.${Date.now()}.tmp`)
  try {
    writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 })
    chmodSync(tempPath, 0o600)
    renameSync(tempPath, authPath)
    chmodSync(authPath, 0o600)
  } catch (error) {
    try { if (existsSync(tempPath)) chmodSync(tempPath, 0o600) } catch {}
    throw error
  }
}

function requireFreshToken(token: unknown, expiresAt: unknown, nowMs: number, provider: OAuthProvider): string {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error(`${provider} OAuth credential has no access token`)
  }
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt <= nowMs + EXPIRY_SKEW_MS) {
    throw new Error(`${provider} OAuth credential is expired; refresh it with its owning CLI and retry`)
  }
  return token.trim()
}

function resolveFromSource(provider: OAuthProvider, metadata: ProviderMetadata, nowMs: number): OAuthCredential {
  const raw = readJson(metadata.sourcePath)

  if (provider === 'minimax') {
    const profileName = metadata.profile || 'minimax-portal:default'
    const profile = raw?.profiles?.[profileName]
    if (!profile || typeof profile !== 'object') {
      throw new Error(`MiniMax OAuth profile ${profileName} was not found`)
    }
    const expiresAt = typeof profile.expires === 'number' ? profile.expires : undefined
    const accessToken = requireFreshToken(profile.access, expiresAt, nowMs, provider)
    return {
      provider,
      accessToken,
      ...(expiresAt === undefined ? {} : { expiresAt }),
      apiMode: 'anthropic_messages',
      baseUrl: 'https://api.minimax.io/anthropic/v1/messages',
    }
  }

  // provider === 'anthropic'
  const oauth = raw?.claudeAiOauth
  if (!oauth || typeof oauth !== 'object') {
    throw new Error('Claude OAuth credentials were not found')
  }
  const expiresAt = typeof oauth.expiresAt === 'number' ? oauth.expiresAt : undefined
  const accessToken = requireFreshToken(oauth.accessToken, expiresAt, nowMs, provider)
  return {
    provider,
    accessToken,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    apiMode: 'anthropic_messages',
    baseUrl: 'https://api.anthropic.com/v1/messages',
  }
}

export function configureOAuthProvider(provider: OAuthProvider, options: ConfigureOptions): void {
  const authPath = options.authPath || DEFAULT_AUTH_PATH
  const nowMs = options.nowMs ?? Date.now()
  const metadata: ProviderMetadata = {
    sourcePath: options.sourcePath,
    ...(options.profile ? { profile: options.profile } : {}),
  }

  // Validate before persisting metadata. This reads but never copies token material.
  resolveFromSource(provider, metadata, nowMs)
  const store = readStore(authPath)
  store.providers[provider] = metadata
  writeStore(authPath, store)
}

export function resolveOAuthCredential(provider: OAuthProvider, options: ResolveOptions = {}): OAuthCredential | null {
  const authPath = options.authPath || DEFAULT_AUTH_PATH
  const metadata = readStore(authPath).providers[provider]
  if (!metadata) return null
  return resolveFromSource(provider, metadata, options.nowMs ?? Date.now())
}

export function getOAuthStatus(options: ResolveOptions = {}): Record<OAuthProvider, { configured: boolean; valid: boolean; sourcePath?: string; expiresAt?: number }> {
  const authPath = options.authPath || DEFAULT_AUTH_PATH
  const store = readStore(authPath)
  const nowMs = options.nowMs ?? Date.now()
  const result = {} as Record<OAuthProvider, { configured: boolean; valid: boolean; sourcePath?: string; expiresAt?: number }>

  for (const provider of ['minimax', 'anthropic'] as OAuthProvider[]) {
    const metadata = store.providers[provider]
    if (!metadata) {
      result[provider] = { configured: false, valid: false }
      continue
    }
    try {
      const credential = resolveFromSource(provider, metadata, nowMs)
      result[provider] = {
        configured: true,
        valid: true,
        sourcePath: metadata.sourcePath,
        ...(credential.expiresAt === undefined ? {} : { expiresAt: credential.expiresAt }),
      }
    } catch {
      result[provider] = { configured: true, valid: false, sourcePath: metadata.sourcePath }
    }
  }
  return result
}

export const DEFAULT_OAUTH_SOURCE_PATHS: Record<OAuthProvider, string> = {
  minimax: join(homedir(), '.minimax-code', 'minimax-oauth-profile.json'),
  anthropic: join(homedir(), '.claude', '.credentials.json'),
}
