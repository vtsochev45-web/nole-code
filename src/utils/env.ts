// Environment utilities — load .env from cwd and ~/.nole-code/
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

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

export function isEnvTruthy(key: string): boolean {
  const val = process.env[key]
  return val === '1' || val === 'true' || val === 'yes'
}

// Provider configuration
export interface ProviderConfig {
  name: string
  baseUrl: string
  apiKey: string
  model: string
  headers?: Record<string, string>
}

export function getProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = []

  // OpenRouter first — most reliable, many free models
  if (OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: OPENROUTER_API_KEY,
      model: 'google/gemini-2.5-flash',
    })
  }

  // MiniMax — free but often overloaded
  if (MINIMAX_API_KEY) {
    providers.push({
      name: 'minimax',
      baseUrl: 'https://api.minimax.io/anthropic/v1/messages',
      apiKey: MINIMAX_API_KEY,
      model: 'MiniMax-M2.7',
      headers: { 'anthropic-version': '2023-06-01' },
    })
  }

  // OpenAI
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

// Check if any provider is configured
export function hasAnyProvider(): boolean {
  return !!(MINIMAX_API_KEY || OPENROUTER_API_KEY || OPENAI_API_KEY)
}
