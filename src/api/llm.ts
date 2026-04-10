// Nole Code - MiniMax API Client (Anthropic-compatible)
// Uses the same API endpoint as openclaw's lib/tools.py

import { MINIMAX_API_KEY, getProviders, type ProviderConfig } from '../utils/env.js'

// Retry config for transient errors (429, 529, 500, 502, 503)
const RETRY_STATUS = new Set([429, 500, 502, 503, 529])
const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

function parseApiError(raw: string): string {
  try {
    const data = JSON.parse(raw)
    const msg = data.error?.message || data.message || raw
    const type = data.error?.type || ''
    if (type === 'overloaded_error') return 'API is overloaded. Try again in a moment.'
    if (type === 'rate_limit_error') return 'Rate limited. Waiting before retry.'
    if (type === 'invalid_request_error') return `Invalid request: ${msg}`
    if (type === 'authentication_error') return 'Invalid API key. Check MINIMAX_API_KEY.'
    return msg
  } catch {
    return raw.slice(0, 200)
  }
}

async function fetchWithRetry(url: string, init: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  let lastResponse: Response | null = null
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, init)
    lastResponse = response

    if (response.ok || !RETRY_STATUS.has(response.status)) {
      return response
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000
    const status = response.status
    const msg = status === 529 ? 'overloaded' : status === 429 ? 'rate limited' : `error ${status}`
    process.stderr.write(`\x1b[33m⟳ API ${msg}, retrying in ${(delay / 1000).toFixed(1)}s (${attempt + 1}/${retries})\x1b[0m\n`)
    await new Promise(r => setTimeout(r, delay))
  }
  return lastResponse!
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
  id?: string
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
  id?: string
}

export interface ToolResult {
  tool_call_id: string
  content: string
  is_error?: boolean
}

export interface ChatOptions {
  model?: string
  tools?: ToolDefinition[]
  temperature?: number
  max_tokens?: number
  system?: string
}

export class LLMClient {
  private apiKey: string
  private model: string
  private providers: ProviderConfig[]
  private activeProvider: number = 0

  constructor(apiKey?: string, model = 'MiniMax-M2.7') {
    this.apiKey = apiKey || MINIMAX_API_KEY || ''
    this.model = model
    this.providers = getProviders()
  }

  getActiveProviderName(): string {
    return this.providers[this.activeProvider]?.name || 'minimax'
  }

  setModel(model: string): void {
    this.model = model
  }

