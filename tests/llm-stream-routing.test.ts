// Regression test: chatStream used to send an Anthropic-shaped streaming
// request to whatever the active provider was and parse the reply as
// Anthropic SSE. Against OpenRouter (OpenAI-shaped) the chunks matched no
// Anthropic event type, so the stream parsed to *nothing* and chatStream
// returned an empty success (0/0 usage) — the real root cause of the
// trust-harness nole-v1 silent fast-fails. OpenAI-shaped providers must not
// go through the Anthropic stream path; they delegate to chat(), which
// routes by apiMode and fails loud.
import { describe, test, expect } from 'bun:test'
import { LLMClient } from '../src/api/llm.js'

describe('chatStream provider routing', () => {
  test('openai-shaped active provider delegates to chat() instead of Anthropic SSE', async () => {
    const client = new LLMClient('unused-key', 'MiniMax-M3')
    ;(client as any).providers = [
      { name: 'openrouter', baseUrl: 'https://fake-openrouter.test/api/v1/chat/completions', apiKey: 'k', model: 'google/gemini-2.5-flash' },
    ]
    ;(client as any).activeProvider = 0

    const originalFetch = globalThis.fetch
    const bodies: string[] = []
    // Serve an OpenAI-shaped SSE stream — exactly what OpenRouter returns.
    // The old code fetched this from chatStream and parsed it to nothing.
    globalThis.fetch = (async (_url: any, init?: any) => {
      bodies.push(String(init?.body || ''))
      const sse = [
        'data: {"id":"gen-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"HARNESS_OK","role":"assistant"},"finish_reason":null}]}',
        'data: {"id":"gen-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2}}',
        'data: [DONE]',
        '',
      ].join('\n')
      // Non-stream JSON for the chat() path; SSE only if stream requested.
      const streaming = String(init?.body || '').includes('"stream":true')
      if (streaming) {
        return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })
      }
      return new Response(JSON.stringify({
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'HARNESS_OK' } }],
        usage: { prompt_tokens: 5, completion_tokens: 2 },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as any

    try {
      let text = ''
      const usage = await client.chatStream([{ role: 'user', content: 'say exactly: HARNESS_OK' }], {}, chunk => { text += chunk })
      expect(text).toBe('HARNESS_OK')
      expect(usage.output).toBeGreaterThan(0)
      // The openai-shaped provider must not receive an Anthropic-shaped body.
      for (const b of bodies) {
        expect(b.includes('"input_schema"')).toBe(false)
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 30_000)
})
