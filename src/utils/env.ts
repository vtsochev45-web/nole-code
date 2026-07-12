// Environment utilities — load .env from cwd and ~/.nole-code/
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { resolveOAuthCredential, type OAuthProvider } from '../auth/oauth-bridge.js'

// Load .env files (cwd first, then ~/.nole-code/, don't override existing)
function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  try {
    const content = readFileSync(path, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}

loadEnvFile(join(process.cwd(), '.env'))
loadEnvFile(join(homedir(), '.nole-code', '.env'))
loadEnvFile(join(homedir(), 'nole-code', '.env'))

export const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''
export const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1'
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
export const API_KEY = process.env.API_KEY || ''
export const SERVER_PORT = parseInt(process.env.SERVER_PORT || '18792', 10)

// Default model used everywhere a model isn't explicitly chosen (settings.model,
// a task spec, or a /model override). Single source of truth — bump this one line
// to change the default. Overridable per-run via the DEFAULT_MODEL env var.
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'MiniMax-M3'

export function isEnvTruthy(key: string): boolean {
  const val = process.env[key]
  return val === '1' || val === 'true' || val === 'yes'
}

// Provider configuration
export type ProviderDynamicValue = string | (() => string)
export interface ProviderConfig {
  name: string
  baseUrl: string
  apiKey: ProviderDynamicValue
  model: string
  apiMode?: 'anthropic_messages' | 'chat_completions'
  headers?: Record<string, string>
}

export function getProviders(options: { oauthAuthPath?: string; nowMs?: number } = {}): ProviderConfig[] {
  const providers: ProviderConfig[] = []

  const resolveOAuth = (provider: OAuthProvider) => resolveOAuthCredential(provider, {
    ...(options.oauthAuthPath ? { authPath: options.oauthAuthPath } : {}),
    ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs }),
  })
  const liveToken = (provider: OAuthProvider) => () => {
    const credential = resolveOAuth(provider)
    if (!credential) throw new Error(`${provider} OAuth bridge is not configured`)
    return credential.accessToken
  }

  // MiniMax OAuth (bridged via `nole auth import minimax`) beats MINIMAX_API_KEY.
  let oauthMiniMax = false
  try {
    const credential = resolveOAuth('minimax')
    if (credential) {
      oauthMiniMax = true
      providers.push({
        name: 'minimax', baseUrl: credential.baseUrl, apiKey: liveToken('minimax'),
        model: DEFAULT_MODEL, apiMode: 'anthropic_messages',
        headers: { 'anthropic-version': '2023-06-01' },
      })
    }
  } catch {}

  // Claude/Anthropic OAuth (bridged via `nole auth import claude`).
  try {
    const credential = resolveOAuth('anthropic')
    if (credential) {
      providers.push({
        name: 'anthropic', baseUrl: credential.baseUrl, apiKey: liveToken('anthropic'),
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', apiMode: 'anthropic_messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20',
          'user-agent': 'claude-code/2.1.74 (external, cli)',
          'x-app': 'cli',
        },
      })
    }
  } catch {}

  // MiniMax first — free, primary provider
  if (MINIMAX_API_KEY && !oauthMiniMax) {
    providers.push({
      name: 'minimax',
      baseUrl: 'https://api.minimax.io/anthropic/v1/messages',
      apiKey: MINIMAX_API_KEY,
      model: DEFAULT_MODEL,
      apiMode: 'anthropic_messages',
      headers: { 'anthropic-version': '2023-06-01' },
    })
  }

  // OpenRouter — fallback, many free models
  if (OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: OPENROUTER_API_KEY,
      model: 'google/gemini-2.5-flash',
    })
  }

  // OpenAI — last resort
  if (OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: OPENAI_API_KEY,
      model: 'gpt-4o-mini',
    })
  }

  return providers
}

// Check if any provider is configured (API key or OAuth bridge)
export function hasAnyProvider(): boolean {
  return !!(MINIMAX_API_KEY || OPENROUTER_API_KEY || OPENAI_API_KEY) || getProviders().length > 0
}

export const WP_USER = process.env.WP_USER || ''
export const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || ''
export const WP_API_URL = process.env.WP_API_URL || 'https://britfarmers.com/wp-json/wp/v2'