  getModel(): string {
    return this.model
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<{
    content: string
    toolCalls: ToolCall[]
    usage: { input: number; output: number }
  }> {
    const { tools, temperature = 0.7, max_tokens = 4096, model } = options

    // Convert messages to Anthropic format
    const anthropicMessages: Array<{
      role: string
      content: string | Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown>; id?: string }>
    }> = []

    for (const msg of messages) {
      if (msg.role === 'tool') {
        if (process.env.DEBUG_TOOL) {
          console.error(`[DEBUG_TOOL] sending tool_result tool_use_id=${msg.tool_call_id}`)
        }
        anthropicMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id || 'unknown',
            content: msg.content,
          }],
        })
      } else if (msg.tool_calls) {
        anthropicMessages.push({
          role: 'assistant',
          content: msg.tool_calls.map(tc => ({
            type: 'tool_use',
            id: tc.id || `call_${Date.now()}`,
            name: tc.name,
            input: tc.input,
          })),
        })
      } else {
        anthropicMessages.push({
          role: msg.role as string,
          content: msg.content,
        })
      }
    }

    // Debug: show tool result IDs being sent
    if (process.env.DEBUG_TOOL) {
      const toolResults = messages.filter(m => m.role === 'tool')
      console.error(`[DEBUG_TOOL] Sending ${toolResults.length} tool results`)
      for (const tr of toolResults) {
        console.error(`[DEBUG_TOOL]   -> tool_use_id=${tr.tool_call_id} content_len=${tr.content.length}`)
      }
    }
    
    const body: Record<string, unknown> = {
      model: model || this.model,
      max_tokens: max_tokens || 4096,
      messages: anthropicMessages,
    }

    if (options.system) {
      body.system = options.system
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }))
    }

    const response = await fetchWithRetry('https://api.minimax.io/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()

      // Try fallback providers before giving up
      if (RETRY_STATUS.has(response.status) && this.providers.length > 1) {
        for (let p = 1; p < this.providers.length; p++) {
          const provider = this.providers[p]
          try {
            process.stderr.write(`\x1b[33m⟳ Falling back to ${provider.name}...\x1b[0m\n`)
            const fallbackResult = await this.chatViaOpenAI(messages, options, provider)
            this.activeProvider = p
            return fallbackResult
          } catch {}
        }
      }

      throw new Error(`API error ${response.status}: ${parseApiError(errorText)}`)
    }

    const data = await response.json() as any

    // Parse response
    let content = ''
    const toolCalls: ToolCall[] = []

    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') {
          content += block.text || ''
        } else if (block.type === 'tool_use') {
          const tcId = block.id || `tool_${Date.now()}`
          // Debug
          if (process.env.DEBUG_TOOL) {
            console.error(`[DEBUG_TOOL] tool_use id=${tcId} name=${block.name}`)
          }
          toolCalls.push({
            id: tcId,
            name: block.name,
            input: block.input || {},
          })
        }
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0,
      },
    }
  }

  async chatStream(
    messages: Message[],
    options: ChatOptions,
    onChunk: (text: string) => void,
    onToolCall?: (tc: ToolCall) => void,
  ): Promise<{ input: number; output: number }> {
    const { tools, temperature = 0.7, max_tokens = 4096, model } = options

    // Build Anthropic-format messages (same as chat())
    const anthropicMessages: Array<{
      role: string
      content: string | Array<{ type: string; [key: string]: unknown }>
    }> = []

    let systemPrompt = ''
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n' : '') + msg.content
      } else if (msg.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id || 'unknown',
            content: msg.content,
          }],
        })
      } else if (msg.tool_calls) {
        anthropicMessages.push({
          role: 'assistant',
          content: msg.tool_calls.map(tc => ({
            type: 'tool_use',
            id: tc.id || `call_${Date.now()}`,
            name: tc.name,
            input: tc.input,
          })),
        })
      } else {
        anthropicMessages.push({
          role: msg.role as string,
          content: msg.content,
        })
      }
    }

    const body: Record<string, unknown> = {
      model: model || this.model,
      max_tokens: max_tokens || 4096,
      messages: anthropicMessages,
      stream: true,
    }

    if (systemPrompt || options.system) {
      body.system = options.system || systemPrompt
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }))
    }

    try {
      const response = await fetchWithRetry('https://api.minimax.io/anthropic/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        // Stream endpoint failed. If it's a retryable error, throw so the outer retry
        // loop in fetchWithRetry handles it (avoids double-retry). Otherwise fall back
        // to non-streaming chat (which has its own retry logic and provider fallback).
        if (RETRY_STATUS.has(response.status)) {
          throw new Error(`Stream API error ${response.status}: ${response.statusText || 'retryable'}`)
        }
        const result = await this.chat(messages, options)
        onChunk(result.content)
        for (const tc of result.toolCalls) onToolCall?.(tc)
        return result.usage
      }

      const contentType = response.headers.get('content-type') || ''

      // If server doesn't support streaming, parse as JSON
      if (!contentType.includes('text/event-stream')) {
        const data = await response.json() as any
        const usage = { input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0 }
        if (data.content) {
          for (const block of data.content) {
            if (block.type === 'text') onChunk(block.text || '')
            else if (block.type === 'tool_use') {
              onToolCall?.({ id: block.id, name: block.name, input: block.input || {} })
            }
          }
        }
        return usage
      }

      // Real SSE streaming
      const reader = response.body?.getReader()
      if (!reader) {
        const result = await this.chat(messages, options)
        onChunk(result.content)
        for (const tc of result.toolCalls) onToolCall?.(tc)
        return result.usage
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let usage = { input: 0, output: 0 }
      const partialToolCalls = new Map<number, { id: string; name: string; inputJson: string }>()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const event = JSON.parse(data)
            const type = event.type

            // Track usage from message_start and message_delta
            if (type === 'message_start' && event.message?.usage) {
              usage.input = event.message.usage.input_tokens || 0
            } else if (type === 'message_delta' && event.usage) {
              usage.output = event.usage.output_tokens || 0
            } else if (type === 'content_block_start') {
              const block = event.content_block
              if (block?.type === 'tool_use') {
                partialToolCalls.set(event.index, {
                  id: block.id || `tool_${Date.now()}`,
                  name: block.name || '',
                  inputJson: '',
                })
              }
            } else if (type === 'content_block_delta') {
              const delta = event.delta
              if (delta?.type === 'text_delta' && delta.text) {
                onChunk(delta.text)
              } else if (delta?.type === 'input_json_delta' && delta.partial_json !== undefined) {
                const partial = partialToolCalls.get(event.index)
                if (partial) partial.inputJson += delta.partial_json
              }
            } else if (type === 'content_block_stop') {
              const partial = partialToolCalls.get(event.index)
              if (partial) {
                let input = {}
                try { input = JSON.parse(partial.inputJson) } catch {}
                onToolCall?.({ id: partial.id, name: partial.name, input })
                partialToolCalls.delete(event.index)
              }
            }
          } catch {}
        }
      }
      return usage
    } catch {
      const result = await this.chat(messages, options)
      onChunk(result.content)
      for (const tc of result.toolCalls) onToolCall?.(tc)
      return result.usage
    }
  }
  // OpenAI-compatible API call (for OpenRouter, OpenAI, etc.)
  private async chatViaOpenAI(
    messages: Message[],
    options: ChatOptions,
    provider: ProviderConfig,
  ): Promise<{ content: string; toolCalls: ToolCall[]; usage: { input: number; output: number } }> {
    const { tools, temperature = 0.7, max_tokens = 4096 } = options

    // Convert to OpenAI format
    const openaiMessages: Array<Record<string, unknown>> = []
    for (const msg of messages) {
      if (msg.role === 'system') {
        openaiMessages.push({ role: 'system', content: msg.content })
      } else if (msg.role === 'tool') {
        openaiMessages.push({
          role: 'tool',
          tool_call_id: msg.tool_call_id || 'unknown',
          content: msg.content,
        })
      } else if (msg.tool_calls && msg.tool_calls.length > 0) {
        openaiMessages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls.map(tc => ({
            id: tc.id || `call_${Date.now()}`,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          })),
        })
      } else {
        openaiMessages.push({ role: msg.role, content: msg.content })
      }
    }

    const body: Record<string, unknown> = {
      model: provider.model,
      max_tokens,
      temperature,
      messages: openaiMessages,
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }))
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
      ...(provider.headers || {}),
    }

    // OpenRouter needs extra headers
    if (provider.name === 'openrouter') {
      headers['HTTP-Referer'] = 'https://nole-code.dev'
      headers['X-Title'] = 'Nole Code'
    }

    const response = await fetchWithRetry(provider.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`${provider.name} error ${response.status}: ${error.slice(0, 200)}`)
    }

    const data = await response.json() as any
    const choice = data.choices?.[0]?.message || {}

    let content = choice.content || ''
    const toolCalls: ToolCall[] = []

    if (choice.tool_calls) {
      for (const tc of choice.tool_calls) {
        let input = {}
        try { input = JSON.parse(tc.function?.arguments || '{}') } catch {}
        toolCalls.push({
          id: tc.id || `tool_${Date.now()}`,
          name: tc.function?.name || '',
          input,
        })
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
      },
    }
  }
}

export const llm = new LLMClient()
