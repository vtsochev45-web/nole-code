// Nole Code - MiniMax API Client (Anthropic-compatible)
// Uses the same API endpoint as openclaw's lib/tools.py

import { randomUUID } from 'crypto'
import { MINIMAX_API_KEY, getProviders, type ProviderConfig } from '../utils/env.js'

// Retry config for transient errors (429, 529, 500, 502, 503)
const RETRY_STATUS = new Set([429, 500, 502, 503, 529])
const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000
// Per-request timeout. Tunable via NOLE_FETCH_TIMEOUT_MS. Default: 180s is long
// enough for large coding responses without letting a hung socket freeze the agent.
const REQUEST_TIMEOUT_MS = Number(process.env.NOLE_FETCH_TIMEOUT_MS) || 180_000

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
    // Not JSON — return raw (truncated) so callers see the real upstream text
    // rather than a vague "unparsable" message.
    const trimmed = raw.trim()
    return trimmed.length > 500 ? `${trimmed.slice(0, 500)}… (truncated)` : trimmed
  }
}

async function fetchWithRetry(url: string, init: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  let lastResponse: Response | null = null
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(url, { ...init, signal: controller.signal })
    } catch (err) {
      clearTimeout(timer)
      const isAbort = err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message))
      const isLast = attempt === retries - 1
      if (isLast) {
        if (isAbort) {
          throw new Error(`API request timed out after ${REQUEST_TIMEOUT_MS}ms (set NOLE_FETCH_TIMEOUT_MS to adjust)`)
        }
        throw err
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000
      process.stderr.write(`\x1b[33m⟳ API ${isAbort ? 'timeout' : 'network error'}, retrying in ${(delay / 1000).toFixed(1)}s (${attempt + 1}/${retries})\x1b[0m\n`)
      await new Promise(r => setTimeout(r, delay))
      continue
    }
    clearTimeout(timer)
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

