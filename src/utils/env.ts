// Environment utilities

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

  // Primary: MiniMax
  if (MINIMAX_API_KEY) {
    providers.push({
      name: 'minimax',
      baseUrl: 'https://api.minimax.io/anthropic/v1/messages',
      apiKey: MINIMAX_API_KEY,
      model: 'MiniMax-M2.7',
      headers: { 'anthropic-version': '2023-06-01' },
    })
  }

  // Fallback: OpenRouter (supports many models)
  if (OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: OPENROUTER_API_KEY,
      model: 'google/gemini-2.5-flash',
    })
  }

  // Fallback: OpenAI-compatible
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
