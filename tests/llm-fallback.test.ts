// Tests for LLMClient's provider fallback routing (src/api/llm.ts chat()).
// Regression test for a defect the OAuth-bridge port newly exposed: the
// fallback loop used to call chatViaOpenAI() for every candidate regardless
// of its apiMode, which sends an OpenAI-shaped body to an Anthropic Messages
// endpoint (minimax/anthropic) and fails. Fallback candidates must now be
// routed by apiMode, same as the primary provider.
import { describe, test, expect } from 'bun:test'
import { LLMClient } from '../src/api/llm.js'

describe('LLMClient fallback routing', () => {
  test('routes an anthropic_messages fallback candidate via the native Messages path, not chatViaOpenAI', async () => {
    const client = new LLMClient('unused-key', 'MiniMax-M3')

    // Inject synthetic providers: primary "minimax" (fails with a retryable
    // 429), fallback "anthropic" (apiMode anthropic_messages) — mirrors a
    // fresh setup with only the two OAuth bridges configured.
    ;(client as any).providers = [
      { name: 'minimax', baseUrl: 'https://fake-minimax.test/v1/messages', apiKey: 'k1', model: 'MiniMax-M3', apiMode: 'anthropic_messages' },
      { name: 'anthropic', baseUrl: 'https://fake-anthropic.test/v1/messages', apiKey: 'k2', model: 'claude-sonnet-4-6', apiMode: 'anthropic_messages' },
    ]
    ;(client as any).activeProvider = 0

    // Prove chatViaOpenAI is never invoked for this anthropic_messages fallback.
    let chatViaOpenAICalled = false
    ;(client as any).chatViaOpenAI = async () => {
      chatViaOpenAICalled = true
      throw new Error('chatViaOpenAI should not be called for an anthropic_messages fallback candidate')
    }

    const requestedUrls: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: any, _init?: any) => {
      const u = String(url)
      requestedUrls.push(u)
      if (u.includes('fake-minimax.test')) {
        return new Response(JSON.stringify({ error: { type: 'rate_limit_error', message: 'rate limited' } }), { status: 429 })
      }
      if (u.includes('fake-anthropic.test')) {
        return new Response(JSON.stringify({ content: [{ type: 'text', text: 'OK' }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 })
      }
      throw new Error(`unexpected fetch to ${u}`)
    }) as any

    try {
      const result = await client.chat([{ role: 'user', content: 'hi' }])
      expect(result.content).toBe('OK')
    } finally {
      globalThis.fetch = originalFetch
    }

    expect(chatViaOpenAICalled).toBe(false)
    expect(requestedUrls.some(u => u.includes('fake-anthropic.test'))).toBe(true)
    expect((client as any).activeProvider).toBe(1) // switched to the anthropic fallback
  }, 30_000)
})