// Parse XML-format tool calls that MiniMax sometimes outputs as text
// Format: <invoke name="ToolName"><parameter name="key">value</parameter></invoke>
export function parseXmlToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = []
  const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g
  let match: RegExpExecArray | null

  while ((match = invokeRegex.exec(text)) !== null) {
    const toolName = match[1]
    const paramsBlock = match[2]
    const input: Record<string, unknown> = {}

    const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g
    let paramMatch: RegExpExecArray | null
    while ((paramMatch = paramRegex.exec(paramsBlock)) !== null) {
      const key = paramMatch[1]
      const value = paramMatch[2].trim()
      // Try to parse as JSON (numbers, booleans, objects), fallback to string
      try {
        input[key] = JSON.parse(value)
      } catch {
        input[key] = value
      }
    }

    calls.push({
      id: `xml_${randomUUID()}`,
      name: toolName,
      input,
    })
  }

  return calls
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
    // Auto-detect provider from model name
    if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
      const idx = this.providers.findIndex(p => p.name === 'openai')
      if (idx >= 0) this.activeProvider = idx
    } else if (model.includes('/') || model.startsWith('google/') || model.startsWith('anthropic/') || model.startsWith('meta-llama/')) {
      const idx = this.providers.findIndex(p => p.name === 'openrouter')
      if (idx >= 0) this.activeProvider = idx
    } else if (model.startsWith('MiniMax') || model.startsWith('minimax')) {
      const idx = this.providers.findIndex(p => p.name === 'minimax')
      if (idx >= 0) this.activeProvider = idx
    }
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
    // Extract system messages — Anthropic API requires system as a top-level param, not in messages
    let systemPrompt = ''
    const anthropicMessages: Array<{
      role: string
      content: string | Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown>; id?: string }>
    }> = []

    // Collect valid tool_use IDs from assistant messages so we can validate tool_results
    const validToolIds = new Set<string>()
    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.id) validToolIds.add(tc.id)
        }
      }
    }

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n' : '') + msg.content
        continue
      } else if (msg.role === 'tool') {
        // Skip orphaned tool results that have no matching tool_use
        if (msg.tool_call_id && !validToolIds.has(msg.tool_call_id)) continue
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
        const blocks: Array<{ type: string; [k: string]: unknown }> = []
        if (msg.content && typeof msg.content === 'string' && msg.content.trim()) {
          blocks.push({ type: 'text', text: msg.content })
        }
        blocks.push(...msg.tool_calls.map(tc => ({
          type: 'tool_use' as const,
          id: tc.id || `call_${Date.now()}`,
          name: tc.name,
          input: tc.input,
        })))
        anthropicMessages.push({ role: 'assistant', content: blocks })
      } else {
        anthropicMessages.push({
          role: msg.role as string,
          content: msg.content,
        })
      }
    }

    // Merge consecutive same-role messages (Anthropic requires alternating user/assistant)
    const merged: typeof anthropicMessages = []
    for (const msg of anthropicMessages) {
      if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
        const prev = merged[merged.length - 1]
        if (typeof prev.content === 'string' && typeof msg.content === 'string') {
          prev.content += '\n' + msg.content
        } else {
          const prevArr = Array.isArray(prev.content) ? prev.content : [{ type: 'text', text: prev.content }]
          const msgArr = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }]
          prev.content = [...prevArr, ...msgArr] as any
        }
      } else {
        merged.push({ ...msg })
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
      messages: merged,
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

    // Use active provider's URL and headers (default to MiniMax if no providers configured)
    const activeP = this.providers[this.activeProvider]
    const chatUrl = activeP?.baseUrl || 'https://api.minimax.io/anthropic/v1/messages'
    const chatHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...(activeP?.headers || { 'anthropic-version': '2023-06-01' }),
    }

    // If active provider uses OpenAI format (not MiniMax), route through chatViaOpenAI
    if (activeP && activeP.name !== 'minimax') {
      return this.chatViaOpenAI(messages, options, activeP)
    }

    const response = await fetchWithRetry(chatUrl, {
      method: 'POST',
      headers: chatHeaders,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()

      // Try fallback providers before giving up (skip the one that just failed)
      if (RETRY_STATUS.has(response.status) && this.providers.length > 1) {
        for (let p = 0; p < this.providers.length; p++) {
          if (p === this.activeProvider) continue  // skip the provider that failed
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

    let data: any
    try {
      data = await response.json()
    } catch {
      const text = await response.text().catch(() => '(empty)')
      throw new Error(`API returned invalid JSON: ${text.slice(0, 200)}`)
    }

    if (data.error) {
      throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`)
    }

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

    // Fallback: parse XML tool calls from text if no structured tool_use blocks found
    // MiniMax sometimes outputs <invoke name="Tool"><parameter name="key">value</parameter></invoke>
    if (toolCalls.length === 0 && content.includes('<invoke')) {
      const xmlParsed = parseXmlToolCalls(content)
      if (xmlParsed.length > 0) {
        toolCalls.push(...xmlParsed)
        // Remove the XML from the displayed content
        content = content.replace(/<invoke[\s\S]*?<\/invoke>/g, '').trim()
        // Also remove minimax:tool_call wrappers if present
        content = content.replace(/<\/?minimax:tool_call>/g, '').trim()
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

    // Collect valid tool_use IDs for validation
    const validToolIds = new Set<string>()
    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.id) validToolIds.add(tc.id)
        }
      }
    }

    let systemPrompt = ''
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n' : '') + msg.content
      } else if (msg.role === 'tool') {
        // Skip orphaned tool results
        if (msg.tool_call_id && !validToolIds.has(msg.tool_call_id)) continue
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
      // Use active provider's URL and headers
      const activeP = this.providers[this.activeProvider]
      const streamUrl = activeP?.baseUrl || 'https://api.minimax.io/anthropic/v1/messages'
      const streamHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...(activeP?.headers || { 'anthropic-version': '2023-06-01' }),
      }

      const response = await fetchWithRetry(streamUrl, {
        method: 'POST',
        headers: streamHeaders,
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
    } catch (err) {
      // Only fall back to non-streaming for transport-level errors (network,
      // abort, JSON parse). Authentication / invalid-model errors must surface
      // — silently retrying them eats the real cause.
      const msg = err instanceof Error ? err.message : String(err)
      const isFatalApi = /\bAPI error 4\d\d\b/.test(msg) && !/ 408| 429/.test(msg)
      if (isFatalApi) throw err
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

// Default client — use LLMClient constructor directly with proper key/model instead
// export const llm = new LLMClient()
