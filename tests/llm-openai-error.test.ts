// Regression tests for the OpenAI-shaped adapter (chatViaOpenAI) silently
// accepting failure responses. OpenRouter returns HTTP 200 with an
// {"error": ...} body for moderation/credit/invalid-model failures; the
// adapter used to read choices[0].message || {} and report an empty, "clean"
// completion — root cause of the trust-harness nole-v1 0/10 silent fast-fails
// (results/20260718-130601). A failure response must throw, never return
// empty content.
import { describe, test, expect } from 'bun:test'
import { LLMClient } from '../src/api/llm.js'

function openRouterClient(): LLMClient {
  const client = new LLMClient('unused-key', 'MiniMax-M3')
  ;(client as any).providers = [
    { name: 'openrouter', baseUrl: 'https://fake-openrouter.test/api/v1/chat/completions', apiKey: 'k', model: 'google/gemini-2.5-flash' },
  ]
  ;(client as any).activeProvider = 0
  return client
}

async function withFetch(body: unknown, fn: () => Promise<void>) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status: 200 })) as any
  try {
    await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

describe('chatViaOpenAI failure-response handling', () => {
  test('HTTP 200 with an error body throws instead of returning empty content', async () => {
    const client = openRouterClient()
    await withFetch({ error: { message: 'Insufficient credits', code: 402 } }, async () => {
      await expect(client.chat([{ role: 'user', content: 'hi' }]))
        .rejects.toThrow(/Insufficient credits/)
    })
  }, 30_000)

  test('HTTP 200 with no choices throws instead of returning empty content', async () => {
    const client = openRouterClient()
    await withFetch({ id: 'gen-x', choices: [] }, async () => {
      await expect(client.chat([{ role: 'user', content: 'hi' }]))
        .rejects.toThrow(/no choices/i)
    })
  }, 30_000)
})
