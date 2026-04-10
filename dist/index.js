#!/usr/bin/env node
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/utils/env.ts
var exports_env = {};
__export(exports_env, {
  isEnvTruthy: () => isEnvTruthy,
  hasAnyProvider: () => hasAnyProvider,
  getProviders: () => getProviders,
  OPENROUTER_API_KEY: () => OPENROUTER_API_KEY,
  OPENAI_API_KEY: () => OPENAI_API_KEY,
  MINIMAX_BASE_URL: () => MINIMAX_BASE_URL,
  MINIMAX_API_KEY: () => MINIMAX_API_KEY
});
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
function loadEnvFile(path) {
  if (!existsSync(path))
    return;
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split(`
`)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#"))
        continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0)
        continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key])
        process.env[key] = val;
    }
  } catch {}
}
function isEnvTruthy(key) {
  const val = process.env[key];
  return val === "1" || val === "true" || val === "yes";
}
function getProviders() {
  const providers = [];
  if (OPENROUTER_API_KEY) {
    providers.push({
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: OPENROUTER_API_KEY,
      model: "google/gemini-2.5-flash"
    });
  }
  if (MINIMAX_API_KEY) {
    providers.push({
      name: "minimax",
      baseUrl: "https://api.minimax.io/anthropic/v1/messages",
      apiKey: MINIMAX_API_KEY,
      model: "MiniMax-M2.7",
      headers: { "anthropic-version": "2023-06-01" }
    });
  }
  if (OPENAI_API_KEY) {
    providers.push({
      name: "openai",
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: OPENAI_API_KEY,
      model: "gpt-4o-mini"
    });
  }
  return providers;
}
function hasAnyProvider() {
  return !!(MINIMAX_API_KEY || OPENROUTER_API_KEY || OPENAI_API_KEY);
}
var MINIMAX_API_KEY, MINIMAX_BASE_URL, OPENROUTER_API_KEY, OPENAI_API_KEY;
var init_env = __esm(() => {
  loadEnvFile(join(process.cwd(), ".env"));
  loadEnvFile(join(homedir(), ".nole-code", ".env"));
  loadEnvFile(join(homedir(), "nole-code", ".env"));
  MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || "";
  MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || "https://api.minimax.chat/v1";
  OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
  OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
});

// src/api/llm.ts
function parseApiError(raw) {
  try {
    const data = JSON.parse(raw);
    const msg = data.error?.message || data.message || raw;
    const type = data.error?.type || "";
    if (type === "overloaded_error")
      return "API is overloaded. Try again in a moment.";
    if (type === "rate_limit_error")
      return "Rate limited. Waiting before retry.";
    if (type === "invalid_request_error")
      return `Invalid request: ${msg}`;
    if (type === "authentication_error")
      return "Invalid API key. Check MINIMAX_API_KEY.";
    return msg;
  } catch {
    return raw.slice(0, 200);
  }
}
async function fetchWithRetry(url, init, retries = MAX_RETRIES) {
  let lastResponse = null;
  for (let attempt = 0;attempt < retries; attempt++) {
    const response = await fetch(url, init);
    lastResponse = response;
    if (response.ok || !RETRY_STATUS.has(response.status)) {
      return response;
    }
    const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
    const status = response.status;
    const msg = status === 529 ? "overloaded" : status === 429 ? "rate limited" : `error ${status}`;
    process.stderr.write(`\x1B[33m⟳ API ${msg}, retrying in ${(delay / 1000).toFixed(1)}s (${attempt + 1}/${retries})\x1B[0m
`);
    await new Promise((r) => setTimeout(r, delay));
  }
  return lastResponse;
}

class LLMClient {
  apiKey;
  model;
  providers;
  activeProvider = 0;
  constructor(apiKey, model = "MiniMax-M2.7") {
    this.apiKey = apiKey || MINIMAX_API_KEY || "";
    this.model = model;
    this.providers = getProviders();
  }
  getActiveProviderName() {
    return this.providers[this.activeProvider]?.name || "minimax";
  }
  setModel(model) {
    this.model = model;
  }
  getModel() {
    return this.model;
  }
  async chat(messages, options = {}) {
    const { tools, temperature = 0.7, max_tokens = 4096, model } = options;
    let systemPrompt = "";
    const anthropicMessages = [];
    const validToolIds = new Set;
    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.id)
            validToolIds.add(tc.id);
        }
      }
    }
    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt += (systemPrompt ? `
` : "") + msg.content;
        continue;
      } else if (msg.role === "tool") {
        if (msg.tool_call_id && !validToolIds.has(msg.tool_call_id))
          continue;
        if (process.env.DEBUG_TOOL) {
          console.error(`[DEBUG_TOOL] sending tool_result tool_use_id=${msg.tool_call_id}`);
        }
        anthropicMessages.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: msg.tool_call_id || "unknown",
            content: msg.content
          }]
        });
      } else if (msg.tool_calls) {
        const blocks = [];
        if (msg.content && typeof msg.content === "string" && msg.content.trim()) {
          blocks.push({ type: "text", text: msg.content });
        }
        blocks.push(...msg.tool_calls.map((tc) => ({
          type: "tool_use",
          id: tc.id || `call_${Date.now()}`,
          name: tc.name,
          input: tc.input
        })));
        anthropicMessages.push({ role: "assistant", content: blocks });
      } else {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    const merged = [];
    for (const msg of anthropicMessages) {
      if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
        const prev = merged[merged.length - 1];
        if (typeof prev.content === "string" && typeof msg.content === "string") {
          prev.content += `
` + msg.content;
        } else {
          const prevArr = Array.isArray(prev.content) ? prev.content : [{ type: "text", text: prev.content }];
          const msgArr = Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }];
          prev.content = [...prevArr, ...msgArr];
        }
      } else {
        merged.push({ ...msg });
      }
    }
    if (process.env.DEBUG_TOOL) {
      const toolResults = messages.filter((m) => m.role === "tool");
      console.error(`[DEBUG_TOOL] Sending ${toolResults.length} tool results`);
      for (const tr of toolResults) {
        console.error(`[DEBUG_TOOL]   -> tool_use_id=${tr.tool_call_id} content_len=${tr.content.length}`);
      }
    }
    const body = {
      model: model || this.model,
      max_tokens: max_tokens || 4096,
      messages: merged
    };
    if (systemPrompt || options.system) {
      body.system = options.system || systemPrompt;
    }
    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema
      }));
    }
    const response = await fetchWithRetry("https://api.minimax.io/anthropic/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      if (RETRY_STATUS.has(response.status) && this.providers.length > 1) {
        for (let p = 1;p < this.providers.length; p++) {
          const provider = this.providers[p];
          try {
            process.stderr.write(`\x1B[33m⟳ Falling back to ${provider.name}...\x1B[0m
`);
            const fallbackResult = await this.chatViaOpenAI(messages, options, provider);
            this.activeProvider = p;
            return fallbackResult;
          } catch {}
        }
      }
      throw new Error(`API error ${response.status}: ${parseApiError(errorText)}`);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      const text = await response.text().catch(() => "(empty)");
      throw new Error(`API returned invalid JSON: ${text.slice(0, 200)}`);
    }
    if (data.error) {
      throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    let content = "";
    const toolCalls = [];
    if (data.content) {
      for (const block of data.content) {
        if (block.type === "text") {
          content += block.text || "";
        } else if (block.type === "tool_use") {
          const tcId = block.id || `tool_${Date.now()}`;
          if (process.env.DEBUG_TOOL) {
            console.error(`[DEBUG_TOOL] tool_use id=${tcId} name=${block.name}`);
          }
          toolCalls.push({
            id: tcId,
            name: block.name,
            input: block.input || {}
          });
        }
      }
    }
    return {
      content,
      toolCalls,
      usage: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0
      }
    };
  }
  async chatStream(messages, options, onChunk, onToolCall) {
    const { tools, temperature = 0.7, max_tokens = 4096, model } = options;
    const anthropicMessages = [];
    const validToolIds = new Set;
    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.id)
            validToolIds.add(tc.id);
        }
      }
    }
    let systemPrompt = "";
    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt += (systemPrompt ? `
` : "") + msg.content;
      } else if (msg.role === "tool") {
        if (msg.tool_call_id && !validToolIds.has(msg.tool_call_id))
          continue;
        anthropicMessages.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: msg.tool_call_id || "unknown",
            content: msg.content
          }]
        });
      } else if (msg.tool_calls) {
        anthropicMessages.push({
          role: "assistant",
          content: msg.tool_calls.map((tc) => ({
            type: "tool_use",
            id: tc.id || `call_${Date.now()}`,
            name: tc.name,
            input: tc.input
          }))
        });
      } else {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    const body = {
      model: model || this.model,
      max_tokens: max_tokens || 4096,
      messages: anthropicMessages,
      stream: true
    };
    if (systemPrompt || options.system) {
      body.system = options.system || systemPrompt;
    }
    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema
      }));
    }
    try {
      const response = await fetchWithRetry("https://api.minimax.io/anthropic/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        if (RETRY_STATUS.has(response.status)) {
          throw new Error(`Stream API error ${response.status}: ${response.statusText || "retryable"}`);
        }
        const result = await this.chat(messages, options);
        onChunk(result.content);
        for (const tc of result.toolCalls)
          onToolCall?.(tc);
        return result.usage;
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const data = await response.json();
        const usage2 = { input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0 };
        if (data.content) {
          for (const block of data.content) {
            if (block.type === "text")
              onChunk(block.text || "");
            else if (block.type === "tool_use") {
              onToolCall?.({ id: block.id, name: block.name, input: block.input || {} });
            }
          }
        }
        return usage2;
      }
      const reader = response.body?.getReader();
      if (!reader) {
        const result = await this.chat(messages, options);
        onChunk(result.content);
        for (const tc of result.toolCalls)
          onToolCall?.(tc);
        return result.usage;
      }
      const decoder = new TextDecoder;
      let buffer = "";
      let usage = { input: 0, output: 0 };
      const partialToolCalls = new Map;
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(`
`);
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: "))
            continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]")
            continue;
          try {
            const event = JSON.parse(data);
            const type = event.type;
            if (type === "message_start" && event.message?.usage) {
              usage.input = event.message.usage.input_tokens || 0;
            } else if (type === "message_delta" && event.usage) {
              usage.output = event.usage.output_tokens || 0;
            } else if (type === "content_block_start") {
              const block = event.content_block;
              if (block?.type === "tool_use") {
                partialToolCalls.set(event.index, {
                  id: block.id || `tool_${Date.now()}`,
                  name: block.name || "",
                  inputJson: ""
                });
              }
            } else if (type === "content_block_delta") {
              const delta = event.delta;
              if (delta?.type === "text_delta" && delta.text) {
                onChunk(delta.text);
              } else if (delta?.type === "input_json_delta" && delta.partial_json !== undefined) {
                const partial = partialToolCalls.get(event.index);
                if (partial)
                  partial.inputJson += delta.partial_json;
              }
            } else if (type === "content_block_stop") {
              const partial = partialToolCalls.get(event.index);
              if (partial) {
                let input = {};
                try {
                  input = JSON.parse(partial.inputJson);
                } catch {}
                onToolCall?.({ id: partial.id, name: partial.name, input });
                partialToolCalls.delete(event.index);
              }
            }
          } catch {}
        }
      }
      return usage;
    } catch {
      const result = await this.chat(messages, options);
      onChunk(result.content);
      for (const tc of result.toolCalls)
        onToolCall?.(tc);
      return result.usage;
    }
  }
  async chatViaOpenAI(messages, options, provider) {
    const { tools, temperature = 0.7, max_tokens = 4096 } = options;
    const openaiMessages = [];
    for (const msg of messages) {
      if (msg.role === "system") {
        openaiMessages.push({ role: "system", content: msg.content });
      } else if (msg.role === "tool") {
        openaiMessages.push({
          role: "tool",
          tool_call_id: msg.tool_call_id || "unknown",
          content: msg.content
        });
      } else if (msg.tool_calls && msg.tool_calls.length > 0) {
        openaiMessages.push({
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id || `call_${Date.now()}`,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.input) }
          }))
        });
      } else {
        openaiMessages.push({ role: msg.role, content: msg.content });
      }
    }
    const body = {
      model: provider.model,
      max_tokens,
      temperature,
      messages: openaiMessages
    };
    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema
        }
      }));
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      ...provider.headers || {}
    };
    if (provider.name === "openrouter") {
      headers["HTTP-Referer"] = "https://nole-code.dev";
      headers["X-Title"] = "Nole Code";
    }
    const response = await fetchWithRetry(provider.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${provider.name} error ${response.status}: ${error.slice(0, 200)}`);
    }
    const data = await response.json();
    const choice = data.choices?.[0]?.message || {};
    let content = choice.content || "";
    const toolCalls = [];
    if (choice.tool_calls) {
      for (const tc of choice.tool_calls) {
        let input = {};
        try {
          input = JSON.parse(tc.function?.arguments || "{}");
        } catch {}
        toolCalls.push({
          id: tc.id || `tool_${Date.now()}`,
          name: tc.function?.name || "",
          input
        });
      }
    }
    return {
      content,
      toolCalls,
      usage: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0
      }
    };
  }
}
var RETRY_STATUS, MAX_RETRIES = 3, BASE_DELAY_MS = 2000, llm;
var init_llm = __esm(() => {
  init_env();
  RETRY_STATUS = new Set([429, 500, 502, 503, 529]);
  llm = new LLMClient;
});

// src/tools/web.ts
async function webSearch(query, count = 5) {
  const timeMatch = query.match(/(?:current )?time (?:is )?in ([A-Za-z_\s]+?)(?:\?|$)/i);
  if (timeMatch) {
    const tz = timeMatch[1].trim().replace(/ /g, "_");
    const now = new Date;
    const zones = {
      New_York: "America/New_York",
      London: "Europe/London",
      Tokyo: "Asia/Tokyo",
      Sydney: "Australia/Sydney",
      Paris: "Europe/Paris",
      Berlin: "Europe/Berlin",
      Los_Angeles: "America/Los_Angeles",
      Chicago: "America/Chicago",
      Toronto: "America/Toronto"
    };
    const zone = zones[tz] || tz.replace(/_/g, "/");
    const localTime = now.toLocaleString("en-US", { timeZone: zone });
    return `Current time in ${tz.replace(/_/g, " ")}: ${localTime}
UTC: ${now.toISOString()}`;
  }
  try {
    const results = await ddgHtmlSearch(query, count);
    if (results.length > 0) {
      return `Search results for "${query}":

${results.join(`

`)}`;
    }
  } catch {}
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Nole-Code/1.12" }
    });
    const data = await response.json();
    const results = [];
    if (data.Abstract && data.AbstractURL) {
      results.push(`${data.Abstract}
Source: ${data.AbstractURL}`);
    }
    if (Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, count)) {
        if (topic.Text && topic.FirstURL) {
          results.push(`- ${topic.Text}
  ${topic.FirstURL}`);
        }
      }
    }
    if (results.length > 0) {
      return `Search results for "${query}":

${results.join(`

`)}`;
    }
  } catch {}
  return `No results found for: ${query}
Try using WebFetch with a specific URL instead.`;
}
async function ddgHtmlSearch(query, count) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Nole-Code/1.12)",
      Accept: "text/html"
    }
  });
  const html = await response.text();
  const results = [];
  const resultPattern = /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  const snippetPattern = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
  const links = [];
  let match;
  while ((match = resultPattern.exec(html)) !== null) {
    const resultUrl = match[1].replace(/&amp;/g, "&");
    const title = match[2].trim();
    if (title && resultUrl && !resultUrl.includes("duckduckgo.com")) {
      links.push({ url: resultUrl, title });
    }
  }
  const snippets = [];
  while ((match = snippetPattern.exec(html)) !== null) {
    const snippet = match[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
    if (snippet)
      snippets.push(snippet);
  }
  for (let i = 0;i < Math.min(links.length, count); i++) {
    const { url: linkUrl, title } = links[i];
    const snippet = snippets[i] || "";
    results.push(`- **${title}**
  ${snippet}
  ${linkUrl}`);
  }
  return results;
}
async function webFetch(url, maxChars = 1e4) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Nole-Code/1.12)",
        Accept: "text/html,application/xhtml+xml,application/json"
      }
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.text();
      return json.slice(0, maxChars);
    }
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "").replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "").replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
    if (text.length > maxChars) {
      text = text.slice(0, maxChars) + `

... (content truncated)`;
    }
    return title ? `# ${title}

${text}` : text || "(No readable content)";
  } catch (err) {
    return `Fetch error: ${err}`;
  }
}

// node_modules/zod/v4/core/core.js
function $constructor(name, initializer, params) {
  function init(inst, def) {
    var _a;
    Object.defineProperty(inst, "_zod", {
      value: inst._zod ?? {},
      enumerable: false
    });
    (_a = inst._zod).traits ?? (_a.traits = new Set);
    inst._zod.traits.add(name);
    initializer(inst, def);
    for (const k in _.prototype) {
      if (!(k in inst))
        Object.defineProperty(inst, k, { value: _.prototype[k].bind(inst) });
    }
    inst._zod.constr = _;
    inst._zod.def = def;
  }
  const Parent = params?.Parent ?? Object;

  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    var _a;
    const inst = params?.Parent ? new Definition : this;
    init(inst, def);
    (_a = inst._zod).deferred ?? (_a.deferred = []);
    for (const fn of inst._zod.deferred) {
      fn();
    }
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}
var NEVER, $brand, $ZodAsyncError, globalConfig;
var init_core = __esm(() => {
  NEVER = Object.freeze({
    status: "aborted"
  });
  $brand = Symbol("zod_brand");
  $ZodAsyncError = class $ZodAsyncError extends Error {
    constructor() {
      super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
    }
  };
  globalConfig = {};
});

// node_modules/zod/v4/core/util.js
var exports_util = {};
__export(exports_util, {
  unwrapMessage: () => unwrapMessage,
  stringifyPrimitive: () => stringifyPrimitive,
  required: () => required,
  randomString: () => randomString,
  propertyKeyTypes: () => propertyKeyTypes,
  promiseAllObject: () => promiseAllObject,
  primitiveTypes: () => primitiveTypes,
  prefixIssues: () => prefixIssues,
  pick: () => pick,
  partial: () => partial,
  optionalKeys: () => optionalKeys,
  omit: () => omit,
  numKeys: () => numKeys,
  nullish: () => nullish,
  normalizeParams: () => normalizeParams,
  merge: () => merge,
  jsonStringifyReplacer: () => jsonStringifyReplacer,
  joinValues: () => joinValues,
  issue: () => issue,
  isPlainObject: () => isPlainObject,
  isObject: () => isObject,
  getSizableOrigin: () => getSizableOrigin,
  getParsedType: () => getParsedType,
  getLengthableOrigin: () => getLengthableOrigin,
  getEnumValues: () => getEnumValues,
  getElementAtPath: () => getElementAtPath,
  floatSafeRemainder: () => floatSafeRemainder,
  finalizeIssue: () => finalizeIssue,
  extend: () => extend,
  escapeRegex: () => escapeRegex,
  esc: () => esc,
  defineLazy: () => defineLazy,
  createTransparentProxy: () => createTransparentProxy,
  clone: () => clone,
  cleanRegex: () => cleanRegex,
  cleanEnum: () => cleanEnum,
  captureStackTrace: () => captureStackTrace,
  cached: () => cached,
  assignProp: () => assignProp,
  assertNotEqual: () => assertNotEqual,
  assertNever: () => assertNever,
  assertIs: () => assertIs,
  assertEqual: () => assertEqual,
  assert: () => assert,
  allowsEval: () => allowsEval,
  aborted: () => aborted,
  NUMBER_FORMAT_RANGES: () => NUMBER_FORMAT_RANGES,
  Class: () => Class,
  BIGINT_FORMAT_RANGES: () => BIGINT_FORMAT_RANGES
});
function assertEqual(val) {
  return val;
}
function assertNotEqual(val) {
  return val;
}
function assertIs(_arg) {}
function assertNever(_x) {
  throw new Error;
}
function assert(_) {}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function joinValues(array, separator = "|") {
  return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
function cached(getter) {
  const set = false;
  return {
    get value() {
      if (!set) {
        const value = getter();
        Object.defineProperty(this, "value", { value });
        return value;
      }
      throw new Error("cached value already set");
    }
  };
}
function nullish(input) {
  return input === null || input === undefined;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
function defineLazy(object, key, getter) {
  const set = false;
  Object.defineProperty(object, key, {
    get() {
      if (!set) {
        const value = getter();
        object[key] = value;
        return value;
      }
      throw new Error("cached value already set");
    },
    set(v) {
      Object.defineProperty(object, key, {
        value: v
      });
    },
    configurable: true
  });
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function getElementAtPath(obj, path) {
  if (!path)
    return obj;
  return path.reduce((acc, key) => acc?.[key], obj);
}
function promiseAllObject(promisesObj) {
  const keys = Object.keys(promisesObj);
  const promises = keys.map((key) => promisesObj[key]);
  return Promise.all(promises).then((results) => {
    const resolvedObj = {};
    for (let i = 0;i < keys.length; i++) {
      resolvedObj[keys[i]] = results[i];
    }
    return resolvedObj;
  });
}
function randomString(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let str = "";
  for (let i = 0;i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}
function esc(str) {
  return JSON.stringify(str);
}
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === undefined)
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function numKeys(data) {
  let keyCount = 0;
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      keyCount++;
    }
  }
  return keyCount;
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== undefined) {
    if (params?.error !== undefined)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function createTransparentProxy(getter) {
  let target;
  return new Proxy({}, {
    get(_, prop, receiver) {
      target ?? (target = getter());
      return Reflect.get(target, prop, receiver);
    },
    set(_, prop, value, receiver) {
      target ?? (target = getter());
      return Reflect.set(target, prop, value, receiver);
    },
    has(_, prop) {
      target ?? (target = getter());
      return Reflect.has(target, prop);
    },
    deleteProperty(_, prop) {
      target ?? (target = getter());
      return Reflect.deleteProperty(target, prop);
    },
    ownKeys(_) {
      target ?? (target = getter());
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(_, prop) {
      target ?? (target = getter());
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    defineProperty(_, prop, descriptor) {
      target ?? (target = getter());
      return Reflect.defineProperty(target, prop, descriptor);
    }
  });
}
function stringifyPrimitive(value) {
  if (typeof value === "bigint")
    return value.toString() + "n";
  if (typeof value === "string")
    return `"${value}"`;
  return `${value}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
  });
}
function pick(schema, mask) {
  const newShape = {};
  const currDef = schema._zod.def;
  for (const key in mask) {
    if (!(key in currDef.shape)) {
      throw new Error(`Unrecognized key: "${key}"`);
    }
    if (!mask[key])
      continue;
    newShape[key] = currDef.shape[key];
  }
  return clone(schema, {
    ...schema._zod.def,
    shape: newShape,
    checks: []
  });
}
function omit(schema, mask) {
  const newShape = { ...schema._zod.def.shape };
  const currDef = schema._zod.def;
  for (const key in mask) {
    if (!(key in currDef.shape)) {
      throw new Error(`Unrecognized key: "${key}"`);
    }
    if (!mask[key])
      continue;
    delete newShape[key];
  }
  return clone(schema, {
    ...schema._zod.def,
    shape: newShape,
    checks: []
  });
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const def = {
    ...schema._zod.def,
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    checks: []
  };
  return clone(schema, def);
}
function merge(a, b) {
  return clone(a, {
    ...a._zod.def,
    get shape() {
      const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    catchall: b._zod.def.catchall,
    checks: []
  });
}
function partial(Class, schema, mask) {
  const oldShape = schema._zod.def.shape;
  const shape = { ...oldShape };
  if (mask) {
    for (const key in mask) {
      if (!(key in oldShape)) {
        throw new Error(`Unrecognized key: "${key}"`);
      }
      if (!mask[key])
        continue;
      shape[key] = Class ? new Class({
        type: "optional",
        innerType: oldShape[key]
      }) : oldShape[key];
    }
  } else {
    for (const key in oldShape) {
      shape[key] = Class ? new Class({
        type: "optional",
        innerType: oldShape[key]
      }) : oldShape[key];
    }
  }
  return clone(schema, {
    ...schema._zod.def,
    shape,
    checks: []
  });
}
function required(Class, schema, mask) {
  const oldShape = schema._zod.def.shape;
  const shape = { ...oldShape };
  if (mask) {
    for (const key in mask) {
      if (!(key in shape)) {
        throw new Error(`Unrecognized key: "${key}"`);
      }
      if (!mask[key])
        continue;
      shape[key] = new Class({
        type: "nonoptional",
        innerType: oldShape[key]
      });
    }
  } else {
    for (const key in oldShape) {
      shape[key] = new Class({
        type: "nonoptional",
        innerType: oldShape[key]
      });
    }
  }
  return clone(schema, {
    ...schema._zod.def,
    shape,
    checks: []
  });
}
function aborted(x, startIndex = 0) {
  for (let i = startIndex;i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true)
      return true;
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a;
    (_a = iss).path ?? (_a.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config2) {
  const full = { ...iss, path: iss.path ?? [] };
  if (!iss.message) {
    const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
    full.message = message;
  }
  delete full.inst;
  delete full.continue;
  if (!ctx?.reportInput) {
    delete full.input;
  }
  return full;
}
function getSizableOrigin(input) {
  if (input instanceof Set)
    return "set";
  if (input instanceof Map)
    return "map";
  if (input instanceof File)
    return "file";
  return "unknown";
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function cleanEnum(obj) {
  return Object.entries(obj).filter(([k, _]) => {
    return Number.isNaN(Number.parseInt(k, 10));
  }).map((el) => el[1]);
}

class Class {
  constructor(..._args) {}
}
var captureStackTrace, allowsEval, getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return "undefined";
    case "string":
      return "string";
    case "number":
      return Number.isNaN(data) ? "nan" : "number";
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "object":
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return "promise";
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return "map";
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return "set";
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return "date";
      }
      if (typeof File !== "undefined" && data instanceof File) {
        return "file";
      }
      return "object";
    default:
      throw new Error(`Unknown data type: ${t}`);
  }
}, propertyKeyTypes, primitiveTypes, NUMBER_FORMAT_RANGES, BIGINT_FORMAT_RANGES;
var init_util = __esm(() => {
  captureStackTrace = Error.captureStackTrace ? Error.captureStackTrace : (..._args) => {};
  allowsEval = cached(() => {
    if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
      return false;
    }
    try {
      const F = Function;
      new F("");
      return true;
    } catch (_) {
      return false;
    }
  });
  propertyKeyTypes = new Set(["string", "number", "symbol"]);
  primitiveTypes = new Set(["string", "number", "bigint", "boolean", "symbol", "undefined"]);
  NUMBER_FORMAT_RANGES = {
    safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    int32: [-2147483648, 2147483647],
    uint32: [0, 4294967295],
    float32: [-340282346638528860000000000000000000000, 340282346638528860000000000000000000000],
    float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
  };
  BIGINT_FORMAT_RANGES = {
    int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
    uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
  };
});

// node_modules/zod/v4/core/errors.js
function flattenError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error.issues) {
    if (sub.path.length > 0) {
      fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
      fieldErrors[sub.path[0]].push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error, _mapper) {
  const mapper = _mapper || function(issue2) {
    return issue2.message;
  };
  const fieldErrors = { _errors: [] };
  const processError = (error2) => {
    for (const issue2 of error2.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues });
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues });
      } else if (issue2.path.length === 0) {
        fieldErrors._errors.push(mapper(issue2));
      } else {
        let curr = fieldErrors;
        let i = 0;
        while (i < issue2.path.length) {
          const el = issue2.path[i];
          const terminal = i === issue2.path.length - 1;
          if (!terminal) {
            curr[el] = curr[el] || { _errors: [] };
          } else {
            curr[el] = curr[el] || { _errors: [] };
            curr[el]._errors.push(mapper(issue2));
          }
          curr = curr[el];
          i++;
        }
      }
    }
  };
  processError(error);
  return fieldErrors;
}
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  Object.defineProperty(inst, "_zod", {
    value: inst._zod,
    enumerable: false
  });
  Object.defineProperty(inst, "issues", {
    value: def,
    enumerable: false
  });
  Object.defineProperty(inst, "message", {
    get() {
      return JSON.stringify(def, jsonStringifyReplacer, 2);
    },
    enumerable: true
  });
  Object.defineProperty(inst, "toString", {
    value: () => inst.message,
    enumerable: false
  });
}, $ZodError, $ZodRealError;
var init_errors = __esm(() => {
  init_core();
  init_util();
  $ZodError = $constructor("$ZodError", initializer);
  $ZodRealError = $constructor("$ZodError", initializer, { Parent: Error });
});

// node_modules/zod/v4/core/parse.js
var _parse = (_Err) => (schema, value, _ctx, _params) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  if (result.issues.length) {
    const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, _params?.callee);
    throw e;
  }
  return result.value;
}, _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params?.callee);
    throw e;
  }
  return result.value;
}, _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
}, safeParse, _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
}, safeParseAsync;
var init_parse = __esm(() => {
  init_core();
  init_errors();
  init_util();
  safeParse = /* @__PURE__ */ _safeParse($ZodRealError);
  safeParseAsync = /* @__PURE__ */ _safeParseAsync($ZodRealError);
});

// node_modules/zod/v4/core/regexes.js
function emoji() {
  return new RegExp(_emoji, "u");
}
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const time2 = timeSource({ precision: args.precision });
  const opts = ["Z"];
  if (args.local)
    opts.push("");
  if (args.offset)
    opts.push(`([+-]\\d{2}:\\d{2})`);
  const timeRegex = `${time2}(?:${opts.join("|")})`;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var cuid, cuid2, ulid, xid, ksuid, nanoid, duration, guid, uuid = (version) => {
  if (!version)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
}, email, _emoji = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`, ipv4, ipv6, cidrv4, cidrv6, base64, base64url, hostname, e164, dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`, date, string = (params) => {
  const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
}, bigint, integer, number, boolean, _null, lowercase, uppercase;
var init_regexes = __esm(() => {
  cuid = /^[cC][^\s-]{8,}$/;
  cuid2 = /^[0-9a-z]+$/;
  ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
  xid = /^[0-9a-vA-V]{20}$/;
  ksuid = /^[A-Za-z0-9]{27}$/;
  nanoid = /^[a-zA-Z0-9_-]{21}$/;
  duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
  guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
  email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
  ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})$/;
  cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
  cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
  base64url = /^[A-Za-z0-9_-]*$/;
  hostname = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/;
  e164 = /^\+(?:[0-9]){6,14}[0-9]$/;
  date = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
  bigint = /^\d+n?$/;
  integer = /^\d+$/;
  number = /^-?\d+(?:\.\d+)?/i;
  boolean = /true|false/i;
  _null = /null/i;
  lowercase = /^[^A-Z]*$/;
  uppercase = /^[^a-z]*$/;
});

// node_modules/zod/v4/core/checks.js
var $ZodCheck, numericOriginMap, $ZodCheckLessThan, $ZodCheckGreaterThan, $ZodCheckMultipleOf, $ZodCheckNumberFormat, $ZodCheckMaxLength, $ZodCheckMinLength, $ZodCheckLengthEquals, $ZodCheckStringFormat, $ZodCheckRegex, $ZodCheckLowerCase, $ZodCheckUpperCase, $ZodCheckIncludes, $ZodCheckStartsWith, $ZodCheckEndsWith, $ZodCheckOverwrite;
var init_checks = __esm(() => {
  init_core();
  init_regexes();
  init_util();
  $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
    var _a;
    inst._zod ?? (inst._zod = {});
    inst._zod.def = def;
    (_a = inst._zod).onattach ?? (_a.onattach = []);
  });
  numericOriginMap = {
    number: "number",
    bigint: "bigint",
    object: "date"
  };
  $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
      if (def.value < curr) {
        if (def.inclusive)
          bag.maximum = def.value;
        else
          bag.exclusiveMaximum = def.value;
      }
    });
    inst._zod.check = (payload) => {
      if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
        return;
      }
      payload.issues.push({
        origin,
        code: "too_big",
        maximum: def.value,
        input: payload.value,
        inclusive: def.inclusive,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
      if (def.value > curr) {
        if (def.inclusive)
          bag.minimum = def.value;
        else
          bag.exclusiveMinimum = def.value;
      }
    });
    inst._zod.check = (payload) => {
      if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
        return;
      }
      payload.issues.push({
        origin,
        code: "too_small",
        minimum: def.value,
        input: payload.value,
        inclusive: def.inclusive,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      var _a;
      (_a = inst2._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
    });
    inst._zod.check = (payload) => {
      if (typeof payload.value !== typeof def.value)
        throw new Error("Cannot mix number and bigint in multiple_of check.");
      const isMultiple = typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0;
      if (isMultiple)
        return;
      payload.issues.push({
        origin: typeof payload.value,
        code: "not_multiple_of",
        divisor: def.value,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
    $ZodCheck.init(inst, def);
    def.format = def.format || "float64";
    const isInt = def.format?.includes("int");
    const origin = isInt ? "int" : "number";
    const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.format = def.format;
      bag.minimum = minimum;
      bag.maximum = maximum;
      if (isInt)
        bag.pattern = integer;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      if (isInt) {
        if (!Number.isInteger(input)) {
          payload.issues.push({
            expected: origin,
            format: def.format,
            code: "invalid_type",
            input,
            inst
          });
          return;
        }
        if (!Number.isSafeInteger(input)) {
          if (input > 0) {
            payload.issues.push({
              input,
              code: "too_big",
              maximum: Number.MAX_SAFE_INTEGER,
              note: "Integers must be within the safe integer range.",
              inst,
              origin,
              continue: !def.abort
            });
          } else {
            payload.issues.push({
              input,
              code: "too_small",
              minimum: Number.MIN_SAFE_INTEGER,
              note: "Integers must be within the safe integer range.",
              inst,
              origin,
              continue: !def.abort
            });
          }
          return;
        }
      }
      if (input < minimum) {
        payload.issues.push({
          origin: "number",
          input,
          code: "too_small",
          minimum,
          inclusive: true,
          inst,
          continue: !def.abort
        });
      }
      if (input > maximum) {
        payload.issues.push({
          origin: "number",
          input,
          code: "too_big",
          maximum,
          inst
        });
      }
    };
  });
  $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
      const val = payload.value;
      return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst2) => {
      const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
      if (def.maximum < curr)
        inst2._zod.bag.maximum = def.maximum;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      const length = input.length;
      if (length <= def.maximum)
        return;
      const origin = getLengthableOrigin(input);
      payload.issues.push({
        origin,
        code: "too_big",
        maximum: def.maximum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
      const val = payload.value;
      return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst2) => {
      const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
      if (def.minimum > curr)
        inst2._zod.bag.minimum = def.minimum;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      const length = input.length;
      if (length >= def.minimum)
        return;
      const origin = getLengthableOrigin(input);
      payload.issues.push({
        origin,
        code: "too_small",
        minimum: def.minimum,
        inclusive: true,
        input,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
      const val = payload.value;
      return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.minimum = def.length;
      bag.maximum = def.length;
      bag.length = def.length;
    });
    inst._zod.check = (payload) => {
      const input = payload.value;
      const length = input.length;
      if (length === def.length)
        return;
      const origin = getLengthableOrigin(input);
      const tooBig = length > def.length;
      payload.issues.push({
        origin,
        ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
        inclusive: true,
        exact: true,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
    var _a, _b;
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.format = def.format;
      if (def.pattern) {
        bag.patterns ?? (bag.patterns = new Set);
        bag.patterns.add(def.pattern);
      }
    });
    if (def.pattern)
      (_a = inst._zod).check ?? (_a.check = (payload) => {
        def.pattern.lastIndex = 0;
        if (def.pattern.test(payload.value))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: def.format,
          input: payload.value,
          ...def.pattern ? { pattern: def.pattern.toString() } : {},
          inst,
          continue: !def.abort
        });
      });
    else
      (_b = inst._zod).check ?? (_b.check = () => {});
  });
  $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "regex",
        input: payload.value,
        pattern: def.pattern.toString(),
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
    def.pattern ?? (def.pattern = lowercase);
    $ZodCheckStringFormat.init(inst, def);
  });
  $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
    def.pattern ?? (def.pattern = uppercase);
    $ZodCheckStringFormat.init(inst, def);
  });
  $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
    $ZodCheck.init(inst, def);
    const escapedRegex = escapeRegex(def.includes);
    const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
    def.pattern = pattern;
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.patterns ?? (bag.patterns = new Set);
      bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
      if (payload.value.includes(def.includes, def.position))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "includes",
        includes: def.includes,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.patterns ?? (bag.patterns = new Set);
      bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
      if (payload.value.startsWith(def.prefix))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "starts_with",
        prefix: def.prefix,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.patterns ?? (bag.patterns = new Set);
      bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
      if (payload.value.endsWith(def.suffix))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: "ends_with",
        suffix: def.suffix,
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
      payload.value = def.tx(payload.value);
    };
  });
});

// node_modules/zod/v4/core/doc.js
class Doc {
  constructor(args = []) {
    this.content = [];
    this.indent = 0;
    if (this)
      this.args = args;
  }
  indented(fn) {
    this.indent += 1;
    fn(this);
    this.indent -= 1;
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split(`
`).filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const args = this?.args;
    const content = this?.content ?? [``];
    const lines = [...content.map((x) => `  ${x}`)];
    return new F(...args, lines.join(`
`));
  }
}

// node_modules/zod/v4/core/versions.js
var version;
var init_versions = __esm(() => {
  version = {
    major: 4,
    minor: 0,
    patch: 0
  };
});

// node_modules/zod/v4/core/schemas.js
function isValidBase64(data) {
  if (data === "")
    return true;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
function isValidBase64URL(data) {
  if (!base64url.test(data))
    return false;
  const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
  return isValidBase64(padded);
}
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
function handleObjectResult(result, final, key) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(key, result.issues));
  }
  final.value[key] = result.value;
}
function handleOptionalObjectResult(result, final, key, input) {
  if (result.issues.length) {
    if (input[key] === undefined) {
      if (key in input) {
        final.value[key] = undefined;
      } else {
        final.value[key] = result.value;
      }
    } else {
      final.issues.push(...prefixIssues(key, result.issues));
    }
  } else if (result.value === undefined) {
    if (key in input)
      final.value[key] = undefined;
  } else {
    final.value[key] = result.value;
  }
}
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  if (left.issues.length) {
    result.issues.push(...left.issues);
  }
  if (right.issues.length) {
    result.issues.push(...right.issues);
  }
  if (aborted(result))
    return result;
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    throw new Error(`Unmergable intersection. Error path: ` + `${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
function handleDefaultResult(payload, def) {
  if (payload.value === undefined) {
    payload.value = def.defaultValue;
  }
  return payload;
}
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === undefined) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
function handlePipeResult(left, def, ctx) {
  if (aborted(left)) {
    return left;
  }
  return def.out._zod.run({ value: left.value, issues: left.issues }, ctx);
}
function handleReadonlyResult(payload) {
  payload.value = Object.freeze(payload.value);
  return payload;
}
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      path: [...inst._zod.def.path ?? []],
      continue: !inst._zod.def.abort
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}
var $ZodType, $ZodString, $ZodStringFormat, $ZodGUID, $ZodUUID, $ZodEmail, $ZodURL, $ZodEmoji, $ZodNanoID, $ZodCUID, $ZodCUID2, $ZodULID, $ZodXID, $ZodKSUID, $ZodISODateTime, $ZodISODate, $ZodISOTime, $ZodISODuration, $ZodIPv4, $ZodIPv6, $ZodCIDRv4, $ZodCIDRv6, $ZodBase64, $ZodBase64URL, $ZodE164, $ZodJWT, $ZodNumber, $ZodNumberFormat, $ZodBoolean, $ZodBigInt, $ZodNull, $ZodAny, $ZodUnknown, $ZodNever, $ZodDate, $ZodArray, $ZodObject, $ZodUnion, $ZodDiscriminatedUnion, $ZodIntersection, $ZodRecord, $ZodEnum, $ZodLiteral, $ZodTransform, $ZodOptional, $ZodNullable, $ZodDefault, $ZodPrefault, $ZodNonOptional, $ZodCatch, $ZodPipe, $ZodReadonly, $ZodCustom;
var init_schemas = __esm(() => {
  init_checks();
  init_core();
  init_parse();
  init_regexes();
  init_util();
  init_versions();
  init_util();
  $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
    var _a;
    inst ?? (inst = {});
    inst._zod.def = def;
    inst._zod.bag = inst._zod.bag || {};
    inst._zod.version = version;
    const checks = [...inst._zod.def.checks ?? []];
    if (inst._zod.traits.has("$ZodCheck")) {
      checks.unshift(inst);
    }
    for (const ch of checks) {
      for (const fn of ch._zod.onattach) {
        fn(inst);
      }
    }
    if (checks.length === 0) {
      (_a = inst._zod).deferred ?? (_a.deferred = []);
      inst._zod.deferred?.push(() => {
        inst._zod.run = inst._zod.parse;
      });
    } else {
      const runChecks = (payload, checks2, ctx) => {
        let isAborted = aborted(payload);
        let asyncResult;
        for (const ch of checks2) {
          if (ch._zod.def.when) {
            const shouldRun = ch._zod.def.when(payload);
            if (!shouldRun)
              continue;
          } else if (isAborted) {
            continue;
          }
          const currLen = payload.issues.length;
          const _ = ch._zod.check(payload);
          if (_ instanceof Promise && ctx?.async === false) {
            throw new $ZodAsyncError;
          }
          if (asyncResult || _ instanceof Promise) {
            asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
              await _;
              const nextLen = payload.issues.length;
              if (nextLen === currLen)
                return;
              if (!isAborted)
                isAborted = aborted(payload, currLen);
            });
          } else {
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              continue;
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          }
        }
        if (asyncResult) {
          return asyncResult.then(() => {
            return payload;
          });
        }
        return payload;
      };
      inst._zod.run = (payload, ctx) => {
        const result = inst._zod.parse(payload, ctx);
        if (result instanceof Promise) {
          if (ctx.async === false)
            throw new $ZodAsyncError;
          return result.then((result2) => runChecks(result2, checks, ctx));
        }
        return runChecks(result, checks, ctx);
      };
    }
    inst["~standard"] = {
      validate: (value) => {
        try {
          const r = safeParse(inst, value);
          return r.success ? { value: r.data } : { issues: r.error?.issues };
        } catch (_) {
          return safeParseAsync(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
        }
      },
      vendor: "zod",
      version: 1
    };
  });
  $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string(inst._zod.bag);
    inst._zod.parse = (payload, _) => {
      if (def.coerce)
        try {
          payload.value = String(payload.value);
        } catch (_2) {}
      if (typeof payload.value === "string")
        return payload;
      payload.issues.push({
        expected: "string",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    $ZodString.init(inst, def);
  });
  $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
    def.pattern ?? (def.pattern = guid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
    if (def.version) {
      const versionMap = {
        v1: 1,
        v2: 2,
        v3: 3,
        v4: 4,
        v5: 5,
        v6: 6,
        v7: 7,
        v8: 8
      };
      const v = versionMap[def.version];
      if (v === undefined)
        throw new Error(`Invalid UUID version: "${def.version}"`);
      def.pattern ?? (def.pattern = uuid(v));
    } else
      def.pattern ?? (def.pattern = uuid());
    $ZodStringFormat.init(inst, def);
  });
  $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
    def.pattern ?? (def.pattern = email);
    $ZodStringFormat.init(inst, def);
  });
  $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      try {
        const orig = payload.value;
        const url = new URL(orig);
        const href = url.href;
        if (def.hostname) {
          def.hostname.lastIndex = 0;
          if (!def.hostname.test(url.hostname)) {
            payload.issues.push({
              code: "invalid_format",
              format: "url",
              note: "Invalid hostname",
              pattern: hostname.source,
              input: payload.value,
              inst,
              continue: !def.abort
            });
          }
        }
        if (def.protocol) {
          def.protocol.lastIndex = 0;
          if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
            payload.issues.push({
              code: "invalid_format",
              format: "url",
              note: "Invalid protocol",
              pattern: def.protocol.source,
              input: payload.value,
              inst,
              continue: !def.abort
            });
          }
        }
        if (!orig.endsWith("/") && href.endsWith("/")) {
          payload.value = href.slice(0, -1);
        } else {
          payload.value = href;
        }
        return;
      } catch (_) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
    def.pattern ?? (def.pattern = emoji());
    $ZodStringFormat.init(inst, def);
  });
  $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
    def.pattern ?? (def.pattern = nanoid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
    def.pattern ?? (def.pattern = cuid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
    def.pattern ?? (def.pattern = cuid2);
    $ZodStringFormat.init(inst, def);
  });
  $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
    def.pattern ?? (def.pattern = ulid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
    def.pattern ?? (def.pattern = xid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
    def.pattern ?? (def.pattern = ksuid);
    $ZodStringFormat.init(inst, def);
  });
  $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
    def.pattern ?? (def.pattern = datetime(def));
    $ZodStringFormat.init(inst, def);
  });
  $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
    def.pattern ?? (def.pattern = date);
    $ZodStringFormat.init(inst, def);
  });
  $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
    def.pattern ?? (def.pattern = time(def));
    $ZodStringFormat.init(inst, def);
  });
  $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
    def.pattern ?? (def.pattern = duration);
    $ZodStringFormat.init(inst, def);
  });
  $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
    def.pattern ?? (def.pattern = ipv4);
    $ZodStringFormat.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.format = `ipv4`;
    });
  });
  $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
    def.pattern ?? (def.pattern = ipv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      const bag = inst2._zod.bag;
      bag.format = `ipv6`;
    });
    inst._zod.check = (payload) => {
      try {
        new URL(`http://[${payload.value}]`);
      } catch {
        payload.issues.push({
          code: "invalid_format",
          format: "ipv6",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv4);
    $ZodStringFormat.init(inst, def);
  });
  $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      const [address, prefix] = payload.value.split("/");
      try {
        if (!prefix)
          throw new Error;
        const prefixNum = Number(prefix);
        if (`${prefixNum}` !== prefix)
          throw new Error;
        if (prefixNum < 0 || prefixNum > 128)
          throw new Error;
        new URL(`http://[${address}]`);
      } catch {
        payload.issues.push({
          code: "invalid_format",
          format: "cidrv6",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
    };
  });
  $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
    def.pattern ?? (def.pattern = base64);
    $ZodStringFormat.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      inst2._zod.bag.contentEncoding = "base64";
    });
    inst._zod.check = (payload) => {
      if (isValidBase64(payload.value))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "base64",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
    def.pattern ?? (def.pattern = base64url);
    $ZodStringFormat.init(inst, def);
    inst._zod.onattach.push((inst2) => {
      inst2._zod.bag.contentEncoding = "base64url";
    });
    inst._zod.check = (payload) => {
      if (isValidBase64URL(payload.value))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "base64url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
    def.pattern ?? (def.pattern = e164);
    $ZodStringFormat.init(inst, def);
  });
  $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
      if (isValidJWT(payload.value, def.alg))
        return;
      payload.issues.push({
        code: "invalid_format",
        format: "jwt",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    };
  });
  $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = inst._zod.bag.pattern ?? number;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = Number(payload.value);
        } catch (_) {}
      const input = payload.value;
      if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
        return payload;
      }
      const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : undefined : undefined;
      payload.issues.push({
        expected: "number",
        code: "invalid_type",
        input,
        inst,
        ...received ? { received } : {}
      });
      return payload;
    };
  });
  $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
    $ZodCheckNumberFormat.init(inst, def);
    $ZodNumber.init(inst, def);
  });
  $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = boolean;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = Boolean(payload.value);
        } catch (_) {}
      const input = payload.value;
      if (typeof input === "boolean")
        return payload;
      payload.issues.push({
        expected: "boolean",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  $ZodBigInt = /* @__PURE__ */ $constructor("$ZodBigInt", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = bigint;
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce)
        try {
          payload.value = BigInt(payload.value);
        } catch (_) {}
      if (typeof payload.value === "bigint")
        return payload;
      payload.issues.push({
        expected: "bigint",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  $ZodNull = /* @__PURE__ */ $constructor("$ZodNull", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = _null;
    inst._zod.values = new Set([null]);
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (input === null)
        return payload;
      payload.issues.push({
        expected: "null",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    };
  });
  $ZodAny = /* @__PURE__ */ $constructor("$ZodAny", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
  });
  $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
  });
  $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      payload.issues.push({
        expected: "never",
        code: "invalid_type",
        input: payload.value,
        inst
      });
      return payload;
    };
  });
  $ZodDate = /* @__PURE__ */ $constructor("$ZodDate", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      if (def.coerce) {
        try {
          payload.value = new Date(payload.value);
        } catch (_err) {}
      }
      const input = payload.value;
      const isDate = input instanceof Date;
      const isValidDate = isDate && !Number.isNaN(input.getTime());
      if (isValidDate)
        return payload;
      payload.issues.push({
        expected: "date",
        code: "invalid_type",
        input,
        ...isDate ? { received: "Invalid Date" } : {},
        inst
      });
      return payload;
    };
  });
  $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!Array.isArray(input)) {
        payload.issues.push({
          expected: "array",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      payload.value = Array(input.length);
      const proms = [];
      for (let i = 0;i < input.length; i++) {
        const item = input[i];
        const result = def.element._zod.run({
          value: item,
          issues: []
        }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
        } else {
          handleArrayResult(result, payload, i);
        }
      }
      if (proms.length) {
        return Promise.all(proms).then(() => payload);
      }
      return payload;
    };
  });
  $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
    $ZodType.init(inst, def);
    const _normalized = cached(() => {
      const keys = Object.keys(def.shape);
      for (const k of keys) {
        if (!(def.shape[k] instanceof $ZodType)) {
          throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
        }
      }
      const okeys = optionalKeys(def.shape);
      return {
        shape: def.shape,
        keys,
        keySet: new Set(keys),
        numKeys: keys.length,
        optionalKeys: new Set(okeys)
      };
    });
    defineLazy(inst._zod, "propValues", () => {
      const shape = def.shape;
      const propValues = {};
      for (const key in shape) {
        const field = shape[key]._zod;
        if (field.values) {
          propValues[key] ?? (propValues[key] = new Set);
          for (const v of field.values)
            propValues[key].add(v);
        }
      }
      return propValues;
    });
    const generateFastpass = (shape) => {
      const doc = new Doc(["shape", "payload", "ctx"]);
      const normalized = _normalized.value;
      const parseStr = (key) => {
        const k = esc(key);
        return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
      };
      doc.write(`const input = payload.value;`);
      const ids = Object.create(null);
      let counter = 0;
      for (const key of normalized.keys) {
        ids[key] = `key_${counter++}`;
      }
      doc.write(`const newResult = {}`);
      for (const key of normalized.keys) {
        if (normalized.optionalKeys.has(key)) {
          const id = ids[key];
          doc.write(`const ${id} = ${parseStr(key)};`);
          const k = esc(key);
          doc.write(`
        if (${id}.issues.length) {
          if (input[${k}] === undefined) {
            if (${k} in input) {
              newResult[${k}] = undefined;
            }
          } else {
            payload.issues = payload.issues.concat(
              ${id}.issues.map((iss) => ({
                ...iss,
                path: iss.path ? [${k}, ...iss.path] : [${k}],
              }))
            );
          }
        } else if (${id}.value === undefined) {
          if (${k} in input) newResult[${k}] = undefined;
        } else {
          newResult[${k}] = ${id}.value;
        }
        `);
        } else {
          const id = ids[key];
          doc.write(`const ${id} = ${parseStr(key)};`);
          doc.write(`
          if (${id}.issues.length) payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${esc(key)}, ...iss.path] : [${esc(key)}]
          })));`);
          doc.write(`newResult[${esc(key)}] = ${id}.value`);
        }
      }
      doc.write(`payload.value = newResult;`);
      doc.write(`return payload;`);
      const fn = doc.compile();
      return (payload, ctx) => fn(shape, payload, ctx);
    };
    let fastpass;
    const isObject2 = isObject;
    const jit = !globalConfig.jitless;
    const allowsEval2 = allowsEval;
    const fastEnabled = jit && allowsEval2.value;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
      value ?? (value = _normalized.value);
      const input = payload.value;
      if (!isObject2(input)) {
        payload.issues.push({
          expected: "object",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      const proms = [];
      if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
        if (!fastpass)
          fastpass = generateFastpass(def.shape);
        payload = fastpass(payload, ctx);
      } else {
        payload.value = {};
        const shape = value.shape;
        for (const key of value.keys) {
          const el = shape[key];
          const r = el._zod.run({ value: input[key], issues: [] }, ctx);
          const isOptional = el._zod.optin === "optional" && el._zod.optout === "optional";
          if (r instanceof Promise) {
            proms.push(r.then((r2) => isOptional ? handleOptionalObjectResult(r2, payload, key, input) : handleObjectResult(r2, payload, key)));
          } else if (isOptional) {
            handleOptionalObjectResult(r, payload, key, input);
          } else {
            handleObjectResult(r, payload, key);
          }
        }
      }
      if (!catchall) {
        return proms.length ? Promise.all(proms).then(() => payload) : payload;
      }
      const unrecognized = [];
      const keySet = value.keySet;
      const _catchall = catchall._zod;
      const t = _catchall.def.type;
      for (const key of Object.keys(input)) {
        if (keySet.has(key))
          continue;
        if (t === "never") {
          unrecognized.push(key);
          continue;
        }
        const r = _catchall.run({ value: input[key], issues: [] }, ctx);
        if (r instanceof Promise) {
          proms.push(r.then((r2) => handleObjectResult(r2, payload, key)));
        } else {
          handleObjectResult(r, payload, key);
        }
      }
      if (unrecognized.length) {
        payload.issues.push({
          code: "unrecognized_keys",
          keys: unrecognized,
          input,
          inst
        });
      }
      if (!proms.length)
        return payload;
      return Promise.all(proms).then(() => {
        return payload;
      });
    };
  });
  $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "values", () => {
      if (def.options.every((o) => o._zod.values)) {
        return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
      }
      return;
    });
    defineLazy(inst._zod, "pattern", () => {
      if (def.options.every((o) => o._zod.pattern)) {
        const patterns = def.options.map((o) => o._zod.pattern);
        return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
      }
      return;
    });
    inst._zod.parse = (payload, ctx) => {
      let async = false;
      const results = [];
      for (const option of def.options) {
        const result = option._zod.run({
          value: payload.value,
          issues: []
        }, ctx);
        if (result instanceof Promise) {
          results.push(result);
          async = true;
        } else {
          if (result.issues.length === 0)
            return result;
          results.push(result);
        }
      }
      if (!async)
        return handleUnionResults(results, payload, inst, ctx);
      return Promise.all(results).then((results2) => {
        return handleUnionResults(results2, payload, inst, ctx);
      });
    };
  });
  $ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    const _super = inst._zod.parse;
    defineLazy(inst._zod, "propValues", () => {
      const propValues = {};
      for (const option of def.options) {
        const pv = option._zod.propValues;
        if (!pv || Object.keys(pv).length === 0)
          throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
        for (const [k, v] of Object.entries(pv)) {
          if (!propValues[k])
            propValues[k] = new Set;
          for (const val of v) {
            propValues[k].add(val);
          }
        }
      }
      return propValues;
    });
    const disc = cached(() => {
      const opts = def.options;
      const map = new Map;
      for (const o of opts) {
        const values = o._zod.propValues[def.discriminator];
        if (!values || values.size === 0)
          throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
        for (const v of values) {
          if (map.has(v)) {
            throw new Error(`Duplicate discriminator value "${String(v)}"`);
          }
          map.set(v, o);
        }
      }
      return map;
    });
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!isObject(input)) {
        payload.issues.push({
          code: "invalid_type",
          expected: "object",
          input,
          inst
        });
        return payload;
      }
      const opt = disc.value.get(input?.[def.discriminator]);
      if (opt) {
        return opt._zod.run(payload, ctx);
      }
      if (def.unionFallback) {
        return _super(payload, ctx);
      }
      payload.issues.push({
        code: "invalid_union",
        errors: [],
        note: "No matching discriminator",
        input,
        path: [def.discriminator],
        inst
      });
      return payload;
    };
  });
  $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      const left = def.left._zod.run({ value: input, issues: [] }, ctx);
      const right = def.right._zod.run({ value: input, issues: [] }, ctx);
      const async = left instanceof Promise || right instanceof Promise;
      if (async) {
        return Promise.all([left, right]).then(([left2, right2]) => {
          return handleIntersectionResults(payload, left2, right2);
        });
      }
      return handleIntersectionResults(payload, left, right);
    };
  });
  $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
      const input = payload.value;
      if (!isPlainObject(input)) {
        payload.issues.push({
          expected: "record",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      }
      const proms = [];
      if (def.keyType._zod.values) {
        const values = def.keyType._zod.values;
        payload.value = {};
        for (const key of values) {
          if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
            const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
            if (result instanceof Promise) {
              proms.push(result.then((result2) => {
                if (result2.issues.length) {
                  payload.issues.push(...prefixIssues(key, result2.issues));
                }
                payload.value[key] = result2.value;
              }));
            } else {
              if (result.issues.length) {
                payload.issues.push(...prefixIssues(key, result.issues));
              }
              payload.value[key] = result.value;
            }
          }
        }
        let unrecognized;
        for (const key in input) {
          if (!values.has(key)) {
            unrecognized = unrecognized ?? [];
            unrecognized.push(key);
          }
        }
        if (unrecognized && unrecognized.length > 0) {
          payload.issues.push({
            code: "unrecognized_keys",
            input,
            inst,
            keys: unrecognized
          });
        }
      } else {
        payload.value = {};
        for (const key of Reflect.ownKeys(input)) {
          if (key === "__proto__")
            continue;
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (keyResult.issues.length) {
            payload.issues.push({
              origin: "record",
              code: "invalid_key",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
            payload.value[keyResult.value] = keyResult.value;
            continue;
          }
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[keyResult.value] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[keyResult.value] = result.value;
          }
        }
      }
      if (proms.length) {
        return Promise.all(proms).then(() => payload);
      }
      return payload;
    };
  });
  $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
    $ZodType.init(inst, def);
    const values = getEnumValues(def.entries);
    inst._zod.values = new Set(values);
    inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (inst._zod.values.has(input)) {
        return payload;
      }
      payload.issues.push({
        code: "invalid_value",
        values,
        input,
        inst
      });
      return payload;
    };
  });
  $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.values = new Set(def.values);
    inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? o.toString() : String(o)).join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
      const input = payload.value;
      if (inst._zod.values.has(input)) {
        return payload;
      }
      payload.issues.push({
        code: "invalid_value",
        values: def.values,
        input,
        inst
      });
      return payload;
    };
  });
  $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      const _out = def.transform(payload.value, payload);
      if (_ctx.async) {
        const output = _out instanceof Promise ? _out : Promise.resolve(_out);
        return output.then((output2) => {
          payload.value = output2;
          return payload;
        });
      }
      if (_out instanceof Promise) {
        throw new $ZodAsyncError;
      }
      payload.value = _out;
      return payload;
    };
  });
  $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    inst._zod.optout = "optional";
    defineLazy(inst._zod, "values", () => {
      return def.innerType._zod.values ? new Set([...def.innerType._zod.values, undefined]) : undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
      const pattern = def.innerType._zod.pattern;
      return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
      if (def.innerType._zod.optin === "optional") {
        return def.innerType._zod.run(payload, ctx);
      }
      if (payload.value === undefined) {
        return payload;
      }
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    defineLazy(inst._zod, "pattern", () => {
      const pattern = def.innerType._zod.pattern;
      return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : undefined;
    });
    defineLazy(inst._zod, "values", () => {
      return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
      if (payload.value === null)
        return payload;
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (payload.value === undefined) {
        payload.value = def.defaultValue;
        return payload;
      }
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => handleDefaultResult(result2, def));
      }
      return handleDefaultResult(result, def);
    };
  });
  $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      if (payload.value === undefined) {
        payload.value = def.defaultValue;
      }
      return def.innerType._zod.run(payload, ctx);
    };
  });
  $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "values", () => {
      const v = def.innerType._zod.values;
      return v ? new Set([...v].filter((x) => x !== undefined)) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => handleNonOptionalResult(result2, inst));
      }
      return handleNonOptionalResult(result, inst);
    };
  });
  $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then((result2) => {
          payload.value = result2.value;
          if (result2.issues.length) {
            payload.value = def.catchValue({
              ...payload,
              error: {
                issues: result2.issues.map((iss) => finalizeIssue(iss, ctx, config()))
              },
              input: payload.value
            });
            payload.issues = [];
          }
          return payload;
        });
      }
      payload.value = result.value;
      if (result.issues.length) {
        payload.value = def.catchValue({
          ...payload,
          error: {
            issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
          },
          input: payload.value
        });
        payload.issues = [];
      }
      return payload;
    };
  });
  $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "values", () => def.in._zod.values);
    defineLazy(inst._zod, "optin", () => def.in._zod.optin);
    defineLazy(inst._zod, "optout", () => def.out._zod.optout);
    inst._zod.parse = (payload, ctx) => {
      const left = def.in._zod.run(payload, ctx);
      if (left instanceof Promise) {
        return left.then((left2) => handlePipeResult(left2, def, ctx));
      }
      return handlePipeResult(left, def, ctx);
    };
  });
  $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    inst._zod.parse = (payload, ctx) => {
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise) {
        return result.then(handleReadonlyResult);
      }
      return handleReadonlyResult(result);
    };
  });
  $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
    $ZodCheck.init(inst, def);
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _) => {
      return payload;
    };
    inst._zod.check = (payload) => {
      const input = payload.value;
      const r = def.fn(input);
      if (r instanceof Promise) {
        return r.then((r2) => handleRefineResult(r2, payload, input, inst));
      }
      handleRefineResult(r, payload, input, inst);
      return;
    };
  });
});

// node_modules/zod/v4/locales/en.js
function en_default() {
  return {
    localeError: error()
  };
}
var parsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "NaN" : "number";
    }
    case "object": {
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (Object.getPrototypeOf(data) !== Object.prototype && data.constructor) {
        return data.constructor.name;
      }
    }
  }
  return t;
}, error = () => {
  const Sizable = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const Nouns = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    jwt: "JWT",
    template_literal: "input"
  };
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type":
        return `Invalid input: expected ${issue2.expected}, received ${parsedType(issue2.input)}`;
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue2.values[0])}`;
        return `Invalid option: expected one of ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Too big: expected ${issue2.origin ?? "value"} to have ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Too big: expected ${issue2.origin ?? "value"} to be ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Too small: expected ${issue2.origin} to have ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Too small: expected ${issue2.origin} to be ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Invalid string: must start with "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Invalid string: must end with "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Invalid string: must include "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Invalid string: must match pattern ${_issue.pattern}`;
        return `Invalid ${Nouns[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${issue2.origin}`;
      case "invalid_union":
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${issue2.origin}`;
      default:
        return `Invalid input`;
    }
  };
};
var init_en = __esm(() => {
  init_util();
});

// node_modules/zod/v4/locales/index.js
var init_locales = () => {};

// node_modules/zod/v4/core/registries.js
class $ZodRegistry {
  constructor() {
    this._map = new Map;
    this._idmap = new Map;
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      if (this._idmap.has(meta.id)) {
        throw new Error(`ID ${meta.id} already exists in the registry`);
      }
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = new Map;
    this._idmap = new Map;
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      return { ...pm, ...this._map.get(schema) };
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry;
}
var $output, $input, globalRegistry;
var init_registries = __esm(() => {
  $output = Symbol("ZodOutput");
  $input = Symbol("ZodInput");
  globalRegistry = /* @__PURE__ */ registry();
});

// node_modules/zod/v4/core/api.js
function _string(Class2, params) {
  return new Class2({
    type: "string",
    ...normalizeParams(params)
  });
}
function _coercedString(Class2, params) {
  return new Class2({
    type: "string",
    coerce: true,
    ...normalizeParams(params)
  });
}
function _email(Class2, params) {
  return new Class2({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _guid(Class2, params) {
  return new Class2({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuidv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
function _uuidv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
function _uuidv7(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
function _url(Class2, params) {
  return new Class2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _emoji2(Class2, params) {
  return new Class2({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _nanoid(Class2, params) {
  return new Class2({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid2(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ulid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _xid(Class2, params) {
  return new Class2({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ksuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64url(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _e164(Class2, params) {
  return new Class2({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _jwt(Class2, params) {
  return new Class2({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _isoDateTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDate(Class2, params) {
  return new Class2({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _isoTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDuration(Class2, params) {
  return new Class2({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _number(Class2, params) {
  return new Class2({
    type: "number",
    checks: [],
    ...normalizeParams(params)
  });
}
function _coercedNumber(Class2, params) {
  return new Class2({
    type: "number",
    coerce: true,
    checks: [],
    ...normalizeParams(params)
  });
}
function _int(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
function _boolean(Class2, params) {
  return new Class2({
    type: "boolean",
    ...normalizeParams(params)
  });
}
function _coercedBoolean(Class2, params) {
  return new Class2({
    type: "boolean",
    coerce: true,
    ...normalizeParams(params)
  });
}
function _coercedBigint(Class2, params) {
  return new Class2({
    type: "bigint",
    coerce: true,
    ...normalizeParams(params)
  });
}
function _null2(Class2, params) {
  return new Class2({
    type: "null",
    ...normalizeParams(params)
  });
}
function _any(Class2) {
  return new Class2({
    type: "any"
  });
}
function _unknown(Class2) {
  return new Class2({
    type: "unknown"
  });
}
function _never(Class2, params) {
  return new Class2({
    type: "never",
    ...normalizeParams(params)
  });
}
function _coercedDate(Class2, params) {
  return new Class2({
    type: "date",
    coerce: true,
    ...normalizeParams(params)
  });
}
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
function _normalize(form) {
  return _overwrite((input) => input.normalize(form));
}
function _trim() {
  return _overwrite((input) => input.trim());
}
function _toLowerCase() {
  return _overwrite((input) => input.toLowerCase());
}
function _toUpperCase() {
  return _overwrite((input) => input.toUpperCase());
}
function _array(Class2, element, params) {
  return new Class2({
    type: "array",
    element,
    ...normalizeParams(params)
  });
}
function _custom(Class2, fn, _params) {
  const norm = normalizeParams(_params);
  norm.abort ?? (norm.abort = true);
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...norm
  });
  return schema;
}
function _refine(Class2, fn, _params) {
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
var init_api = __esm(() => {
  init_checks();
  init_util();
});

// node_modules/zod/v4/core/function.js
var init_function = () => {};

// node_modules/zod/v4/core/to-json-schema.js
var init_to_json_schema = () => {};

// node_modules/zod/v4/core/json-schema.js
var init_json_schema = () => {};

// node_modules/zod/v4/core/index.js
var init_core2 = __esm(() => {
  init_util();
  init_regexes();
  init_locales();
  init_json_schema();
  init_core();
  init_parse();
  init_errors();
  init_schemas();
  init_checks();
  init_versions();
  init_registries();
  init_function();
  init_api();
  init_to_json_schema();
});

// node_modules/zod/v4/mini/parse.js
var init_parse2 = __esm(() => {
  init_core2();
});

// node_modules/zod/v4/mini/schemas.js
var init_schemas2 = () => {};

// node_modules/zod/v4/mini/checks.js
var init_checks2 = () => {};

// node_modules/zod/v4/mini/iso.js
var init_iso = () => {};

// node_modules/zod/v4/mini/coerce.js
var init_coerce = () => {};

// node_modules/zod/v4/mini/external.js
var init_external = __esm(() => {
  init_core2();
  init_locales();
  init_iso();
  init_coerce();
  init_parse2();
  init_schemas2();
  init_checks2();
});

// node_modules/zod/v4/mini/index.js
var init_mini = __esm(() => {
  init_external();
});

// node_modules/zod/v4-mini/index.js
var init_v4_mini = __esm(() => {
  init_mini();
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/zod-compat.js
function isZ4Schema(s) {
  const schema = s;
  return !!schema._zod;
}
function safeParse2(schema, data) {
  if (isZ4Schema(schema)) {
    const result2 = safeParse(schema, data);
    return result2;
  }
  const v3Schema = schema;
  const result = v3Schema.safeParse(data);
  return result;
}
function getObjectShape(schema) {
  if (!schema)
    return;
  let rawShape;
  if (isZ4Schema(schema)) {
    const v4Schema = schema;
    rawShape = v4Schema._zod?.def?.shape;
  } else {
    const v3Schema = schema;
    rawShape = v3Schema.shape;
  }
  if (!rawShape)
    return;
  if (typeof rawShape === "function") {
    try {
      return rawShape();
    } catch {
      return;
    }
  }
  return rawShape;
}
function getLiteralValue(schema) {
  if (isZ4Schema(schema)) {
    const v4Schema = schema;
    const def2 = v4Schema._zod?.def;
    if (def2) {
      if (def2.value !== undefined)
        return def2.value;
      if (Array.isArray(def2.values) && def2.values.length > 0) {
        return def2.values[0];
      }
    }
  }
  const v3Schema = schema;
  const def = v3Schema._def;
  if (def) {
    if (def.value !== undefined)
      return def.value;
    if (Array.isArray(def.values) && def.values.length > 0) {
      return def.values[0];
    }
  }
  const directValue = schema.value;
  if (directValue !== undefined)
    return directValue;
  return;
}
var init_zod_compat = __esm(() => {
  init_v4_mini();
});

// node_modules/zod/v4/classic/checks.js
var init_checks3 = __esm(() => {
  init_core2();
});

// node_modules/zod/v4/classic/iso.js
var exports_iso2 = {};
__export(exports_iso2, {
  time: () => time2,
  duration: () => duration2,
  datetime: () => datetime2,
  date: () => date2,
  ZodISOTime: () => ZodISOTime,
  ZodISODuration: () => ZodISODuration,
  ZodISODateTime: () => ZodISODateTime,
  ZodISODate: () => ZodISODate
});
function datetime2(params) {
  return _isoDateTime(ZodISODateTime, params);
}
function date2(params) {
  return _isoDate(ZodISODate, params);
}
function time2(params) {
  return _isoTime(ZodISOTime, params);
}
function duration2(params) {
  return _isoDuration(ZodISODuration, params);
}
var ZodISODateTime, ZodISODate, ZodISOTime, ZodISODuration;
var init_iso2 = __esm(() => {
  init_core2();
  init_schemas3();
  ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
    $ZodISODateTime.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
    $ZodISODate.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
    $ZodISOTime.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
    $ZodISODuration.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
});

// node_modules/zod/v4/classic/errors.js
var initializer2 = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  Object.defineProperties(inst, {
    format: {
      value: (mapper) => formatError(inst, mapper)
    },
    flatten: {
      value: (mapper) => flattenError(inst, mapper)
    },
    addIssue: {
      value: (issue2) => inst.issues.push(issue2)
    },
    addIssues: {
      value: (issues2) => inst.issues.push(...issues2)
    },
    isEmpty: {
      get() {
        return inst.issues.length === 0;
      }
    }
  });
}, ZodError, ZodRealError;
var init_errors2 = __esm(() => {
  init_core2();
  init_core2();
  ZodError = $constructor("ZodError", initializer2);
  ZodRealError = $constructor("ZodError", initializer2, {
    Parent: Error
  });
});

// node_modules/zod/v4/classic/parse.js
var parse4, parseAsync2, safeParse3, safeParseAsync2;
var init_parse3 = __esm(() => {
  init_core2();
  init_errors2();
  parse4 = /* @__PURE__ */ _parse(ZodRealError);
  parseAsync2 = /* @__PURE__ */ _parseAsync(ZodRealError);
  safeParse3 = /* @__PURE__ */ _safeParse(ZodRealError);
  safeParseAsync2 = /* @__PURE__ */ _safeParseAsync(ZodRealError);
});

// node_modules/zod/v4/classic/schemas.js
function string2(params) {
  return _string(ZodString, params);
}
function url(params) {
  return _url(ZodURL, params);
}
function number2(params) {
  return _number(ZodNumber, params);
}
function int(params) {
  return _int(ZodNumberFormat, params);
}
function boolean2(params) {
  return _boolean(ZodBoolean, params);
}
function _null3(params) {
  return _null2(ZodNull, params);
}
function any() {
  return _any(ZodAny);
}
function unknown() {
  return _unknown(ZodUnknown);
}
function never(params) {
  return _never(ZodNever, params);
}
function array(element, params) {
  return _array(ZodArray, element, params);
}
function object2(shape, params) {
  const def = {
    type: "object",
    get shape() {
      exports_util.assignProp(this, "shape", { ...shape });
      return this.shape;
    },
    ...exports_util.normalizeParams(params)
  };
  return new ZodObject(def);
}
function looseObject(shape, params) {
  return new ZodObject({
    type: "object",
    get shape() {
      exports_util.assignProp(this, "shape", { ...shape });
      return this.shape;
    },
    catchall: unknown(),
    ...exports_util.normalizeParams(params)
  });
}
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...exports_util.normalizeParams(params)
  });
}
function discriminatedUnion(discriminator, options, params) {
  return new ZodDiscriminatedUnion({
    type: "union",
    options,
    discriminator,
    ...exports_util.normalizeParams(params)
  });
}
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
function record(keyType, valueType, params) {
  return new ZodRecord({
    type: "record",
    keyType,
    valueType,
    ...exports_util.normalizeParams(params)
  });
}
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...exports_util.normalizeParams(params)
  });
}
function literal(value, params) {
  return new ZodLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...exports_util.normalizeParams(params)
  });
}
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
function _default(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : defaultValue;
    }
  });
}
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : defaultValue;
    }
  });
}
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...exports_util.normalizeParams(params)
  });
}
function _catch(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
  });
}
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
function check(fn) {
  const ch = new $ZodCheck({
    check: "custom"
  });
  ch._zod.check = fn;
  return ch;
}
function custom(fn, _params) {
  return _custom(ZodCustom, fn ?? (() => true), _params);
}
function refine(fn, _params = {}) {
  return _refine(ZodCustom, fn, _params);
}
function superRefine(fn) {
  const ch = check((payload) => {
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(exports_util.issue(issue2, payload.value, ch._zod.def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(exports_util.issue(_issue));
      }
    };
    return fn(payload.value, payload);
  });
  return ch;
}
function preprocess(fn, schema) {
  return pipe(transform(fn), schema);
}
var ZodType, _ZodString, ZodString, ZodStringFormat, ZodEmail, ZodGUID, ZodUUID, ZodURL, ZodEmoji, ZodNanoID, ZodCUID, ZodCUID2, ZodULID, ZodXID, ZodKSUID, ZodIPv4, ZodIPv6, ZodCIDRv4, ZodCIDRv6, ZodBase64, ZodBase64URL, ZodE164, ZodJWT, ZodNumber, ZodNumberFormat, ZodBoolean, ZodBigInt, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodDate, ZodArray, ZodObject, ZodUnion, ZodDiscriminatedUnion, ZodIntersection, ZodRecord, ZodEnum, ZodLiteral, ZodTransform, ZodOptional, ZodNullable, ZodDefault, ZodPrefault, ZodNonOptional, ZodCatch, ZodPipe, ZodReadonly, ZodCustom;
var init_schemas3 = __esm(() => {
  init_core2();
  init_core2();
  init_checks3();
  init_iso2();
  init_parse3();
  ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
    $ZodType.init(inst, def);
    inst.def = def;
    Object.defineProperty(inst, "_def", { value: def });
    inst.check = (...checks3) => {
      return inst.clone({
        ...def,
        checks: [
          ...def.checks ?? [],
          ...checks3.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
        ]
      });
    };
    inst.clone = (def2, params) => clone(inst, def2, params);
    inst.brand = () => inst;
    inst.register = (reg, meta) => {
      reg.add(inst, meta);
      return inst;
    };
    inst.parse = (data, params) => parse4(inst, data, params, { callee: inst.parse });
    inst.safeParse = (data, params) => safeParse3(inst, data, params);
    inst.parseAsync = async (data, params) => parseAsync2(inst, data, params, { callee: inst.parseAsync });
    inst.safeParseAsync = async (data, params) => safeParseAsync2(inst, data, params);
    inst.spa = inst.safeParseAsync;
    inst.refine = (check, params) => inst.check(refine(check, params));
    inst.superRefine = (refinement) => inst.check(superRefine(refinement));
    inst.overwrite = (fn) => inst.check(_overwrite(fn));
    inst.optional = () => optional(inst);
    inst.nullable = () => nullable(inst);
    inst.nullish = () => optional(nullable(inst));
    inst.nonoptional = (params) => nonoptional(inst, params);
    inst.array = () => array(inst);
    inst.or = (arg) => union([inst, arg]);
    inst.and = (arg) => intersection(inst, arg);
    inst.transform = (tx) => pipe(inst, transform(tx));
    inst.default = (def2) => _default(inst, def2);
    inst.prefault = (def2) => prefault(inst, def2);
    inst.catch = (params) => _catch(inst, params);
    inst.pipe = (target) => pipe(inst, target);
    inst.readonly = () => readonly(inst);
    inst.describe = (description) => {
      const cl = inst.clone();
      globalRegistry.add(cl, { description });
      return cl;
    };
    Object.defineProperty(inst, "description", {
      get() {
        return globalRegistry.get(inst)?.description;
      },
      configurable: true
    });
    inst.meta = (...args) => {
      if (args.length === 0) {
        return globalRegistry.get(inst);
      }
      const cl = inst.clone();
      globalRegistry.add(cl, args[0]);
      return cl;
    };
    inst.isOptional = () => inst.safeParse(undefined).success;
    inst.isNullable = () => inst.safeParse(null).success;
    return inst;
  });
  _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    ZodType.init(inst, def);
    const bag = inst._zod.bag;
    inst.format = bag.format ?? null;
    inst.minLength = bag.minimum ?? null;
    inst.maxLength = bag.maximum ?? null;
    inst.regex = (...args) => inst.check(_regex(...args));
    inst.includes = (...args) => inst.check(_includes(...args));
    inst.startsWith = (...args) => inst.check(_startsWith(...args));
    inst.endsWith = (...args) => inst.check(_endsWith(...args));
    inst.min = (...args) => inst.check(_minLength(...args));
    inst.max = (...args) => inst.check(_maxLength(...args));
    inst.length = (...args) => inst.check(_length(...args));
    inst.nonempty = (...args) => inst.check(_minLength(1, ...args));
    inst.lowercase = (params) => inst.check(_lowercase(params));
    inst.uppercase = (params) => inst.check(_uppercase(params));
    inst.trim = () => inst.check(_trim());
    inst.normalize = (...args) => inst.check(_normalize(...args));
    inst.toLowerCase = () => inst.check(_toLowerCase());
    inst.toUpperCase = () => inst.check(_toUpperCase());
  });
  ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    _ZodString.init(inst, def);
    inst.email = (params) => inst.check(_email(ZodEmail, params));
    inst.url = (params) => inst.check(_url(ZodURL, params));
    inst.jwt = (params) => inst.check(_jwt(ZodJWT, params));
    inst.emoji = (params) => inst.check(_emoji2(ZodEmoji, params));
    inst.guid = (params) => inst.check(_guid(ZodGUID, params));
    inst.uuid = (params) => inst.check(_uuid(ZodUUID, params));
    inst.uuidv4 = (params) => inst.check(_uuidv4(ZodUUID, params));
    inst.uuidv6 = (params) => inst.check(_uuidv6(ZodUUID, params));
    inst.uuidv7 = (params) => inst.check(_uuidv7(ZodUUID, params));
    inst.nanoid = (params) => inst.check(_nanoid(ZodNanoID, params));
    inst.guid = (params) => inst.check(_guid(ZodGUID, params));
    inst.cuid = (params) => inst.check(_cuid(ZodCUID, params));
    inst.cuid2 = (params) => inst.check(_cuid2(ZodCUID2, params));
    inst.ulid = (params) => inst.check(_ulid(ZodULID, params));
    inst.base64 = (params) => inst.check(_base64(ZodBase64, params));
    inst.base64url = (params) => inst.check(_base64url(ZodBase64URL, params));
    inst.xid = (params) => inst.check(_xid(ZodXID, params));
    inst.ksuid = (params) => inst.check(_ksuid(ZodKSUID, params));
    inst.ipv4 = (params) => inst.check(_ipv4(ZodIPv4, params));
    inst.ipv6 = (params) => inst.check(_ipv6(ZodIPv6, params));
    inst.cidrv4 = (params) => inst.check(_cidrv4(ZodCIDRv4, params));
    inst.cidrv6 = (params) => inst.check(_cidrv6(ZodCIDRv6, params));
    inst.e164 = (params) => inst.check(_e164(ZodE164, params));
    inst.datetime = (params) => inst.check(datetime2(params));
    inst.date = (params) => inst.check(date2(params));
    inst.time = (params) => inst.check(time2(params));
    inst.duration = (params) => inst.check(duration2(params));
  });
  ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    _ZodString.init(inst, def);
  });
  ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
    $ZodEmail.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
    $ZodGUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
    $ZodUUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
    $ZodURL.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
    $ZodEmoji.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
    $ZodNanoID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
    $ZodCUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
    $ZodCUID2.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
    $ZodULID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
    $ZodXID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
    $ZodKSUID.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
    $ZodIPv4.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
    $ZodIPv6.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
    $ZodCIDRv4.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
    $ZodCIDRv6.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
    $ZodBase64.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
    $ZodBase64URL.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
    $ZodE164.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
    $ZodJWT.init(inst, def);
    ZodStringFormat.init(inst, def);
  });
  ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
    $ZodNumber.init(inst, def);
    ZodType.init(inst, def);
    inst.gt = (value, params) => inst.check(_gt(value, params));
    inst.gte = (value, params) => inst.check(_gte(value, params));
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.lt = (value, params) => inst.check(_lt(value, params));
    inst.lte = (value, params) => inst.check(_lte(value, params));
    inst.max = (value, params) => inst.check(_lte(value, params));
    inst.int = (params) => inst.check(int(params));
    inst.safe = (params) => inst.check(int(params));
    inst.positive = (params) => inst.check(_gt(0, params));
    inst.nonnegative = (params) => inst.check(_gte(0, params));
    inst.negative = (params) => inst.check(_lt(0, params));
    inst.nonpositive = (params) => inst.check(_lte(0, params));
    inst.multipleOf = (value, params) => inst.check(_multipleOf(value, params));
    inst.step = (value, params) => inst.check(_multipleOf(value, params));
    inst.finite = () => inst;
    const bag = inst._zod.bag;
    inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
    inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
    inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
    inst.isFinite = true;
    inst.format = bag.format ?? null;
  });
  ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
    $ZodNumberFormat.init(inst, def);
    ZodNumber.init(inst, def);
  });
  ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
    $ZodBoolean.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodBigInt = /* @__PURE__ */ $constructor("ZodBigInt", (inst, def) => {
    $ZodBigInt.init(inst, def);
    ZodType.init(inst, def);
    inst.gte = (value, params) => inst.check(_gte(value, params));
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.gt = (value, params) => inst.check(_gt(value, params));
    inst.gte = (value, params) => inst.check(_gte(value, params));
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.lt = (value, params) => inst.check(_lt(value, params));
    inst.lte = (value, params) => inst.check(_lte(value, params));
    inst.max = (value, params) => inst.check(_lte(value, params));
    inst.positive = (params) => inst.check(_gt(BigInt(0), params));
    inst.negative = (params) => inst.check(_lt(BigInt(0), params));
    inst.nonpositive = (params) => inst.check(_lte(BigInt(0), params));
    inst.nonnegative = (params) => inst.check(_gte(BigInt(0), params));
    inst.multipleOf = (value, params) => inst.check(_multipleOf(value, params));
    const bag = inst._zod.bag;
    inst.minValue = bag.minimum ?? null;
    inst.maxValue = bag.maximum ?? null;
    inst.format = bag.format ?? null;
  });
  ZodNull = /* @__PURE__ */ $constructor("ZodNull", (inst, def) => {
    $ZodNull.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodAny = /* @__PURE__ */ $constructor("ZodAny", (inst, def) => {
    $ZodAny.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
    $ZodUnknown.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
    $ZodNever.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodDate = /* @__PURE__ */ $constructor("ZodDate", (inst, def) => {
    $ZodDate.init(inst, def);
    ZodType.init(inst, def);
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.max = (value, params) => inst.check(_lte(value, params));
    const c = inst._zod.bag;
    inst.minDate = c.minimum ? new Date(c.minimum) : null;
    inst.maxDate = c.maximum ? new Date(c.maximum) : null;
  });
  ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
    $ZodArray.init(inst, def);
    ZodType.init(inst, def);
    inst.element = def.element;
    inst.min = (minLength, params) => inst.check(_minLength(minLength, params));
    inst.nonempty = (params) => inst.check(_minLength(1, params));
    inst.max = (maxLength, params) => inst.check(_maxLength(maxLength, params));
    inst.length = (len, params) => inst.check(_length(len, params));
    inst.unwrap = () => inst.element;
  });
  ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
    $ZodObject.init(inst, def);
    ZodType.init(inst, def);
    exports_util.defineLazy(inst, "shape", () => def.shape);
    inst.keyof = () => _enum(Object.keys(inst._zod.def.shape));
    inst.catchall = (catchall) => inst.clone({ ...inst._zod.def, catchall });
    inst.passthrough = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.loose = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.strict = () => inst.clone({ ...inst._zod.def, catchall: never() });
    inst.strip = () => inst.clone({ ...inst._zod.def, catchall: undefined });
    inst.extend = (incoming) => {
      return exports_util.extend(inst, incoming);
    };
    inst.merge = (other) => exports_util.merge(inst, other);
    inst.pick = (mask) => exports_util.pick(inst, mask);
    inst.omit = (mask) => exports_util.omit(inst, mask);
    inst.partial = (...args) => exports_util.partial(ZodOptional, inst, args[0]);
    inst.required = (...args) => exports_util.required(ZodNonOptional, inst, args[0]);
  });
  ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    ZodType.init(inst, def);
    inst.options = def.options;
  });
  ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("ZodDiscriminatedUnion", (inst, def) => {
    ZodUnion.init(inst, def);
    $ZodDiscriminatedUnion.init(inst, def);
  });
  ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
    $ZodIntersection.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
    $ZodRecord.init(inst, def);
    ZodType.init(inst, def);
    inst.keyType = def.keyType;
    inst.valueType = def.valueType;
  });
  ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
    $ZodEnum.init(inst, def);
    ZodType.init(inst, def);
    inst.enum = def.entries;
    inst.options = Object.values(def.entries);
    const keys = new Set(Object.keys(def.entries));
    inst.extract = (values, params) => {
      const newEntries = {};
      for (const value of values) {
        if (keys.has(value)) {
          newEntries[value] = def.entries[value];
        } else
          throw new Error(`Key ${value} not found in enum`);
      }
      return new ZodEnum({
        ...def,
        checks: [],
        ...exports_util.normalizeParams(params),
        entries: newEntries
      });
    };
    inst.exclude = (values, params) => {
      const newEntries = { ...def.entries };
      for (const value of values) {
        if (keys.has(value)) {
          delete newEntries[value];
        } else
          throw new Error(`Key ${value} not found in enum`);
      }
      return new ZodEnum({
        ...def,
        checks: [],
        ...exports_util.normalizeParams(params),
        entries: newEntries
      });
    };
  });
  ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
    $ZodLiteral.init(inst, def);
    ZodType.init(inst, def);
    inst.values = new Set(def.values);
    Object.defineProperty(inst, "value", {
      get() {
        if (def.values.length > 1) {
          throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
        }
        return def.values[0];
      }
    });
  });
  ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
    $ZodTransform.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
      payload.addIssue = (issue2) => {
        if (typeof issue2 === "string") {
          payload.issues.push(exports_util.issue(issue2, payload.value, def));
        } else {
          const _issue = issue2;
          if (_issue.fatal)
            _issue.continue = false;
          _issue.code ?? (_issue.code = "custom");
          _issue.input ?? (_issue.input = payload.value);
          _issue.inst ?? (_issue.inst = inst);
          _issue.continue ?? (_issue.continue = true);
          payload.issues.push(exports_util.issue(_issue));
        }
      };
      const output = def.transform(payload.value, payload);
      if (output instanceof Promise) {
        return output.then((output2) => {
          payload.value = output2;
          return payload;
        });
      }
      payload.value = output;
      return payload;
    };
  });
  ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
    $ZodNullable.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
    $ZodDefault.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeDefault = inst.unwrap;
  });
  ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
    $ZodPrefault.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
    $ZodNonOptional.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
  });
  ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
    $ZodCatch.init(inst, def);
    ZodType.init(inst, def);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeCatch = inst.unwrap;
  });
  ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
    $ZodPipe.init(inst, def);
    ZodType.init(inst, def);
    inst.in = def.in;
    inst.out = def.out;
  });
  ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
    $ZodReadonly.init(inst, def);
    ZodType.init(inst, def);
  });
  ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
    $ZodCustom.init(inst, def);
    ZodType.init(inst, def);
  });
});

// node_modules/zod/v4/classic/compat.js
var ZodIssueCode;
var init_compat = __esm(() => {
  ZodIssueCode = {
    invalid_type: "invalid_type",
    too_big: "too_big",
    too_small: "too_small",
    invalid_format: "invalid_format",
    not_multiple_of: "not_multiple_of",
    unrecognized_keys: "unrecognized_keys",
    invalid_union: "invalid_union",
    invalid_key: "invalid_key",
    invalid_element: "invalid_element",
    invalid_value: "invalid_value",
    custom: "custom"
  };
});

// node_modules/zod/v4/classic/coerce.js
var exports_coerce2 = {};
__export(exports_coerce2, {
  string: () => string3,
  number: () => number3,
  date: () => date3,
  boolean: () => boolean3,
  bigint: () => bigint2
});
function string3(params) {
  return _coercedString(ZodString, params);
}
function number3(params) {
  return _coercedNumber(ZodNumber, params);
}
function boolean3(params) {
  return _coercedBoolean(ZodBoolean, params);
}
function bigint2(params) {
  return _coercedBigint(ZodBigInt, params);
}
function date3(params) {
  return _coercedDate(ZodDate, params);
}
var init_coerce2 = __esm(() => {
  init_core2();
  init_schemas3();
});

// node_modules/zod/v4/classic/external.js
var init_external2 = __esm(() => {
  init_core2();
  init_core2();
  init_en();
  init_core2();
  init_locales();
  init_iso2();
  init_coerce2();
  init_schemas3();
  init_checks3();
  init_errors2();
  init_parse3();
  init_compat();
  config(en_default());
});

// node_modules/zod/v4/classic/index.js
var init_classic = __esm(() => {
  init_external2();
});

// node_modules/zod/v4/index.js
var init_v4 = __esm(() => {
  init_classic();
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/types.js
var LATEST_PROTOCOL_VERSION = "2025-11-25", SUPPORTED_PROTOCOL_VERSIONS, RELATED_TASK_META_KEY = "io.modelcontextprotocol/related-task", JSONRPC_VERSION = "2.0", AssertObjectSchema, ProgressTokenSchema, CursorSchema, TaskCreationParamsSchema, TaskMetadataSchema, RelatedTaskMetadataSchema, RequestMetaSchema, BaseRequestParamsSchema, TaskAugmentedRequestParamsSchema, isTaskAugmentedRequestParams = (value) => TaskAugmentedRequestParamsSchema.safeParse(value).success, RequestSchema, NotificationsParamsSchema, NotificationSchema, ResultSchema, RequestIdSchema, JSONRPCRequestSchema, isJSONRPCRequest = (value) => JSONRPCRequestSchema.safeParse(value).success, JSONRPCNotificationSchema, isJSONRPCNotification = (value) => JSONRPCNotificationSchema.safeParse(value).success, JSONRPCResultResponseSchema, isJSONRPCResultResponse = (value) => JSONRPCResultResponseSchema.safeParse(value).success, ErrorCode, JSONRPCErrorResponseSchema, isJSONRPCErrorResponse = (value) => JSONRPCErrorResponseSchema.safeParse(value).success, JSONRPCMessageSchema, JSONRPCResponseSchema, EmptyResultSchema, CancelledNotificationParamsSchema, CancelledNotificationSchema, IconSchema, IconsSchema, BaseMetadataSchema, ImplementationSchema, FormElicitationCapabilitySchema, ElicitationCapabilitySchema, ClientTasksCapabilitySchema, ServerTasksCapabilitySchema, ClientCapabilitiesSchema, InitializeRequestParamsSchema, InitializeRequestSchema, ServerCapabilitiesSchema, InitializeResultSchema, InitializedNotificationSchema, isInitializedNotification = (value) => InitializedNotificationSchema.safeParse(value).success, PingRequestSchema, ProgressSchema, ProgressNotificationParamsSchema, ProgressNotificationSchema, PaginatedRequestParamsSchema, PaginatedRequestSchema, PaginatedResultSchema, TaskStatusSchema, TaskSchema, CreateTaskResultSchema, TaskStatusNotificationParamsSchema, TaskStatusNotificationSchema, GetTaskRequestSchema, GetTaskResultSchema, GetTaskPayloadRequestSchema, GetTaskPayloadResultSchema, ListTasksRequestSchema, ListTasksResultSchema, CancelTaskRequestSchema, CancelTaskResultSchema, ResourceContentsSchema, TextResourceContentsSchema, Base64Schema, BlobResourceContentsSchema, RoleSchema, AnnotationsSchema, ResourceSchema, ResourceTemplateSchema, ListResourcesRequestSchema, ListResourcesResultSchema, ListResourceTemplatesRequestSchema, ListResourceTemplatesResultSchema, ResourceRequestParamsSchema, ReadResourceRequestParamsSchema, ReadResourceRequestSchema, ReadResourceResultSchema, ResourceListChangedNotificationSchema, SubscribeRequestParamsSchema, SubscribeRequestSchema, UnsubscribeRequestParamsSchema, UnsubscribeRequestSchema, ResourceUpdatedNotificationParamsSchema, ResourceUpdatedNotificationSchema, PromptArgumentSchema, PromptSchema, ListPromptsRequestSchema, ListPromptsResultSchema, GetPromptRequestParamsSchema, GetPromptRequestSchema, TextContentSchema, ImageContentSchema, AudioContentSchema, ToolUseContentSchema, EmbeddedResourceSchema, ResourceLinkSchema, ContentBlockSchema, PromptMessageSchema, GetPromptResultSchema, PromptListChangedNotificationSchema, ToolAnnotationsSchema, ToolExecutionSchema, ToolSchema, ListToolsRequestSchema, ListToolsResultSchema2, CallToolResultSchema, CompatibilityCallToolResultSchema, CallToolRequestParamsSchema, CallToolRequestSchema, ToolListChangedNotificationSchema, ListChangedOptionsBaseSchema, LoggingLevelSchema, SetLevelRequestParamsSchema, SetLevelRequestSchema, LoggingMessageNotificationParamsSchema, LoggingMessageNotificationSchema, ModelHintSchema, ModelPreferencesSchema, ToolChoiceSchema, ToolResultContentSchema, SamplingContentSchema, SamplingMessageContentBlockSchema, SamplingMessageSchema, CreateMessageRequestParamsSchema, CreateMessageRequestSchema, CreateMessageResultSchema, CreateMessageResultWithToolsSchema, BooleanSchemaSchema, StringSchemaSchema, NumberSchemaSchema, UntitledSingleSelectEnumSchemaSchema, TitledSingleSelectEnumSchemaSchema, LegacyTitledEnumSchemaSchema, SingleSelectEnumSchemaSchema, UntitledMultiSelectEnumSchemaSchema, TitledMultiSelectEnumSchemaSchema, MultiSelectEnumSchemaSchema, EnumSchemaSchema, PrimitiveSchemaDefinitionSchema, ElicitRequestFormParamsSchema, ElicitRequestURLParamsSchema, ElicitRequestParamsSchema, ElicitRequestSchema, ElicitationCompleteNotificationParamsSchema, ElicitationCompleteNotificationSchema, ElicitResultSchema, ResourceTemplateReferenceSchema, PromptReferenceSchema, CompleteRequestParamsSchema, CompleteRequestSchema, CompleteResultSchema, RootSchema, ListRootsRequestSchema, ListRootsResultSchema, RootsListChangedNotificationSchema, ClientRequestSchema, ClientNotificationSchema, ClientResultSchema, ServerRequestSchema, ServerNotificationSchema, ServerResultSchema, McpError, UrlElicitationRequiredError;
var init_types = __esm(() => {
  init_v4();
  SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"];
  AssertObjectSchema = custom((v) => v !== null && (typeof v === "object" || typeof v === "function"));
  ProgressTokenSchema = union([string2(), number2().int()]);
  CursorSchema = string2();
  TaskCreationParamsSchema = looseObject({
    ttl: number2().optional(),
    pollInterval: number2().optional()
  });
  TaskMetadataSchema = object2({
    ttl: number2().optional()
  });
  RelatedTaskMetadataSchema = object2({
    taskId: string2()
  });
  RequestMetaSchema = looseObject({
    progressToken: ProgressTokenSchema.optional(),
    [RELATED_TASK_META_KEY]: RelatedTaskMetadataSchema.optional()
  });
  BaseRequestParamsSchema = object2({
    _meta: RequestMetaSchema.optional()
  });
  TaskAugmentedRequestParamsSchema = BaseRequestParamsSchema.extend({
    task: TaskMetadataSchema.optional()
  });
  RequestSchema = object2({
    method: string2(),
    params: BaseRequestParamsSchema.loose().optional()
  });
  NotificationsParamsSchema = object2({
    _meta: RequestMetaSchema.optional()
  });
  NotificationSchema = object2({
    method: string2(),
    params: NotificationsParamsSchema.loose().optional()
  });
  ResultSchema = looseObject({
    _meta: RequestMetaSchema.optional()
  });
  RequestIdSchema = union([string2(), number2().int()]);
  JSONRPCRequestSchema = object2({
    jsonrpc: literal(JSONRPC_VERSION),
    id: RequestIdSchema,
    ...RequestSchema.shape
  }).strict();
  JSONRPCNotificationSchema = object2({
    jsonrpc: literal(JSONRPC_VERSION),
    ...NotificationSchema.shape
  }).strict();
  JSONRPCResultResponseSchema = object2({
    jsonrpc: literal(JSONRPC_VERSION),
    id: RequestIdSchema,
    result: ResultSchema
  }).strict();
  (function(ErrorCode2) {
    ErrorCode2[ErrorCode2["ConnectionClosed"] = -32000] = "ConnectionClosed";
    ErrorCode2[ErrorCode2["RequestTimeout"] = -32001] = "RequestTimeout";
    ErrorCode2[ErrorCode2["ParseError"] = -32700] = "ParseError";
    ErrorCode2[ErrorCode2["InvalidRequest"] = -32600] = "InvalidRequest";
    ErrorCode2[ErrorCode2["MethodNotFound"] = -32601] = "MethodNotFound";
    ErrorCode2[ErrorCode2["InvalidParams"] = -32602] = "InvalidParams";
    ErrorCode2[ErrorCode2["InternalError"] = -32603] = "InternalError";
    ErrorCode2[ErrorCode2["UrlElicitationRequired"] = -32042] = "UrlElicitationRequired";
  })(ErrorCode || (ErrorCode = {}));
  JSONRPCErrorResponseSchema = object2({
    jsonrpc: literal(JSONRPC_VERSION),
    id: RequestIdSchema.optional(),
    error: object2({
      code: number2().int(),
      message: string2(),
      data: unknown().optional()
    })
  }).strict();
  JSONRPCMessageSchema = union([
    JSONRPCRequestSchema,
    JSONRPCNotificationSchema,
    JSONRPCResultResponseSchema,
    JSONRPCErrorResponseSchema
  ]);
  JSONRPCResponseSchema = union([JSONRPCResultResponseSchema, JSONRPCErrorResponseSchema]);
  EmptyResultSchema = ResultSchema.strict();
  CancelledNotificationParamsSchema = NotificationsParamsSchema.extend({
    requestId: RequestIdSchema.optional(),
    reason: string2().optional()
  });
  CancelledNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/cancelled"),
    params: CancelledNotificationParamsSchema
  });
  IconSchema = object2({
    src: string2(),
    mimeType: string2().optional(),
    sizes: array(string2()).optional(),
    theme: _enum(["light", "dark"]).optional()
  });
  IconsSchema = object2({
    icons: array(IconSchema).optional()
  });
  BaseMetadataSchema = object2({
    name: string2(),
    title: string2().optional()
  });
  ImplementationSchema = BaseMetadataSchema.extend({
    ...BaseMetadataSchema.shape,
    ...IconsSchema.shape,
    version: string2(),
    websiteUrl: string2().optional(),
    description: string2().optional()
  });
  FormElicitationCapabilitySchema = intersection(object2({
    applyDefaults: boolean2().optional()
  }), record(string2(), unknown()));
  ElicitationCapabilitySchema = preprocess((value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Object.keys(value).length === 0) {
        return { form: {} };
      }
    }
    return value;
  }, intersection(object2({
    form: FormElicitationCapabilitySchema.optional(),
    url: AssertObjectSchema.optional()
  }), record(string2(), unknown()).optional()));
  ClientTasksCapabilitySchema = looseObject({
    list: AssertObjectSchema.optional(),
    cancel: AssertObjectSchema.optional(),
    requests: looseObject({
      sampling: looseObject({
        createMessage: AssertObjectSchema.optional()
      }).optional(),
      elicitation: looseObject({
        create: AssertObjectSchema.optional()
      }).optional()
    }).optional()
  });
  ServerTasksCapabilitySchema = looseObject({
    list: AssertObjectSchema.optional(),
    cancel: AssertObjectSchema.optional(),
    requests: looseObject({
      tools: looseObject({
        call: AssertObjectSchema.optional()
      }).optional()
    }).optional()
  });
  ClientCapabilitiesSchema = object2({
    experimental: record(string2(), AssertObjectSchema).optional(),
    sampling: object2({
      context: AssertObjectSchema.optional(),
      tools: AssertObjectSchema.optional()
    }).optional(),
    elicitation: ElicitationCapabilitySchema.optional(),
    roots: object2({
      listChanged: boolean2().optional()
    }).optional(),
    tasks: ClientTasksCapabilitySchema.optional(),
    extensions: record(string2(), AssertObjectSchema).optional()
  });
  InitializeRequestParamsSchema = BaseRequestParamsSchema.extend({
    protocolVersion: string2(),
    capabilities: ClientCapabilitiesSchema,
    clientInfo: ImplementationSchema
  });
  InitializeRequestSchema = RequestSchema.extend({
    method: literal("initialize"),
    params: InitializeRequestParamsSchema
  });
  ServerCapabilitiesSchema = object2({
    experimental: record(string2(), AssertObjectSchema).optional(),
    logging: AssertObjectSchema.optional(),
    completions: AssertObjectSchema.optional(),
    prompts: object2({
      listChanged: boolean2().optional()
    }).optional(),
    resources: object2({
      subscribe: boolean2().optional(),
      listChanged: boolean2().optional()
    }).optional(),
    tools: object2({
      listChanged: boolean2().optional()
    }).optional(),
    tasks: ServerTasksCapabilitySchema.optional(),
    extensions: record(string2(), AssertObjectSchema).optional()
  });
  InitializeResultSchema = ResultSchema.extend({
    protocolVersion: string2(),
    capabilities: ServerCapabilitiesSchema,
    serverInfo: ImplementationSchema,
    instructions: string2().optional()
  });
  InitializedNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/initialized"),
    params: NotificationsParamsSchema.optional()
  });
  PingRequestSchema = RequestSchema.extend({
    method: literal("ping"),
    params: BaseRequestParamsSchema.optional()
  });
  ProgressSchema = object2({
    progress: number2(),
    total: optional(number2()),
    message: optional(string2())
  });
  ProgressNotificationParamsSchema = object2({
    ...NotificationsParamsSchema.shape,
    ...ProgressSchema.shape,
    progressToken: ProgressTokenSchema
  });
  ProgressNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/progress"),
    params: ProgressNotificationParamsSchema
  });
  PaginatedRequestParamsSchema = BaseRequestParamsSchema.extend({
    cursor: CursorSchema.optional()
  });
  PaginatedRequestSchema = RequestSchema.extend({
    params: PaginatedRequestParamsSchema.optional()
  });
  PaginatedResultSchema = ResultSchema.extend({
    nextCursor: CursorSchema.optional()
  });
  TaskStatusSchema = _enum(["working", "input_required", "completed", "failed", "cancelled"]);
  TaskSchema = object2({
    taskId: string2(),
    status: TaskStatusSchema,
    ttl: union([number2(), _null3()]),
    createdAt: string2(),
    lastUpdatedAt: string2(),
    pollInterval: optional(number2()),
    statusMessage: optional(string2())
  });
  CreateTaskResultSchema = ResultSchema.extend({
    task: TaskSchema
  });
  TaskStatusNotificationParamsSchema = NotificationsParamsSchema.merge(TaskSchema);
  TaskStatusNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/tasks/status"),
    params: TaskStatusNotificationParamsSchema
  });
  GetTaskRequestSchema = RequestSchema.extend({
    method: literal("tasks/get"),
    params: BaseRequestParamsSchema.extend({
      taskId: string2()
    })
  });
  GetTaskResultSchema = ResultSchema.merge(TaskSchema);
  GetTaskPayloadRequestSchema = RequestSchema.extend({
    method: literal("tasks/result"),
    params: BaseRequestParamsSchema.extend({
      taskId: string2()
    })
  });
  GetTaskPayloadResultSchema = ResultSchema.loose();
  ListTasksRequestSchema = PaginatedRequestSchema.extend({
    method: literal("tasks/list")
  });
  ListTasksResultSchema = PaginatedResultSchema.extend({
    tasks: array(TaskSchema)
  });
  CancelTaskRequestSchema = RequestSchema.extend({
    method: literal("tasks/cancel"),
    params: BaseRequestParamsSchema.extend({
      taskId: string2()
    })
  });
  CancelTaskResultSchema = ResultSchema.merge(TaskSchema);
  ResourceContentsSchema = object2({
    uri: string2(),
    mimeType: optional(string2()),
    _meta: record(string2(), unknown()).optional()
  });
  TextResourceContentsSchema = ResourceContentsSchema.extend({
    text: string2()
  });
  Base64Schema = string2().refine((val) => {
    try {
      atob(val);
      return true;
    } catch {
      return false;
    }
  }, { message: "Invalid Base64 string" });
  BlobResourceContentsSchema = ResourceContentsSchema.extend({
    blob: Base64Schema
  });
  RoleSchema = _enum(["user", "assistant"]);
  AnnotationsSchema = object2({
    audience: array(RoleSchema).optional(),
    priority: number2().min(0).max(1).optional(),
    lastModified: exports_iso2.datetime({ offset: true }).optional()
  });
  ResourceSchema = object2({
    ...BaseMetadataSchema.shape,
    ...IconsSchema.shape,
    uri: string2(),
    description: optional(string2()),
    mimeType: optional(string2()),
    size: optional(number2()),
    annotations: AnnotationsSchema.optional(),
    _meta: optional(looseObject({}))
  });
  ResourceTemplateSchema = object2({
    ...BaseMetadataSchema.shape,
    ...IconsSchema.shape,
    uriTemplate: string2(),
    description: optional(string2()),
    mimeType: optional(string2()),
    annotations: AnnotationsSchema.optional(),
    _meta: optional(looseObject({}))
  });
  ListResourcesRequestSchema = PaginatedRequestSchema.extend({
    method: literal("resources/list")
  });
  ListResourcesResultSchema = PaginatedResultSchema.extend({
    resources: array(ResourceSchema)
  });
  ListResourceTemplatesRequestSchema = PaginatedRequestSchema.extend({
    method: literal("resources/templates/list")
  });
  ListResourceTemplatesResultSchema = PaginatedResultSchema.extend({
    resourceTemplates: array(ResourceTemplateSchema)
  });
  ResourceRequestParamsSchema = BaseRequestParamsSchema.extend({
    uri: string2()
  });
  ReadResourceRequestParamsSchema = ResourceRequestParamsSchema;
  ReadResourceRequestSchema = RequestSchema.extend({
    method: literal("resources/read"),
    params: ReadResourceRequestParamsSchema
  });
  ReadResourceResultSchema = ResultSchema.extend({
    contents: array(union([TextResourceContentsSchema, BlobResourceContentsSchema]))
  });
  ResourceListChangedNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/resources/list_changed"),
    params: NotificationsParamsSchema.optional()
  });
  SubscribeRequestParamsSchema = ResourceRequestParamsSchema;
  SubscribeRequestSchema = RequestSchema.extend({
    method: literal("resources/subscribe"),
    params: SubscribeRequestParamsSchema
  });
  UnsubscribeRequestParamsSchema = ResourceRequestParamsSchema;
  UnsubscribeRequestSchema = RequestSchema.extend({
    method: literal("resources/unsubscribe"),
    params: UnsubscribeRequestParamsSchema
  });
  ResourceUpdatedNotificationParamsSchema = NotificationsParamsSchema.extend({
    uri: string2()
  });
  ResourceUpdatedNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/resources/updated"),
    params: ResourceUpdatedNotificationParamsSchema
  });
  PromptArgumentSchema = object2({
    name: string2(),
    description: optional(string2()),
    required: optional(boolean2())
  });
  PromptSchema = object2({
    ...BaseMetadataSchema.shape,
    ...IconsSchema.shape,
    description: optional(string2()),
    arguments: optional(array(PromptArgumentSchema)),
    _meta: optional(looseObject({}))
  });
  ListPromptsRequestSchema = PaginatedRequestSchema.extend({
    method: literal("prompts/list")
  });
  ListPromptsResultSchema = PaginatedResultSchema.extend({
    prompts: array(PromptSchema)
  });
  GetPromptRequestParamsSchema = BaseRequestParamsSchema.extend({
    name: string2(),
    arguments: record(string2(), string2()).optional()
  });
  GetPromptRequestSchema = RequestSchema.extend({
    method: literal("prompts/get"),
    params: GetPromptRequestParamsSchema
  });
  TextContentSchema = object2({
    type: literal("text"),
    text: string2(),
    annotations: AnnotationsSchema.optional(),
    _meta: record(string2(), unknown()).optional()
  });
  ImageContentSchema = object2({
    type: literal("image"),
    data: Base64Schema,
    mimeType: string2(),
    annotations: AnnotationsSchema.optional(),
    _meta: record(string2(), unknown()).optional()
  });
  AudioContentSchema = object2({
    type: literal("audio"),
    data: Base64Schema,
    mimeType: string2(),
    annotations: AnnotationsSchema.optional(),
    _meta: record(string2(), unknown()).optional()
  });
  ToolUseContentSchema = object2({
    type: literal("tool_use"),
    name: string2(),
    id: string2(),
    input: record(string2(), unknown()),
    _meta: record(string2(), unknown()).optional()
  });
  EmbeddedResourceSchema = object2({
    type: literal("resource"),
    resource: union([TextResourceContentsSchema, BlobResourceContentsSchema]),
    annotations: AnnotationsSchema.optional(),
    _meta: record(string2(), unknown()).optional()
  });
  ResourceLinkSchema = ResourceSchema.extend({
    type: literal("resource_link")
  });
  ContentBlockSchema = union([
    TextContentSchema,
    ImageContentSchema,
    AudioContentSchema,
    ResourceLinkSchema,
    EmbeddedResourceSchema
  ]);
  PromptMessageSchema = object2({
    role: RoleSchema,
    content: ContentBlockSchema
  });
  GetPromptResultSchema = ResultSchema.extend({
    description: string2().optional(),
    messages: array(PromptMessageSchema)
  });
  PromptListChangedNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/prompts/list_changed"),
    params: NotificationsParamsSchema.optional()
  });
  ToolAnnotationsSchema = object2({
    title: string2().optional(),
    readOnlyHint: boolean2().optional(),
    destructiveHint: boolean2().optional(),
    idempotentHint: boolean2().optional(),
    openWorldHint: boolean2().optional()
  });
  ToolExecutionSchema = object2({
    taskSupport: _enum(["required", "optional", "forbidden"]).optional()
  });
  ToolSchema = object2({
    ...BaseMetadataSchema.shape,
    ...IconsSchema.shape,
    description: string2().optional(),
    inputSchema: object2({
      type: literal("object"),
      properties: record(string2(), AssertObjectSchema).optional(),
      required: array(string2()).optional()
    }).catchall(unknown()),
    outputSchema: object2({
      type: literal("object"),
      properties: record(string2(), AssertObjectSchema).optional(),
      required: array(string2()).optional()
    }).catchall(unknown()).optional(),
    annotations: ToolAnnotationsSchema.optional(),
    execution: ToolExecutionSchema.optional(),
    _meta: record(string2(), unknown()).optional()
  });
  ListToolsRequestSchema = PaginatedRequestSchema.extend({
    method: literal("tools/list")
  });
  ListToolsResultSchema2 = PaginatedResultSchema.extend({
    tools: array(ToolSchema)
  });
  CallToolResultSchema = ResultSchema.extend({
    content: array(ContentBlockSchema).default([]),
    structuredContent: record(string2(), unknown()).optional(),
    isError: boolean2().optional()
  });
  CompatibilityCallToolResultSchema = CallToolResultSchema.or(ResultSchema.extend({
    toolResult: unknown()
  }));
  CallToolRequestParamsSchema = TaskAugmentedRequestParamsSchema.extend({
    name: string2(),
    arguments: record(string2(), unknown()).optional()
  });
  CallToolRequestSchema = RequestSchema.extend({
    method: literal("tools/call"),
    params: CallToolRequestParamsSchema
  });
  ToolListChangedNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/tools/list_changed"),
    params: NotificationsParamsSchema.optional()
  });
  ListChangedOptionsBaseSchema = object2({
    autoRefresh: boolean2().default(true),
    debounceMs: number2().int().nonnegative().default(300)
  });
  LoggingLevelSchema = _enum(["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"]);
  SetLevelRequestParamsSchema = BaseRequestParamsSchema.extend({
    level: LoggingLevelSchema
  });
  SetLevelRequestSchema = RequestSchema.extend({
    method: literal("logging/setLevel"),
    params: SetLevelRequestParamsSchema
  });
  LoggingMessageNotificationParamsSchema = NotificationsParamsSchema.extend({
    level: LoggingLevelSchema,
    logger: string2().optional(),
    data: unknown()
  });
  LoggingMessageNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/message"),
    params: LoggingMessageNotificationParamsSchema
  });
  ModelHintSchema = object2({
    name: string2().optional()
  });
  ModelPreferencesSchema = object2({
    hints: array(ModelHintSchema).optional(),
    costPriority: number2().min(0).max(1).optional(),
    speedPriority: number2().min(0).max(1).optional(),
    intelligencePriority: number2().min(0).max(1).optional()
  });
  ToolChoiceSchema = object2({
    mode: _enum(["auto", "required", "none"]).optional()
  });
  ToolResultContentSchema = object2({
    type: literal("tool_result"),
    toolUseId: string2().describe("The unique identifier for the corresponding tool call."),
    content: array(ContentBlockSchema).default([]),
    structuredContent: object2({}).loose().optional(),
    isError: boolean2().optional(),
    _meta: record(string2(), unknown()).optional()
  });
  SamplingContentSchema = discriminatedUnion("type", [TextContentSchema, ImageContentSchema, AudioContentSchema]);
  SamplingMessageContentBlockSchema = discriminatedUnion("type", [
    TextContentSchema,
    ImageContentSchema,
    AudioContentSchema,
    ToolUseContentSchema,
    ToolResultContentSchema
  ]);
  SamplingMessageSchema = object2({
    role: RoleSchema,
    content: union([SamplingMessageContentBlockSchema, array(SamplingMessageContentBlockSchema)]),
    _meta: record(string2(), unknown()).optional()
  });
  CreateMessageRequestParamsSchema = TaskAugmentedRequestParamsSchema.extend({
    messages: array(SamplingMessageSchema),
    modelPreferences: ModelPreferencesSchema.optional(),
    systemPrompt: string2().optional(),
    includeContext: _enum(["none", "thisServer", "allServers"]).optional(),
    temperature: number2().optional(),
    maxTokens: number2().int(),
    stopSequences: array(string2()).optional(),
    metadata: AssertObjectSchema.optional(),
    tools: array(ToolSchema).optional(),
    toolChoice: ToolChoiceSchema.optional()
  });
  CreateMessageRequestSchema = RequestSchema.extend({
    method: literal("sampling/createMessage"),
    params: CreateMessageRequestParamsSchema
  });
  CreateMessageResultSchema = ResultSchema.extend({
    model: string2(),
    stopReason: optional(_enum(["endTurn", "stopSequence", "maxTokens"]).or(string2())),
    role: RoleSchema,
    content: SamplingContentSchema
  });
  CreateMessageResultWithToolsSchema = ResultSchema.extend({
    model: string2(),
    stopReason: optional(_enum(["endTurn", "stopSequence", "maxTokens", "toolUse"]).or(string2())),
    role: RoleSchema,
    content: union([SamplingMessageContentBlockSchema, array(SamplingMessageContentBlockSchema)])
  });
  BooleanSchemaSchema = object2({
    type: literal("boolean"),
    title: string2().optional(),
    description: string2().optional(),
    default: boolean2().optional()
  });
  StringSchemaSchema = object2({
    type: literal("string"),
    title: string2().optional(),
    description: string2().optional(),
    minLength: number2().optional(),
    maxLength: number2().optional(),
    format: _enum(["email", "uri", "date", "date-time"]).optional(),
    default: string2().optional()
  });
  NumberSchemaSchema = object2({
    type: _enum(["number", "integer"]),
    title: string2().optional(),
    description: string2().optional(),
    minimum: number2().optional(),
    maximum: number2().optional(),
    default: number2().optional()
  });
  UntitledSingleSelectEnumSchemaSchema = object2({
    type: literal("string"),
    title: string2().optional(),
    description: string2().optional(),
    enum: array(string2()),
    default: string2().optional()
  });
  TitledSingleSelectEnumSchemaSchema = object2({
    type: literal("string"),
    title: string2().optional(),
    description: string2().optional(),
    oneOf: array(object2({
      const: string2(),
      title: string2()
    })),
    default: string2().optional()
  });
  LegacyTitledEnumSchemaSchema = object2({
    type: literal("string"),
    title: string2().optional(),
    description: string2().optional(),
    enum: array(string2()),
    enumNames: array(string2()).optional(),
    default: string2().optional()
  });
  SingleSelectEnumSchemaSchema = union([UntitledSingleSelectEnumSchemaSchema, TitledSingleSelectEnumSchemaSchema]);
  UntitledMultiSelectEnumSchemaSchema = object2({
    type: literal("array"),
    title: string2().optional(),
    description: string2().optional(),
    minItems: number2().optional(),
    maxItems: number2().optional(),
    items: object2({
      type: literal("string"),
      enum: array(string2())
    }),
    default: array(string2()).optional()
  });
  TitledMultiSelectEnumSchemaSchema = object2({
    type: literal("array"),
    title: string2().optional(),
    description: string2().optional(),
    minItems: number2().optional(),
    maxItems: number2().optional(),
    items: object2({
      anyOf: array(object2({
        const: string2(),
        title: string2()
      }))
    }),
    default: array(string2()).optional()
  });
  MultiSelectEnumSchemaSchema = union([UntitledMultiSelectEnumSchemaSchema, TitledMultiSelectEnumSchemaSchema]);
  EnumSchemaSchema = union([LegacyTitledEnumSchemaSchema, SingleSelectEnumSchemaSchema, MultiSelectEnumSchemaSchema]);
  PrimitiveSchemaDefinitionSchema = union([EnumSchemaSchema, BooleanSchemaSchema, StringSchemaSchema, NumberSchemaSchema]);
  ElicitRequestFormParamsSchema = TaskAugmentedRequestParamsSchema.extend({
    mode: literal("form").optional(),
    message: string2(),
    requestedSchema: object2({
      type: literal("object"),
      properties: record(string2(), PrimitiveSchemaDefinitionSchema),
      required: array(string2()).optional()
    })
  });
  ElicitRequestURLParamsSchema = TaskAugmentedRequestParamsSchema.extend({
    mode: literal("url"),
    message: string2(),
    elicitationId: string2(),
    url: string2().url()
  });
  ElicitRequestParamsSchema = union([ElicitRequestFormParamsSchema, ElicitRequestURLParamsSchema]);
  ElicitRequestSchema = RequestSchema.extend({
    method: literal("elicitation/create"),
    params: ElicitRequestParamsSchema
  });
  ElicitationCompleteNotificationParamsSchema = NotificationsParamsSchema.extend({
    elicitationId: string2()
  });
  ElicitationCompleteNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/elicitation/complete"),
    params: ElicitationCompleteNotificationParamsSchema
  });
  ElicitResultSchema = ResultSchema.extend({
    action: _enum(["accept", "decline", "cancel"]),
    content: preprocess((val) => val === null ? undefined : val, record(string2(), union([string2(), number2(), boolean2(), array(string2())])).optional())
  });
  ResourceTemplateReferenceSchema = object2({
    type: literal("ref/resource"),
    uri: string2()
  });
  PromptReferenceSchema = object2({
    type: literal("ref/prompt"),
    name: string2()
  });
  CompleteRequestParamsSchema = BaseRequestParamsSchema.extend({
    ref: union([PromptReferenceSchema, ResourceTemplateReferenceSchema]),
    argument: object2({
      name: string2(),
      value: string2()
    }),
    context: object2({
      arguments: record(string2(), string2()).optional()
    }).optional()
  });
  CompleteRequestSchema = RequestSchema.extend({
    method: literal("completion/complete"),
    params: CompleteRequestParamsSchema
  });
  CompleteResultSchema = ResultSchema.extend({
    completion: looseObject({
      values: array(string2()).max(100),
      total: optional(number2().int()),
      hasMore: optional(boolean2())
    })
  });
  RootSchema = object2({
    uri: string2().startsWith("file://"),
    name: string2().optional(),
    _meta: record(string2(), unknown()).optional()
  });
  ListRootsRequestSchema = RequestSchema.extend({
    method: literal("roots/list"),
    params: BaseRequestParamsSchema.optional()
  });
  ListRootsResultSchema = ResultSchema.extend({
    roots: array(RootSchema)
  });
  RootsListChangedNotificationSchema = NotificationSchema.extend({
    method: literal("notifications/roots/list_changed"),
    params: NotificationsParamsSchema.optional()
  });
  ClientRequestSchema = union([
    PingRequestSchema,
    InitializeRequestSchema,
    CompleteRequestSchema,
    SetLevelRequestSchema,
    GetPromptRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ReadResourceRequestSchema,
    SubscribeRequestSchema,
    UnsubscribeRequestSchema,
    CallToolRequestSchema,
    ListToolsRequestSchema,
    GetTaskRequestSchema,
    GetTaskPayloadRequestSchema,
    ListTasksRequestSchema,
    CancelTaskRequestSchema
  ]);
  ClientNotificationSchema = union([
    CancelledNotificationSchema,
    ProgressNotificationSchema,
    InitializedNotificationSchema,
    RootsListChangedNotificationSchema,
    TaskStatusNotificationSchema
  ]);
  ClientResultSchema = union([
    EmptyResultSchema,
    CreateMessageResultSchema,
    CreateMessageResultWithToolsSchema,
    ElicitResultSchema,
    ListRootsResultSchema,
    GetTaskResultSchema,
    ListTasksResultSchema,
    CreateTaskResultSchema
  ]);
  ServerRequestSchema = union([
    PingRequestSchema,
    CreateMessageRequestSchema,
    ElicitRequestSchema,
    ListRootsRequestSchema,
    GetTaskRequestSchema,
    GetTaskPayloadRequestSchema,
    ListTasksRequestSchema,
    CancelTaskRequestSchema
  ]);
  ServerNotificationSchema = union([
    CancelledNotificationSchema,
    ProgressNotificationSchema,
    LoggingMessageNotificationSchema,
    ResourceUpdatedNotificationSchema,
    ResourceListChangedNotificationSchema,
    ToolListChangedNotificationSchema,
    PromptListChangedNotificationSchema,
    TaskStatusNotificationSchema,
    ElicitationCompleteNotificationSchema
  ]);
  ServerResultSchema = union([
    EmptyResultSchema,
    InitializeResultSchema,
    CompleteResultSchema,
    GetPromptResultSchema,
    ListPromptsResultSchema,
    ListResourcesResultSchema,
    ListResourceTemplatesResultSchema,
    ReadResourceResultSchema,
    CallToolResultSchema,
    ListToolsResultSchema2,
    GetTaskResultSchema,
    ListTasksResultSchema,
    CreateTaskResultSchema
  ]);
  McpError = class McpError extends Error {
    constructor(code, message, data) {
      super(`MCP error ${code}: ${message}`);
      this.code = code;
      this.data = data;
      this.name = "McpError";
    }
    static fromError(code, message, data) {
      if (code === ErrorCode.UrlElicitationRequired && data) {
        const errorData = data;
        if (errorData.elicitations) {
          return new UrlElicitationRequiredError(errorData.elicitations, message);
        }
      }
      return new McpError(code, message, data);
    }
  };
  UrlElicitationRequiredError = class UrlElicitationRequiredError extends McpError {
    constructor(elicitations, message = `URL elicitation${elicitations.length > 1 ? "s" : ""} required`) {
      super(ErrorCode.UrlElicitationRequired, message, {
        elicitations
      });
    }
    get elicitations() {
      return this.data?.elicitations ?? [];
    }
  };
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/experimental/tasks/interfaces.js
function isTerminal(status) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

// node_modules/zod-to-json-schema/dist/esm/Options.js
var ignoreOverride;
var init_Options = __esm(() => {
  ignoreOverride = Symbol("Let zodToJsonSchema decide on which parser to use");
});

// node_modules/zod-to-json-schema/dist/esm/Refs.js
var init_Refs = __esm(() => {
  init_Options();
});
// node_modules/zod-to-json-schema/dist/esm/parsers/any.js
var init_any = () => {};

// node_modules/zod-to-json-schema/dist/esm/parsers/array.js
var init_array = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/bigint.js
var init_bigint = () => {};
// node_modules/zod-to-json-schema/dist/esm/parsers/branded.js
var init_branded = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/catch.js
var init_catch = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/date.js
var init_date = () => {};

// node_modules/zod-to-json-schema/dist/esm/parsers/default.js
var init_default = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/effects.js
var init_effects = __esm(() => {
  init_parseDef();
  init_any();
});
// node_modules/zod-to-json-schema/dist/esm/parsers/intersection.js
var init_intersection = __esm(() => {
  init_parseDef();
});
// node_modules/zod-to-json-schema/dist/esm/parsers/string.js
var ALPHA_NUMERIC;
var init_string = __esm(() => {
  ALPHA_NUMERIC = new Set("ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvxyz0123456789");
});

// node_modules/zod-to-json-schema/dist/esm/parsers/record.js
var init_record = __esm(() => {
  init_parseDef();
  init_string();
  init_branded();
  init_any();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/map.js
var init_map = __esm(() => {
  init_parseDef();
  init_record();
  init_any();
});
// node_modules/zod-to-json-schema/dist/esm/parsers/never.js
var init_never = __esm(() => {
  init_any();
});
// node_modules/zod-to-json-schema/dist/esm/parsers/union.js
var init_union = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/nullable.js
var init_nullable = __esm(() => {
  init_parseDef();
  init_union();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/number.js
var init_number = () => {};

// node_modules/zod-to-json-schema/dist/esm/parsers/object.js
var init_object = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/optional.js
var init_optional = __esm(() => {
  init_parseDef();
  init_any();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/pipeline.js
var init_pipeline = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/promise.js
var init_promise = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/set.js
var init_set = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/tuple.js
var init_tuple = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/undefined.js
var init_undefined = __esm(() => {
  init_any();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/unknown.js
var init_unknown = __esm(() => {
  init_any();
});

// node_modules/zod-to-json-schema/dist/esm/parsers/readonly.js
var init_readonly = __esm(() => {
  init_parseDef();
});

// node_modules/zod-to-json-schema/dist/esm/selectParser.js
var init_selectParser = __esm(() => {
  init_any();
  init_array();
  init_bigint();
  init_branded();
  init_catch();
  init_date();
  init_default();
  init_effects();
  init_intersection();
  init_map();
  init_never();
  init_nullable();
  init_number();
  init_object();
  init_optional();
  init_pipeline();
  init_promise();
  init_record();
  init_set();
  init_string();
  init_tuple();
  init_undefined();
  init_union();
  init_unknown();
  init_readonly();
});

// node_modules/zod-to-json-schema/dist/esm/parseDef.js
var init_parseDef = __esm(() => {
  init_Options();
  init_selectParser();
  init_any();
});

// node_modules/zod-to-json-schema/dist/esm/parseTypes.js
var init_parseTypes = () => {};

// node_modules/zod-to-json-schema/dist/esm/zodToJsonSchema.js
var init_zodToJsonSchema = __esm(() => {
  init_parseDef();
  init_Refs();
  init_any();
});

// node_modules/zod-to-json-schema/dist/esm/index.js
var init_esm = __esm(() => {
  init_zodToJsonSchema();
  init_Options();
  init_Refs();
  init_parseDef();
  init_parseTypes();
  init_any();
  init_array();
  init_bigint();
  init_branded();
  init_catch();
  init_date();
  init_default();
  init_effects();
  init_intersection();
  init_map();
  init_never();
  init_nullable();
  init_number();
  init_object();
  init_optional();
  init_pipeline();
  init_promise();
  init_readonly();
  init_record();
  init_set();
  init_string();
  init_tuple();
  init_undefined();
  init_union();
  init_unknown();
  init_selectParser();
  init_zodToJsonSchema();
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/zod-json-schema-compat.js
function getMethodLiteral(schema) {
  const shape = getObjectShape(schema);
  const methodSchema = shape?.method;
  if (!methodSchema) {
    throw new Error("Schema is missing a method literal");
  }
  const value = getLiteralValue(methodSchema);
  if (typeof value !== "string") {
    throw new Error("Schema method literal must be a string");
  }
  return value;
}
function parseWithCompat(schema, data) {
  const result = safeParse2(schema, data);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
var init_zod_json_schema_compat = __esm(() => {
  init_zod_compat();
  init_esm();
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js
class Protocol {
  constructor(_options) {
    this._options = _options;
    this._requestMessageId = 0;
    this._requestHandlers = new Map;
    this._requestHandlerAbortControllers = new Map;
    this._notificationHandlers = new Map;
    this._responseHandlers = new Map;
    this._progressHandlers = new Map;
    this._timeoutInfo = new Map;
    this._pendingDebouncedNotifications = new Set;
    this._taskProgressTokens = new Map;
    this._requestResolvers = new Map;
    this.setNotificationHandler(CancelledNotificationSchema, (notification) => {
      this._oncancel(notification);
    });
    this.setNotificationHandler(ProgressNotificationSchema, (notification) => {
      this._onprogress(notification);
    });
    this.setRequestHandler(PingRequestSchema, (_request) => ({}));
    this._taskStore = _options?.taskStore;
    this._taskMessageQueue = _options?.taskMessageQueue;
    if (this._taskStore) {
      this.setRequestHandler(GetTaskRequestSchema, async (request, extra) => {
        const task = await this._taskStore.getTask(request.params.taskId, extra.sessionId);
        if (!task) {
          throw new McpError(ErrorCode.InvalidParams, "Failed to retrieve task: Task not found");
        }
        return {
          ...task
        };
      });
      this.setRequestHandler(GetTaskPayloadRequestSchema, async (request, extra) => {
        const handleTaskResult = async () => {
          const taskId = request.params.taskId;
          if (this._taskMessageQueue) {
            let queuedMessage;
            while (queuedMessage = await this._taskMessageQueue.dequeue(taskId, extra.sessionId)) {
              if (queuedMessage.type === "response" || queuedMessage.type === "error") {
                const message = queuedMessage.message;
                const requestId = message.id;
                const resolver = this._requestResolvers.get(requestId);
                if (resolver) {
                  this._requestResolvers.delete(requestId);
                  if (queuedMessage.type === "response") {
                    resolver(message);
                  } else {
                    const errorMessage = message;
                    const error2 = new McpError(errorMessage.error.code, errorMessage.error.message, errorMessage.error.data);
                    resolver(error2);
                  }
                } else {
                  const messageType = queuedMessage.type === "response" ? "Response" : "Error";
                  this._onerror(new Error(`${messageType} handler missing for request ${requestId}`));
                }
                continue;
              }
              await this._transport?.send(queuedMessage.message, { relatedRequestId: extra.requestId });
            }
          }
          const task = await this._taskStore.getTask(taskId, extra.sessionId);
          if (!task) {
            throw new McpError(ErrorCode.InvalidParams, `Task not found: ${taskId}`);
          }
          if (!isTerminal(task.status)) {
            await this._waitForTaskUpdate(taskId, extra.signal);
            return await handleTaskResult();
          }
          if (isTerminal(task.status)) {
            const result = await this._taskStore.getTaskResult(taskId, extra.sessionId);
            this._clearTaskQueue(taskId);
            return {
              ...result,
              _meta: {
                ...result._meta,
                [RELATED_TASK_META_KEY]: {
                  taskId
                }
              }
            };
          }
          return await handleTaskResult();
        };
        return await handleTaskResult();
      });
      this.setRequestHandler(ListTasksRequestSchema, async (request, extra) => {
        try {
          const { tasks, nextCursor } = await this._taskStore.listTasks(request.params?.cursor, extra.sessionId);
          return {
            tasks,
            nextCursor,
            _meta: {}
          };
        } catch (error2) {
          throw new McpError(ErrorCode.InvalidParams, `Failed to list tasks: ${error2 instanceof Error ? error2.message : String(error2)}`);
        }
      });
      this.setRequestHandler(CancelTaskRequestSchema, async (request, extra) => {
        try {
          const task = await this._taskStore.getTask(request.params.taskId, extra.sessionId);
          if (!task) {
            throw new McpError(ErrorCode.InvalidParams, `Task not found: ${request.params.taskId}`);
          }
          if (isTerminal(task.status)) {
            throw new McpError(ErrorCode.InvalidParams, `Cannot cancel task in terminal status: ${task.status}`);
          }
          await this._taskStore.updateTaskStatus(request.params.taskId, "cancelled", "Client cancelled task execution.", extra.sessionId);
          this._clearTaskQueue(request.params.taskId);
          const cancelledTask = await this._taskStore.getTask(request.params.taskId, extra.sessionId);
          if (!cancelledTask) {
            throw new McpError(ErrorCode.InvalidParams, `Task not found after cancellation: ${request.params.taskId}`);
          }
          return {
            _meta: {},
            ...cancelledTask
          };
        } catch (error2) {
          if (error2 instanceof McpError) {
            throw error2;
          }
          throw new McpError(ErrorCode.InvalidRequest, `Failed to cancel task: ${error2 instanceof Error ? error2.message : String(error2)}`);
        }
      });
    }
  }
  async _oncancel(notification) {
    if (!notification.params.requestId) {
      return;
    }
    const controller = this._requestHandlerAbortControllers.get(notification.params.requestId);
    controller?.abort(notification.params.reason);
  }
  _setupTimeout(messageId, timeout, maxTotalTimeout, onTimeout, resetTimeoutOnProgress = false) {
    this._timeoutInfo.set(messageId, {
      timeoutId: setTimeout(onTimeout, timeout),
      startTime: Date.now(),
      timeout,
      maxTotalTimeout,
      resetTimeoutOnProgress,
      onTimeout
    });
  }
  _resetTimeout(messageId) {
    const info = this._timeoutInfo.get(messageId);
    if (!info)
      return false;
    const totalElapsed = Date.now() - info.startTime;
    if (info.maxTotalTimeout && totalElapsed >= info.maxTotalTimeout) {
      this._timeoutInfo.delete(messageId);
      throw McpError.fromError(ErrorCode.RequestTimeout, "Maximum total timeout exceeded", {
        maxTotalTimeout: info.maxTotalTimeout,
        totalElapsed
      });
    }
    clearTimeout(info.timeoutId);
    info.timeoutId = setTimeout(info.onTimeout, info.timeout);
    return true;
  }
  _cleanupTimeout(messageId) {
    const info = this._timeoutInfo.get(messageId);
    if (info) {
      clearTimeout(info.timeoutId);
      this._timeoutInfo.delete(messageId);
    }
  }
  async connect(transport) {
    if (this._transport) {
      throw new Error("Already connected to a transport. Call close() before connecting to a new transport, or use a separate Protocol instance per connection.");
    }
    this._transport = transport;
    const _onclose = this.transport?.onclose;
    this._transport.onclose = () => {
      _onclose?.();
      this._onclose();
    };
    const _onerror = this.transport?.onerror;
    this._transport.onerror = (error2) => {
      _onerror?.(error2);
      this._onerror(error2);
    };
    const _onmessage = this._transport?.onmessage;
    this._transport.onmessage = (message, extra) => {
      _onmessage?.(message, extra);
      if (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) {
        this._onresponse(message);
      } else if (isJSONRPCRequest(message)) {
        this._onrequest(message, extra);
      } else if (isJSONRPCNotification(message)) {
        this._onnotification(message);
      } else {
        this._onerror(new Error(`Unknown message type: ${JSON.stringify(message)}`));
      }
    };
    await this._transport.start();
  }
  _onclose() {
    const responseHandlers = this._responseHandlers;
    this._responseHandlers = new Map;
    this._progressHandlers.clear();
    this._taskProgressTokens.clear();
    this._pendingDebouncedNotifications.clear();
    for (const info of this._timeoutInfo.values()) {
      clearTimeout(info.timeoutId);
    }
    this._timeoutInfo.clear();
    for (const controller of this._requestHandlerAbortControllers.values()) {
      controller.abort();
    }
    this._requestHandlerAbortControllers.clear();
    const error2 = McpError.fromError(ErrorCode.ConnectionClosed, "Connection closed");
    this._transport = undefined;
    this.onclose?.();
    for (const handler of responseHandlers.values()) {
      handler(error2);
    }
  }
  _onerror(error2) {
    this.onerror?.(error2);
  }
  _onnotification(notification) {
    const handler = this._notificationHandlers.get(notification.method) ?? this.fallbackNotificationHandler;
    if (handler === undefined) {
      return;
    }
    Promise.resolve().then(() => handler(notification)).catch((error2) => this._onerror(new Error(`Uncaught error in notification handler: ${error2}`)));
  }
  _onrequest(request, extra) {
    const handler = this._requestHandlers.get(request.method) ?? this.fallbackRequestHandler;
    const capturedTransport = this._transport;
    const relatedTaskId = request.params?._meta?.[RELATED_TASK_META_KEY]?.taskId;
    if (handler === undefined) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: ErrorCode.MethodNotFound,
          message: "Method not found"
        }
      };
      if (relatedTaskId && this._taskMessageQueue) {
        this._enqueueTaskMessage(relatedTaskId, {
          type: "error",
          message: errorResponse,
          timestamp: Date.now()
        }, capturedTransport?.sessionId).catch((error2) => this._onerror(new Error(`Failed to enqueue error response: ${error2}`)));
      } else {
        capturedTransport?.send(errorResponse).catch((error2) => this._onerror(new Error(`Failed to send an error response: ${error2}`)));
      }
      return;
    }
    const abortController = new AbortController;
    this._requestHandlerAbortControllers.set(request.id, abortController);
    const taskCreationParams = isTaskAugmentedRequestParams(request.params) ? request.params.task : undefined;
    const taskStore = this._taskStore ? this.requestTaskStore(request, capturedTransport?.sessionId) : undefined;
    const fullExtra = {
      signal: abortController.signal,
      sessionId: capturedTransport?.sessionId,
      _meta: request.params?._meta,
      sendNotification: async (notification) => {
        if (abortController.signal.aborted)
          return;
        const notificationOptions = { relatedRequestId: request.id };
        if (relatedTaskId) {
          notificationOptions.relatedTask = { taskId: relatedTaskId };
        }
        await this.notification(notification, notificationOptions);
      },
      sendRequest: async (r, resultSchema, options) => {
        if (abortController.signal.aborted) {
          throw new McpError(ErrorCode.ConnectionClosed, "Request was cancelled");
        }
        const requestOptions = { ...options, relatedRequestId: request.id };
        if (relatedTaskId && !requestOptions.relatedTask) {
          requestOptions.relatedTask = { taskId: relatedTaskId };
        }
        const effectiveTaskId = requestOptions.relatedTask?.taskId ?? relatedTaskId;
        if (effectiveTaskId && taskStore) {
          await taskStore.updateTaskStatus(effectiveTaskId, "input_required");
        }
        return await this.request(r, resultSchema, requestOptions);
      },
      authInfo: extra?.authInfo,
      requestId: request.id,
      requestInfo: extra?.requestInfo,
      taskId: relatedTaskId,
      taskStore,
      taskRequestedTtl: taskCreationParams?.ttl,
      closeSSEStream: extra?.closeSSEStream,
      closeStandaloneSSEStream: extra?.closeStandaloneSSEStream
    };
    Promise.resolve().then(() => {
      if (taskCreationParams) {
        this.assertTaskHandlerCapability(request.method);
      }
    }).then(() => handler(request, fullExtra)).then(async (result) => {
      if (abortController.signal.aborted) {
        return;
      }
      const response = {
        result,
        jsonrpc: "2.0",
        id: request.id
      };
      if (relatedTaskId && this._taskMessageQueue) {
        await this._enqueueTaskMessage(relatedTaskId, {
          type: "response",
          message: response,
          timestamp: Date.now()
        }, capturedTransport?.sessionId);
      } else {
        await capturedTransport?.send(response);
      }
    }, async (error2) => {
      if (abortController.signal.aborted) {
        return;
      }
      const errorResponse = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: Number.isSafeInteger(error2["code"]) ? error2["code"] : ErrorCode.InternalError,
          message: error2.message ?? "Internal error",
          ...error2["data"] !== undefined && { data: error2["data"] }
        }
      };
      if (relatedTaskId && this._taskMessageQueue) {
        await this._enqueueTaskMessage(relatedTaskId, {
          type: "error",
          message: errorResponse,
          timestamp: Date.now()
        }, capturedTransport?.sessionId);
      } else {
        await capturedTransport?.send(errorResponse);
      }
    }).catch((error2) => this._onerror(new Error(`Failed to send response: ${error2}`))).finally(() => {
      if (this._requestHandlerAbortControllers.get(request.id) === abortController) {
        this._requestHandlerAbortControllers.delete(request.id);
      }
    });
  }
  _onprogress(notification) {
    const { progressToken, ...params } = notification.params;
    const messageId = Number(progressToken);
    const handler = this._progressHandlers.get(messageId);
    if (!handler) {
      this._onerror(new Error(`Received a progress notification for an unknown token: ${JSON.stringify(notification)}`));
      return;
    }
    const responseHandler = this._responseHandlers.get(messageId);
    const timeoutInfo = this._timeoutInfo.get(messageId);
    if (timeoutInfo && responseHandler && timeoutInfo.resetTimeoutOnProgress) {
      try {
        this._resetTimeout(messageId);
      } catch (error2) {
        this._responseHandlers.delete(messageId);
        this._progressHandlers.delete(messageId);
        this._cleanupTimeout(messageId);
        responseHandler(error2);
        return;
      }
    }
    handler(params);
  }
  _onresponse(response) {
    const messageId = Number(response.id);
    const resolver = this._requestResolvers.get(messageId);
    if (resolver) {
      this._requestResolvers.delete(messageId);
      if (isJSONRPCResultResponse(response)) {
        resolver(response);
      } else {
        const error2 = new McpError(response.error.code, response.error.message, response.error.data);
        resolver(error2);
      }
      return;
    }
    const handler = this._responseHandlers.get(messageId);
    if (handler === undefined) {
      this._onerror(new Error(`Received a response for an unknown message ID: ${JSON.stringify(response)}`));
      return;
    }
    this._responseHandlers.delete(messageId);
    this._cleanupTimeout(messageId);
    let isTaskResponse = false;
    if (isJSONRPCResultResponse(response) && response.result && typeof response.result === "object") {
      const result = response.result;
      if (result.task && typeof result.task === "object") {
        const task = result.task;
        if (typeof task.taskId === "string") {
          isTaskResponse = true;
          this._taskProgressTokens.set(task.taskId, messageId);
        }
      }
    }
    if (!isTaskResponse) {
      this._progressHandlers.delete(messageId);
    }
    if (isJSONRPCResultResponse(response)) {
      handler(response);
    } else {
      const error2 = McpError.fromError(response.error.code, response.error.message, response.error.data);
      handler(error2);
    }
  }
  get transport() {
    return this._transport;
  }
  async close() {
    await this._transport?.close();
  }
  async* requestStream(request, resultSchema, options) {
    const { task } = options ?? {};
    if (!task) {
      try {
        const result = await this.request(request, resultSchema, options);
        yield { type: "result", result };
      } catch (error2) {
        yield {
          type: "error",
          error: error2 instanceof McpError ? error2 : new McpError(ErrorCode.InternalError, String(error2))
        };
      }
      return;
    }
    let taskId;
    try {
      const createResult = await this.request(request, CreateTaskResultSchema, options);
      if (createResult.task) {
        taskId = createResult.task.taskId;
        yield { type: "taskCreated", task: createResult.task };
      } else {
        throw new McpError(ErrorCode.InternalError, "Task creation did not return a task");
      }
      while (true) {
        const task2 = await this.getTask({ taskId }, options);
        yield { type: "taskStatus", task: task2 };
        if (isTerminal(task2.status)) {
          if (task2.status === "completed") {
            const result = await this.getTaskResult({ taskId }, resultSchema, options);
            yield { type: "result", result };
          } else if (task2.status === "failed") {
            yield {
              type: "error",
              error: new McpError(ErrorCode.InternalError, `Task ${taskId} failed`)
            };
          } else if (task2.status === "cancelled") {
            yield {
              type: "error",
              error: new McpError(ErrorCode.InternalError, `Task ${taskId} was cancelled`)
            };
          }
          return;
        }
        if (task2.status === "input_required") {
          const result = await this.getTaskResult({ taskId }, resultSchema, options);
          yield { type: "result", result };
          return;
        }
        const pollInterval = task2.pollInterval ?? this._options?.defaultTaskPollInterval ?? 1000;
        await new Promise((resolve2) => setTimeout(resolve2, pollInterval));
        options?.signal?.throwIfAborted();
      }
    } catch (error2) {
      yield {
        type: "error",
        error: error2 instanceof McpError ? error2 : new McpError(ErrorCode.InternalError, String(error2))
      };
    }
  }
  request(request, resultSchema, options) {
    const { relatedRequestId, resumptionToken, onresumptiontoken, task, relatedTask } = options ?? {};
    return new Promise((resolve2, reject) => {
      const earlyReject = (error2) => {
        reject(error2);
      };
      if (!this._transport) {
        earlyReject(new Error("Not connected"));
        return;
      }
      if (this._options?.enforceStrictCapabilities === true) {
        try {
          this.assertCapabilityForMethod(request.method);
          if (task) {
            this.assertTaskCapability(request.method);
          }
        } catch (e) {
          earlyReject(e);
          return;
        }
      }
      options?.signal?.throwIfAborted();
      const messageId = this._requestMessageId++;
      const jsonrpcRequest = {
        ...request,
        jsonrpc: "2.0",
        id: messageId
      };
      if (options?.onprogress) {
        this._progressHandlers.set(messageId, options.onprogress);
        jsonrpcRequest.params = {
          ...request.params,
          _meta: {
            ...request.params?._meta || {},
            progressToken: messageId
          }
        };
      }
      if (task) {
        jsonrpcRequest.params = {
          ...jsonrpcRequest.params,
          task
        };
      }
      if (relatedTask) {
        jsonrpcRequest.params = {
          ...jsonrpcRequest.params,
          _meta: {
            ...jsonrpcRequest.params?._meta || {},
            [RELATED_TASK_META_KEY]: relatedTask
          }
        };
      }
      const cancel = (reason) => {
        this._responseHandlers.delete(messageId);
        this._progressHandlers.delete(messageId);
        this._cleanupTimeout(messageId);
        this._transport?.send({
          jsonrpc: "2.0",
          method: "notifications/cancelled",
          params: {
            requestId: messageId,
            reason: String(reason)
          }
        }, { relatedRequestId, resumptionToken, onresumptiontoken }).catch((error3) => this._onerror(new Error(`Failed to send cancellation: ${error3}`)));
        const error2 = reason instanceof McpError ? reason : new McpError(ErrorCode.RequestTimeout, String(reason));
        reject(error2);
      };
      this._responseHandlers.set(messageId, (response) => {
        if (options?.signal?.aborted) {
          return;
        }
        if (response instanceof Error) {
          return reject(response);
        }
        try {
          const parseResult = safeParse2(resultSchema, response.result);
          if (!parseResult.success) {
            reject(parseResult.error);
          } else {
            resolve2(parseResult.data);
          }
        } catch (error2) {
          reject(error2);
        }
      });
      options?.signal?.addEventListener("abort", () => {
        cancel(options?.signal?.reason);
      });
      const timeout = options?.timeout ?? DEFAULT_REQUEST_TIMEOUT_MSEC;
      const timeoutHandler = () => cancel(McpError.fromError(ErrorCode.RequestTimeout, "Request timed out", { timeout }));
      this._setupTimeout(messageId, timeout, options?.maxTotalTimeout, timeoutHandler, options?.resetTimeoutOnProgress ?? false);
      const relatedTaskId = relatedTask?.taskId;
      if (relatedTaskId) {
        const responseResolver = (response) => {
          const handler = this._responseHandlers.get(messageId);
          if (handler) {
            handler(response);
          } else {
            this._onerror(new Error(`Response handler missing for side-channeled request ${messageId}`));
          }
        };
        this._requestResolvers.set(messageId, responseResolver);
        this._enqueueTaskMessage(relatedTaskId, {
          type: "request",
          message: jsonrpcRequest,
          timestamp: Date.now()
        }).catch((error2) => {
          this._cleanupTimeout(messageId);
          reject(error2);
        });
      } else {
        this._transport.send(jsonrpcRequest, { relatedRequestId, resumptionToken, onresumptiontoken }).catch((error2) => {
          this._cleanupTimeout(messageId);
          reject(error2);
        });
      }
    });
  }
  async getTask(params, options) {
    return this.request({ method: "tasks/get", params }, GetTaskResultSchema, options);
  }
  async getTaskResult(params, resultSchema, options) {
    return this.request({ method: "tasks/result", params }, resultSchema, options);
  }
  async listTasks(params, options) {
    return this.request({ method: "tasks/list", params }, ListTasksResultSchema, options);
  }
  async cancelTask(params, options) {
    return this.request({ method: "tasks/cancel", params }, CancelTaskResultSchema, options);
  }
  async notification(notification, options) {
    if (!this._transport) {
      throw new Error("Not connected");
    }
    this.assertNotificationCapability(notification.method);
    const relatedTaskId = options?.relatedTask?.taskId;
    if (relatedTaskId) {
      const jsonrpcNotification2 = {
        ...notification,
        jsonrpc: "2.0",
        params: {
          ...notification.params,
          _meta: {
            ...notification.params?._meta || {},
            [RELATED_TASK_META_KEY]: options.relatedTask
          }
        }
      };
      await this._enqueueTaskMessage(relatedTaskId, {
        type: "notification",
        message: jsonrpcNotification2,
        timestamp: Date.now()
      });
      return;
    }
    const debouncedMethods = this._options?.debouncedNotificationMethods ?? [];
    const canDebounce = debouncedMethods.includes(notification.method) && !notification.params && !options?.relatedRequestId && !options?.relatedTask;
    if (canDebounce) {
      if (this._pendingDebouncedNotifications.has(notification.method)) {
        return;
      }
      this._pendingDebouncedNotifications.add(notification.method);
      Promise.resolve().then(() => {
        this._pendingDebouncedNotifications.delete(notification.method);
        if (!this._transport) {
          return;
        }
        let jsonrpcNotification2 = {
          ...notification,
          jsonrpc: "2.0"
        };
        if (options?.relatedTask) {
          jsonrpcNotification2 = {
            ...jsonrpcNotification2,
            params: {
              ...jsonrpcNotification2.params,
              _meta: {
                ...jsonrpcNotification2.params?._meta || {},
                [RELATED_TASK_META_KEY]: options.relatedTask
              }
            }
          };
        }
        this._transport?.send(jsonrpcNotification2, options).catch((error2) => this._onerror(error2));
      });
      return;
    }
    let jsonrpcNotification = {
      ...notification,
      jsonrpc: "2.0"
    };
    if (options?.relatedTask) {
      jsonrpcNotification = {
        ...jsonrpcNotification,
        params: {
          ...jsonrpcNotification.params,
          _meta: {
            ...jsonrpcNotification.params?._meta || {},
            [RELATED_TASK_META_KEY]: options.relatedTask
          }
        }
      };
    }
    await this._transport.send(jsonrpcNotification, options);
  }
  setRequestHandler(requestSchema, handler) {
    const method = getMethodLiteral(requestSchema);
    this.assertRequestHandlerCapability(method);
    this._requestHandlers.set(method, (request, extra) => {
      const parsed = parseWithCompat(requestSchema, request);
      return Promise.resolve(handler(parsed, extra));
    });
  }
  removeRequestHandler(method) {
    this._requestHandlers.delete(method);
  }
  assertCanSetRequestHandler(method) {
    if (this._requestHandlers.has(method)) {
      throw new Error(`A request handler for ${method} already exists, which would be overridden`);
    }
  }
  setNotificationHandler(notificationSchema, handler) {
    const method = getMethodLiteral(notificationSchema);
    this._notificationHandlers.set(method, (notification) => {
      const parsed = parseWithCompat(notificationSchema, notification);
      return Promise.resolve(handler(parsed));
    });
  }
  removeNotificationHandler(method) {
    this._notificationHandlers.delete(method);
  }
  _cleanupTaskProgressHandler(taskId) {
    const progressToken = this._taskProgressTokens.get(taskId);
    if (progressToken !== undefined) {
      this._progressHandlers.delete(progressToken);
      this._taskProgressTokens.delete(taskId);
    }
  }
  async _enqueueTaskMessage(taskId, message, sessionId) {
    if (!this._taskStore || !this._taskMessageQueue) {
      throw new Error("Cannot enqueue task message: taskStore and taskMessageQueue are not configured");
    }
    const maxQueueSize = this._options?.maxTaskQueueSize;
    await this._taskMessageQueue.enqueue(taskId, message, sessionId, maxQueueSize);
  }
  async _clearTaskQueue(taskId, sessionId) {
    if (this._taskMessageQueue) {
      const messages = await this._taskMessageQueue.dequeueAll(taskId, sessionId);
      for (const message of messages) {
        if (message.type === "request" && isJSONRPCRequest(message.message)) {
          const requestId = message.message.id;
          const resolver = this._requestResolvers.get(requestId);
          if (resolver) {
            resolver(new McpError(ErrorCode.InternalError, "Task cancelled or completed"));
            this._requestResolvers.delete(requestId);
          } else {
            this._onerror(new Error(`Resolver missing for request ${requestId} during task ${taskId} cleanup`));
          }
        }
      }
    }
  }
  async _waitForTaskUpdate(taskId, signal) {
    let interval = this._options?.defaultTaskPollInterval ?? 1000;
    try {
      const task = await this._taskStore?.getTask(taskId);
      if (task?.pollInterval) {
        interval = task.pollInterval;
      }
    } catch {}
    return new Promise((resolve2, reject) => {
      if (signal.aborted) {
        reject(new McpError(ErrorCode.InvalidRequest, "Request cancelled"));
        return;
      }
      const timeoutId = setTimeout(resolve2, interval);
      signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        reject(new McpError(ErrorCode.InvalidRequest, "Request cancelled"));
      }, { once: true });
    });
  }
  requestTaskStore(request, sessionId) {
    const taskStore = this._taskStore;
    if (!taskStore) {
      throw new Error("No task store configured");
    }
    return {
      createTask: async (taskParams) => {
        if (!request) {
          throw new Error("No request provided");
        }
        return await taskStore.createTask(taskParams, request.id, {
          method: request.method,
          params: request.params
        }, sessionId);
      },
      getTask: async (taskId) => {
        const task = await taskStore.getTask(taskId, sessionId);
        if (!task) {
          throw new McpError(ErrorCode.InvalidParams, "Failed to retrieve task: Task not found");
        }
        return task;
      },
      storeTaskResult: async (taskId, status, result) => {
        await taskStore.storeTaskResult(taskId, status, result, sessionId);
        const task = await taskStore.getTask(taskId, sessionId);
        if (task) {
          const notification = TaskStatusNotificationSchema.parse({
            method: "notifications/tasks/status",
            params: task
          });
          await this.notification(notification);
          if (isTerminal(task.status)) {
            this._cleanupTaskProgressHandler(taskId);
          }
        }
      },
      getTaskResult: (taskId) => {
        return taskStore.getTaskResult(taskId, sessionId);
      },
      updateTaskStatus: async (taskId, status, statusMessage) => {
        const task = await taskStore.getTask(taskId, sessionId);
        if (!task) {
          throw new McpError(ErrorCode.InvalidParams, `Task "${taskId}" not found - it may have been cleaned up`);
        }
        if (isTerminal(task.status)) {
          throw new McpError(ErrorCode.InvalidParams, `Cannot update task "${taskId}" from terminal status "${task.status}" to "${status}". Terminal states (completed, failed, cancelled) cannot transition to other states.`);
        }
        await taskStore.updateTaskStatus(taskId, status, statusMessage, sessionId);
        const updatedTask = await taskStore.getTask(taskId, sessionId);
        if (updatedTask) {
          const notification = TaskStatusNotificationSchema.parse({
            method: "notifications/tasks/status",
            params: updatedTask
          });
          await this.notification(notification);
          if (isTerminal(updatedTask.status)) {
            this._cleanupTaskProgressHandler(taskId);
          }
        }
      },
      listTasks: (cursor) => {
        return taskStore.listTasks(cursor, sessionId);
      }
    };
  }
}
function isPlainObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function mergeCapabilities(base, additional) {
  const result = { ...base };
  for (const key in additional) {
    const k = key;
    const addValue = additional[k];
    if (addValue === undefined)
      continue;
    const baseValue = result[k];
    if (isPlainObject2(baseValue) && isPlainObject2(addValue)) {
      result[k] = { ...baseValue, ...addValue };
    } else {
      result[k] = addValue;
    }
  }
  return result;
}
var DEFAULT_REQUEST_TIMEOUT_MSEC = 60000;
var init_protocol = __esm(() => {
  init_zod_compat();
  init_types();
  init_zod_json_schema_compat();
});

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = undefined;

  class _CodeOrName {
  }
  exports._CodeOrName = _CodeOrName;
  exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;

  class Name extends _CodeOrName {
    constructor(s) {
      super();
      if (!exports.IDENTIFIER.test(s))
        throw new Error("CodeGen: name must be a valid identifier");
      this.str = s;
    }
    toString() {
      return this.str;
    }
    emptyStr() {
      return false;
    }
    get names() {
      return { [this.str]: 1 };
    }
  }
  exports.Name = Name;

  class _Code extends _CodeOrName {
    constructor(code) {
      super();
      this._items = typeof code === "string" ? [code] : code;
    }
    toString() {
      return this.str;
    }
    emptyStr() {
      if (this._items.length > 1)
        return false;
      const item = this._items[0];
      return item === "" || item === '""';
    }
    get str() {
      var _a;
      return (_a = this._str) !== null && _a !== undefined ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
    }
    get names() {
      var _a;
      return (_a = this._names) !== null && _a !== undefined ? _a : this._names = this._items.reduce((names, c) => {
        if (c instanceof Name)
          names[c.str] = (names[c.str] || 0) + 1;
        return names;
      }, {});
    }
  }
  exports._Code = _Code;
  exports.nil = new _Code("");
  function _(strs, ...args) {
    const code = [strs[0]];
    let i = 0;
    while (i < args.length) {
      addCodeArg(code, args[i]);
      code.push(strs[++i]);
    }
    return new _Code(code);
  }
  exports._ = _;
  var plus = new _Code("+");
  function str(strs, ...args) {
    const expr = [safeStringify(strs[0])];
    let i = 0;
    while (i < args.length) {
      expr.push(plus);
      addCodeArg(expr, args[i]);
      expr.push(plus, safeStringify(strs[++i]));
    }
    optimize(expr);
    return new _Code(expr);
  }
  exports.str = str;
  function addCodeArg(code, arg) {
    if (arg instanceof _Code)
      code.push(...arg._items);
    else if (arg instanceof Name)
      code.push(arg);
    else
      code.push(interpolate(arg));
  }
  exports.addCodeArg = addCodeArg;
  function optimize(expr) {
    let i = 1;
    while (i < expr.length - 1) {
      if (expr[i] === plus) {
        const res = mergeExprItems(expr[i - 1], expr[i + 1]);
        if (res !== undefined) {
          expr.splice(i - 1, 3, res);
          continue;
        }
        expr[i++] = "+";
      }
      i++;
    }
  }
  function mergeExprItems(a, b) {
    if (b === '""')
      return a;
    if (a === '""')
      return b;
    if (typeof a == "string") {
      if (b instanceof Name || a[a.length - 1] !== '"')
        return;
      if (typeof b != "string")
        return `${a.slice(0, -1)}${b}"`;
      if (b[0] === '"')
        return a.slice(0, -1) + b.slice(1);
      return;
    }
    if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
      return `"${a}${b.slice(1)}`;
    return;
  }
  function strConcat(c1, c2) {
    return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
  }
  exports.strConcat = strConcat;
  function interpolate(x) {
    return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
  }
  function stringify(x) {
    return new _Code(safeStringify(x));
  }
  exports.stringify = stringify;
  function safeStringify(x) {
    return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  }
  exports.safeStringify = safeStringify;
  function getProperty(key) {
    return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
  }
  exports.getProperty = getProperty;
  function getEsmExportName(key) {
    if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
      return new _Code(`${key}`);
    }
    throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
  }
  exports.getEsmExportName = getEsmExportName;
  function regexpCode(rx) {
    return new _Code(rx.toString());
  }
  exports.regexpCode = regexpCode;
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = undefined;
  var code_1 = require_code();

  class ValueError extends Error {
    constructor(name) {
      super(`CodeGen: "code" for ${name} not defined`);
      this.value = name.value;
    }
  }
  var UsedValueState;
  (function(UsedValueState2) {
    UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
    UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
  })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
  exports.varKinds = {
    const: new code_1.Name("const"),
    let: new code_1.Name("let"),
    var: new code_1.Name("var")
  };

  class Scope {
    constructor({ prefixes, parent } = {}) {
      this._names = {};
      this._prefixes = prefixes;
      this._parent = parent;
    }
    toName(nameOrPrefix) {
      return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
    }
    name(prefix) {
      return new code_1.Name(this._newName(prefix));
    }
    _newName(prefix) {
      const ng = this._names[prefix] || this._nameGroup(prefix);
      return `${prefix}${ng.index++}`;
    }
    _nameGroup(prefix) {
      var _a, _b;
      if (((_b = (_a = this._parent) === null || _a === undefined ? undefined : _a._prefixes) === null || _b === undefined ? undefined : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
        throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
      }
      return this._names[prefix] = { prefix, index: 0 };
    }
  }
  exports.Scope = Scope;

  class ValueScopeName extends code_1.Name {
    constructor(prefix, nameStr) {
      super(nameStr);
      this.prefix = prefix;
    }
    setValue(value, { property, itemIndex }) {
      this.value = value;
      this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
    }
  }
  exports.ValueScopeName = ValueScopeName;
  var line = (0, code_1._)`\n`;

  class ValueScope extends Scope {
    constructor(opts) {
      super(opts);
      this._values = {};
      this._scope = opts.scope;
      this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
    }
    get() {
      return this._scope;
    }
    name(prefix) {
      return new ValueScopeName(prefix, this._newName(prefix));
    }
    value(nameOrPrefix, value) {
      var _a;
      if (value.ref === undefined)
        throw new Error("CodeGen: ref must be passed in value");
      const name = this.toName(nameOrPrefix);
      const { prefix } = name;
      const valueKey = (_a = value.key) !== null && _a !== undefined ? _a : value.ref;
      let vs = this._values[prefix];
      if (vs) {
        const _name = vs.get(valueKey);
        if (_name)
          return _name;
      } else {
        vs = this._values[prefix] = new Map;
      }
      vs.set(valueKey, name);
      const s = this._scope[prefix] || (this._scope[prefix] = []);
      const itemIndex = s.length;
      s[itemIndex] = value.ref;
      name.setValue(value, { property: prefix, itemIndex });
      return name;
    }
    getValue(prefix, keyOrRef) {
      const vs = this._values[prefix];
      if (!vs)
        return;
      return vs.get(keyOrRef);
    }
    scopeRefs(scopeName, values = this._values) {
      return this._reduceValues(values, (name) => {
        if (name.scopePath === undefined)
          throw new Error(`CodeGen: name "${name}" has no value`);
        return (0, code_1._)`${scopeName}${name.scopePath}`;
      });
    }
    scopeCode(values = this._values, usedValues, getCode) {
      return this._reduceValues(values, (name) => {
        if (name.value === undefined)
          throw new Error(`CodeGen: name "${name}" has no value`);
        return name.value.code;
      }, usedValues, getCode);
    }
    _reduceValues(values, valueCode, usedValues = {}, getCode) {
      let code = code_1.nil;
      for (const prefix in values) {
        const vs = values[prefix];
        if (!vs)
          continue;
        const nameSet = usedValues[prefix] = usedValues[prefix] || new Map;
        vs.forEach((name) => {
          if (nameSet.has(name))
            return;
          nameSet.set(name, UsedValueState.Started);
          let c = valueCode(name);
          if (c) {
            const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
            code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
          } else if (c = getCode === null || getCode === undefined ? undefined : getCode(name)) {
            code = (0, code_1._)`${code}${c}${this.opts._n}`;
          } else {
            throw new ValueError(name);
          }
          nameSet.set(name, UsedValueState.Completed);
        });
      }
      return code;
    }
  }
  exports.ValueScope = ValueScope;
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = undefined;
  var code_1 = require_code();
  var scope_1 = require_scope();
  var code_2 = require_code();
  Object.defineProperty(exports, "_", { enumerable: true, get: function() {
    return code_2._;
  } });
  Object.defineProperty(exports, "str", { enumerable: true, get: function() {
    return code_2.str;
  } });
  Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
    return code_2.strConcat;
  } });
  Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
    return code_2.nil;
  } });
  Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
    return code_2.getProperty;
  } });
  Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
    return code_2.stringify;
  } });
  Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
    return code_2.regexpCode;
  } });
  Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
    return code_2.Name;
  } });
  var scope_2 = require_scope();
  Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
    return scope_2.Scope;
  } });
  Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
    return scope_2.ValueScope;
  } });
  Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
    return scope_2.ValueScopeName;
  } });
  Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
    return scope_2.varKinds;
  } });
  exports.operators = {
    GT: new code_1._Code(">"),
    GTE: new code_1._Code(">="),
    LT: new code_1._Code("<"),
    LTE: new code_1._Code("<="),
    EQ: new code_1._Code("==="),
    NEQ: new code_1._Code("!=="),
    NOT: new code_1._Code("!"),
    OR: new code_1._Code("||"),
    AND: new code_1._Code("&&"),
    ADD: new code_1._Code("+")
  };

  class Node {
    optimizeNodes() {
      return this;
    }
    optimizeNames(_names, _constants) {
      return this;
    }
  }

  class Def extends Node {
    constructor(varKind, name, rhs) {
      super();
      this.varKind = varKind;
      this.name = name;
      this.rhs = rhs;
    }
    render({ es5, _n }) {
      const varKind = es5 ? scope_1.varKinds.var : this.varKind;
      const rhs = this.rhs === undefined ? "" : ` = ${this.rhs}`;
      return `${varKind} ${this.name}${rhs};` + _n;
    }
    optimizeNames(names, constants) {
      if (!names[this.name.str])
        return;
      if (this.rhs)
        this.rhs = optimizeExpr(this.rhs, names, constants);
      return this;
    }
    get names() {
      return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
    }
  }

  class Assign extends Node {
    constructor(lhs, rhs, sideEffects) {
      super();
      this.lhs = lhs;
      this.rhs = rhs;
      this.sideEffects = sideEffects;
    }
    render({ _n }) {
      return `${this.lhs} = ${this.rhs};` + _n;
    }
    optimizeNames(names, constants) {
      if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
        return;
      this.rhs = optimizeExpr(this.rhs, names, constants);
      return this;
    }
    get names() {
      const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
      return addExprNames(names, this.rhs);
    }
  }

  class AssignOp extends Assign {
    constructor(lhs, op, rhs, sideEffects) {
      super(lhs, rhs, sideEffects);
      this.op = op;
    }
    render({ _n }) {
      return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
    }
  }

  class Label extends Node {
    constructor(label) {
      super();
      this.label = label;
      this.names = {};
    }
    render({ _n }) {
      return `${this.label}:` + _n;
    }
  }

  class Break extends Node {
    constructor(label) {
      super();
      this.label = label;
      this.names = {};
    }
    render({ _n }) {
      const label = this.label ? ` ${this.label}` : "";
      return `break${label};` + _n;
    }
  }

  class Throw extends Node {
    constructor(error2) {
      super();
      this.error = error2;
    }
    render({ _n }) {
      return `throw ${this.error};` + _n;
    }
    get names() {
      return this.error.names;
    }
  }

  class AnyCode extends Node {
    constructor(code) {
      super();
      this.code = code;
    }
    render({ _n }) {
      return `${this.code};` + _n;
    }
    optimizeNodes() {
      return `${this.code}` ? this : undefined;
    }
    optimizeNames(names, constants) {
      this.code = optimizeExpr(this.code, names, constants);
      return this;
    }
    get names() {
      return this.code instanceof code_1._CodeOrName ? this.code.names : {};
    }
  }

  class ParentNode extends Node {
    constructor(nodes = []) {
      super();
      this.nodes = nodes;
    }
    render(opts) {
      return this.nodes.reduce((code, n) => code + n.render(opts), "");
    }
    optimizeNodes() {
      const { nodes } = this;
      let i = nodes.length;
      while (i--) {
        const n = nodes[i].optimizeNodes();
        if (Array.isArray(n))
          nodes.splice(i, 1, ...n);
        else if (n)
          nodes[i] = n;
        else
          nodes.splice(i, 1);
      }
      return nodes.length > 0 ? this : undefined;
    }
    optimizeNames(names, constants) {
      const { nodes } = this;
      let i = nodes.length;
      while (i--) {
        const n = nodes[i];
        if (n.optimizeNames(names, constants))
          continue;
        subtractNames(names, n.names);
        nodes.splice(i, 1);
      }
      return nodes.length > 0 ? this : undefined;
    }
    get names() {
      return this.nodes.reduce((names, n) => addNames(names, n.names), {});
    }
  }

  class BlockNode extends ParentNode {
    render(opts) {
      return "{" + opts._n + super.render(opts) + "}" + opts._n;
    }
  }

  class Root extends ParentNode {
  }

  class Else extends BlockNode {
  }
  Else.kind = "else";

  class If extends BlockNode {
    constructor(condition, nodes) {
      super(nodes);
      this.condition = condition;
    }
    render(opts) {
      let code = `if(${this.condition})` + super.render(opts);
      if (this.else)
        code += "else " + this.else.render(opts);
      return code;
    }
    optimizeNodes() {
      super.optimizeNodes();
      const cond = this.condition;
      if (cond === true)
        return this.nodes;
      let e = this.else;
      if (e) {
        const ns = e.optimizeNodes();
        e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
      }
      if (e) {
        if (cond === false)
          return e instanceof If ? e : e.nodes;
        if (this.nodes.length)
          return this;
        return new If(not(cond), e instanceof If ? [e] : e.nodes);
      }
      if (cond === false || !this.nodes.length)
        return;
      return this;
    }
    optimizeNames(names, constants) {
      var _a;
      this.else = (_a = this.else) === null || _a === undefined ? undefined : _a.optimizeNames(names, constants);
      if (!(super.optimizeNames(names, constants) || this.else))
        return;
      this.condition = optimizeExpr(this.condition, names, constants);
      return this;
    }
    get names() {
      const names = super.names;
      addExprNames(names, this.condition);
      if (this.else)
        addNames(names, this.else.names);
      return names;
    }
  }
  If.kind = "if";

  class For extends BlockNode {
  }
  For.kind = "for";

  class ForLoop extends For {
    constructor(iteration) {
      super();
      this.iteration = iteration;
    }
    render(opts) {
      return `for(${this.iteration})` + super.render(opts);
    }
    optimizeNames(names, constants) {
      if (!super.optimizeNames(names, constants))
        return;
      this.iteration = optimizeExpr(this.iteration, names, constants);
      return this;
    }
    get names() {
      return addNames(super.names, this.iteration.names);
    }
  }

  class ForRange extends For {
    constructor(varKind, name, from, to) {
      super();
      this.varKind = varKind;
      this.name = name;
      this.from = from;
      this.to = to;
    }
    render(opts) {
      const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
      const { name, from, to } = this;
      return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
    }
    get names() {
      const names = addExprNames(super.names, this.from);
      return addExprNames(names, this.to);
    }
  }

  class ForIter extends For {
    constructor(loop, varKind, name, iterable) {
      super();
      this.loop = loop;
      this.varKind = varKind;
      this.name = name;
      this.iterable = iterable;
    }
    render(opts) {
      return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
    }
    optimizeNames(names, constants) {
      if (!super.optimizeNames(names, constants))
        return;
      this.iterable = optimizeExpr(this.iterable, names, constants);
      return this;
    }
    get names() {
      return addNames(super.names, this.iterable.names);
    }
  }

  class Func extends BlockNode {
    constructor(name, args, async) {
      super();
      this.name = name;
      this.args = args;
      this.async = async;
    }
    render(opts) {
      const _async = this.async ? "async " : "";
      return `${_async}function ${this.name}(${this.args})` + super.render(opts);
    }
  }
  Func.kind = "func";

  class Return extends ParentNode {
    render(opts) {
      return "return " + super.render(opts);
    }
  }
  Return.kind = "return";

  class Try extends BlockNode {
    render(opts) {
      let code = "try" + super.render(opts);
      if (this.catch)
        code += this.catch.render(opts);
      if (this.finally)
        code += this.finally.render(opts);
      return code;
    }
    optimizeNodes() {
      var _a, _b;
      super.optimizeNodes();
      (_a = this.catch) === null || _a === undefined || _a.optimizeNodes();
      (_b = this.finally) === null || _b === undefined || _b.optimizeNodes();
      return this;
    }
    optimizeNames(names, constants) {
      var _a, _b;
      super.optimizeNames(names, constants);
      (_a = this.catch) === null || _a === undefined || _a.optimizeNames(names, constants);
      (_b = this.finally) === null || _b === undefined || _b.optimizeNames(names, constants);
      return this;
    }
    get names() {
      const names = super.names;
      if (this.catch)
        addNames(names, this.catch.names);
      if (this.finally)
        addNames(names, this.finally.names);
      return names;
    }
  }

  class Catch extends BlockNode {
    constructor(error2) {
      super();
      this.error = error2;
    }
    render(opts) {
      return `catch(${this.error})` + super.render(opts);
    }
  }
  Catch.kind = "catch";

  class Finally extends BlockNode {
    render(opts) {
      return "finally" + super.render(opts);
    }
  }
  Finally.kind = "finally";

  class CodeGen {
    constructor(extScope, opts = {}) {
      this._values = {};
      this._blockStarts = [];
      this._constants = {};
      this.opts = { ...opts, _n: opts.lines ? `
` : "" };
      this._extScope = extScope;
      this._scope = new scope_1.Scope({ parent: extScope });
      this._nodes = [new Root];
    }
    toString() {
      return this._root.render(this.opts);
    }
    name(prefix) {
      return this._scope.name(prefix);
    }
    scopeName(prefix) {
      return this._extScope.name(prefix);
    }
    scopeValue(prefixOrName, value) {
      const name = this._extScope.value(prefixOrName, value);
      const vs = this._values[name.prefix] || (this._values[name.prefix] = new Set);
      vs.add(name);
      return name;
    }
    getScopeValue(prefix, keyOrRef) {
      return this._extScope.getValue(prefix, keyOrRef);
    }
    scopeRefs(scopeName) {
      return this._extScope.scopeRefs(scopeName, this._values);
    }
    scopeCode() {
      return this._extScope.scopeCode(this._values);
    }
    _def(varKind, nameOrPrefix, rhs, constant) {
      const name = this._scope.toName(nameOrPrefix);
      if (rhs !== undefined && constant)
        this._constants[name.str] = rhs;
      this._leafNode(new Def(varKind, name, rhs));
      return name;
    }
    const(nameOrPrefix, rhs, _constant) {
      return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
    }
    let(nameOrPrefix, rhs, _constant) {
      return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
    }
    var(nameOrPrefix, rhs, _constant) {
      return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
    }
    assign(lhs, rhs, sideEffects) {
      return this._leafNode(new Assign(lhs, rhs, sideEffects));
    }
    add(lhs, rhs) {
      return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
    }
    code(c) {
      if (typeof c == "function")
        c();
      else if (c !== code_1.nil)
        this._leafNode(new AnyCode(c));
      return this;
    }
    object(...keyValues) {
      const code = ["{"];
      for (const [key, value] of keyValues) {
        if (code.length > 1)
          code.push(",");
        code.push(key);
        if (key !== value || this.opts.es5) {
          code.push(":");
          (0, code_1.addCodeArg)(code, value);
        }
      }
      code.push("}");
      return new code_1._Code(code);
    }
    if(condition, thenBody, elseBody) {
      this._blockNode(new If(condition));
      if (thenBody && elseBody) {
        this.code(thenBody).else().code(elseBody).endIf();
      } else if (thenBody) {
        this.code(thenBody).endIf();
      } else if (elseBody) {
        throw new Error('CodeGen: "else" body without "then" body');
      }
      return this;
    }
    elseIf(condition) {
      return this._elseNode(new If(condition));
    }
    else() {
      return this._elseNode(new Else);
    }
    endIf() {
      return this._endBlockNode(If, Else);
    }
    _for(node, forBody) {
      this._blockNode(node);
      if (forBody)
        this.code(forBody).endFor();
      return this;
    }
    for(iteration, forBody) {
      return this._for(new ForLoop(iteration), forBody);
    }
    forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
      const name = this._scope.toName(nameOrPrefix);
      return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
    }
    forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
      const name = this._scope.toName(nameOrPrefix);
      if (this.opts.es5) {
        const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
        return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
          this.var(name, (0, code_1._)`${arr}[${i}]`);
          forBody(name);
        });
      }
      return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
    }
    forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
      if (this.opts.ownProperties) {
        return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
      }
      const name = this._scope.toName(nameOrPrefix);
      return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
    }
    endFor() {
      return this._endBlockNode(For);
    }
    label(label) {
      return this._leafNode(new Label(label));
    }
    break(label) {
      return this._leafNode(new Break(label));
    }
    return(value) {
      const node = new Return;
      this._blockNode(node);
      this.code(value);
      if (node.nodes.length !== 1)
        throw new Error('CodeGen: "return" should have one node');
      return this._endBlockNode(Return);
    }
    try(tryBody, catchCode, finallyCode) {
      if (!catchCode && !finallyCode)
        throw new Error('CodeGen: "try" without "catch" and "finally"');
      const node = new Try;
      this._blockNode(node);
      this.code(tryBody);
      if (catchCode) {
        const error2 = this.name("e");
        this._currNode = node.catch = new Catch(error2);
        catchCode(error2);
      }
      if (finallyCode) {
        this._currNode = node.finally = new Finally;
        this.code(finallyCode);
      }
      return this._endBlockNode(Catch, Finally);
    }
    throw(error2) {
      return this._leafNode(new Throw(error2));
    }
    block(body, nodeCount) {
      this._blockStarts.push(this._nodes.length);
      if (body)
        this.code(body).endBlock(nodeCount);
      return this;
    }
    endBlock(nodeCount) {
      const len = this._blockStarts.pop();
      if (len === undefined)
        throw new Error("CodeGen: not in self-balancing block");
      const toClose = this._nodes.length - len;
      if (toClose < 0 || nodeCount !== undefined && toClose !== nodeCount) {
        throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
      }
      this._nodes.length = len;
      return this;
    }
    func(name, args = code_1.nil, async, funcBody) {
      this._blockNode(new Func(name, args, async));
      if (funcBody)
        this.code(funcBody).endFunc();
      return this;
    }
    endFunc() {
      return this._endBlockNode(Func);
    }
    optimize(n = 1) {
      while (n-- > 0) {
        this._root.optimizeNodes();
        this._root.optimizeNames(this._root.names, this._constants);
      }
    }
    _leafNode(node) {
      this._currNode.nodes.push(node);
      return this;
    }
    _blockNode(node) {
      this._currNode.nodes.push(node);
      this._nodes.push(node);
    }
    _endBlockNode(N1, N2) {
      const n = this._currNode;
      if (n instanceof N1 || N2 && n instanceof N2) {
        this._nodes.pop();
        return this;
      }
      throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
    }
    _elseNode(node) {
      const n = this._currNode;
      if (!(n instanceof If)) {
        throw new Error('CodeGen: "else" without "if"');
      }
      this._currNode = n.else = node;
      return this;
    }
    get _root() {
      return this._nodes[0];
    }
    get _currNode() {
      const ns = this._nodes;
      return ns[ns.length - 1];
    }
    set _currNode(node) {
      const ns = this._nodes;
      ns[ns.length - 1] = node;
    }
  }
  exports.CodeGen = CodeGen;
  function addNames(names, from) {
    for (const n in from)
      names[n] = (names[n] || 0) + (from[n] || 0);
    return names;
  }
  function addExprNames(names, from) {
    return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
  }
  function optimizeExpr(expr, names, constants) {
    if (expr instanceof code_1.Name)
      return replaceName(expr);
    if (!canOptimize(expr))
      return expr;
    return new code_1._Code(expr._items.reduce((items, c) => {
      if (c instanceof code_1.Name)
        c = replaceName(c);
      if (c instanceof code_1._Code)
        items.push(...c._items);
      else
        items.push(c);
      return items;
    }, []));
    function replaceName(n) {
      const c = constants[n.str];
      if (c === undefined || names[n.str] !== 1)
        return n;
      delete names[n.str];
      return c;
    }
    function canOptimize(e) {
      return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== undefined);
    }
  }
  function subtractNames(names, from) {
    for (const n in from)
      names[n] = (names[n] || 0) - (from[n] || 0);
  }
  function not(x) {
    return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
  }
  exports.not = not;
  var andCode = mappend(exports.operators.AND);
  function and(...args) {
    return args.reduce(andCode);
  }
  exports.and = and;
  var orCode = mappend(exports.operators.OR);
  function or(...args) {
    return args.reduce(orCode);
  }
  exports.or = or;
  function mappend(op) {
    return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
  }
  function par(x) {
    return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = undefined;
  var codegen_1 = require_codegen();
  var code_1 = require_code();
  function toHash(arr) {
    const hash = {};
    for (const item of arr)
      hash[item] = true;
    return hash;
  }
  exports.toHash = toHash;
  function alwaysValidSchema(it, schema) {
    if (typeof schema == "boolean")
      return schema;
    if (Object.keys(schema).length === 0)
      return true;
    checkUnknownRules(it, schema);
    return !schemaHasRules(schema, it.self.RULES.all);
  }
  exports.alwaysValidSchema = alwaysValidSchema;
  function checkUnknownRules(it, schema = it.schema) {
    const { opts, self } = it;
    if (!opts.strictSchema)
      return;
    if (typeof schema === "boolean")
      return;
    const rules = self.RULES.keywords;
    for (const key in schema) {
      if (!rules[key])
        checkStrictMode(it, `unknown keyword: "${key}"`);
    }
  }
  exports.checkUnknownRules = checkUnknownRules;
  function schemaHasRules(schema, rules) {
    if (typeof schema == "boolean")
      return !schema;
    for (const key in schema)
      if (rules[key])
        return true;
    return false;
  }
  exports.schemaHasRules = schemaHasRules;
  function schemaHasRulesButRef(schema, RULES) {
    if (typeof schema == "boolean")
      return !schema;
    for (const key in schema)
      if (key !== "$ref" && RULES.all[key])
        return true;
    return false;
  }
  exports.schemaHasRulesButRef = schemaHasRulesButRef;
  function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
    if (!$data) {
      if (typeof schema == "number" || typeof schema == "boolean")
        return schema;
      if (typeof schema == "string")
        return (0, codegen_1._)`${schema}`;
    }
    return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
  }
  exports.schemaRefOrVal = schemaRefOrVal;
  function unescapeFragment(str) {
    return unescapeJsonPointer(decodeURIComponent(str));
  }
  exports.unescapeFragment = unescapeFragment;
  function escapeFragment(str) {
    return encodeURIComponent(escapeJsonPointer(str));
  }
  exports.escapeFragment = escapeFragment;
  function escapeJsonPointer(str) {
    if (typeof str == "number")
      return `${str}`;
    return str.replace(/~/g, "~0").replace(/\//g, "~1");
  }
  exports.escapeJsonPointer = escapeJsonPointer;
  function unescapeJsonPointer(str) {
    return str.replace(/~1/g, "/").replace(/~0/g, "~");
  }
  exports.unescapeJsonPointer = unescapeJsonPointer;
  function eachItem(xs, f) {
    if (Array.isArray(xs)) {
      for (const x of xs)
        f(x);
    } else {
      f(xs);
    }
  }
  exports.eachItem = eachItem;
  function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues: mergeValues2, resultToName }) {
    return (gen, from, to, toName) => {
      const res = to === undefined ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues2(from, to);
      return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
    };
  }
  exports.mergeEvaluated = {
    props: makeMergeEvaluated({
      mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
        gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
      }),
      mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
        if (from === true) {
          gen.assign(to, true);
        } else {
          gen.assign(to, (0, codegen_1._)`${to} || {}`);
          setEvaluated(gen, to, from);
        }
      }),
      mergeValues: (from, to) => from === true ? true : { ...from, ...to },
      resultToName: evaluatedPropsToName
    }),
    items: makeMergeEvaluated({
      mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
      mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
      mergeValues: (from, to) => from === true ? true : Math.max(from, to),
      resultToName: (gen, items) => gen.var("items", items)
    })
  };
  function evaluatedPropsToName(gen, ps) {
    if (ps === true)
      return gen.var("props", true);
    const props = gen.var("props", (0, codegen_1._)`{}`);
    if (ps !== undefined)
      setEvaluated(gen, props, ps);
    return props;
  }
  exports.evaluatedPropsToName = evaluatedPropsToName;
  function setEvaluated(gen, props, ps) {
    Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
  }
  exports.setEvaluated = setEvaluated;
  var snippets = {};
  function useFunc(gen, f) {
    return gen.scopeValue("func", {
      ref: f,
      code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
    });
  }
  exports.useFunc = useFunc;
  var Type;
  (function(Type2) {
    Type2[Type2["Num"] = 0] = "Num";
    Type2[Type2["Str"] = 1] = "Str";
  })(Type || (exports.Type = Type = {}));
  function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
    if (dataProp instanceof codegen_1.Name) {
      const isNumber = dataPropType === Type.Num;
      return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
    }
    return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
  }
  exports.getErrorPath = getErrorPath;
  function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
    if (!mode)
      return;
    msg = `strict mode: ${msg}`;
    if (mode === true)
      throw new Error(msg);
    it.self.logger.warn(msg);
  }
  exports.checkStrictMode = checkStrictMode;
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var names = {
    data: new codegen_1.Name("data"),
    valCxt: new codegen_1.Name("valCxt"),
    instancePath: new codegen_1.Name("instancePath"),
    parentData: new codegen_1.Name("parentData"),
    parentDataProperty: new codegen_1.Name("parentDataProperty"),
    rootData: new codegen_1.Name("rootData"),
    dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
    vErrors: new codegen_1.Name("vErrors"),
    errors: new codegen_1.Name("errors"),
    this: new codegen_1.Name("this"),
    self: new codegen_1.Name("self"),
    scope: new codegen_1.Name("scope"),
    json: new codegen_1.Name("json"),
    jsonPos: new codegen_1.Name("jsonPos"),
    jsonLen: new codegen_1.Name("jsonLen"),
    jsonPart: new codegen_1.Name("jsonPart")
  };
  exports.default = names;
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = undefined;
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var names_1 = require_names();
  exports.keywordError = {
    message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
  };
  exports.keyword$DataError = {
    message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
  };
  function reportError(cxt, error2 = exports.keywordError, errorPaths, overrideAllErrors) {
    const { it } = cxt;
    const { gen, compositeRule, allErrors } = it;
    const errObj = errorObjectCode(cxt, error2, errorPaths);
    if (overrideAllErrors !== null && overrideAllErrors !== undefined ? overrideAllErrors : compositeRule || allErrors) {
      addError(gen, errObj);
    } else {
      returnErrors(it, (0, codegen_1._)`[${errObj}]`);
    }
  }
  exports.reportError = reportError;
  function reportExtraError(cxt, error2 = exports.keywordError, errorPaths) {
    const { it } = cxt;
    const { gen, compositeRule, allErrors } = it;
    const errObj = errorObjectCode(cxt, error2, errorPaths);
    addError(gen, errObj);
    if (!(compositeRule || allErrors)) {
      returnErrors(it, names_1.default.vErrors);
    }
  }
  exports.reportExtraError = reportExtraError;
  function resetErrorsCount(gen, errsCount) {
    gen.assign(names_1.default.errors, errsCount);
    gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
  }
  exports.resetErrorsCount = resetErrorsCount;
  function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
    if (errsCount === undefined)
      throw new Error("ajv implementation error");
    const err = gen.name("err");
    gen.forRange("i", errsCount, names_1.default.errors, (i) => {
      gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
      gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
      gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
      if (it.opts.verbose) {
        gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
        gen.assign((0, codegen_1._)`${err}.data`, data);
      }
    });
  }
  exports.extendErrors = extendErrors;
  function addError(gen, errObj) {
    const err = gen.const("err", errObj);
    gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
    gen.code((0, codegen_1._)`${names_1.default.errors}++`);
  }
  function returnErrors(it, errs) {
    const { gen, validateName, schemaEnv } = it;
    if (schemaEnv.$async) {
      gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
    } else {
      gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
      gen.return(false);
    }
  }
  var E = {
    keyword: new codegen_1.Name("keyword"),
    schemaPath: new codegen_1.Name("schemaPath"),
    params: new codegen_1.Name("params"),
    propertyName: new codegen_1.Name("propertyName"),
    message: new codegen_1.Name("message"),
    schema: new codegen_1.Name("schema"),
    parentSchema: new codegen_1.Name("parentSchema")
  };
  function errorObjectCode(cxt, error2, errorPaths) {
    const { createErrors } = cxt.it;
    if (createErrors === false)
      return (0, codegen_1._)`{}`;
    return errorObject(cxt, error2, errorPaths);
  }
  function errorObject(cxt, error2, errorPaths = {}) {
    const { gen, it } = cxt;
    const keyValues = [
      errorInstancePath(it, errorPaths),
      errorSchemaPath(cxt, errorPaths)
    ];
    extraErrorProps(cxt, error2, keyValues);
    return gen.object(...keyValues);
  }
  function errorInstancePath({ errorPath }, { instancePath }) {
    const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
    return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
  }
  function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
    let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
    if (schemaPath) {
      schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
    }
    return [E.schemaPath, schPath];
  }
  function extraErrorProps(cxt, { params, message }, keyValues) {
    const { keyword, data, schemaValue, it } = cxt;
    const { opts, propertyName, topSchemaRef, schemaPath } = it;
    keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
    if (opts.messages) {
      keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
    }
    if (opts.verbose) {
      keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
    }
    if (propertyName)
      keyValues.push([E.propertyName, propertyName]);
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = undefined;
  var errors_1 = require_errors();
  var codegen_1 = require_codegen();
  var names_1 = require_names();
  var boolError = {
    message: "boolean schema is false"
  };
  function topBoolOrEmptySchema(it) {
    const { gen, schema, validateName } = it;
    if (schema === false) {
      falseSchemaError(it, false);
    } else if (typeof schema == "object" && schema.$async === true) {
      gen.return(names_1.default.data);
    } else {
      gen.assign((0, codegen_1._)`${validateName}.errors`, null);
      gen.return(true);
    }
  }
  exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
  function boolOrEmptySchema(it, valid) {
    const { gen, schema } = it;
    if (schema === false) {
      gen.var(valid, false);
      falseSchemaError(it);
    } else {
      gen.var(valid, true);
    }
  }
  exports.boolOrEmptySchema = boolOrEmptySchema;
  function falseSchemaError(it, overrideAllErrors) {
    const { gen, data } = it;
    const cxt = {
      gen,
      keyword: "false schema",
      data,
      schema: false,
      schemaCode: false,
      schemaValue: false,
      params: {},
      it
    };
    (0, errors_1.reportError)(cxt, boolError, undefined, overrideAllErrors);
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.getRules = exports.isJSONType = undefined;
  var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
  var jsonTypes = new Set(_jsonTypes);
  function isJSONType(x) {
    return typeof x == "string" && jsonTypes.has(x);
  }
  exports.isJSONType = isJSONType;
  function getRules() {
    const groups = {
      number: { type: "number", rules: [] },
      string: { type: "string", rules: [] },
      array: { type: "array", rules: [] },
      object: { type: "object", rules: [] }
    };
    return {
      types: { ...groups, integer: true, boolean: true, null: true },
      rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
      post: { rules: [] },
      all: {},
      keywords: {}
    };
  }
  exports.getRules = getRules;
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = undefined;
  function schemaHasRulesForType({ schema, self }, type) {
    const group = self.RULES.types[type];
    return group && group !== true && shouldUseGroup(schema, group);
  }
  exports.schemaHasRulesForType = schemaHasRulesForType;
  function shouldUseGroup(schema, group) {
    return group.rules.some((rule) => shouldUseRule(schema, rule));
  }
  exports.shouldUseGroup = shouldUseGroup;
  function shouldUseRule(schema, rule) {
    var _a;
    return schema[rule.keyword] !== undefined || ((_a = rule.definition.implements) === null || _a === undefined ? undefined : _a.some((kwd) => schema[kwd] !== undefined));
  }
  exports.shouldUseRule = shouldUseRule;
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = undefined;
  var rules_1 = require_rules();
  var applicability_1 = require_applicability();
  var errors_1 = require_errors();
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var DataType;
  (function(DataType2) {
    DataType2[DataType2["Correct"] = 0] = "Correct";
    DataType2[DataType2["Wrong"] = 1] = "Wrong";
  })(DataType || (exports.DataType = DataType = {}));
  function getSchemaTypes(schema) {
    const types = getJSONTypes(schema.type);
    const hasNull = types.includes("null");
    if (hasNull) {
      if (schema.nullable === false)
        throw new Error("type: null contradicts nullable: false");
    } else {
      if (!types.length && schema.nullable !== undefined) {
        throw new Error('"nullable" cannot be used without "type"');
      }
      if (schema.nullable === true)
        types.push("null");
    }
    return types;
  }
  exports.getSchemaTypes = getSchemaTypes;
  function getJSONTypes(ts) {
    const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
    if (types.every(rules_1.isJSONType))
      return types;
    throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
  }
  exports.getJSONTypes = getJSONTypes;
  function coerceAndCheckDataType(it, types) {
    const { gen, data, opts } = it;
    const coerceTo = coerceToTypes(types, opts.coerceTypes);
    const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
    if (checkTypes) {
      const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
      gen.if(wrongType, () => {
        if (coerceTo.length)
          coerceData(it, types, coerceTo);
        else
          reportTypeError(it);
      });
    }
    return checkTypes;
  }
  exports.coerceAndCheckDataType = coerceAndCheckDataType;
  var COERCIBLE = new Set(["string", "number", "integer", "boolean", "null"]);
  function coerceToTypes(types, coerceTypes) {
    return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
  }
  function coerceData(it, types, coerceTo) {
    const { gen, data, opts } = it;
    const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
    const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
    if (opts.coerceTypes === "array") {
      gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
    }
    gen.if((0, codegen_1._)`${coerced} !== undefined`);
    for (const t of coerceTo) {
      if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
        coerceSpecificType(t);
      }
    }
    gen.else();
    reportTypeError(it);
    gen.endIf();
    gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
      gen.assign(data, coerced);
      assignParentData(it, coerced);
    });
    function coerceSpecificType(t) {
      switch (t) {
        case "string":
          gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
          return;
        case "number":
          gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
          return;
        case "integer":
          gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
          return;
        case "boolean":
          gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
          return;
        case "null":
          gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
          gen.assign(coerced, null);
          return;
        case "array":
          gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
      }
    }
  }
  function assignParentData({ gen, parentData, parentDataProperty }, expr) {
    gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
  }
  function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
    const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
    let cond;
    switch (dataType) {
      case "null":
        return (0, codegen_1._)`${data} ${EQ} null`;
      case "array":
        cond = (0, codegen_1._)`Array.isArray(${data})`;
        break;
      case "object":
        cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
        break;
      case "integer":
        cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
        break;
      case "number":
        cond = numCond();
        break;
      default:
        return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
    }
    return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
    function numCond(_cond = codegen_1.nil) {
      return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
    }
  }
  exports.checkDataType = checkDataType;
  function checkDataTypes(dataTypes, data, strictNums, correct) {
    if (dataTypes.length === 1) {
      return checkDataType(dataTypes[0], data, strictNums, correct);
    }
    let cond;
    const types = (0, util_1.toHash)(dataTypes);
    if (types.array && types.object) {
      const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
      cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
      delete types.null;
      delete types.array;
      delete types.object;
    } else {
      cond = codegen_1.nil;
    }
    if (types.number)
      delete types.integer;
    for (const t in types)
      cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
    return cond;
  }
  exports.checkDataTypes = checkDataTypes;
  var typeError = {
    message: ({ schema }) => `must be ${schema}`,
    params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
  };
  function reportTypeError(it) {
    const cxt = getTypeErrorContext(it);
    (0, errors_1.reportError)(cxt, typeError);
  }
  exports.reportTypeError = reportTypeError;
  function getTypeErrorContext(it) {
    const { gen, data, schema } = it;
    const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
    return {
      gen,
      keyword: "type",
      data,
      schema: schema.type,
      schemaCode,
      schemaValue: schemaCode,
      parentSchema: schema,
      params: {},
      it
    };
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.assignDefaults = undefined;
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  function assignDefaults(it, ty) {
    const { properties, items } = it.schema;
    if (ty === "object" && properties) {
      for (const key in properties) {
        assignDefault(it, key, properties[key].default);
      }
    } else if (ty === "array" && Array.isArray(items)) {
      items.forEach((sch, i) => assignDefault(it, i, sch.default));
    }
  }
  exports.assignDefaults = assignDefaults;
  function assignDefault(it, prop, defaultValue) {
    const { gen, compositeRule, data, opts } = it;
    if (defaultValue === undefined)
      return;
    const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
    if (compositeRule) {
      (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
      return;
    }
    let condition = (0, codegen_1._)`${childData} === undefined`;
    if (opts.useDefaults === "empty") {
      condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
    }
    gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = undefined;
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var names_1 = require_names();
  var util_2 = require_util();
  function checkReportMissingProp(cxt, prop) {
    const { gen, data, it } = cxt;
    gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
      cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
      cxt.error();
    });
  }
  exports.checkReportMissingProp = checkReportMissingProp;
  function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
    return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
  }
  exports.checkMissingProp = checkMissingProp;
  function reportMissingProp(cxt, missing) {
    cxt.setParams({ missingProperty: missing }, true);
    cxt.error();
  }
  exports.reportMissingProp = reportMissingProp;
  function hasPropFunc(gen) {
    return gen.scopeValue("func", {
      ref: Object.prototype.hasOwnProperty,
      code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
    });
  }
  exports.hasPropFunc = hasPropFunc;
  function isOwnProperty(gen, data, property) {
    return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
  }
  exports.isOwnProperty = isOwnProperty;
  function propertyInData(gen, data, property, ownProperties) {
    const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
    return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
  }
  exports.propertyInData = propertyInData;
  function noPropertyInData(gen, data, property, ownProperties) {
    const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
    return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
  }
  exports.noPropertyInData = noPropertyInData;
  function allSchemaProperties(schemaMap) {
    return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
  }
  exports.allSchemaProperties = allSchemaProperties;
  function schemaProperties(it, schemaMap) {
    return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
  }
  exports.schemaProperties = schemaProperties;
  function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
    const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
    const valCxt = [
      [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
      [names_1.default.parentData, it.parentData],
      [names_1.default.parentDataProperty, it.parentDataProperty],
      [names_1.default.rootData, names_1.default.rootData]
    ];
    if (it.opts.dynamicRef)
      valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
    const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
    return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
  }
  exports.callValidateCode = callValidateCode;
  var newRegExp = (0, codegen_1._)`new RegExp`;
  function usePattern({ gen, it: { opts } }, pattern) {
    const u = opts.unicodeRegExp ? "u" : "";
    const { regExp } = opts.code;
    const rx = regExp(pattern, u);
    return gen.scopeValue("pattern", {
      key: rx.toString(),
      ref: rx,
      code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
    });
  }
  exports.usePattern = usePattern;
  function validateArray(cxt) {
    const { gen, data, keyword, it } = cxt;
    const valid = gen.name("valid");
    if (it.allErrors) {
      const validArr = gen.let("valid", true);
      validateItems(() => gen.assign(validArr, false));
      return validArr;
    }
    gen.var(valid, true);
    validateItems(() => gen.break());
    return valid;
    function validateItems(notValid) {
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      gen.forRange("i", 0, len, (i) => {
        cxt.subschema({
          keyword,
          dataProp: i,
          dataPropType: util_1.Type.Num
        }, valid);
        gen.if((0, codegen_1.not)(valid), notValid);
      });
    }
  }
  exports.validateArray = validateArray;
  function validateUnion(cxt) {
    const { gen, schema, keyword, it } = cxt;
    if (!Array.isArray(schema))
      throw new Error("ajv implementation error");
    const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
    if (alwaysValid && !it.opts.unevaluated)
      return;
    const valid = gen.let("valid", false);
    const schValid = gen.name("_valid");
    gen.block(() => schema.forEach((_sch, i) => {
      const schCxt = cxt.subschema({
        keyword,
        schemaProp: i,
        compositeRule: true
      }, schValid);
      gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
      const merged = cxt.mergeValidEvaluated(schCxt, schValid);
      if (!merged)
        gen.if((0, codegen_1.not)(valid));
    }));
    cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
  }
  exports.validateUnion = validateUnion;
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = undefined;
  var codegen_1 = require_codegen();
  var names_1 = require_names();
  var code_1 = require_code2();
  var errors_1 = require_errors();
  function macroKeywordCode(cxt, def) {
    const { gen, keyword, schema, parentSchema, it } = cxt;
    const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
    const schemaRef = useKeyword(gen, keyword, macroSchema);
    if (it.opts.validateSchema !== false)
      it.self.validateSchema(macroSchema, true);
    const valid = gen.name("valid");
    cxt.subschema({
      schema: macroSchema,
      schemaPath: codegen_1.nil,
      errSchemaPath: `${it.errSchemaPath}/${keyword}`,
      topSchemaRef: schemaRef,
      compositeRule: true
    }, valid);
    cxt.pass(valid, () => cxt.error(true));
  }
  exports.macroKeywordCode = macroKeywordCode;
  function funcKeywordCode(cxt, def) {
    var _a;
    const { gen, keyword, schema, parentSchema, $data, it } = cxt;
    checkAsyncKeyword(it, def);
    const validate = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
    const validateRef = useKeyword(gen, keyword, validate);
    const valid = gen.let("valid");
    cxt.block$data(valid, validateKeyword);
    cxt.ok((_a = def.valid) !== null && _a !== undefined ? _a : valid);
    function validateKeyword() {
      if (def.errors === false) {
        assignValid();
        if (def.modifying)
          modifyData(cxt);
        reportErrs(() => cxt.error());
      } else {
        const ruleErrs = def.async ? validateAsync() : validateSync();
        if (def.modifying)
          modifyData(cxt);
        reportErrs(() => addErrs(cxt, ruleErrs));
      }
    }
    function validateAsync() {
      const ruleErrs = gen.let("ruleErrs", null);
      gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
      return ruleErrs;
    }
    function validateSync() {
      const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
      gen.assign(validateErrs, null);
      assignValid(codegen_1.nil);
      return validateErrs;
    }
    function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
      const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
      const passSchema = !(("compile" in def) && !$data || def.schema === false);
      gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
    }
    function reportErrs(errors3) {
      var _a2;
      gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== undefined ? _a2 : valid), errors3);
    }
  }
  exports.funcKeywordCode = funcKeywordCode;
  function modifyData(cxt) {
    const { gen, data, it } = cxt;
    gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
  }
  function addErrs(cxt, errs) {
    const { gen } = cxt;
    gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
      gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      (0, errors_1.extendErrors)(cxt);
    }, () => cxt.error());
  }
  function checkAsyncKeyword({ schemaEnv }, def) {
    if (def.async && !schemaEnv.$async)
      throw new Error("async keyword in sync schema");
  }
  function useKeyword(gen, keyword, result) {
    if (result === undefined)
      throw new Error(`keyword "${keyword}" failed to compile`);
    return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
  }
  function validSchemaType(schema, schemaType, allowUndefined = false) {
    return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema == "undefined");
  }
  exports.validSchemaType = validSchemaType;
  function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
    if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
      throw new Error("ajv implementation error");
    }
    const deps = def.dependencies;
    if (deps === null || deps === undefined ? undefined : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
      throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
    }
    if (def.validateSchema) {
      const valid = def.validateSchema(schema[keyword]);
      if (!valid) {
        const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
        if (opts.validateSchema === "log")
          self.logger.error(msg);
        else
          throw new Error(msg);
      }
    }
  }
  exports.validateKeywordUsage = validateKeywordUsage;
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = undefined;
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
    if (keyword !== undefined && schema !== undefined) {
      throw new Error('both "keyword" and "schema" passed, only one allowed');
    }
    if (keyword !== undefined) {
      const sch = it.schema[keyword];
      return schemaProp === undefined ? {
        schema: sch,
        schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`
      } : {
        schema: sch[schemaProp],
        schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
        errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
      };
    }
    if (schema !== undefined) {
      if (schemaPath === undefined || errSchemaPath === undefined || topSchemaRef === undefined) {
        throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
      }
      return {
        schema,
        schemaPath,
        topSchemaRef,
        errSchemaPath
      };
    }
    throw new Error('either "keyword" or "schema" must be passed');
  }
  exports.getSubschema = getSubschema;
  function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
    if (data !== undefined && dataProp !== undefined) {
      throw new Error('both "data" and "dataProp" passed, only one allowed');
    }
    const { gen } = it;
    if (dataProp !== undefined) {
      const { errorPath, dataPathArr, opts } = it;
      const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
      dataContextProps(nextData);
      subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
      subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
      subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
    }
    if (data !== undefined) {
      const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
      dataContextProps(nextData);
      if (propertyName !== undefined)
        subschema.propertyName = propertyName;
    }
    if (dataTypes)
      subschema.dataTypes = dataTypes;
    function dataContextProps(_nextData) {
      subschema.data = _nextData;
      subschema.dataLevel = it.dataLevel + 1;
      subschema.dataTypes = [];
      it.definedProperties = new Set;
      subschema.parentData = it.data;
      subschema.dataNames = [...it.dataNames, _nextData];
    }
  }
  exports.extendSubschemaData = extendSubschemaData;
  function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
    if (compositeRule !== undefined)
      subschema.compositeRule = compositeRule;
    if (createErrors !== undefined)
      subschema.createErrors = createErrors;
    if (allErrors !== undefined)
      subschema.allErrors = allErrors;
    subschema.jtdDiscriminator = jtdDiscriminator;
    subschema.jtdMetadata = jtdMetadata;
  }
  exports.extendSubschemaMode = extendSubschemaMode;
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS((exports, module) => {
  module.exports = function equal(a, b) {
    if (a === b)
      return true;
    if (a && b && typeof a == "object" && typeof b == "object") {
      if (a.constructor !== b.constructor)
        return false;
      var length, i, keys;
      if (Array.isArray(a)) {
        length = a.length;
        if (length != b.length)
          return false;
        for (i = length;i-- !== 0; )
          if (!equal(a[i], b[i]))
            return false;
        return true;
      }
      if (a.constructor === RegExp)
        return a.source === b.source && a.flags === b.flags;
      if (a.valueOf !== Object.prototype.valueOf)
        return a.valueOf() === b.valueOf();
      if (a.toString !== Object.prototype.toString)
        return a.toString() === b.toString();
      keys = Object.keys(a);
      length = keys.length;
      if (length !== Object.keys(b).length)
        return false;
      for (i = length;i-- !== 0; )
        if (!Object.prototype.hasOwnProperty.call(b, keys[i]))
          return false;
      for (i = length;i-- !== 0; ) {
        var key = keys[i];
        if (!equal(a[key], b[key]))
          return false;
      }
      return true;
    }
    return a !== a && b !== b;
  };
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS((exports, module) => {
  var traverse = module.exports = function(schema, opts, cb) {
    if (typeof opts == "function") {
      cb = opts;
      opts = {};
    }
    cb = opts.cb || cb;
    var pre = typeof cb == "function" ? cb : cb.pre || function() {};
    var post = cb.post || function() {};
    _traverse(opts, pre, post, schema, "", schema);
  };
  traverse.keywords = {
    additionalItems: true,
    items: true,
    contains: true,
    additionalProperties: true,
    propertyNames: true,
    not: true,
    if: true,
    then: true,
    else: true
  };
  traverse.arrayKeywords = {
    items: true,
    allOf: true,
    anyOf: true,
    oneOf: true
  };
  traverse.propsKeywords = {
    $defs: true,
    definitions: true,
    properties: true,
    patternProperties: true,
    dependencies: true
  };
  traverse.skipKeywords = {
    default: true,
    enum: true,
    const: true,
    required: true,
    maximum: true,
    minimum: true,
    exclusiveMaximum: true,
    exclusiveMinimum: true,
    multipleOf: true,
    maxLength: true,
    minLength: true,
    pattern: true,
    format: true,
    maxItems: true,
    minItems: true,
    uniqueItems: true,
    maxProperties: true,
    minProperties: true
  };
  function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
    if (schema && typeof schema == "object" && !Array.isArray(schema)) {
      pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      for (var key in schema) {
        var sch = schema[key];
        if (Array.isArray(sch)) {
          if (key in traverse.arrayKeywords) {
            for (var i = 0;i < sch.length; i++)
              _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
          }
        } else if (key in traverse.propsKeywords) {
          if (sch && typeof sch == "object") {
            for (var prop in sch)
              _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
          }
        } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
          _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
        }
      }
      post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
    }
  }
  function escapeJsonPtr(str) {
    return str.replace(/~/g, "~0").replace(/\//g, "~1");
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = undefined;
  var util_1 = require_util();
  var equal = require_fast_deep_equal();
  var traverse = require_json_schema_traverse();
  var SIMPLE_INLINED = new Set([
    "type",
    "format",
    "pattern",
    "maxLength",
    "minLength",
    "maxProperties",
    "minProperties",
    "maxItems",
    "minItems",
    "maximum",
    "minimum",
    "uniqueItems",
    "multipleOf",
    "required",
    "enum",
    "const"
  ]);
  function inlineRef(schema, limit = true) {
    if (typeof schema == "boolean")
      return true;
    if (limit === true)
      return !hasRef(schema);
    if (!limit)
      return false;
    return countKeys(schema) <= limit;
  }
  exports.inlineRef = inlineRef;
  var REF_KEYWORDS = new Set([
    "$ref",
    "$recursiveRef",
    "$recursiveAnchor",
    "$dynamicRef",
    "$dynamicAnchor"
  ]);
  function hasRef(schema) {
    for (const key in schema) {
      if (REF_KEYWORDS.has(key))
        return true;
      const sch = schema[key];
      if (Array.isArray(sch) && sch.some(hasRef))
        return true;
      if (typeof sch == "object" && hasRef(sch))
        return true;
    }
    return false;
  }
  function countKeys(schema) {
    let count = 0;
    for (const key in schema) {
      if (key === "$ref")
        return Infinity;
      count++;
      if (SIMPLE_INLINED.has(key))
        continue;
      if (typeof schema[key] == "object") {
        (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
      }
      if (count === Infinity)
        return Infinity;
    }
    return count;
  }
  function getFullPath(resolver, id = "", normalize) {
    if (normalize !== false)
      id = normalizeId(id);
    const p = resolver.parse(id);
    return _getFullPath(resolver, p);
  }
  exports.getFullPath = getFullPath;
  function _getFullPath(resolver, p) {
    const serialized = resolver.serialize(p);
    return serialized.split("#")[0] + "#";
  }
  exports._getFullPath = _getFullPath;
  var TRAILING_SLASH_HASH = /#\/?$/;
  function normalizeId(id) {
    return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
  }
  exports.normalizeId = normalizeId;
  function resolveUrl(resolver, baseId, id) {
    id = normalizeId(id);
    return resolver.resolve(baseId, id);
  }
  exports.resolveUrl = resolveUrl;
  var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
  function getSchemaRefs(schema, baseId) {
    if (typeof schema == "boolean")
      return {};
    const { schemaId, uriResolver } = this.opts;
    const schId = normalizeId(schema[schemaId] || baseId);
    const baseIds = { "": schId };
    const pathPrefix = getFullPath(uriResolver, schId, false);
    const localRefs = {};
    const schemaRefs = new Set;
    traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
      if (parentJsonPtr === undefined)
        return;
      const fullPath = pathPrefix + jsonPtr;
      let innerBaseId = baseIds[parentJsonPtr];
      if (typeof sch[schemaId] == "string")
        innerBaseId = addRef.call(this, sch[schemaId]);
      addAnchor.call(this, sch.$anchor);
      addAnchor.call(this, sch.$dynamicAnchor);
      baseIds[jsonPtr] = innerBaseId;
      function addRef(ref) {
        const _resolve = this.opts.uriResolver.resolve;
        ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
        if (schemaRefs.has(ref))
          throw ambiguos(ref);
        schemaRefs.add(ref);
        let schOrRef = this.refs[ref];
        if (typeof schOrRef == "string")
          schOrRef = this.refs[schOrRef];
        if (typeof schOrRef == "object") {
          checkAmbiguosRef(sch, schOrRef.schema, ref);
        } else if (ref !== normalizeId(fullPath)) {
          if (ref[0] === "#") {
            checkAmbiguosRef(sch, localRefs[ref], ref);
            localRefs[ref] = sch;
          } else {
            this.refs[ref] = fullPath;
          }
        }
        return ref;
      }
      function addAnchor(anchor) {
        if (typeof anchor == "string") {
          if (!ANCHOR.test(anchor))
            throw new Error(`invalid anchor "${anchor}"`);
          addRef.call(this, `#${anchor}`);
        }
      }
    });
    return localRefs;
    function checkAmbiguosRef(sch1, sch2, ref) {
      if (sch2 !== undefined && !equal(sch1, sch2))
        throw ambiguos(ref);
    }
    function ambiguos(ref) {
      return new Error(`reference "${ref}" resolves to more than one schema`);
    }
  }
  exports.getSchemaRefs = getSchemaRefs;
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.getData = exports.KeywordCxt = exports.validateFunctionCode = undefined;
  var boolSchema_1 = require_boolSchema();
  var dataType_1 = require_dataType();
  var applicability_1 = require_applicability();
  var dataType_2 = require_dataType();
  var defaults_1 = require_defaults();
  var keyword_1 = require_keyword();
  var subschema_1 = require_subschema();
  var codegen_1 = require_codegen();
  var names_1 = require_names();
  var resolve_1 = require_resolve();
  var util_1 = require_util();
  var errors_1 = require_errors();
  function validateFunctionCode(it) {
    if (isSchemaObj(it)) {
      checkKeywords(it);
      if (schemaCxtHasRules(it)) {
        topSchemaObjCode(it);
        return;
      }
    }
    validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
  }
  exports.validateFunctionCode = validateFunctionCode;
  function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
    if (opts.code.es5) {
      gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
        gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
        destructureValCxtES5(gen, opts);
        gen.code(body);
      });
    } else {
      gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
    }
  }
  function destructureValCxt(opts) {
    return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
  }
  function destructureValCxtES5(gen, opts) {
    gen.if(names_1.default.valCxt, () => {
      gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
      gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
      gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
      gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
      if (opts.dynamicRef)
        gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
    }, () => {
      gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
      gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
      gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
      gen.var(names_1.default.rootData, names_1.default.data);
      if (opts.dynamicRef)
        gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
    });
  }
  function topSchemaObjCode(it) {
    const { schema, opts, gen } = it;
    validateFunction(it, () => {
      if (opts.$comment && schema.$comment)
        commentKeyword(it);
      checkNoDefault(it);
      gen.let(names_1.default.vErrors, null);
      gen.let(names_1.default.errors, 0);
      if (opts.unevaluated)
        resetEvaluated(it);
      typeAndKeywords(it);
      returnResults(it);
    });
    return;
  }
  function resetEvaluated(it) {
    const { gen, validateName } = it;
    it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
    gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
    gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
  }
  function funcSourceUrl(schema, opts) {
    const schId = typeof schema == "object" && schema[opts.schemaId];
    return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
  }
  function subschemaCode(it, valid) {
    if (isSchemaObj(it)) {
      checkKeywords(it);
      if (schemaCxtHasRules(it)) {
        subSchemaObjCode(it, valid);
        return;
      }
    }
    (0, boolSchema_1.boolOrEmptySchema)(it, valid);
  }
  function schemaCxtHasRules({ schema, self }) {
    if (typeof schema == "boolean")
      return !schema;
    for (const key in schema)
      if (self.RULES.all[key])
        return true;
    return false;
  }
  function isSchemaObj(it) {
    return typeof it.schema != "boolean";
  }
  function subSchemaObjCode(it, valid) {
    const { schema, gen, opts } = it;
    if (opts.$comment && schema.$comment)
      commentKeyword(it);
    updateContext(it);
    checkAsyncSchema(it);
    const errsCount = gen.const("_errs", names_1.default.errors);
    typeAndKeywords(it, errsCount);
    gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
  }
  function checkKeywords(it) {
    (0, util_1.checkUnknownRules)(it);
    checkRefsAndKeywords(it);
  }
  function typeAndKeywords(it, errsCount) {
    if (it.opts.jtd)
      return schemaKeywords(it, [], false, errsCount);
    const types = (0, dataType_1.getSchemaTypes)(it.schema);
    const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
    schemaKeywords(it, types, !checkedTypes, errsCount);
  }
  function checkRefsAndKeywords(it) {
    const { schema, errSchemaPath, opts, self } = it;
    if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) {
      self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
    }
  }
  function checkNoDefault(it) {
    const { schema, opts } = it;
    if (schema.default !== undefined && opts.useDefaults && opts.strictSchema) {
      (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
    }
  }
  function updateContext(it) {
    const schId = it.schema[it.opts.schemaId];
    if (schId)
      it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
  }
  function checkAsyncSchema(it) {
    if (it.schema.$async && !it.schemaEnv.$async)
      throw new Error("async schema in sync schema");
  }
  function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
    const msg = schema.$comment;
    if (opts.$comment === true) {
      gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
    } else if (typeof opts.$comment == "function") {
      const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
      const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
      gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
    }
  }
  function returnResults(it) {
    const { gen, schemaEnv, validateName, ValidationError, opts } = it;
    if (schemaEnv.$async) {
      gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
    } else {
      gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
      if (opts.unevaluated)
        assignEvaluated(it);
      gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
    }
  }
  function assignEvaluated({ gen, evaluated, props, items }) {
    if (props instanceof codegen_1.Name)
      gen.assign((0, codegen_1._)`${evaluated}.props`, props);
    if (items instanceof codegen_1.Name)
      gen.assign((0, codegen_1._)`${evaluated}.items`, items);
  }
  function schemaKeywords(it, types, typeErrors, errsCount) {
    const { gen, schema, data, allErrors, opts, self } = it;
    const { RULES } = self;
    if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
      gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
      return;
    }
    if (!opts.jtd)
      checkStrictTypes(it, types);
    gen.block(() => {
      for (const group of RULES.rules)
        groupKeywords(group);
      groupKeywords(RULES.post);
    });
    function groupKeywords(group) {
      if (!(0, applicability_1.shouldUseGroup)(schema, group))
        return;
      if (group.type) {
        gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
        iterateKeywords(it, group);
        if (types.length === 1 && types[0] === group.type && typeErrors) {
          gen.else();
          (0, dataType_2.reportTypeError)(it);
        }
        gen.endIf();
      } else {
        iterateKeywords(it, group);
      }
      if (!allErrors)
        gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
    }
  }
  function iterateKeywords(it, group) {
    const { gen, schema, opts: { useDefaults } } = it;
    if (useDefaults)
      (0, defaults_1.assignDefaults)(it, group.type);
    gen.block(() => {
      for (const rule of group.rules) {
        if ((0, applicability_1.shouldUseRule)(schema, rule)) {
          keywordCode(it, rule.keyword, rule.definition, group.type);
        }
      }
    });
  }
  function checkStrictTypes(it, types) {
    if (it.schemaEnv.meta || !it.opts.strictTypes)
      return;
    checkContextTypes(it, types);
    if (!it.opts.allowUnionTypes)
      checkMultipleTypes(it, types);
    checkKeywordTypes(it, it.dataTypes);
  }
  function checkContextTypes(it, types) {
    if (!types.length)
      return;
    if (!it.dataTypes.length) {
      it.dataTypes = types;
      return;
    }
    types.forEach((t) => {
      if (!includesType(it.dataTypes, t)) {
        strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
      }
    });
    narrowSchemaTypes(it, types);
  }
  function checkMultipleTypes(it, ts) {
    if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
      strictTypesError(it, "use allowUnionTypes to allow union type keyword");
    }
  }
  function checkKeywordTypes(it, ts) {
    const rules = it.self.RULES.all;
    for (const keyword in rules) {
      const rule = rules[keyword];
      if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
        const { type } = rule.definition;
        if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
          strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
        }
      }
    }
  }
  function hasApplicableType(schTs, kwdT) {
    return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
  }
  function includesType(ts, t) {
    return ts.includes(t) || t === "integer" && ts.includes("number");
  }
  function narrowSchemaTypes(it, withTypes) {
    const ts = [];
    for (const t of it.dataTypes) {
      if (includesType(withTypes, t))
        ts.push(t);
      else if (withTypes.includes("integer") && t === "number")
        ts.push("integer");
    }
    it.dataTypes = ts;
  }
  function strictTypesError(it, msg) {
    const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
    msg += ` at "${schemaPath}" (strictTypes)`;
    (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
  }

  class KeywordCxt {
    constructor(it, def, keyword) {
      (0, keyword_1.validateKeywordUsage)(it, def, keyword);
      this.gen = it.gen;
      this.allErrors = it.allErrors;
      this.keyword = keyword;
      this.data = it.data;
      this.schema = it.schema[keyword];
      this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
      this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
      this.schemaType = def.schemaType;
      this.parentSchema = it.schema;
      this.params = {};
      this.it = it;
      this.def = def;
      if (this.$data) {
        this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
      } else {
        this.schemaCode = this.schemaValue;
        if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
          throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
        }
      }
      if ("code" in def ? def.trackErrors : def.errors !== false) {
        this.errsCount = it.gen.const("_errs", names_1.default.errors);
      }
    }
    result(condition, successAction, failAction) {
      this.failResult((0, codegen_1.not)(condition), successAction, failAction);
    }
    failResult(condition, successAction, failAction) {
      this.gen.if(condition);
      if (failAction)
        failAction();
      else
        this.error();
      if (successAction) {
        this.gen.else();
        successAction();
        if (this.allErrors)
          this.gen.endIf();
      } else {
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
    }
    pass(condition, failAction) {
      this.failResult((0, codegen_1.not)(condition), undefined, failAction);
    }
    fail(condition) {
      if (condition === undefined) {
        this.error();
        if (!this.allErrors)
          this.gen.if(false);
        return;
      }
      this.gen.if(condition);
      this.error();
      if (this.allErrors)
        this.gen.endIf();
      else
        this.gen.else();
    }
    fail$data(condition) {
      if (!this.$data)
        return this.fail(condition);
      const { schemaCode } = this;
      this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
    }
    error(append, errorParams, errorPaths) {
      if (errorParams) {
        this.setParams(errorParams);
        this._error(append, errorPaths);
        this.setParams({});
        return;
      }
      this._error(append, errorPaths);
    }
    _error(append, errorPaths) {
      (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
    }
    $dataError() {
      (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
    }
    reset() {
      if (this.errsCount === undefined)
        throw new Error('add "trackErrors" to keyword definition');
      (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
    }
    ok(cond) {
      if (!this.allErrors)
        this.gen.if(cond);
    }
    setParams(obj, assign) {
      if (assign)
        Object.assign(this.params, obj);
      else
        this.params = obj;
    }
    block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
      this.gen.block(() => {
        this.check$data(valid, $dataValid);
        codeBlock();
      });
    }
    check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
      if (!this.$data)
        return;
      const { gen, schemaCode, schemaType, def } = this;
      gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
      if (valid !== codegen_1.nil)
        gen.assign(valid, true);
      if (schemaType.length || def.validateSchema) {
        gen.elseIf(this.invalid$data());
        this.$dataError();
        if (valid !== codegen_1.nil)
          gen.assign(valid, false);
      }
      gen.else();
    }
    invalid$data() {
      const { gen, schemaCode, schemaType, def, it } = this;
      return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
      function wrong$DataType() {
        if (schemaType.length) {
          if (!(schemaCode instanceof codegen_1.Name))
            throw new Error("ajv implementation error");
          const st = Array.isArray(schemaType) ? schemaType : [schemaType];
          return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
        }
        return codegen_1.nil;
      }
      function invalid$DataSchema() {
        if (def.validateSchema) {
          const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
          return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
        }
        return codegen_1.nil;
      }
    }
    subschema(appl, valid) {
      const subschema = (0, subschema_1.getSubschema)(this.it, appl);
      (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
      (0, subschema_1.extendSubschemaMode)(subschema, appl);
      const nextContext = { ...this.it, ...subschema, items: undefined, props: undefined };
      subschemaCode(nextContext, valid);
      return nextContext;
    }
    mergeEvaluated(schemaCxt, toName) {
      const { it, gen } = this;
      if (!it.opts.unevaluated)
        return;
      if (it.props !== true && schemaCxt.props !== undefined) {
        it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
      }
      if (it.items !== true && schemaCxt.items !== undefined) {
        it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
      }
    }
    mergeValidEvaluated(schemaCxt, valid) {
      const { it, gen } = this;
      if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
        gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
        return true;
      }
    }
  }
  exports.KeywordCxt = KeywordCxt;
  function keywordCode(it, keyword, def, ruleType) {
    const cxt = new KeywordCxt(it, def, keyword);
    if ("code" in def) {
      def.code(cxt, ruleType);
    } else if (cxt.$data && def.validate) {
      (0, keyword_1.funcKeywordCode)(cxt, def);
    } else if ("macro" in def) {
      (0, keyword_1.macroKeywordCode)(cxt, def);
    } else if (def.compile || def.validate) {
      (0, keyword_1.funcKeywordCode)(cxt, def);
    }
  }
  var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
  var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
  function getData($data, { dataLevel, dataNames, dataPathArr }) {
    let jsonPointer;
    let data;
    if ($data === "")
      return names_1.default.rootData;
    if ($data[0] === "/") {
      if (!JSON_POINTER.test($data))
        throw new Error(`Invalid JSON-pointer: ${$data}`);
      jsonPointer = $data;
      data = names_1.default.rootData;
    } else {
      const matches = RELATIVE_JSON_POINTER.exec($data);
      if (!matches)
        throw new Error(`Invalid JSON-pointer: ${$data}`);
      const up = +matches[1];
      jsonPointer = matches[2];
      if (jsonPointer === "#") {
        if (up >= dataLevel)
          throw new Error(errorMsg("property/index", up));
        return dataPathArr[dataLevel - up];
      }
      if (up > dataLevel)
        throw new Error(errorMsg("data", up));
      data = dataNames[dataLevel - up];
      if (!jsonPointer)
        return data;
    }
    let expr = data;
    const segments = jsonPointer.split("/");
    for (const segment of segments) {
      if (segment) {
        data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
        expr = (0, codegen_1._)`${expr} && ${data}`;
      }
    }
    return expr;
    function errorMsg(pointerType, up) {
      return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
    }
  }
  exports.getData = getData;
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });

  class ValidationError extends Error {
    constructor(errors3) {
      super("validation failed");
      this.errors = errors3;
      this.ajv = this.validation = true;
    }
  }
  exports.default = ValidationError;
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var resolve_1 = require_resolve();

  class MissingRefError extends Error {
    constructor(resolver, baseId, ref, msg) {
      super(msg || `can't resolve reference ${ref} from id ${baseId}`);
      this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
      this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
    }
  }
  exports.default = MissingRefError;
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = undefined;
  var codegen_1 = require_codegen();
  var validation_error_1 = require_validation_error();
  var names_1 = require_names();
  var resolve_1 = require_resolve();
  var util_1 = require_util();
  var validate_1 = require_validate();

  class SchemaEnv {
    constructor(env) {
      var _a;
      this.refs = {};
      this.dynamicAnchors = {};
      let schema;
      if (typeof env.schema == "object")
        schema = env.schema;
      this.schema = env.schema;
      this.schemaId = env.schemaId;
      this.root = env.root || this;
      this.baseId = (_a = env.baseId) !== null && _a !== undefined ? _a : (0, resolve_1.normalizeId)(schema === null || schema === undefined ? undefined : schema[env.schemaId || "$id"]);
      this.schemaPath = env.schemaPath;
      this.localRefs = env.localRefs;
      this.meta = env.meta;
      this.$async = schema === null || schema === undefined ? undefined : schema.$async;
      this.refs = {};
    }
  }
  exports.SchemaEnv = SchemaEnv;
  function compileSchema(sch) {
    const _sch = getCompilingSchema.call(this, sch);
    if (_sch)
      return _sch;
    const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
    const { es5, lines } = this.opts.code;
    const { ownProperties } = this.opts;
    const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
    let _ValidationError;
    if (sch.$async) {
      _ValidationError = gen.scopeValue("Error", {
        ref: validation_error_1.default,
        code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
      });
    }
    const validateName = gen.scopeName("validate");
    sch.validateName = validateName;
    const schemaCxt = {
      gen,
      allErrors: this.opts.allErrors,
      data: names_1.default.data,
      parentData: names_1.default.parentData,
      parentDataProperty: names_1.default.parentDataProperty,
      dataNames: [names_1.default.data],
      dataPathArr: [codegen_1.nil],
      dataLevel: 0,
      dataTypes: [],
      definedProperties: new Set,
      topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
      validateName,
      ValidationError: _ValidationError,
      schema: sch.schema,
      schemaEnv: sch,
      rootId,
      baseId: sch.baseId || rootId,
      schemaPath: codegen_1.nil,
      errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
      errorPath: (0, codegen_1._)`""`,
      opts: this.opts,
      self: this
    };
    let sourceCode;
    try {
      this._compilations.add(sch);
      (0, validate_1.validateFunctionCode)(schemaCxt);
      gen.optimize(this.opts.code.optimize);
      const validateCode = gen.toString();
      sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
      if (this.opts.code.process)
        sourceCode = this.opts.code.process(sourceCode, sch);
      const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
      const validate = makeValidate(this, this.scope.get());
      this.scope.value(validateName, { ref: validate });
      validate.errors = null;
      validate.schema = sch.schema;
      validate.schemaEnv = sch;
      if (sch.$async)
        validate.$async = true;
      if (this.opts.code.source === true) {
        validate.source = { validateName, validateCode, scopeValues: gen._values };
      }
      if (this.opts.unevaluated) {
        const { props, items } = schemaCxt;
        validate.evaluated = {
          props: props instanceof codegen_1.Name ? undefined : props,
          items: items instanceof codegen_1.Name ? undefined : items,
          dynamicProps: props instanceof codegen_1.Name,
          dynamicItems: items instanceof codegen_1.Name
        };
        if (validate.source)
          validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
      }
      sch.validate = validate;
      return sch;
    } catch (e) {
      delete sch.validate;
      delete sch.validateName;
      if (sourceCode)
        this.logger.error("Error compiling schema, function code:", sourceCode);
      throw e;
    } finally {
      this._compilations.delete(sch);
    }
  }
  exports.compileSchema = compileSchema;
  function resolveRef(root, baseId, ref) {
    var _a;
    ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
    const schOrFunc = root.refs[ref];
    if (schOrFunc)
      return schOrFunc;
    let _sch = resolve2.call(this, root, ref);
    if (_sch === undefined) {
      const schema = (_a = root.localRefs) === null || _a === undefined ? undefined : _a[ref];
      const { schemaId } = this.opts;
      if (schema)
        _sch = new SchemaEnv({ schema, schemaId, root, baseId });
    }
    if (_sch === undefined)
      return;
    return root.refs[ref] = inlineOrCompile.call(this, _sch);
  }
  exports.resolveRef = resolveRef;
  function inlineOrCompile(sch) {
    if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
      return sch.schema;
    return sch.validate ? sch : compileSchema.call(this, sch);
  }
  function getCompilingSchema(schEnv) {
    for (const sch of this._compilations) {
      if (sameSchemaEnv(sch, schEnv))
        return sch;
    }
  }
  exports.getCompilingSchema = getCompilingSchema;
  function sameSchemaEnv(s1, s2) {
    return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
  }
  function resolve2(root, ref) {
    let sch;
    while (typeof (sch = this.refs[ref]) == "string")
      ref = sch;
    return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
  }
  function resolveSchema(root, ref) {
    const p = this.opts.uriResolver.parse(ref);
    const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
    let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, undefined);
    if (Object.keys(root.schema).length > 0 && refPath === baseId) {
      return getJsonPointer.call(this, p, root);
    }
    const id = (0, resolve_1.normalizeId)(refPath);
    const schOrRef = this.refs[id] || this.schemas[id];
    if (typeof schOrRef == "string") {
      const sch = resolveSchema.call(this, root, schOrRef);
      if (typeof (sch === null || sch === undefined ? undefined : sch.schema) !== "object")
        return;
      return getJsonPointer.call(this, p, sch);
    }
    if (typeof (schOrRef === null || schOrRef === undefined ? undefined : schOrRef.schema) !== "object")
      return;
    if (!schOrRef.validate)
      compileSchema.call(this, schOrRef);
    if (id === (0, resolve_1.normalizeId)(ref)) {
      const { schema } = schOrRef;
      const { schemaId } = this.opts;
      const schId = schema[schemaId];
      if (schId)
        baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
      return new SchemaEnv({ schema, schemaId, root, baseId });
    }
    return getJsonPointer.call(this, p, schOrRef);
  }
  exports.resolveSchema = resolveSchema;
  var PREVENT_SCOPE_CHANGE = new Set([
    "properties",
    "patternProperties",
    "enum",
    "dependencies",
    "definitions"
  ]);
  function getJsonPointer(parsedRef, { baseId, schema, root }) {
    var _a;
    if (((_a = parsedRef.fragment) === null || _a === undefined ? undefined : _a[0]) !== "/")
      return;
    for (const part of parsedRef.fragment.slice(1).split("/")) {
      if (typeof schema === "boolean")
        return;
      const partSchema = schema[(0, util_1.unescapeFragment)(part)];
      if (partSchema === undefined)
        return;
      schema = partSchema;
      const schId = typeof schema === "object" && schema[this.opts.schemaId];
      if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
        baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
      }
    }
    let env;
    if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
      const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
      env = resolveSchema.call(this, root, $ref);
    }
    const { schemaId } = this.opts;
    env = env || new SchemaEnv({ schema, schemaId, root, baseId });
    if (env.schema !== env.root.schema)
      return env;
    return;
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS((exports, module) => {
  module.exports = {
    $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
    description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
    type: "object",
    required: ["$data"],
    properties: {
      $data: {
        type: "string",
        anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
      }
    },
    additionalProperties: false
  };
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS((exports, module) => {
  var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
  var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
  function stringArrayToHexStripped(input) {
    let acc = "";
    let code = 0;
    let i = 0;
    for (i = 0;i < input.length; i++) {
      code = input[i].charCodeAt(0);
      if (code === 48) {
        continue;
      }
      if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
        return "";
      }
      acc += input[i];
      break;
    }
    for (i += 1;i < input.length; i++) {
      code = input[i].charCodeAt(0);
      if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
        return "";
      }
      acc += input[i];
    }
    return acc;
  }
  var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
  function consumeIsZone(buffer) {
    buffer.length = 0;
    return true;
  }
  function consumeHextets(buffer, address, output) {
    if (buffer.length) {
      const hex = stringArrayToHexStripped(buffer);
      if (hex !== "") {
        address.push(hex);
      } else {
        output.error = true;
        return false;
      }
      buffer.length = 0;
    }
    return true;
  }
  function getIPV6(input) {
    let tokenCount = 0;
    const output = { error: false, address: "", zone: "" };
    const address = [];
    const buffer = [];
    let endipv6Encountered = false;
    let endIpv6 = false;
    let consume = consumeHextets;
    for (let i = 0;i < input.length; i++) {
      const cursor = input[i];
      if (cursor === "[" || cursor === "]") {
        continue;
      }
      if (cursor === ":") {
        if (endipv6Encountered === true) {
          endIpv6 = true;
        }
        if (!consume(buffer, address, output)) {
          break;
        }
        if (++tokenCount > 7) {
          output.error = true;
          break;
        }
        if (i > 0 && input[i - 1] === ":") {
          endipv6Encountered = true;
        }
        address.push(":");
        continue;
      } else if (cursor === "%") {
        if (!consume(buffer, address, output)) {
          break;
        }
        consume = consumeIsZone;
      } else {
        buffer.push(cursor);
        continue;
      }
    }
    if (buffer.length) {
      if (consume === consumeIsZone) {
        output.zone = buffer.join("");
      } else if (endIpv6) {
        address.push(buffer.join(""));
      } else {
        address.push(stringArrayToHexStripped(buffer));
      }
    }
    output.address = address.join("");
    return output;
  }
  function normalizeIPv6(host) {
    if (findToken(host, ":") < 2) {
      return { host, isIPV6: false };
    }
    const ipv62 = getIPV6(host);
    if (!ipv62.error) {
      let newHost = ipv62.address;
      let escapedHost = ipv62.address;
      if (ipv62.zone) {
        newHost += "%" + ipv62.zone;
        escapedHost += "%25" + ipv62.zone;
      }
      return { host: newHost, isIPV6: true, escapedHost };
    } else {
      return { host, isIPV6: false };
    }
  }
  function findToken(str, token) {
    let ind = 0;
    for (let i = 0;i < str.length; i++) {
      if (str[i] === token)
        ind++;
    }
    return ind;
  }
  function removeDotSegments(path) {
    let input = path;
    const output = [];
    let nextSlash = -1;
    let len = 0;
    while (len = input.length) {
      if (len === 1) {
        if (input === ".") {
          break;
        } else if (input === "/") {
          output.push("/");
          break;
        } else {
          output.push(input);
          break;
        }
      } else if (len === 2) {
        if (input[0] === ".") {
          if (input[1] === ".") {
            break;
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === "." || input[1] === "/") {
            output.push("/");
            break;
          }
        }
      } else if (len === 3) {
        if (input === "/..") {
          if (output.length !== 0) {
            output.pop();
          }
          output.push("/");
          break;
        }
      }
      if (input[0] === ".") {
        if (input[1] === ".") {
          if (input[2] === "/") {
            input = input.slice(3);
            continue;
          }
        } else if (input[1] === "/") {
          input = input.slice(2);
          continue;
        }
      } else if (input[0] === "/") {
        if (input[1] === ".") {
          if (input[2] === "/") {
            input = input.slice(2);
            continue;
          } else if (input[2] === ".") {
            if (input[3] === "/") {
              input = input.slice(3);
              if (output.length !== 0) {
                output.pop();
              }
              continue;
            }
          }
        }
      }
      if ((nextSlash = input.indexOf("/", 1)) === -1) {
        output.push(input);
        break;
      } else {
        output.push(input.slice(0, nextSlash));
        input = input.slice(nextSlash);
      }
    }
    return output.join("");
  }
  function normalizeComponentEncoding(component, esc2) {
    const func = esc2 !== true ? escape : unescape;
    if (component.scheme !== undefined) {
      component.scheme = func(component.scheme);
    }
    if (component.userinfo !== undefined) {
      component.userinfo = func(component.userinfo);
    }
    if (component.host !== undefined) {
      component.host = func(component.host);
    }
    if (component.path !== undefined) {
      component.path = func(component.path);
    }
    if (component.query !== undefined) {
      component.query = func(component.query);
    }
    if (component.fragment !== undefined) {
      component.fragment = func(component.fragment);
    }
    return component;
  }
  function recomposeAuthority(component) {
    const uriTokens = [];
    if (component.userinfo !== undefined) {
      uriTokens.push(component.userinfo);
      uriTokens.push("@");
    }
    if (component.host !== undefined) {
      let host = unescape(component.host);
      if (!isIPv4(host)) {
        const ipV6res = normalizeIPv6(host);
        if (ipV6res.isIPV6 === true) {
          host = `[${ipV6res.escapedHost}]`;
        } else {
          host = component.host;
        }
      }
      uriTokens.push(host);
    }
    if (typeof component.port === "number" || typeof component.port === "string") {
      uriTokens.push(":");
      uriTokens.push(String(component.port));
    }
    return uriTokens.length ? uriTokens.join("") : undefined;
  }
  module.exports = {
    nonSimpleDomain,
    recomposeAuthority,
    normalizeComponentEncoding,
    removeDotSegments,
    isIPv4,
    isUUID,
    normalizeIPv6,
    stringArrayToHexStripped
  };
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS((exports, module) => {
  var { isUUID } = require_utils();
  var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
  var supportedSchemeNames = [
    "http",
    "https",
    "ws",
    "wss",
    "urn",
    "urn:uuid"
  ];
  function isValidSchemeName(name) {
    return supportedSchemeNames.indexOf(name) !== -1;
  }
  function wsIsSecure(wsComponent) {
    if (wsComponent.secure === true) {
      return true;
    } else if (wsComponent.secure === false) {
      return false;
    } else if (wsComponent.scheme) {
      return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
    } else {
      return false;
    }
  }
  function httpParse(component) {
    if (!component.host) {
      component.error = component.error || "HTTP URIs must have a host.";
    }
    return component;
  }
  function httpSerialize(component) {
    const secure = String(component.scheme).toLowerCase() === "https";
    if (component.port === (secure ? 443 : 80) || component.port === "") {
      component.port = undefined;
    }
    if (!component.path) {
      component.path = "/";
    }
    return component;
  }
  function wsParse(wsComponent) {
    wsComponent.secure = wsIsSecure(wsComponent);
    wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
    wsComponent.path = undefined;
    wsComponent.query = undefined;
    return wsComponent;
  }
  function wsSerialize(wsComponent) {
    if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
      wsComponent.port = undefined;
    }
    if (typeof wsComponent.secure === "boolean") {
      wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
      wsComponent.secure = undefined;
    }
    if (wsComponent.resourceName) {
      const [path, query] = wsComponent.resourceName.split("?");
      wsComponent.path = path && path !== "/" ? path : undefined;
      wsComponent.query = query;
      wsComponent.resourceName = undefined;
    }
    wsComponent.fragment = undefined;
    return wsComponent;
  }
  function urnParse(urnComponent, options) {
    if (!urnComponent.path) {
      urnComponent.error = "URN can not be parsed";
      return urnComponent;
    }
    const matches = urnComponent.path.match(URN_REG);
    if (matches) {
      const scheme = options.scheme || urnComponent.scheme || "urn";
      urnComponent.nid = matches[1].toLowerCase();
      urnComponent.nss = matches[2];
      const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      urnComponent.path = undefined;
      if (schemeHandler) {
        urnComponent = schemeHandler.parse(urnComponent, options);
      }
    } else {
      urnComponent.error = urnComponent.error || "URN can not be parsed.";
    }
    return urnComponent;
  }
  function urnSerialize(urnComponent, options) {
    if (urnComponent.nid === undefined) {
      throw new Error("URN without nid cannot be serialized");
    }
    const scheme = options.scheme || urnComponent.scheme || "urn";
    const nid = urnComponent.nid.toLowerCase();
    const urnScheme = `${scheme}:${options.nid || nid}`;
    const schemeHandler = getSchemeHandler(urnScheme);
    if (schemeHandler) {
      urnComponent = schemeHandler.serialize(urnComponent, options);
    }
    const uriComponent = urnComponent;
    const nss = urnComponent.nss;
    uriComponent.path = `${nid || options.nid}:${nss}`;
    options.skipEscape = true;
    return uriComponent;
  }
  function urnuuidParse(urnComponent, options) {
    const uuidComponent = urnComponent;
    uuidComponent.uuid = uuidComponent.nss;
    uuidComponent.nss = undefined;
    if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
      uuidComponent.error = uuidComponent.error || "UUID is not valid.";
    }
    return uuidComponent;
  }
  function urnuuidSerialize(uuidComponent) {
    const urnComponent = uuidComponent;
    urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
    return urnComponent;
  }
  var http = {
    scheme: "http",
    domainHost: true,
    parse: httpParse,
    serialize: httpSerialize
  };
  var https = {
    scheme: "https",
    domainHost: http.domainHost,
    parse: httpParse,
    serialize: httpSerialize
  };
  var ws = {
    scheme: "ws",
    domainHost: true,
    parse: wsParse,
    serialize: wsSerialize
  };
  var wss = {
    scheme: "wss",
    domainHost: ws.domainHost,
    parse: ws.parse,
    serialize: ws.serialize
  };
  var urn = {
    scheme: "urn",
    parse: urnParse,
    serialize: urnSerialize,
    skipNormalize: true
  };
  var urnuuid = {
    scheme: "urn:uuid",
    parse: urnuuidParse,
    serialize: urnuuidSerialize,
    skipNormalize: true
  };
  var SCHEMES = {
    http,
    https,
    ws,
    wss,
    urn,
    "urn:uuid": urnuuid
  };
  Object.setPrototypeOf(SCHEMES, null);
  function getSchemeHandler(scheme) {
    return scheme && (SCHEMES[scheme] || SCHEMES[scheme.toLowerCase()]) || undefined;
  }
  module.exports = {
    wsIsSecure,
    SCHEMES,
    isValidSchemeName,
    getSchemeHandler
  };
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS((exports, module) => {
  var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizeComponentEncoding, isIPv4, nonSimpleDomain } = require_utils();
  var { SCHEMES, getSchemeHandler } = require_schemes();
  function normalize(uri, options) {
    if (typeof uri === "string") {
      uri = serialize(parse6(uri, options), options);
    } else if (typeof uri === "object") {
      uri = parse6(serialize(uri, options), options);
    }
    return uri;
  }
  function resolve2(baseURI, relativeURI, options) {
    const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
    const resolved = resolveComponent(parse6(baseURI, schemelessOptions), parse6(relativeURI, schemelessOptions), schemelessOptions, true);
    schemelessOptions.skipEscape = true;
    return serialize(resolved, schemelessOptions);
  }
  function resolveComponent(base, relative, options, skipNormalization) {
    const target = {};
    if (!skipNormalization) {
      base = parse6(serialize(base, options), options);
      relative = parse6(serialize(relative, options), options);
    }
    options = options || {};
    if (!options.tolerant && relative.scheme) {
      target.scheme = relative.scheme;
      target.userinfo = relative.userinfo;
      target.host = relative.host;
      target.port = relative.port;
      target.path = removeDotSegments(relative.path || "");
      target.query = relative.query;
    } else {
      if (relative.userinfo !== undefined || relative.host !== undefined || relative.port !== undefined) {
        target.userinfo = relative.userinfo;
        target.host = relative.host;
        target.port = relative.port;
        target.path = removeDotSegments(relative.path || "");
        target.query = relative.query;
      } else {
        if (!relative.path) {
          target.path = base.path;
          if (relative.query !== undefined) {
            target.query = relative.query;
          } else {
            target.query = base.query;
          }
        } else {
          if (relative.path[0] === "/") {
            target.path = removeDotSegments(relative.path);
          } else {
            if ((base.userinfo !== undefined || base.host !== undefined || base.port !== undefined) && !base.path) {
              target.path = "/" + relative.path;
            } else if (!base.path) {
              target.path = relative.path;
            } else {
              target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path;
            }
            target.path = removeDotSegments(target.path);
          }
          target.query = relative.query;
        }
        target.userinfo = base.userinfo;
        target.host = base.host;
        target.port = base.port;
      }
      target.scheme = base.scheme;
    }
    target.fragment = relative.fragment;
    return target;
  }
  function equal(uriA, uriB, options) {
    if (typeof uriA === "string") {
      uriA = unescape(uriA);
      uriA = serialize(normalizeComponentEncoding(parse6(uriA, options), true), { ...options, skipEscape: true });
    } else if (typeof uriA === "object") {
      uriA = serialize(normalizeComponentEncoding(uriA, true), { ...options, skipEscape: true });
    }
    if (typeof uriB === "string") {
      uriB = unescape(uriB);
      uriB = serialize(normalizeComponentEncoding(parse6(uriB, options), true), { ...options, skipEscape: true });
    } else if (typeof uriB === "object") {
      uriB = serialize(normalizeComponentEncoding(uriB, true), { ...options, skipEscape: true });
    }
    return uriA.toLowerCase() === uriB.toLowerCase();
  }
  function serialize(cmpts, opts) {
    const component = {
      host: cmpts.host,
      scheme: cmpts.scheme,
      userinfo: cmpts.userinfo,
      port: cmpts.port,
      path: cmpts.path,
      query: cmpts.query,
      nid: cmpts.nid,
      nss: cmpts.nss,
      uuid: cmpts.uuid,
      fragment: cmpts.fragment,
      reference: cmpts.reference,
      resourceName: cmpts.resourceName,
      secure: cmpts.secure,
      error: ""
    };
    const options = Object.assign({}, opts);
    const uriTokens = [];
    const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
    if (schemeHandler && schemeHandler.serialize)
      schemeHandler.serialize(component, options);
    if (component.path !== undefined) {
      if (!options.skipEscape) {
        component.path = escape(component.path);
        if (component.scheme !== undefined) {
          component.path = component.path.split("%3A").join(":");
        }
      } else {
        component.path = unescape(component.path);
      }
    }
    if (options.reference !== "suffix" && component.scheme) {
      uriTokens.push(component.scheme, ":");
    }
    const authority = recomposeAuthority(component);
    if (authority !== undefined) {
      if (options.reference !== "suffix") {
        uriTokens.push("//");
      }
      uriTokens.push(authority);
      if (component.path && component.path[0] !== "/") {
        uriTokens.push("/");
      }
    }
    if (component.path !== undefined) {
      let s = component.path;
      if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
        s = removeDotSegments(s);
      }
      if (authority === undefined && s[0] === "/" && s[1] === "/") {
        s = "/%2F" + s.slice(2);
      }
      uriTokens.push(s);
    }
    if (component.query !== undefined) {
      uriTokens.push("?", component.query);
    }
    if (component.fragment !== undefined) {
      uriTokens.push("#", component.fragment);
    }
    return uriTokens.join("");
  }
  var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
  function parse6(uri, opts) {
    const options = Object.assign({}, opts);
    const parsed = {
      scheme: undefined,
      userinfo: undefined,
      host: "",
      port: undefined,
      path: "",
      query: undefined,
      fragment: undefined
    };
    let isIP = false;
    if (options.reference === "suffix") {
      if (options.scheme) {
        uri = options.scheme + ":" + uri;
      } else {
        uri = "//" + uri;
      }
    }
    const matches = uri.match(URI_PARSE);
    if (matches) {
      parsed.scheme = matches[1];
      parsed.userinfo = matches[3];
      parsed.host = matches[4];
      parsed.port = parseInt(matches[5], 10);
      parsed.path = matches[6] || "";
      parsed.query = matches[7];
      parsed.fragment = matches[8];
      if (isNaN(parsed.port)) {
        parsed.port = matches[5];
      }
      if (parsed.host) {
        const ipv4result = isIPv4(parsed.host);
        if (ipv4result === false) {
          const ipv6result = normalizeIPv6(parsed.host);
          parsed.host = ipv6result.host.toLowerCase();
          isIP = ipv6result.isIPV6;
        } else {
          isIP = true;
        }
      }
      if (parsed.scheme === undefined && parsed.userinfo === undefined && parsed.host === undefined && parsed.port === undefined && parsed.query === undefined && !parsed.path) {
        parsed.reference = "same-document";
      } else if (parsed.scheme === undefined) {
        parsed.reference = "relative";
      } else if (parsed.fragment === undefined) {
        parsed.reference = "absolute";
      } else {
        parsed.reference = "uri";
      }
      if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
        parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
      }
      const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
      if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
        if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
          try {
            parsed.host = URL.domainToASCII(parsed.host.toLowerCase());
          } catch (e) {
            parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
          }
        }
      }
      if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
        if (uri.indexOf("%") !== -1) {
          if (parsed.scheme !== undefined) {
            parsed.scheme = unescape(parsed.scheme);
          }
          if (parsed.host !== undefined) {
            parsed.host = unescape(parsed.host);
          }
        }
        if (parsed.path) {
          parsed.path = escape(unescape(parsed.path));
        }
        if (parsed.fragment) {
          parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
        }
      }
      if (schemeHandler && schemeHandler.parse) {
        schemeHandler.parse(parsed, options);
      }
    } else {
      parsed.error = parsed.error || "URI can not be parsed.";
    }
    return parsed;
  }
  var fastUri = {
    SCHEMES,
    normalize,
    resolve: resolve2,
    resolveComponent,
    equal,
    serialize,
    parse: parse6
  };
  module.exports = fastUri;
  module.exports.default = fastUri;
  module.exports.fastUri = fastUri;
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var uri = require_fast_uri();
  uri.code = 'require("ajv/dist/runtime/uri").default';
  exports.default = uri;
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = undefined;
  var validate_1 = require_validate();
  Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
    return validate_1.KeywordCxt;
  } });
  var codegen_1 = require_codegen();
  Object.defineProperty(exports, "_", { enumerable: true, get: function() {
    return codegen_1._;
  } });
  Object.defineProperty(exports, "str", { enumerable: true, get: function() {
    return codegen_1.str;
  } });
  Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
    return codegen_1.stringify;
  } });
  Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
    return codegen_1.nil;
  } });
  Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
    return codegen_1.Name;
  } });
  Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
    return codegen_1.CodeGen;
  } });
  var validation_error_1 = require_validation_error();
  var ref_error_1 = require_ref_error();
  var rules_1 = require_rules();
  var compile_1 = require_compile();
  var codegen_2 = require_codegen();
  var resolve_1 = require_resolve();
  var dataType_1 = require_dataType();
  var util_1 = require_util();
  var $dataRefSchema = require_data();
  var uri_1 = require_uri();
  var defaultRegExp = (str, flags) => new RegExp(str, flags);
  defaultRegExp.code = "new RegExp";
  var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
  var EXT_SCOPE_NAMES = new Set([
    "validate",
    "serialize",
    "parse",
    "wrapper",
    "root",
    "schema",
    "keyword",
    "pattern",
    "formats",
    "validate$data",
    "func",
    "obj",
    "Error"
  ]);
  var removedOptions = {
    errorDataPath: "",
    format: "`validateFormats: false` can be used instead.",
    nullable: '"nullable" keyword is supported by default.',
    jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
    extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
    missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
    processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
    sourceCode: "Use option `code: {source: true}`",
    strictDefaults: "It is default now, see option `strict`.",
    strictKeywords: "It is default now, see option `strict`.",
    uniqueItems: '"uniqueItems" keyword is always validated.',
    unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
    cache: "Map is used as cache, schema object as key.",
    serialize: "Map is used as cache, schema object as key.",
    ajvErrors: "It is default now."
  };
  var deprecatedOptions = {
    ignoreKeywordsWithRef: "",
    jsPropertySyntax: "",
    unicode: '"minLength"/"maxLength" account for unicode characters by default.'
  };
  var MAX_EXPRESSION = 200;
  function requiredOptions(o) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
    const s = o.strict;
    const _optz = (_a = o.code) === null || _a === undefined ? undefined : _a.optimize;
    const optimize = _optz === true || _optz === undefined ? 1 : _optz || 0;
    const regExp = (_c = (_b = o.code) === null || _b === undefined ? undefined : _b.regExp) !== null && _c !== undefined ? _c : defaultRegExp;
    const uriResolver = (_d = o.uriResolver) !== null && _d !== undefined ? _d : uri_1.default;
    return {
      strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== undefined ? _e : s) !== null && _f !== undefined ? _f : true,
      strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== undefined ? _g : s) !== null && _h !== undefined ? _h : true,
      strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== undefined ? _j : s) !== null && _k !== undefined ? _k : "log",
      strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== undefined ? _l : s) !== null && _m !== undefined ? _m : "log",
      strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== undefined ? _o : s) !== null && _p !== undefined ? _p : false,
      code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
      loopRequired: (_q = o.loopRequired) !== null && _q !== undefined ? _q : MAX_EXPRESSION,
      loopEnum: (_r = o.loopEnum) !== null && _r !== undefined ? _r : MAX_EXPRESSION,
      meta: (_s = o.meta) !== null && _s !== undefined ? _s : true,
      messages: (_t = o.messages) !== null && _t !== undefined ? _t : true,
      inlineRefs: (_u = o.inlineRefs) !== null && _u !== undefined ? _u : true,
      schemaId: (_v = o.schemaId) !== null && _v !== undefined ? _v : "$id",
      addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== undefined ? _w : true,
      validateSchema: (_x = o.validateSchema) !== null && _x !== undefined ? _x : true,
      validateFormats: (_y = o.validateFormats) !== null && _y !== undefined ? _y : true,
      unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== undefined ? _z : true,
      int32range: (_0 = o.int32range) !== null && _0 !== undefined ? _0 : true,
      uriResolver
    };
  }

  class Ajv {
    constructor(opts = {}) {
      this.schemas = {};
      this.refs = {};
      this.formats = {};
      this._compilations = new Set;
      this._loading = {};
      this._cache = new Map;
      opts = this.opts = { ...opts, ...requiredOptions(opts) };
      const { es5, lines } = this.opts.code;
      this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
      this.logger = getLogger(opts.logger);
      const formatOpt = opts.validateFormats;
      opts.validateFormats = false;
      this.RULES = (0, rules_1.getRules)();
      checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
      checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
      this._metaOpts = getMetaSchemaOptions.call(this);
      if (opts.formats)
        addInitialFormats.call(this);
      this._addVocabularies();
      this._addDefaultMetaSchema();
      if (opts.keywords)
        addInitialKeywords.call(this, opts.keywords);
      if (typeof opts.meta == "object")
        this.addMetaSchema(opts.meta);
      addInitialSchemas.call(this);
      opts.validateFormats = formatOpt;
    }
    _addVocabularies() {
      this.addKeyword("$async");
    }
    _addDefaultMetaSchema() {
      const { $data, meta, schemaId } = this.opts;
      let _dataRefSchema = $dataRefSchema;
      if (schemaId === "id") {
        _dataRefSchema = { ...$dataRefSchema };
        _dataRefSchema.id = _dataRefSchema.$id;
        delete _dataRefSchema.$id;
      }
      if (meta && $data)
        this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
    }
    defaultMeta() {
      const { meta, schemaId } = this.opts;
      return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : undefined;
    }
    validate(schemaKeyRef, data) {
      let v;
      if (typeof schemaKeyRef == "string") {
        v = this.getSchema(schemaKeyRef);
        if (!v)
          throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
      } else {
        v = this.compile(schemaKeyRef);
      }
      const valid = v(data);
      if (!("$async" in v))
        this.errors = v.errors;
      return valid;
    }
    compile(schema, _meta) {
      const sch = this._addSchema(schema, _meta);
      return sch.validate || this._compileSchemaEnv(sch);
    }
    compileAsync(schema, meta) {
      if (typeof this.opts.loadSchema != "function") {
        throw new Error("options.loadSchema should be a function");
      }
      const { loadSchema } = this.opts;
      return runCompileAsync.call(this, schema, meta);
      async function runCompileAsync(_schema, _meta) {
        await loadMetaSchema.call(this, _schema.$schema);
        const sch = this._addSchema(_schema, _meta);
        return sch.validate || _compileAsync.call(this, sch);
      }
      async function loadMetaSchema($ref) {
        if ($ref && !this.getSchema($ref)) {
          await runCompileAsync.call(this, { $ref }, true);
        }
      }
      async function _compileAsync(sch) {
        try {
          return this._compileSchemaEnv(sch);
        } catch (e) {
          if (!(e instanceof ref_error_1.default))
            throw e;
          checkLoaded.call(this, e);
          await loadMissingSchema.call(this, e.missingSchema);
          return _compileAsync.call(this, sch);
        }
      }
      function checkLoaded({ missingSchema: ref, missingRef }) {
        if (this.refs[ref]) {
          throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
        }
      }
      async function loadMissingSchema(ref) {
        const _schema = await _loadSchema.call(this, ref);
        if (!this.refs[ref])
          await loadMetaSchema.call(this, _schema.$schema);
        if (!this.refs[ref])
          this.addSchema(_schema, ref, meta);
      }
      async function _loadSchema(ref) {
        const p = this._loading[ref];
        if (p)
          return p;
        try {
          return await (this._loading[ref] = loadSchema(ref));
        } finally {
          delete this._loading[ref];
        }
      }
    }
    addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
      if (Array.isArray(schema)) {
        for (const sch of schema)
          this.addSchema(sch, undefined, _meta, _validateSchema);
        return this;
      }
      let id;
      if (typeof schema === "object") {
        const { schemaId } = this.opts;
        id = schema[schemaId];
        if (id !== undefined && typeof id != "string") {
          throw new Error(`schema ${schemaId} must be string`);
        }
      }
      key = (0, resolve_1.normalizeId)(key || id);
      this._checkUnique(key);
      this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
      return this;
    }
    addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
      this.addSchema(schema, key, true, _validateSchema);
      return this;
    }
    validateSchema(schema, throwOrLogError) {
      if (typeof schema == "boolean")
        return true;
      let $schema;
      $schema = schema.$schema;
      if ($schema !== undefined && typeof $schema != "string") {
        throw new Error("$schema must be a string");
      }
      $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
      if (!$schema) {
        this.logger.warn("meta-schema not available");
        this.errors = null;
        return true;
      }
      const valid = this.validate($schema, schema);
      if (!valid && throwOrLogError) {
        const message = "schema is invalid: " + this.errorsText();
        if (this.opts.validateSchema === "log")
          this.logger.error(message);
        else
          throw new Error(message);
      }
      return valid;
    }
    getSchema(keyRef) {
      let sch;
      while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
        keyRef = sch;
      if (sch === undefined) {
        const { schemaId } = this.opts;
        const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
        sch = compile_1.resolveSchema.call(this, root, keyRef);
        if (!sch)
          return;
        this.refs[keyRef] = sch;
      }
      return sch.validate || this._compileSchemaEnv(sch);
    }
    removeSchema(schemaKeyRef) {
      if (schemaKeyRef instanceof RegExp) {
        this._removeAllSchemas(this.schemas, schemaKeyRef);
        this._removeAllSchemas(this.refs, schemaKeyRef);
        return this;
      }
      switch (typeof schemaKeyRef) {
        case "undefined":
          this._removeAllSchemas(this.schemas);
          this._removeAllSchemas(this.refs);
          this._cache.clear();
          return this;
        case "string": {
          const sch = getSchEnv.call(this, schemaKeyRef);
          if (typeof sch == "object")
            this._cache.delete(sch.schema);
          delete this.schemas[schemaKeyRef];
          delete this.refs[schemaKeyRef];
          return this;
        }
        case "object": {
          const cacheKey = schemaKeyRef;
          this._cache.delete(cacheKey);
          let id = schemaKeyRef[this.opts.schemaId];
          if (id) {
            id = (0, resolve_1.normalizeId)(id);
            delete this.schemas[id];
            delete this.refs[id];
          }
          return this;
        }
        default:
          throw new Error("ajv.removeSchema: invalid parameter");
      }
    }
    addVocabulary(definitions) {
      for (const def of definitions)
        this.addKeyword(def);
      return this;
    }
    addKeyword(kwdOrDef, def) {
      let keyword;
      if (typeof kwdOrDef == "string") {
        keyword = kwdOrDef;
        if (typeof def == "object") {
          this.logger.warn("these parameters are deprecated, see docs for addKeyword");
          def.keyword = keyword;
        }
      } else if (typeof kwdOrDef == "object" && def === undefined) {
        def = kwdOrDef;
        keyword = def.keyword;
        if (Array.isArray(keyword) && !keyword.length) {
          throw new Error("addKeywords: keyword must be string or non-empty array");
        }
      } else {
        throw new Error("invalid addKeywords parameters");
      }
      checkKeyword.call(this, keyword, def);
      if (!def) {
        (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
        return this;
      }
      keywordMetaschema.call(this, def);
      const definition = {
        ...def,
        type: (0, dataType_1.getJSONTypes)(def.type),
        schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
      };
      (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
      return this;
    }
    getKeyword(keyword) {
      const rule = this.RULES.all[keyword];
      return typeof rule == "object" ? rule.definition : !!rule;
    }
    removeKeyword(keyword) {
      const { RULES } = this;
      delete RULES.keywords[keyword];
      delete RULES.all[keyword];
      for (const group of RULES.rules) {
        const i = group.rules.findIndex((rule) => rule.keyword === keyword);
        if (i >= 0)
          group.rules.splice(i, 1);
      }
      return this;
    }
    addFormat(name, format) {
      if (typeof format == "string")
        format = new RegExp(format);
      this.formats[name] = format;
      return this;
    }
    errorsText(errors3 = this.errors, { separator = ", ", dataVar = "data" } = {}) {
      if (!errors3 || errors3.length === 0)
        return "No errors";
      return errors3.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
    }
    $dataMetaSchema(metaSchema, keywordsJsonPointers) {
      const rules = this.RULES.all;
      metaSchema = JSON.parse(JSON.stringify(metaSchema));
      for (const jsonPointer of keywordsJsonPointers) {
        const segments = jsonPointer.split("/").slice(1);
        let keywords = metaSchema;
        for (const seg of segments)
          keywords = keywords[seg];
        for (const key in rules) {
          const rule = rules[key];
          if (typeof rule != "object")
            continue;
          const { $data } = rule.definition;
          const schema = keywords[key];
          if ($data && schema)
            keywords[key] = schemaOrData(schema);
        }
      }
      return metaSchema;
    }
    _removeAllSchemas(schemas4, regex) {
      for (const keyRef in schemas4) {
        const sch = schemas4[keyRef];
        if (!regex || regex.test(keyRef)) {
          if (typeof sch == "string") {
            delete schemas4[keyRef];
          } else if (sch && !sch.meta) {
            this._cache.delete(sch.schema);
            delete schemas4[keyRef];
          }
        }
      }
    }
    _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
      let id;
      const { schemaId } = this.opts;
      if (typeof schema == "object") {
        id = schema[schemaId];
      } else {
        if (this.opts.jtd)
          throw new Error("schema must be object");
        else if (typeof schema != "boolean")
          throw new Error("schema must be object or boolean");
      }
      let sch = this._cache.get(schema);
      if (sch !== undefined)
        return sch;
      baseId = (0, resolve_1.normalizeId)(id || baseId);
      const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
      sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
      this._cache.set(sch.schema, sch);
      if (addSchema && !baseId.startsWith("#")) {
        if (baseId)
          this._checkUnique(baseId);
        this.refs[baseId] = sch;
      }
      if (validateSchema)
        this.validateSchema(schema, true);
      return sch;
    }
    _checkUnique(id) {
      if (this.schemas[id] || this.refs[id]) {
        throw new Error(`schema with key or id "${id}" already exists`);
      }
    }
    _compileSchemaEnv(sch) {
      if (sch.meta)
        this._compileMetaSchema(sch);
      else
        compile_1.compileSchema.call(this, sch);
      if (!sch.validate)
        throw new Error("ajv implementation error");
      return sch.validate;
    }
    _compileMetaSchema(sch) {
      const currentOpts = this.opts;
      this.opts = this._metaOpts;
      try {
        compile_1.compileSchema.call(this, sch);
      } finally {
        this.opts = currentOpts;
      }
    }
  }
  Ajv.ValidationError = validation_error_1.default;
  Ajv.MissingRefError = ref_error_1.default;
  exports.default = Ajv;
  function checkOptions(checkOpts, options, msg, log = "error") {
    for (const key in checkOpts) {
      const opt = key;
      if (opt in options)
        this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
    }
  }
  function getSchEnv(keyRef) {
    keyRef = (0, resolve_1.normalizeId)(keyRef);
    return this.schemas[keyRef] || this.refs[keyRef];
  }
  function addInitialSchemas() {
    const optsSchemas = this.opts.schemas;
    if (!optsSchemas)
      return;
    if (Array.isArray(optsSchemas))
      this.addSchema(optsSchemas);
    else
      for (const key in optsSchemas)
        this.addSchema(optsSchemas[key], key);
  }
  function addInitialFormats() {
    for (const name in this.opts.formats) {
      const format = this.opts.formats[name];
      if (format)
        this.addFormat(name, format);
    }
  }
  function addInitialKeywords(defs) {
    if (Array.isArray(defs)) {
      this.addVocabulary(defs);
      return;
    }
    this.logger.warn("keywords option as map is deprecated, pass array");
    for (const keyword in defs) {
      const def = defs[keyword];
      if (!def.keyword)
        def.keyword = keyword;
      this.addKeyword(def);
    }
  }
  function getMetaSchemaOptions() {
    const metaOpts = { ...this.opts };
    for (const opt of META_IGNORE_OPTIONS)
      delete metaOpts[opt];
    return metaOpts;
  }
  var noLogs = { log() {}, warn() {}, error() {} };
  function getLogger(logger) {
    if (logger === false)
      return noLogs;
    if (logger === undefined)
      return console;
    if (logger.log && logger.warn && logger.error)
      return logger;
    throw new Error("logger must implement log, warn and error methods");
  }
  var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
  function checkKeyword(keyword, def) {
    const { RULES } = this;
    (0, util_1.eachItem)(keyword, (kwd) => {
      if (RULES.keywords[kwd])
        throw new Error(`Keyword ${kwd} is already defined`);
      if (!KEYWORD_NAME.test(kwd))
        throw new Error(`Keyword ${kwd} has invalid name`);
    });
    if (!def)
      return;
    if (def.$data && !(("code" in def) || ("validate" in def))) {
      throw new Error('$data keyword must have "code" or "validate" function');
    }
  }
  function addRule(keyword, definition, dataType) {
    var _a;
    const post = definition === null || definition === undefined ? undefined : definition.post;
    if (dataType && post)
      throw new Error('keyword with "post" flag cannot have "type"');
    const { RULES } = this;
    let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
    if (!ruleGroup) {
      ruleGroup = { type: dataType, rules: [] };
      RULES.rules.push(ruleGroup);
    }
    RULES.keywords[keyword] = true;
    if (!definition)
      return;
    const rule = {
      keyword,
      definition: {
        ...definition,
        type: (0, dataType_1.getJSONTypes)(definition.type),
        schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
      }
    };
    if (definition.before)
      addBeforeRule.call(this, ruleGroup, rule, definition.before);
    else
      ruleGroup.rules.push(rule);
    RULES.all[keyword] = rule;
    (_a = definition.implements) === null || _a === undefined || _a.forEach((kwd) => this.addKeyword(kwd));
  }
  function addBeforeRule(ruleGroup, rule, before) {
    const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
    if (i >= 0) {
      ruleGroup.rules.splice(i, 0, rule);
    } else {
      ruleGroup.rules.push(rule);
      this.logger.warn(`rule ${before} is not defined`);
    }
  }
  function keywordMetaschema(def) {
    let { metaSchema } = def;
    if (metaSchema === undefined)
      return;
    if (def.$data && this.opts.$data)
      metaSchema = schemaOrData(metaSchema);
    def.validateSchema = this.compile(metaSchema, true);
  }
  var $dataRef = {
    $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
  };
  function schemaOrData(schema) {
    return { anyOf: [schema, $dataRef] };
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var def = {
    keyword: "id",
    code() {
      throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.callRef = exports.getValidate = undefined;
  var ref_error_1 = require_ref_error();
  var code_1 = require_code2();
  var codegen_1 = require_codegen();
  var names_1 = require_names();
  var compile_1 = require_compile();
  var util_1 = require_util();
  var def = {
    keyword: "$ref",
    schemaType: "string",
    code(cxt) {
      const { gen, schema: $ref, it } = cxt;
      const { baseId, schemaEnv: env, validateName, opts, self } = it;
      const { root } = env;
      if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
        return callRootRef();
      const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
      if (schOrEnv === undefined)
        throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
      if (schOrEnv instanceof compile_1.SchemaEnv)
        return callValidate(schOrEnv);
      return inlineRefSchema(schOrEnv);
      function callRootRef() {
        if (env === root)
          return callRef(cxt, validateName, env, env.$async);
        const rootName = gen.scopeValue("root", { ref: root });
        return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
      }
      function callValidate(sch) {
        const v = getValidate(cxt, sch);
        callRef(cxt, v, sch, sch.$async);
      }
      function inlineRefSchema(sch) {
        const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
        const valid = gen.name("valid");
        const schCxt = cxt.subschema({
          schema: sch,
          dataTypes: [],
          schemaPath: codegen_1.nil,
          topSchemaRef: schName,
          errSchemaPath: $ref
        }, valid);
        cxt.mergeEvaluated(schCxt);
        cxt.ok(valid);
      }
    }
  };
  function getValidate(cxt, sch) {
    const { gen } = cxt;
    return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
  }
  exports.getValidate = getValidate;
  function callRef(cxt, v, sch, $async) {
    const { gen, it } = cxt;
    const { allErrors, schemaEnv: env, opts } = it;
    const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
    if ($async)
      callAsyncRef();
    else
      callSyncRef();
    function callAsyncRef() {
      if (!env.$async)
        throw new Error("async schema referenced by sync schema");
      const valid = gen.let("valid");
      gen.try(() => {
        gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
        addEvaluatedFrom(v);
        if (!allErrors)
          gen.assign(valid, true);
      }, (e) => {
        gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
        addErrorsFrom(e);
        if (!allErrors)
          gen.assign(valid, false);
      });
      cxt.ok(valid);
    }
    function callSyncRef() {
      cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
    }
    function addErrorsFrom(source) {
      const errs = (0, codegen_1._)`${source}.errors`;
      gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
      gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
    }
    function addEvaluatedFrom(source) {
      var _a;
      if (!it.opts.unevaluated)
        return;
      const schEvaluated = (_a = sch === null || sch === undefined ? undefined : sch.validate) === null || _a === undefined ? undefined : _a.evaluated;
      if (it.props !== true) {
        if (schEvaluated && !schEvaluated.dynamicProps) {
          if (schEvaluated.props !== undefined) {
            it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
          }
        } else {
          const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
          it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
        }
      }
      if (it.items !== true) {
        if (schEvaluated && !schEvaluated.dynamicItems) {
          if (schEvaluated.items !== undefined) {
            it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
          }
        } else {
          const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
          it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
        }
      }
    }
  }
  exports.callRef = callRef;
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var id_1 = require_id();
  var ref_1 = require_ref();
  var core2 = [
    "$schema",
    "$id",
    "$defs",
    "$vocabulary",
    { keyword: "$comment" },
    "definitions",
    id_1.default,
    ref_1.default
  ];
  exports.default = core2;
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var ops = codegen_1.operators;
  var KWDs = {
    maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
    minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
    exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
    exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
  };
  var error2 = {
    message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
    params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
  };
  var def = {
    keyword: Object.keys(KWDs),
    type: "number",
    schemaType: "number",
    $data: true,
    error: error2,
    code(cxt) {
      const { keyword, data, schemaCode } = cxt;
      cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var error2 = {
    message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
    params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
  };
  var def = {
    keyword: "multipleOf",
    type: "number",
    schemaType: "number",
    $data: true,
    error: error2,
    code(cxt) {
      const { gen, data, schemaCode, it } = cxt;
      const prec = it.opts.multipleOfPrecision;
      const res = gen.let("res");
      const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
      cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  function ucs2length(str) {
    const len = str.length;
    let length = 0;
    let pos = 0;
    let value;
    while (pos < len) {
      length++;
      value = str.charCodeAt(pos++);
      if (value >= 55296 && value <= 56319 && pos < len) {
        value = str.charCodeAt(pos);
        if ((value & 64512) === 56320)
          pos++;
      }
    }
    return length;
  }
  exports.default = ucs2length;
  ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var ucs2length_1 = require_ucs2length();
  var error2 = {
    message({ keyword, schemaCode }) {
      const comp = keyword === "maxLength" ? "more" : "fewer";
      return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
    },
    params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
  };
  var def = {
    keyword: ["maxLength", "minLength"],
    type: "string",
    schemaType: "number",
    $data: true,
    error: error2,
    code(cxt) {
      const { keyword, data, schemaCode, it } = cxt;
      const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
      const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
      cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var code_1 = require_code2();
  var util_1 = require_util();
  var codegen_1 = require_codegen();
  var error2 = {
    message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
    params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
  };
  var def = {
    keyword: "pattern",
    type: "string",
    schemaType: "string",
    $data: true,
    error: error2,
    code(cxt) {
      const { gen, data, $data, schema, schemaCode, it } = cxt;
      const u = it.opts.unicodeRegExp ? "u" : "";
      if ($data) {
        const { regExp } = it.opts.code;
        const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
        const valid = gen.let("valid");
        gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
        cxt.fail$data((0, codegen_1._)`!${valid}`);
      } else {
        const regExp = (0, code_1.usePattern)(cxt, schema);
        cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var error2 = {
    message({ keyword, schemaCode }) {
      const comp = keyword === "maxProperties" ? "more" : "fewer";
      return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
    },
    params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
  };
  var def = {
    keyword: ["maxProperties", "minProperties"],
    type: "object",
    schemaType: "number",
    $data: true,
    error: error2,
    code(cxt) {
      const { keyword, data, schemaCode } = cxt;
      const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
      cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var code_1 = require_code2();
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var error2 = {
    message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
    params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
  };
  var def = {
    keyword: "required",
    type: "object",
    schemaType: "array",
    $data: true,
    error: error2,
    code(cxt) {
      const { gen, schema, schemaCode, data, $data, it } = cxt;
      const { opts } = it;
      if (!$data && schema.length === 0)
        return;
      const useLoop = schema.length >= opts.loopRequired;
      if (it.allErrors)
        allErrorsMode();
      else
        exitOnErrorMode();
      if (opts.strictRequired) {
        const props = cxt.parentSchema.properties;
        const { definedProperties } = cxt.it;
        for (const requiredKey of schema) {
          if ((props === null || props === undefined ? undefined : props[requiredKey]) === undefined && !definedProperties.has(requiredKey)) {
            const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
            const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
            (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
          }
        }
      }
      function allErrorsMode() {
        if (useLoop || $data) {
          cxt.block$data(codegen_1.nil, loopAllRequired);
        } else {
          for (const prop of schema) {
            (0, code_1.checkReportMissingProp)(cxt, prop);
          }
        }
      }
      function exitOnErrorMode() {
        const missing = gen.let("missing");
        if (useLoop || $data) {
          const valid = gen.let("valid", true);
          cxt.block$data(valid, () => loopUntilMissing(missing, valid));
          cxt.ok(valid);
        } else {
          gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
      function loopAllRequired() {
        gen.forOf("prop", schemaCode, (prop) => {
          cxt.setParams({ missingProperty: prop });
          gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
        });
      }
      function loopUntilMissing(missing, valid) {
        cxt.setParams({ missingProperty: missing });
        gen.forOf(missing, schemaCode, () => {
          gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error();
            gen.break();
          });
        }, codegen_1.nil);
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var error2 = {
    message({ keyword, schemaCode }) {
      const comp = keyword === "maxItems" ? "more" : "fewer";
      return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
    },
    params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
  };
  var def = {
    keyword: ["maxItems", "minItems"],
    type: "array",
    schemaType: "number",
    $data: true,
    error: error2,
    code(cxt) {
      const { keyword, data, schemaCode } = cxt;
      const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
      cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var equal = require_fast_deep_equal();
  equal.code = 'require("ajv/dist/runtime/equal").default';
  exports.default = equal;
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var dataType_1 = require_dataType();
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var equal_1 = require_equal();
  var error2 = {
    message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
    params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
  };
  var def = {
    keyword: "uniqueItems",
    type: "array",
    schemaType: "boolean",
    $data: true,
    error: error2,
    code(cxt) {
      const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
      if (!$data && !schema)
        return;
      const valid = gen.let("valid");
      const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
      cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
      cxt.ok(valid);
      function validateUniqueItems() {
        const i = gen.let("i", (0, codegen_1._)`${data}.length`);
        const j = gen.let("j");
        cxt.setParams({ i, j });
        gen.assign(valid, true);
        gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
      }
      function canOptimize() {
        return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
      }
      function loopN(i, j) {
        const item = gen.name("item");
        const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
        const indices = gen.const("indices", (0, codegen_1._)`{}`);
        gen.for((0, codegen_1._)`;${i}--;`, () => {
          gen.let(item, (0, codegen_1._)`${data}[${i}]`);
          gen.if(wrongType, (0, codegen_1._)`continue`);
          if (itemTypes.length > 1)
            gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
          gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
            gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
            cxt.error();
            gen.assign(valid, false).break();
          }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
        });
      }
      function loopN2(i, j) {
        const eql = (0, util_1.useFunc)(gen, equal_1.default);
        const outer = gen.name("outer");
        gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
          cxt.error();
          gen.assign(valid, false).break(outer);
        })));
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var equal_1 = require_equal();
  var error2 = {
    message: "must be equal to constant",
    params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
  };
  var def = {
    keyword: "const",
    $data: true,
    error: error2,
    code(cxt) {
      const { gen, data, $data, schemaCode, schema } = cxt;
      if ($data || schema && typeof schema == "object") {
        cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
      } else {
        cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var equal_1 = require_equal();
  var error2 = {
    message: "must be equal to one of the allowed values",
    params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
  };
  var def = {
    keyword: "enum",
    schemaType: "array",
    $data: true,
    error: error2,
    code(cxt) {
      const { gen, data, $data, schema, schemaCode, it } = cxt;
      if (!$data && schema.length === 0)
        throw new Error("enum must have non-empty array");
      const useLoop = schema.length >= it.opts.loopEnum;
      let eql;
      const getEql = () => eql !== null && eql !== undefined ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
      let valid;
      if (useLoop || $data) {
        valid = gen.let("valid");
        cxt.block$data(valid, loopEnum);
      } else {
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        const vSchema = gen.const("vSchema", schemaCode);
        valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
      }
      cxt.pass(valid);
      function loopEnum() {
        gen.assign(valid, false);
        gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
      }
      function equalCode(vSchema, i) {
        const sch = schema[i];
        return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var limitNumber_1 = require_limitNumber();
  var multipleOf_1 = require_multipleOf();
  var limitLength_1 = require_limitLength();
  var pattern_1 = require_pattern();
  var limitProperties_1 = require_limitProperties();
  var required_1 = require_required();
  var limitItems_1 = require_limitItems();
  var uniqueItems_1 = require_uniqueItems();
  var const_1 = require_const();
  var enum_1 = require_enum();
  var validation = [
    limitNumber_1.default,
    multipleOf_1.default,
    limitLength_1.default,
    pattern_1.default,
    limitProperties_1.default,
    required_1.default,
    limitItems_1.default,
    uniqueItems_1.default,
    { keyword: "type", schemaType: ["string", "array"] },
    { keyword: "nullable", schemaType: "boolean" },
    const_1.default,
    enum_1.default
  ];
  exports.default = validation;
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.validateAdditionalItems = undefined;
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var error2 = {
    message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
    params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
  };
  var def = {
    keyword: "additionalItems",
    type: "array",
    schemaType: ["boolean", "object"],
    before: "uniqueItems",
    error: error2,
    code(cxt) {
      const { parentSchema, it } = cxt;
      const { items } = parentSchema;
      if (!Array.isArray(items)) {
        (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
        return;
      }
      validateAdditionalItems(cxt, items);
    }
  };
  function validateAdditionalItems(cxt, items) {
    const { gen, schema, data, keyword, it } = cxt;
    it.items = true;
    const len = gen.const("len", (0, codegen_1._)`${data}.length`);
    if (schema === false) {
      cxt.setParams({ len: items.length });
      cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
    } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
      const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
      gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
      cxt.ok(valid);
    }
    function validateItems(valid) {
      gen.forRange("i", items.length, len, (i) => {
        cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
        if (!it.allErrors)
          gen.if((0, codegen_1.not)(valid), () => gen.break());
      });
    }
  }
  exports.validateAdditionalItems = validateAdditionalItems;
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.validateTuple = undefined;
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var code_1 = require_code2();
  var def = {
    keyword: "items",
    type: "array",
    schemaType: ["object", "array", "boolean"],
    before: "uniqueItems",
    code(cxt) {
      const { schema, it } = cxt;
      if (Array.isArray(schema))
        return validateTuple(cxt, "additionalItems", schema);
      it.items = true;
      if ((0, util_1.alwaysValidSchema)(it, schema))
        return;
      cxt.ok((0, code_1.validateArray)(cxt));
    }
  };
  function validateTuple(cxt, extraItems, schArr = cxt.schema) {
    const { gen, parentSchema, data, keyword, it } = cxt;
    checkStrictTuple(parentSchema);
    if (it.opts.unevaluated && schArr.length && it.items !== true) {
      it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
    }
    const valid = gen.name("valid");
    const len = gen.const("len", (0, codegen_1._)`${data}.length`);
    schArr.forEach((sch, i) => {
      if ((0, util_1.alwaysValidSchema)(it, sch))
        return;
      gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
        keyword,
        schemaProp: i,
        dataProp: i
      }, valid));
      cxt.ok(valid);
    });
    function checkStrictTuple(sch) {
      const { opts, errSchemaPath } = it;
      const l = schArr.length;
      const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
      if (opts.strictTuples && !fullTuple) {
        const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
        (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
      }
    }
  }
  exports.validateTuple = validateTuple;
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var items_1 = require_items();
  var def = {
    keyword: "prefixItems",
    type: "array",
    schemaType: ["array"],
    before: "uniqueItems",
    code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var code_1 = require_code2();
  var additionalItems_1 = require_additionalItems();
  var error2 = {
    message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
    params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
  };
  var def = {
    keyword: "items",
    type: "array",
    schemaType: ["object", "boolean"],
    before: "uniqueItems",
    error: error2,
    code(cxt) {
      const { schema, parentSchema, it } = cxt;
      const { prefixItems } = parentSchema;
      it.items = true;
      if ((0, util_1.alwaysValidSchema)(it, schema))
        return;
      if (prefixItems)
        (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
      else
        cxt.ok((0, code_1.validateArray)(cxt));
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var error2 = {
    message: ({ params: { min, max } }) => max === undefined ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
    params: ({ params: { min, max } }) => max === undefined ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
  };
  var def = {
    keyword: "contains",
    type: "array",
    schemaType: ["object", "boolean"],
    before: "uniqueItems",
    trackErrors: true,
    error: error2,
    code(cxt) {
      const { gen, schema, parentSchema, data, it } = cxt;
      let min;
      let max;
      const { minContains, maxContains } = parentSchema;
      if (it.opts.next) {
        min = minContains === undefined ? 1 : minContains;
        max = maxContains;
      } else {
        min = 1;
      }
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      cxt.setParams({ min, max });
      if (max === undefined && min === 0) {
        (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
        return;
      }
      if (max !== undefined && min > max) {
        (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
        cxt.fail();
        return;
      }
      if ((0, util_1.alwaysValidSchema)(it, schema)) {
        let cond = (0, codegen_1._)`${len} >= ${min}`;
        if (max !== undefined)
          cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
        cxt.pass(cond);
        return;
      }
      it.items = true;
      const valid = gen.name("valid");
      if (max === undefined && min === 1) {
        validateItems(valid, () => gen.if(valid, () => gen.break()));
      } else if (min === 0) {
        gen.let(valid, true);
        if (max !== undefined)
          gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
      } else {
        gen.let(valid, false);
        validateItemsWithCount();
      }
      cxt.result(valid, () => cxt.reset());
      function validateItemsWithCount() {
        const schValid = gen.name("_valid");
        const count = gen.let("count", 0);
        validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
      }
      function validateItems(_valid, block) {
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword: "contains",
            dataProp: i,
            dataPropType: util_1.Type.Num,
            compositeRule: true
          }, _valid);
          block();
        });
      }
      function checkLimits(count) {
        gen.code((0, codegen_1._)`${count}++`);
        if (max === undefined) {
          gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
        } else {
          gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
          if (min === 1)
            gen.assign(valid, true);
          else
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
        }
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = undefined;
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var code_1 = require_code2();
  exports.error = {
    message: ({ params: { property, depsCount, deps } }) => {
      const property_ies = depsCount === 1 ? "property" : "properties";
      return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
    },
    params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
  };
  var def = {
    keyword: "dependencies",
    type: "object",
    schemaType: "object",
    error: exports.error,
    code(cxt) {
      const [propDeps, schDeps] = splitDependencies(cxt);
      validatePropertyDeps(cxt, propDeps);
      validateSchemaDeps(cxt, schDeps);
    }
  };
  function splitDependencies({ schema }) {
    const propertyDeps = {};
    const schemaDeps = {};
    for (const key in schema) {
      if (key === "__proto__")
        continue;
      const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
      deps[key] = schema[key];
    }
    return [propertyDeps, schemaDeps];
  }
  function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
    const { gen, data, it } = cxt;
    if (Object.keys(propertyDeps).length === 0)
      return;
    const missing = gen.let("missing");
    for (const prop in propertyDeps) {
      const deps = propertyDeps[prop];
      if (deps.length === 0)
        continue;
      const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
      cxt.setParams({
        property: prop,
        depsCount: deps.length,
        deps: deps.join(", ")
      });
      if (it.allErrors) {
        gen.if(hasProperty, () => {
          for (const depProp of deps) {
            (0, code_1.checkReportMissingProp)(cxt, depProp);
          }
        });
      } else {
        gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
        (0, code_1.reportMissingProp)(cxt, missing);
        gen.else();
      }
    }
  }
  exports.validatePropertyDeps = validatePropertyDeps;
  function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
    const { gen, data, keyword, it } = cxt;
    const valid = gen.name("valid");
    for (const prop in schemaDeps) {
      if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
        continue;
      gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties), () => {
        const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
        cxt.mergeValidEvaluated(schCxt, valid);
      }, () => gen.var(valid, true));
      cxt.ok(valid);
    }
  }
  exports.validateSchemaDeps = validateSchemaDeps;
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var error2 = {
    message: "property name must be valid",
    params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
  };
  var def = {
    keyword: "propertyNames",
    type: "object",
    schemaType: ["object", "boolean"],
    error: error2,
    code(cxt) {
      const { gen, schema, data, it } = cxt;
      if ((0, util_1.alwaysValidSchema)(it, schema))
        return;
      const valid = gen.name("valid");
      gen.forIn("key", data, (key) => {
        cxt.setParams({ propertyName: key });
        cxt.subschema({
          keyword: "propertyNames",
          data: key,
          dataTypes: ["string"],
          propertyName: key,
          compositeRule: true
        }, valid);
        gen.if((0, codegen_1.not)(valid), () => {
          cxt.error(true);
          if (!it.allErrors)
            gen.break();
        });
      });
      cxt.ok(valid);
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var code_1 = require_code2();
  var codegen_1 = require_codegen();
  var names_1 = require_names();
  var util_1 = require_util();
  var error2 = {
    message: "must NOT have additional properties",
    params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
  };
  var def = {
    keyword: "additionalProperties",
    type: ["object"],
    schemaType: ["boolean", "object"],
    allowUndefined: true,
    trackErrors: true,
    error: error2,
    code(cxt) {
      const { gen, schema, parentSchema, data, errsCount, it } = cxt;
      if (!errsCount)
        throw new Error("ajv implementation error");
      const { allErrors, opts } = it;
      it.props = true;
      if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
        return;
      const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
      const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
      checkAdditionalProperties();
      cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
      function checkAdditionalProperties() {
        gen.forIn("key", data, (key) => {
          if (!props.length && !patProps.length)
            additionalPropertyCode(key);
          else
            gen.if(isAdditional(key), () => additionalPropertyCode(key));
        });
      }
      function isAdditional(key) {
        let definedProp;
        if (props.length > 8) {
          const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
          definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
        } else if (props.length) {
          definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
        } else {
          definedProp = codegen_1.nil;
        }
        if (patProps.length) {
          definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
        }
        return (0, codegen_1.not)(definedProp);
      }
      function deleteAdditional(key) {
        gen.code((0, codegen_1._)`delete ${data}[${key}]`);
      }
      function additionalPropertyCode(key) {
        if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
          deleteAdditional(key);
          return;
        }
        if (schema === false) {
          cxt.setParams({ additionalProperty: key });
          cxt.error();
          if (!allErrors)
            gen.break();
          return;
        }
        if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
          const valid = gen.name("valid");
          if (opts.removeAdditional === "failing") {
            applyAdditionalSchema(key, valid, false);
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.reset();
              deleteAdditional(key);
            });
          } else {
            applyAdditionalSchema(key, valid);
            if (!allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          }
        }
      }
      function applyAdditionalSchema(key, valid, errors3) {
        const subschema = {
          keyword: "additionalProperties",
          dataProp: key,
          dataPropType: util_1.Type.Str
        };
        if (errors3 === false) {
          Object.assign(subschema, {
            compositeRule: true,
            createErrors: false,
            allErrors: false
          });
        }
        cxt.subschema(subschema, valid);
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var validate_1 = require_validate();
  var code_1 = require_code2();
  var util_1 = require_util();
  var additionalProperties_1 = require_additionalProperties();
  var def = {
    keyword: "properties",
    type: "object",
    schemaType: "object",
    code(cxt) {
      const { gen, schema, parentSchema, data, it } = cxt;
      if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === undefined) {
        additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
      }
      const allProps = (0, code_1.allSchemaProperties)(schema);
      for (const prop of allProps) {
        it.definedProperties.add(prop);
      }
      if (it.opts.unevaluated && allProps.length && it.props !== true) {
        it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
      }
      const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
      if (properties.length === 0)
        return;
      const valid = gen.name("valid");
      for (const prop of properties) {
        if (hasDefault(prop)) {
          applyPropertySchema(prop);
        } else {
          gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
          applyPropertySchema(prop);
          if (!it.allErrors)
            gen.else().var(valid, true);
          gen.endIf();
        }
        cxt.it.definedProperties.add(prop);
        cxt.ok(valid);
      }
      function hasDefault(prop) {
        return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== undefined;
      }
      function applyPropertySchema(prop) {
        cxt.subschema({
          keyword: "properties",
          schemaProp: prop,
          dataProp: prop
        }, valid);
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var code_1 = require_code2();
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var util_2 = require_util();
  var def = {
    keyword: "patternProperties",
    type: "object",
    schemaType: "object",
    code(cxt) {
      const { gen, schema, data, parentSchema, it } = cxt;
      const { opts } = it;
      const patterns = (0, code_1.allSchemaProperties)(schema);
      const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
      if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
        return;
      }
      const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
      const valid = gen.name("valid");
      if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
        it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
      }
      const { props } = it;
      validatePatternProperties();
      function validatePatternProperties() {
        for (const pat of patterns) {
          if (checkProperties)
            checkMatchingProperties(pat);
          if (it.allErrors) {
            validateProperties(pat);
          } else {
            gen.var(valid, true);
            validateProperties(pat);
            gen.if(valid);
          }
        }
      }
      function checkMatchingProperties(pat) {
        for (const prop in checkProperties) {
          if (new RegExp(pat).test(prop)) {
            (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
          }
        }
      }
      function validateProperties(pat) {
        gen.forIn("key", data, (key) => {
          gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
            const alwaysValid = alwaysValidPatterns.includes(pat);
            if (!alwaysValid) {
              cxt.subschema({
                keyword: "patternProperties",
                schemaProp: pat,
                dataProp: key,
                dataPropType: util_2.Type.Str
              }, valid);
            }
            if (it.opts.unevaluated && props !== true) {
              gen.assign((0, codegen_1._)`${props}[${key}]`, true);
            } else if (!alwaysValid && !it.allErrors) {
              gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          });
        });
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var util_1 = require_util();
  var def = {
    keyword: "not",
    schemaType: ["object", "boolean"],
    trackErrors: true,
    code(cxt) {
      const { gen, schema, it } = cxt;
      if ((0, util_1.alwaysValidSchema)(it, schema)) {
        cxt.fail();
        return;
      }
      const valid = gen.name("valid");
      cxt.subschema({
        keyword: "not",
        compositeRule: true,
        createErrors: false,
        allErrors: false
      }, valid);
      cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
    },
    error: { message: "must NOT be valid" }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var code_1 = require_code2();
  var def = {
    keyword: "anyOf",
    schemaType: "array",
    trackErrors: true,
    code: code_1.validateUnion,
    error: { message: "must match a schema in anyOf" }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var error2 = {
    message: "must match exactly one schema in oneOf",
    params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
  };
  var def = {
    keyword: "oneOf",
    schemaType: "array",
    trackErrors: true,
    error: error2,
    code(cxt) {
      const { gen, schema, parentSchema, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      if (it.opts.discriminator && parentSchema.discriminator)
        return;
      const schArr = schema;
      const valid = gen.let("valid", false);
      const passing = gen.let("passing", null);
      const schValid = gen.name("_valid");
      cxt.setParams({ passing });
      gen.block(validateOneOf);
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
      function validateOneOf() {
        schArr.forEach((sch, i) => {
          let schCxt;
          if ((0, util_1.alwaysValidSchema)(it, sch)) {
            gen.var(schValid, true);
          } else {
            schCxt = cxt.subschema({
              keyword: "oneOf",
              schemaProp: i,
              compositeRule: true
            }, schValid);
          }
          if (i > 0) {
            gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
          }
          gen.if(schValid, () => {
            gen.assign(valid, true);
            gen.assign(passing, i);
            if (schCxt)
              cxt.mergeEvaluated(schCxt, codegen_1.Name);
          });
        });
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var util_1 = require_util();
  var def = {
    keyword: "allOf",
    schemaType: "array",
    code(cxt) {
      const { gen, schema, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      const valid = gen.name("valid");
      schema.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
        cxt.ok(valid);
        cxt.mergeEvaluated(schCxt);
      });
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var util_1 = require_util();
  var error2 = {
    message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
    params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
  };
  var def = {
    keyword: "if",
    schemaType: ["object", "boolean"],
    trackErrors: true,
    error: error2,
    code(cxt) {
      const { gen, parentSchema, it } = cxt;
      if (parentSchema.then === undefined && parentSchema.else === undefined) {
        (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
      }
      const hasThen = hasSchema(it, "then");
      const hasElse = hasSchema(it, "else");
      if (!hasThen && !hasElse)
        return;
      const valid = gen.let("valid", true);
      const schValid = gen.name("_valid");
      validateIf();
      cxt.reset();
      if (hasThen && hasElse) {
        const ifClause = gen.let("ifClause");
        cxt.setParams({ ifClause });
        gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
      } else if (hasThen) {
        gen.if(schValid, validateClause("then"));
      } else {
        gen.if((0, codegen_1.not)(schValid), validateClause("else"));
      }
      cxt.pass(valid, () => cxt.error(true));
      function validateIf() {
        const schCxt = cxt.subschema({
          keyword: "if",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, schValid);
        cxt.mergeEvaluated(schCxt);
      }
      function validateClause(keyword, ifClause) {
        return () => {
          const schCxt = cxt.subschema({ keyword }, schValid);
          gen.assign(valid, schValid);
          cxt.mergeValidEvaluated(schCxt, valid);
          if (ifClause)
            gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
          else
            cxt.setParams({ ifClause: keyword });
        };
      }
    }
  };
  function hasSchema(it, keyword) {
    const schema = it.schema[keyword];
    return schema !== undefined && !(0, util_1.alwaysValidSchema)(it, schema);
  }
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var util_1 = require_util();
  var def = {
    keyword: ["then", "else"],
    schemaType: ["object", "boolean"],
    code({ keyword, parentSchema, it }) {
      if (parentSchema.if === undefined)
        (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var additionalItems_1 = require_additionalItems();
  var prefixItems_1 = require_prefixItems();
  var items_1 = require_items();
  var items2020_1 = require_items2020();
  var contains_1 = require_contains();
  var dependencies_1 = require_dependencies();
  var propertyNames_1 = require_propertyNames();
  var additionalProperties_1 = require_additionalProperties();
  var properties_1 = require_properties();
  var patternProperties_1 = require_patternProperties();
  var not_1 = require_not();
  var anyOf_1 = require_anyOf();
  var oneOf_1 = require_oneOf();
  var allOf_1 = require_allOf();
  var if_1 = require_if();
  var thenElse_1 = require_thenElse();
  function getApplicator(draft2020 = false) {
    const applicator = [
      not_1.default,
      anyOf_1.default,
      oneOf_1.default,
      allOf_1.default,
      if_1.default,
      thenElse_1.default,
      propertyNames_1.default,
      additionalProperties_1.default,
      dependencies_1.default,
      properties_1.default,
      patternProperties_1.default
    ];
    if (draft2020)
      applicator.push(prefixItems_1.default, items2020_1.default);
    else
      applicator.push(additionalItems_1.default, items_1.default);
    applicator.push(contains_1.default);
    return applicator;
  }
  exports.default = getApplicator;
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var error2 = {
    message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
    params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
  };
  var def = {
    keyword: "format",
    type: ["number", "string"],
    schemaType: "string",
    $data: true,
    error: error2,
    code(cxt, ruleType) {
      const { gen, data, $data, schema, schemaCode, it } = cxt;
      const { opts, errSchemaPath, schemaEnv, self } = it;
      if (!opts.validateFormats)
        return;
      if ($data)
        validate$DataFormat();
      else
        validateFormat();
      function validate$DataFormat() {
        const fmts = gen.scopeValue("formats", {
          ref: self.formats,
          code: opts.code.formats
        });
        const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
        const fType = gen.let("fType");
        const format = gen.let("format");
        gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
        cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
        function unknownFmt() {
          if (opts.strictSchema === false)
            return codegen_1.nil;
          return (0, codegen_1._)`${schemaCode} && !${format}`;
        }
        function invalidFmt() {
          const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
          const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
          return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
        }
      }
      function validateFormat() {
        const formatDef = self.formats[schema];
        if (!formatDef) {
          unknownFormat();
          return;
        }
        if (formatDef === true)
          return;
        const [fmtType, format, fmtRef] = getFormat(formatDef);
        if (fmtType === ruleType)
          cxt.pass(validCondition());
        function unknownFormat() {
          if (opts.strictSchema === false) {
            self.logger.warn(unknownMsg());
            return;
          }
          throw new Error(unknownMsg());
          function unknownMsg() {
            return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
          }
        }
        function getFormat(fmtDef) {
          const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : undefined;
          const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
          if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
            return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
          }
          return ["string", fmtDef, fmt];
        }
        function validCondition() {
          if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
            if (!schemaEnv.$async)
              throw new Error("async format in sync schema");
            return (0, codegen_1._)`await ${fmtRef}(${data})`;
          }
          return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
        }
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var format_1 = require_format();
  var format = [format_1.default];
  exports.default = format;
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.contentVocabulary = exports.metadataVocabulary = undefined;
  exports.metadataVocabulary = [
    "title",
    "description",
    "default",
    "deprecated",
    "readOnly",
    "writeOnly",
    "examples"
  ];
  exports.contentVocabulary = [
    "contentMediaType",
    "contentEncoding",
    "contentSchema"
  ];
});

// node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var core_1 = require_core2();
  var validation_1 = require_validation();
  var applicator_1 = require_applicator();
  var format_1 = require_format2();
  var metadata_1 = require_metadata();
  var draft7Vocabularies = [
    core_1.default,
    validation_1.default,
    (0, applicator_1.default)(),
    format_1.default,
    metadata_1.metadataVocabulary,
    metadata_1.contentVocabulary
  ];
  exports.default = draft7Vocabularies;
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.DiscrError = undefined;
  var DiscrError;
  (function(DiscrError2) {
    DiscrError2["Tag"] = "tag";
    DiscrError2["Mapping"] = "mapping";
  })(DiscrError || (exports.DiscrError = DiscrError = {}));
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var codegen_1 = require_codegen();
  var types_1 = require_types();
  var compile_1 = require_compile();
  var ref_error_1 = require_ref_error();
  var util_1 = require_util();
  var error2 = {
    message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
    params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
  };
  var def = {
    keyword: "discriminator",
    type: "object",
    schemaType: "object",
    error: error2,
    code(cxt) {
      const { gen, data, schema, parentSchema, it } = cxt;
      const { oneOf } = parentSchema;
      if (!it.opts.discriminator) {
        throw new Error("discriminator: requires discriminator option");
      }
      const tagName = schema.propertyName;
      if (typeof tagName != "string")
        throw new Error("discriminator: requires propertyName");
      if (schema.mapping)
        throw new Error("discriminator: mapping is not supported");
      if (!oneOf)
        throw new Error("discriminator: requires oneOf keyword");
      const valid = gen.let("valid", false);
      const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
      gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
      cxt.ok(valid);
      function validateMapping() {
        const mapping = getMapping();
        gen.if(false);
        for (const tagValue in mapping) {
          gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
          gen.assign(valid, applyTagSchema(mapping[tagValue]));
        }
        gen.else();
        cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
        gen.endIf();
      }
      function applyTagSchema(schemaProp) {
        const _valid = gen.name("valid");
        const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
        cxt.mergeEvaluated(schCxt, codegen_1.Name);
        return _valid;
      }
      function getMapping() {
        var _a;
        const oneOfMapping = {};
        const topRequired = hasRequired(parentSchema);
        let tagRequired = true;
        for (let i = 0;i < oneOf.length; i++) {
          let sch = oneOf[i];
          if ((sch === null || sch === undefined ? undefined : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
            const ref = sch.$ref;
            sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
            if (sch instanceof compile_1.SchemaEnv)
              sch = sch.schema;
            if (sch === undefined)
              throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
          }
          const propSch = (_a = sch === null || sch === undefined ? undefined : sch.properties) === null || _a === undefined ? undefined : _a[tagName];
          if (typeof propSch != "object") {
            throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
          }
          tagRequired = tagRequired && (topRequired || hasRequired(sch));
          addMappings(propSch, i);
        }
        if (!tagRequired)
          throw new Error(`discriminator: "${tagName}" must be required`);
        return oneOfMapping;
        function hasRequired({ required: required2 }) {
          return Array.isArray(required2) && required2.includes(tagName);
        }
        function addMappings(sch, i) {
          if (sch.const) {
            addMapping(sch.const, i);
          } else if (sch.enum) {
            for (const tagValue of sch.enum) {
              addMapping(tagValue, i);
            }
          } else {
            throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
          }
        }
        function addMapping(tagValue, i) {
          if (typeof tagValue != "string" || tagValue in oneOfMapping) {
            throw new Error(`discriminator: "${tagName}" values must be unique strings`);
          }
          oneOfMapping[tagValue] = i;
        }
      }
    }
  };
  exports.default = def;
});

// node_modules/ajv/dist/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS((exports, module) => {
  module.exports = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://json-schema.org/draft-07/schema#",
    title: "Core schema meta-schema",
    definitions: {
      schemaArray: {
        type: "array",
        minItems: 1,
        items: { $ref: "#" }
      },
      nonNegativeInteger: {
        type: "integer",
        minimum: 0
      },
      nonNegativeIntegerDefault0: {
        allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }]
      },
      simpleTypes: {
        enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
      },
      stringArray: {
        type: "array",
        items: { type: "string" },
        uniqueItems: true,
        default: []
      }
    },
    type: ["object", "boolean"],
    properties: {
      $id: {
        type: "string",
        format: "uri-reference"
      },
      $schema: {
        type: "string",
        format: "uri"
      },
      $ref: {
        type: "string",
        format: "uri-reference"
      },
      $comment: {
        type: "string"
      },
      title: {
        type: "string"
      },
      description: {
        type: "string"
      },
      default: true,
      readOnly: {
        type: "boolean",
        default: false
      },
      examples: {
        type: "array",
        items: true
      },
      multipleOf: {
        type: "number",
        exclusiveMinimum: 0
      },
      maximum: {
        type: "number"
      },
      exclusiveMaximum: {
        type: "number"
      },
      minimum: {
        type: "number"
      },
      exclusiveMinimum: {
        type: "number"
      },
      maxLength: { $ref: "#/definitions/nonNegativeInteger" },
      minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      pattern: {
        type: "string",
        format: "regex"
      },
      additionalItems: { $ref: "#" },
      items: {
        anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }],
        default: true
      },
      maxItems: { $ref: "#/definitions/nonNegativeInteger" },
      minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      uniqueItems: {
        type: "boolean",
        default: false
      },
      contains: { $ref: "#" },
      maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
      minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      required: { $ref: "#/definitions/stringArray" },
      additionalProperties: { $ref: "#" },
      definitions: {
        type: "object",
        additionalProperties: { $ref: "#" },
        default: {}
      },
      properties: {
        type: "object",
        additionalProperties: { $ref: "#" },
        default: {}
      },
      patternProperties: {
        type: "object",
        additionalProperties: { $ref: "#" },
        propertyNames: { format: "regex" },
        default: {}
      },
      dependencies: {
        type: "object",
        additionalProperties: {
          anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }]
        }
      },
      propertyNames: { $ref: "#" },
      const: true,
      enum: {
        type: "array",
        items: true,
        minItems: 1,
        uniqueItems: true
      },
      type: {
        anyOf: [
          { $ref: "#/definitions/simpleTypes" },
          {
            type: "array",
            items: { $ref: "#/definitions/simpleTypes" },
            minItems: 1,
            uniqueItems: true
          }
        ]
      },
      format: { type: "string" },
      contentMediaType: { type: "string" },
      contentEncoding: { type: "string" },
      if: { $ref: "#" },
      then: { $ref: "#" },
      else: { $ref: "#" },
      allOf: { $ref: "#/definitions/schemaArray" },
      anyOf: { $ref: "#/definitions/schemaArray" },
      oneOf: { $ref: "#/definitions/schemaArray" },
      not: { $ref: "#" }
    },
    default: true
  };
});

// node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS((exports, module) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = undefined;
  var core_1 = require_core();
  var draft7_1 = require_draft7();
  var discriminator_1 = require_discriminator();
  var draft7MetaSchema = require_json_schema_draft_07();
  var META_SUPPORT_DATA = ["/properties"];
  var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";

  class Ajv extends core_1.default {
    _addVocabularies() {
      super._addVocabularies();
      draft7_1.default.forEach((v) => this.addVocabulary(v));
      if (this.opts.discriminator)
        this.addKeyword(discriminator_1.default);
    }
    _addDefaultMetaSchema() {
      super._addDefaultMetaSchema();
      if (!this.opts.meta)
        return;
      const metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
      this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
      this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
    }
    defaultMeta() {
      return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : undefined);
    }
  }
  exports.Ajv = Ajv;
  module.exports = exports = Ajv;
  module.exports.Ajv = Ajv;
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.default = Ajv;
  var validate_1 = require_validate();
  Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
    return validate_1.KeywordCxt;
  } });
  var codegen_1 = require_codegen();
  Object.defineProperty(exports, "_", { enumerable: true, get: function() {
    return codegen_1._;
  } });
  Object.defineProperty(exports, "str", { enumerable: true, get: function() {
    return codegen_1.str;
  } });
  Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
    return codegen_1.stringify;
  } });
  Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
    return codegen_1.nil;
  } });
  Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
    return codegen_1.Name;
  } });
  Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
    return codegen_1.CodeGen;
  } });
  var validation_error_1 = require_validation_error();
  Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
    return validation_error_1.default;
  } });
  var ref_error_1 = require_ref_error();
  Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
    return ref_error_1.default;
  } });
});

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.formatNames = exports.fastFormats = exports.fullFormats = undefined;
  function fmtDef(validate, compare) {
    return { validate, compare };
  }
  exports.fullFormats = {
    date: fmtDef(date5, compareDate),
    time: fmtDef(getTime(true), compareTime),
    "date-time": fmtDef(getDateTime(true), compareDateTime),
    "iso-time": fmtDef(getTime(), compareIsoTime),
    "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
    duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
    uri,
    "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
    "uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
    url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
    email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
    hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
    ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
    ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
    regex,
    uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
    "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
    "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
    "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
    byte,
    int32: { type: "number", validate: validateInt32 },
    int64: { type: "number", validate: validateInt64 },
    float: { type: "number", validate: validateNumber },
    double: { type: "number", validate: validateNumber },
    password: true,
    binary: true
  };
  exports.fastFormats = {
    ...exports.fullFormats,
    date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
    time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
    "date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
    "iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
    "iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
    uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
    "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
    email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
  };
  exports.formatNames = Object.keys(exports.fullFormats);
  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }
  var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
  var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function date5(str) {
    const matches = DATE.exec(str);
    if (!matches)
      return false;
    const year = +matches[1];
    const month = +matches[2];
    const day = +matches[3];
    return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
  }
  function compareDate(d1, d2) {
    if (!(d1 && d2))
      return;
    if (d1 > d2)
      return 1;
    if (d1 < d2)
      return -1;
    return 0;
  }
  var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
  function getTime(strictTimeZone) {
    return function time3(str) {
      const matches = TIME.exec(str);
      if (!matches)
        return false;
      const hr = +matches[1];
      const min = +matches[2];
      const sec = +matches[3];
      const tz = matches[4];
      const tzSign = matches[5] === "-" ? -1 : 1;
      const tzH = +(matches[6] || 0);
      const tzM = +(matches[7] || 0);
      if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
        return false;
      if (hr <= 23 && min <= 59 && sec < 60)
        return true;
      const utcMin = min - tzM * tzSign;
      const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
      return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
    };
  }
  function compareTime(s1, s2) {
    if (!(s1 && s2))
      return;
    const t1 = new Date("2020-01-01T" + s1).valueOf();
    const t2 = new Date("2020-01-01T" + s2).valueOf();
    if (!(t1 && t2))
      return;
    return t1 - t2;
  }
  function compareIsoTime(t1, t2) {
    if (!(t1 && t2))
      return;
    const a1 = TIME.exec(t1);
    const a2 = TIME.exec(t2);
    if (!(a1 && a2))
      return;
    t1 = a1[1] + a1[2] + a1[3];
    t2 = a2[1] + a2[2] + a2[3];
    if (t1 > t2)
      return 1;
    if (t1 < t2)
      return -1;
    return 0;
  }
  var DATE_TIME_SEPARATOR = /t|\s/i;
  function getDateTime(strictTimeZone) {
    const time3 = getTime(strictTimeZone);
    return function date_time(str) {
      const dateTime = str.split(DATE_TIME_SEPARATOR);
      return dateTime.length === 2 && date5(dateTime[0]) && time3(dateTime[1]);
    };
  }
  function compareDateTime(dt1, dt2) {
    if (!(dt1 && dt2))
      return;
    const d1 = new Date(dt1).valueOf();
    const d2 = new Date(dt2).valueOf();
    if (!(d1 && d2))
      return;
    return d1 - d2;
  }
  function compareIsoDateTime(dt1, dt2) {
    if (!(dt1 && dt2))
      return;
    const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
    const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
    const res = compareDate(d1, d2);
    if (res === undefined)
      return;
    return res || compareTime(t1, t2);
  }
  var NOT_URI_FRAGMENT = /\/|:/;
  var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
  function uri(str) {
    return NOT_URI_FRAGMENT.test(str) && URI.test(str);
  }
  var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
  function byte(str) {
    BYTE.lastIndex = 0;
    return BYTE.test(str);
  }
  var MIN_INT32 = -(2 ** 31);
  var MAX_INT32 = 2 ** 31 - 1;
  function validateInt32(value) {
    return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
  }
  function validateInt64(value) {
    return Number.isInteger(value);
  }
  function validateNumber() {
    return true;
  }
  var Z_ANCHOR = /[^\\]\\Z/;
  function regex(str) {
    if (Z_ANCHOR.test(str))
      return false;
    try {
      new RegExp(str);
      return true;
    } catch (e) {
      return false;
    }
  }
});

// node_modules/ajv-formats/dist/limit.js
var require_limit = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.formatLimitDefinition = undefined;
  var ajv_1 = require_ajv();
  var codegen_1 = require_codegen();
  var ops = codegen_1.operators;
  var KWDs = {
    formatMaximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
    formatMinimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
    formatExclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
    formatExclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
  };
  var error2 = {
    message: ({ keyword, schemaCode }) => (0, codegen_1.str)`should be ${KWDs[keyword].okStr} ${schemaCode}`,
    params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
  };
  exports.formatLimitDefinition = {
    keyword: Object.keys(KWDs),
    type: "string",
    schemaType: "string",
    $data: true,
    error: error2,
    code(cxt) {
      const { gen, data, schemaCode, keyword, it } = cxt;
      const { opts, self } = it;
      if (!opts.validateFormats)
        return;
      const fCxt = new ajv_1.KeywordCxt(it, self.RULES.all.format.definition, "format");
      if (fCxt.$data)
        validate$DataFormat();
      else
        validateFormat();
      function validate$DataFormat() {
        const fmts = gen.scopeValue("formats", {
          ref: self.formats,
          code: opts.code.formats
        });
        const fmt = gen.const("fmt", (0, codegen_1._)`${fmts}[${fCxt.schemaCode}]`);
        cxt.fail$data((0, codegen_1.or)((0, codegen_1._)`typeof ${fmt} != "object"`, (0, codegen_1._)`${fmt} instanceof RegExp`, (0, codegen_1._)`typeof ${fmt}.compare != "function"`, compareCode(fmt)));
      }
      function validateFormat() {
        const format = fCxt.schema;
        const fmtDef = self.formats[format];
        if (!fmtDef || fmtDef === true)
          return;
        if (typeof fmtDef != "object" || fmtDef instanceof RegExp || typeof fmtDef.compare != "function") {
          throw new Error(`"${keyword}": format "${format}" does not define "compare" function`);
        }
        const fmt = gen.scopeValue("formats", {
          key: format,
          ref: fmtDef,
          code: opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(format)}` : undefined
        });
        cxt.fail$data(compareCode(fmt));
      }
      function compareCode(fmt) {
        return (0, codegen_1._)`${fmt}.compare(${data}, ${schemaCode}) ${KWDs[keyword].fail} 0`;
      }
    },
    dependencies: ["format"]
  };
  var formatLimitPlugin = (ajv) => {
    ajv.addKeyword(exports.formatLimitDefinition);
    return ajv;
  };
  exports.default = formatLimitPlugin;
});

// node_modules/ajv-formats/dist/index.js
var require_dist = __commonJS((exports, module) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var formats_1 = require_formats();
  var limit_1 = require_limit();
  var codegen_1 = require_codegen();
  var fullName = new codegen_1.Name("fullFormats");
  var fastName = new codegen_1.Name("fastFormats");
  var formatsPlugin = (ajv, opts = { keywords: true }) => {
    if (Array.isArray(opts)) {
      addFormats(ajv, opts, formats_1.fullFormats, fullName);
      return ajv;
    }
    const [formats, exportName] = opts.mode === "fast" ? [formats_1.fastFormats, fastName] : [formats_1.fullFormats, fullName];
    const list = opts.formats || formats_1.formatNames;
    addFormats(ajv, list, formats, exportName);
    if (opts.keywords)
      (0, limit_1.default)(ajv);
    return ajv;
  };
  formatsPlugin.get = (name, mode = "full") => {
    const formats = mode === "fast" ? formats_1.fastFormats : formats_1.fullFormats;
    const f = formats[name];
    if (!f)
      throw new Error(`Unknown format "${name}"`);
    return f;
  };
  function addFormats(ajv, list, fs, exportName) {
    var _a;
    var _b;
    (_a = (_b = ajv.opts.code).formats) !== null && _a !== undefined || (_b.formats = (0, codegen_1._)`require("ajv-formats/dist/formats").${exportName}`);
    for (const f of list)
      ajv.addFormat(f, fs[f]);
  }
  module.exports = exports = formatsPlugin;
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.default = formatsPlugin;
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/validation/ajv-provider.js
function createDefaultAjvInstance() {
  const ajv = new import_ajv.default({
    strict: false,
    validateFormats: true,
    validateSchema: false,
    allErrors: true
  });
  const addFormats = import_ajv_formats.default;
  addFormats(ajv);
  return ajv;
}

class AjvJsonSchemaValidator {
  constructor(ajv) {
    this._ajv = ajv ?? createDefaultAjvInstance();
  }
  getValidator(schema) {
    const ajvValidator = "$id" in schema && typeof schema.$id === "string" ? this._ajv.getSchema(schema.$id) ?? this._ajv.compile(schema) : this._ajv.compile(schema);
    return (input) => {
      const valid = ajvValidator(input);
      if (valid) {
        return {
          valid: true,
          data: input,
          errorMessage: undefined
        };
      } else {
        return {
          valid: false,
          data: undefined,
          errorMessage: this._ajv.errorsText(ajvValidator.errors)
        };
      }
    };
  }
}
var import_ajv, import_ajv_formats;
var init_ajv_provider = __esm(() => {
  import_ajv = __toESM(require_ajv(), 1);
  import_ajv_formats = __toESM(require_dist(), 1);
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/experimental/tasks/client.js
class ExperimentalClientTasks {
  constructor(_client) {
    this._client = _client;
  }
  async* callToolStream(params, resultSchema = CallToolResultSchema, options) {
    const clientInternal = this._client;
    const optionsWithTask = {
      ...options,
      task: options?.task ?? (clientInternal.isToolTask(params.name) ? {} : undefined)
    };
    const stream = clientInternal.requestStream({ method: "tools/call", params }, resultSchema, optionsWithTask);
    const validator = clientInternal.getToolOutputValidator(params.name);
    for await (const message of stream) {
      if (message.type === "result" && validator) {
        const result = message.result;
        if (!result.structuredContent && !result.isError) {
          yield {
            type: "error",
            error: new McpError(ErrorCode.InvalidRequest, `Tool ${params.name} has an output schema but did not return structured content`)
          };
          return;
        }
        if (result.structuredContent) {
          try {
            const validationResult = validator(result.structuredContent);
            if (!validationResult.valid) {
              yield {
                type: "error",
                error: new McpError(ErrorCode.InvalidParams, `Structured content does not match the tool's output schema: ${validationResult.errorMessage}`)
              };
              return;
            }
          } catch (error2) {
            if (error2 instanceof McpError) {
              yield { type: "error", error: error2 };
              return;
            }
            yield {
              type: "error",
              error: new McpError(ErrorCode.InvalidParams, `Failed to validate structured content: ${error2 instanceof Error ? error2.message : String(error2)}`)
            };
            return;
          }
        }
      }
      yield message;
    }
  }
  async getTask(taskId, options) {
    return this._client.getTask({ taskId }, options);
  }
  async getTaskResult(taskId, resultSchema, options) {
    return this._client.getTaskResult({ taskId }, resultSchema, options);
  }
  async listTasks(cursor, options) {
    return this._client.listTasks(cursor ? { cursor } : undefined, options);
  }
  async cancelTask(taskId, options) {
    return this._client.cancelTask({ taskId }, options);
  }
  requestStream(request, resultSchema, options) {
    return this._client.requestStream(request, resultSchema, options);
  }
}
var init_client = __esm(() => {
  init_types();
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/experimental/tasks/helpers.js
function assertToolsCallTaskCapability(requests, method, entityName) {
  if (!requests) {
    throw new Error(`${entityName} does not support task creation (required for ${method})`);
  }
  switch (method) {
    case "tools/call":
      if (!requests.tools?.call) {
        throw new Error(`${entityName} does not support task creation for tools/call (required for ${method})`);
      }
      break;
    default:
      break;
  }
}
function assertClientRequestTaskCapability(requests, method, entityName) {
  if (!requests) {
    throw new Error(`${entityName} does not support task creation (required for ${method})`);
  }
  switch (method) {
    case "sampling/createMessage":
      if (!requests.sampling?.createMessage) {
        throw new Error(`${entityName} does not support task creation for sampling/createMessage (required for ${method})`);
      }
      break;
    case "elicitation/create":
      if (!requests.elicitation?.create) {
        throw new Error(`${entityName} does not support task creation for elicitation/create (required for ${method})`);
      }
      break;
    default:
      break;
  }
}

// node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js
function applyElicitationDefaults(schema, data) {
  if (!schema || data === null || typeof data !== "object")
    return;
  if (schema.type === "object" && schema.properties && typeof schema.properties === "object") {
    const obj = data;
    const props = schema.properties;
    for (const key of Object.keys(props)) {
      const propSchema = props[key];
      if (obj[key] === undefined && Object.prototype.hasOwnProperty.call(propSchema, "default")) {
        obj[key] = propSchema.default;
      }
      if (obj[key] !== undefined) {
        applyElicitationDefaults(propSchema, obj[key]);
      }
    }
  }
  if (Array.isArray(schema.anyOf)) {
    for (const sub of schema.anyOf) {
      if (typeof sub !== "boolean") {
        applyElicitationDefaults(sub, data);
      }
    }
  }
  if (Array.isArray(schema.oneOf)) {
    for (const sub of schema.oneOf) {
      if (typeof sub !== "boolean") {
        applyElicitationDefaults(sub, data);
      }
    }
  }
}
function getSupportedElicitationModes(capabilities) {
  if (!capabilities) {
    return { supportsFormMode: false, supportsUrlMode: false };
  }
  const hasFormCapability = capabilities.form !== undefined;
  const hasUrlCapability = capabilities.url !== undefined;
  const supportsFormMode = hasFormCapability || !hasFormCapability && !hasUrlCapability;
  const supportsUrlMode = hasUrlCapability;
  return { supportsFormMode, supportsUrlMode };
}
var Client;
var init_client2 = __esm(() => {
  init_protocol();
  init_types();
  init_ajv_provider();
  init_zod_compat();
  init_client();
  Client = class Client extends Protocol {
    constructor(_clientInfo, options) {
      super(options);
      this._clientInfo = _clientInfo;
      this._cachedToolOutputValidators = new Map;
      this._cachedKnownTaskTools = new Set;
      this._cachedRequiredTaskTools = new Set;
      this._listChangedDebounceTimers = new Map;
      this._capabilities = options?.capabilities ?? {};
      this._jsonSchemaValidator = options?.jsonSchemaValidator ?? new AjvJsonSchemaValidator;
      if (options?.listChanged) {
        this._pendingListChangedConfig = options.listChanged;
      }
    }
    _setupListChangedHandlers(config2) {
      if (config2.tools && this._serverCapabilities?.tools?.listChanged) {
        this._setupListChangedHandler("tools", ToolListChangedNotificationSchema, config2.tools, async () => {
          const result = await this.listTools();
          return result.tools;
        });
      }
      if (config2.prompts && this._serverCapabilities?.prompts?.listChanged) {
        this._setupListChangedHandler("prompts", PromptListChangedNotificationSchema, config2.prompts, async () => {
          const result = await this.listPrompts();
          return result.prompts;
        });
      }
      if (config2.resources && this._serverCapabilities?.resources?.listChanged) {
        this._setupListChangedHandler("resources", ResourceListChangedNotificationSchema, config2.resources, async () => {
          const result = await this.listResources();
          return result.resources;
        });
      }
    }
    get experimental() {
      if (!this._experimental) {
        this._experimental = {
          tasks: new ExperimentalClientTasks(this)
        };
      }
      return this._experimental;
    }
    registerCapabilities(capabilities) {
      if (this.transport) {
        throw new Error("Cannot register capabilities after connecting to transport");
      }
      this._capabilities = mergeCapabilities(this._capabilities, capabilities);
    }
    setRequestHandler(requestSchema, handler) {
      const shape = getObjectShape(requestSchema);
      const methodSchema = shape?.method;
      if (!methodSchema) {
        throw new Error("Schema is missing a method literal");
      }
      let methodValue;
      if (isZ4Schema(methodSchema)) {
        const v4Schema = methodSchema;
        const v4Def = v4Schema._zod?.def;
        methodValue = v4Def?.value ?? v4Schema.value;
      } else {
        const v3Schema = methodSchema;
        const legacyDef = v3Schema._def;
        methodValue = legacyDef?.value ?? v3Schema.value;
      }
      if (typeof methodValue !== "string") {
        throw new Error("Schema method literal must be a string");
      }
      const method = methodValue;
      if (method === "elicitation/create") {
        const wrappedHandler = async (request, extra) => {
          const validatedRequest = safeParse2(ElicitRequestSchema, request);
          if (!validatedRequest.success) {
            const errorMessage = validatedRequest.error instanceof Error ? validatedRequest.error.message : String(validatedRequest.error);
            throw new McpError(ErrorCode.InvalidParams, `Invalid elicitation request: ${errorMessage}`);
          }
          const { params } = validatedRequest.data;
          params.mode = params.mode ?? "form";
          const { supportsFormMode, supportsUrlMode } = getSupportedElicitationModes(this._capabilities.elicitation);
          if (params.mode === "form" && !supportsFormMode) {
            throw new McpError(ErrorCode.InvalidParams, "Client does not support form-mode elicitation requests");
          }
          if (params.mode === "url" && !supportsUrlMode) {
            throw new McpError(ErrorCode.InvalidParams, "Client does not support URL-mode elicitation requests");
          }
          const result = await Promise.resolve(handler(request, extra));
          if (params.task) {
            const taskValidationResult = safeParse2(CreateTaskResultSchema, result);
            if (!taskValidationResult.success) {
              const errorMessage = taskValidationResult.error instanceof Error ? taskValidationResult.error.message : String(taskValidationResult.error);
              throw new McpError(ErrorCode.InvalidParams, `Invalid task creation result: ${errorMessage}`);
            }
            return taskValidationResult.data;
          }
          const validationResult = safeParse2(ElicitResultSchema, result);
          if (!validationResult.success) {
            const errorMessage = validationResult.error instanceof Error ? validationResult.error.message : String(validationResult.error);
            throw new McpError(ErrorCode.InvalidParams, `Invalid elicitation result: ${errorMessage}`);
          }
          const validatedResult = validationResult.data;
          const requestedSchema = params.mode === "form" ? params.requestedSchema : undefined;
          if (params.mode === "form" && validatedResult.action === "accept" && validatedResult.content && requestedSchema) {
            if (this._capabilities.elicitation?.form?.applyDefaults) {
              try {
                applyElicitationDefaults(requestedSchema, validatedResult.content);
              } catch {}
            }
          }
          return validatedResult;
        };
        return super.setRequestHandler(requestSchema, wrappedHandler);
      }
      if (method === "sampling/createMessage") {
        const wrappedHandler = async (request, extra) => {
          const validatedRequest = safeParse2(CreateMessageRequestSchema, request);
          if (!validatedRequest.success) {
            const errorMessage = validatedRequest.error instanceof Error ? validatedRequest.error.message : String(validatedRequest.error);
            throw new McpError(ErrorCode.InvalidParams, `Invalid sampling request: ${errorMessage}`);
          }
          const { params } = validatedRequest.data;
          const result = await Promise.resolve(handler(request, extra));
          if (params.task) {
            const taskValidationResult = safeParse2(CreateTaskResultSchema, result);
            if (!taskValidationResult.success) {
              const errorMessage = taskValidationResult.error instanceof Error ? taskValidationResult.error.message : String(taskValidationResult.error);
              throw new McpError(ErrorCode.InvalidParams, `Invalid task creation result: ${errorMessage}`);
            }
            return taskValidationResult.data;
          }
          const hasTools = params.tools || params.toolChoice;
          const resultSchema = hasTools ? CreateMessageResultWithToolsSchema : CreateMessageResultSchema;
          const validationResult = safeParse2(resultSchema, result);
          if (!validationResult.success) {
            const errorMessage = validationResult.error instanceof Error ? validationResult.error.message : String(validationResult.error);
            throw new McpError(ErrorCode.InvalidParams, `Invalid sampling result: ${errorMessage}`);
          }
          return validationResult.data;
        };
        return super.setRequestHandler(requestSchema, wrappedHandler);
      }
      return super.setRequestHandler(requestSchema, handler);
    }
    assertCapability(capability, method) {
      if (!this._serverCapabilities?.[capability]) {
        throw new Error(`Server does not support ${capability} (required for ${method})`);
      }
    }
    async connect(transport, options) {
      await super.connect(transport);
      if (transport.sessionId !== undefined) {
        return;
      }
      try {
        const result = await this.request({
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: this._capabilities,
            clientInfo: this._clientInfo
          }
        }, InitializeResultSchema, options);
        if (result === undefined) {
          throw new Error(`Server sent invalid initialize result: ${result}`);
        }
        if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
          throw new Error(`Server's protocol version is not supported: ${result.protocolVersion}`);
        }
        this._serverCapabilities = result.capabilities;
        this._serverVersion = result.serverInfo;
        if (transport.setProtocolVersion) {
          transport.setProtocolVersion(result.protocolVersion);
        }
        this._instructions = result.instructions;
        await this.notification({
          method: "notifications/initialized"
        });
        if (this._pendingListChangedConfig) {
          this._setupListChangedHandlers(this._pendingListChangedConfig);
          this._pendingListChangedConfig = undefined;
        }
      } catch (error2) {
        this.close();
        throw error2;
      }
    }
    getServerCapabilities() {
      return this._serverCapabilities;
    }
    getServerVersion() {
      return this._serverVersion;
    }
    getInstructions() {
      return this._instructions;
    }
    assertCapabilityForMethod(method) {
      switch (method) {
        case "logging/setLevel":
          if (!this._serverCapabilities?.logging) {
            throw new Error(`Server does not support logging (required for ${method})`);
          }
          break;
        case "prompts/get":
        case "prompts/list":
          if (!this._serverCapabilities?.prompts) {
            throw new Error(`Server does not support prompts (required for ${method})`);
          }
          break;
        case "resources/list":
        case "resources/templates/list":
        case "resources/read":
        case "resources/subscribe":
        case "resources/unsubscribe":
          if (!this._serverCapabilities?.resources) {
            throw new Error(`Server does not support resources (required for ${method})`);
          }
          if (method === "resources/subscribe" && !this._serverCapabilities.resources.subscribe) {
            throw new Error(`Server does not support resource subscriptions (required for ${method})`);
          }
          break;
        case "tools/call":
        case "tools/list":
          if (!this._serverCapabilities?.tools) {
            throw new Error(`Server does not support tools (required for ${method})`);
          }
          break;
        case "completion/complete":
          if (!this._serverCapabilities?.completions) {
            throw new Error(`Server does not support completions (required for ${method})`);
          }
          break;
        case "initialize":
          break;
        case "ping":
          break;
      }
    }
    assertNotificationCapability(method) {
      switch (method) {
        case "notifications/roots/list_changed":
          if (!this._capabilities.roots?.listChanged) {
            throw new Error(`Client does not support roots list changed notifications (required for ${method})`);
          }
          break;
        case "notifications/initialized":
          break;
        case "notifications/cancelled":
          break;
        case "notifications/progress":
          break;
      }
    }
    assertRequestHandlerCapability(method) {
      if (!this._capabilities) {
        return;
      }
      switch (method) {
        case "sampling/createMessage":
          if (!this._capabilities.sampling) {
            throw new Error(`Client does not support sampling capability (required for ${method})`);
          }
          break;
        case "elicitation/create":
          if (!this._capabilities.elicitation) {
            throw new Error(`Client does not support elicitation capability (required for ${method})`);
          }
          break;
        case "roots/list":
          if (!this._capabilities.roots) {
            throw new Error(`Client does not support roots capability (required for ${method})`);
          }
          break;
        case "tasks/get":
        case "tasks/list":
        case "tasks/result":
        case "tasks/cancel":
          if (!this._capabilities.tasks) {
            throw new Error(`Client does not support tasks capability (required for ${method})`);
          }
          break;
        case "ping":
          break;
      }
    }
    assertTaskCapability(method) {
      assertToolsCallTaskCapability(this._serverCapabilities?.tasks?.requests, method, "Server");
    }
    assertTaskHandlerCapability(method) {
      if (!this._capabilities) {
        return;
      }
      assertClientRequestTaskCapability(this._capabilities.tasks?.requests, method, "Client");
    }
    async ping(options) {
      return this.request({ method: "ping" }, EmptyResultSchema, options);
    }
    async complete(params, options) {
      return this.request({ method: "completion/complete", params }, CompleteResultSchema, options);
    }
    async setLoggingLevel(level, options) {
      return this.request({ method: "logging/setLevel", params: { level } }, EmptyResultSchema, options);
    }
    async getPrompt(params, options) {
      return this.request({ method: "prompts/get", params }, GetPromptResultSchema, options);
    }
    async listPrompts(params, options) {
      return this.request({ method: "prompts/list", params }, ListPromptsResultSchema, options);
    }
    async listResources(params, options) {
      return this.request({ method: "resources/list", params }, ListResourcesResultSchema, options);
    }
    async listResourceTemplates(params, options) {
      return this.request({ method: "resources/templates/list", params }, ListResourceTemplatesResultSchema, options);
    }
    async readResource(params, options) {
      return this.request({ method: "resources/read", params }, ReadResourceResultSchema, options);
    }
    async subscribeResource(params, options) {
      return this.request({ method: "resources/subscribe", params }, EmptyResultSchema, options);
    }
    async unsubscribeResource(params, options) {
      return this.request({ method: "resources/unsubscribe", params }, EmptyResultSchema, options);
    }
    async callTool(params, resultSchema = CallToolResultSchema, options) {
      if (this.isToolTaskRequired(params.name)) {
        throw new McpError(ErrorCode.InvalidRequest, `Tool "${params.name}" requires task-based execution. Use client.experimental.tasks.callToolStream() instead.`);
      }
      const result = await this.request({ method: "tools/call", params }, resultSchema, options);
      const validator = this.getToolOutputValidator(params.name);
      if (validator) {
        if (!result.structuredContent && !result.isError) {
          throw new McpError(ErrorCode.InvalidRequest, `Tool ${params.name} has an output schema but did not return structured content`);
        }
        if (result.structuredContent) {
          try {
            const validationResult = validator(result.structuredContent);
            if (!validationResult.valid) {
              throw new McpError(ErrorCode.InvalidParams, `Structured content does not match the tool's output schema: ${validationResult.errorMessage}`);
            }
          } catch (error2) {
            if (error2 instanceof McpError) {
              throw error2;
            }
            throw new McpError(ErrorCode.InvalidParams, `Failed to validate structured content: ${error2 instanceof Error ? error2.message : String(error2)}`);
          }
        }
      }
      return result;
    }
    isToolTask(toolName) {
      if (!this._serverCapabilities?.tasks?.requests?.tools?.call) {
        return false;
      }
      return this._cachedKnownTaskTools.has(toolName);
    }
    isToolTaskRequired(toolName) {
      return this._cachedRequiredTaskTools.has(toolName);
    }
    cacheToolMetadata(tools) {
      this._cachedToolOutputValidators.clear();
      this._cachedKnownTaskTools.clear();
      this._cachedRequiredTaskTools.clear();
      for (const tool of tools) {
        if (tool.outputSchema) {
          const toolValidator = this._jsonSchemaValidator.getValidator(tool.outputSchema);
          this._cachedToolOutputValidators.set(tool.name, toolValidator);
        }
        const taskSupport = tool.execution?.taskSupport;
        if (taskSupport === "required" || taskSupport === "optional") {
          this._cachedKnownTaskTools.add(tool.name);
        }
        if (taskSupport === "required") {
          this._cachedRequiredTaskTools.add(tool.name);
        }
      }
    }
    getToolOutputValidator(toolName) {
      return this._cachedToolOutputValidators.get(toolName);
    }
    async listTools(params, options) {
      const result = await this.request({ method: "tools/list", params }, ListToolsResultSchema2, options);
      this.cacheToolMetadata(result.tools);
      return result;
    }
    _setupListChangedHandler(listType, notificationSchema, options, fetcher) {
      const parseResult = ListChangedOptionsBaseSchema.safeParse(options);
      if (!parseResult.success) {
        throw new Error(`Invalid ${listType} listChanged options: ${parseResult.error.message}`);
      }
      if (typeof options.onChanged !== "function") {
        throw new Error(`Invalid ${listType} listChanged options: onChanged must be a function`);
      }
      const { autoRefresh, debounceMs } = parseResult.data;
      const { onChanged } = options;
      const refresh = async () => {
        if (!autoRefresh) {
          onChanged(null, null);
          return;
        }
        try {
          const items = await fetcher();
          onChanged(null, items);
        } catch (e) {
          const error2 = e instanceof Error ? e : new Error(String(e));
          onChanged(error2, null);
        }
      };
      const handler = () => {
        if (debounceMs) {
          const existingTimer = this._listChangedDebounceTimers.get(listType);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }
          const timer = setTimeout(refresh, debounceMs);
          this._listChangedDebounceTimers.set(listType, timer);
        } else {
          refresh();
        }
      };
      this.setNotificationHandler(notificationSchema, handler);
    }
    async sendRootsListChanged() {
      return this.notification({ method: "notifications/roots/list_changed" });
    }
  };
});

// node_modules/isexe/windows.js
var require_windows = __commonJS((exports, module) => {
  module.exports = isexe;
  isexe.sync = sync;
  var fs = __require("fs");
  function checkPathExt(path, options) {
    var pathext = options.pathExt !== undefined ? options.pathExt : process.env.PATHEXT;
    if (!pathext) {
      return true;
    }
    pathext = pathext.split(";");
    if (pathext.indexOf("") !== -1) {
      return true;
    }
    for (var i = 0;i < pathext.length; i++) {
      var p = pathext[i].toLowerCase();
      if (p && path.substr(-p.length).toLowerCase() === p) {
        return true;
      }
    }
    return false;
  }
  function checkStat(stat, path, options) {
    if (!stat.isSymbolicLink() && !stat.isFile()) {
      return false;
    }
    return checkPathExt(path, options);
  }
  function isexe(path, options, cb) {
    fs.stat(path, function(er, stat) {
      cb(er, er ? false : checkStat(stat, path, options));
    });
  }
  function sync(path, options) {
    return checkStat(fs.statSync(path), path, options);
  }
});

// node_modules/isexe/mode.js
var require_mode = __commonJS((exports, module) => {
  module.exports = isexe;
  isexe.sync = sync;
  var fs = __require("fs");
  function isexe(path, options, cb) {
    fs.stat(path, function(er, stat) {
      cb(er, er ? false : checkStat(stat, options));
    });
  }
  function sync(path, options) {
    return checkStat(fs.statSync(path), options);
  }
  function checkStat(stat, options) {
    return stat.isFile() && checkMode(stat, options);
  }
  function checkMode(stat, options) {
    var mod = stat.mode;
    var uid = stat.uid;
    var gid = stat.gid;
    var myUid = options.uid !== undefined ? options.uid : process.getuid && process.getuid();
    var myGid = options.gid !== undefined ? options.gid : process.getgid && process.getgid();
    var u = parseInt("100", 8);
    var g = parseInt("010", 8);
    var o = parseInt("001", 8);
    var ug = u | g;
    var ret = mod & o || mod & g && gid === myGid || mod & u && uid === myUid || mod & ug && myUid === 0;
    return ret;
  }
});

// node_modules/isexe/index.js
var require_isexe = __commonJS((exports, module) => {
  var fs = __require("fs");
  var core2;
  if (process.platform === "win32" || global.TESTING_WINDOWS) {
    core2 = require_windows();
  } else {
    core2 = require_mode();
  }
  module.exports = isexe;
  isexe.sync = sync;
  function isexe(path, options, cb) {
    if (typeof options === "function") {
      cb = options;
      options = {};
    }
    if (!cb) {
      if (typeof Promise !== "function") {
        throw new TypeError("callback not provided");
      }
      return new Promise(function(resolve2, reject) {
        isexe(path, options || {}, function(er, is) {
          if (er) {
            reject(er);
          } else {
            resolve2(is);
          }
        });
      });
    }
    core2(path, options || {}, function(er, is) {
      if (er) {
        if (er.code === "EACCES" || options && options.ignoreErrors) {
          er = null;
          is = false;
        }
      }
      cb(er, is);
    });
  }
  function sync(path, options) {
    try {
      return core2.sync(path, options || {});
    } catch (er) {
      if (options && options.ignoreErrors || er.code === "EACCES") {
        return false;
      } else {
        throw er;
      }
    }
  }
});

// node_modules/which/which.js
var require_which = __commonJS((exports, module) => {
  var isWindows = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys";
  var path = __require("path");
  var COLON = isWindows ? ";" : ":";
  var isexe = require_isexe();
  var getNotFoundError = (cmd) => Object.assign(new Error(`not found: ${cmd}`), { code: "ENOENT" });
  var getPathInfo = (cmd, opt) => {
    const colon = opt.colon || COLON;
    const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? [""] : [
      ...isWindows ? [process.cwd()] : [],
      ...(opt.path || process.env.PATH || "").split(colon)
    ];
    const pathExtExe = isWindows ? opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "";
    const pathExt = isWindows ? pathExtExe.split(colon) : [""];
    if (isWindows) {
      if (cmd.indexOf(".") !== -1 && pathExt[0] !== "")
        pathExt.unshift("");
    }
    return {
      pathEnv,
      pathExt,
      pathExtExe
    };
  };
  var which = (cmd, opt, cb) => {
    if (typeof opt === "function") {
      cb = opt;
      opt = {};
    }
    if (!opt)
      opt = {};
    const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
    const found = [];
    const step = (i) => new Promise((resolve2, reject) => {
      if (i === pathEnv.length)
        return opt.all && found.length ? resolve2(found) : reject(getNotFoundError(cmd));
      const ppRaw = pathEnv[i];
      const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
      const pCmd = path.join(pathPart, cmd);
      const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
      resolve2(subStep(p, i, 0));
    });
    const subStep = (p, i, ii) => new Promise((resolve2, reject) => {
      if (ii === pathExt.length)
        return resolve2(step(i + 1));
      const ext = pathExt[ii];
      isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
        if (!er && is) {
          if (opt.all)
            found.push(p + ext);
          else
            return resolve2(p + ext);
        }
        return resolve2(subStep(p, i, ii + 1));
      });
    });
    return cb ? step(0).then((res) => cb(null, res), cb) : step(0);
  };
  var whichSync = (cmd, opt) => {
    opt = opt || {};
    const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
    const found = [];
    for (let i = 0;i < pathEnv.length; i++) {
      const ppRaw = pathEnv[i];
      const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
      const pCmd = path.join(pathPart, cmd);
      const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
      for (let j = 0;j < pathExt.length; j++) {
        const cur = p + pathExt[j];
        try {
          const is = isexe.sync(cur, { pathExt: pathExtExe });
          if (is) {
            if (opt.all)
              found.push(cur);
            else
              return cur;
          }
        } catch (ex) {}
      }
    }
    if (opt.all && found.length)
      return found;
    if (opt.nothrow)
      return null;
    throw getNotFoundError(cmd);
  };
  module.exports = which;
  which.sync = whichSync;
});

// node_modules/path-key/index.js
var require_path_key = __commonJS((exports, module) => {
  var pathKey = (options = {}) => {
    const environment = options.env || process.env;
    const platform = options.platform || process.platform;
    if (platform !== "win32") {
      return "PATH";
    }
    return Object.keys(environment).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
  };
  module.exports = pathKey;
  module.exports.default = pathKey;
});

// node_modules/cross-spawn/lib/util/resolveCommand.js
var require_resolveCommand = __commonJS((exports, module) => {
  var path = __require("path");
  var which = require_which();
  var getPathKey = require_path_key();
  function resolveCommandAttempt(parsed, withoutPathExt) {
    const env = parsed.options.env || process.env;
    const cwd = process.cwd();
    const hasCustomCwd = parsed.options.cwd != null;
    const shouldSwitchCwd = hasCustomCwd && process.chdir !== undefined && !process.chdir.disabled;
    if (shouldSwitchCwd) {
      try {
        process.chdir(parsed.options.cwd);
      } catch (err) {}
    }
    let resolved;
    try {
      resolved = which.sync(parsed.command, {
        path: env[getPathKey({ env })],
        pathExt: withoutPathExt ? path.delimiter : undefined
      });
    } catch (e) {} finally {
      if (shouldSwitchCwd) {
        process.chdir(cwd);
      }
    }
    if (resolved) {
      resolved = path.resolve(hasCustomCwd ? parsed.options.cwd : "", resolved);
    }
    return resolved;
  }
  function resolveCommand(parsed) {
    return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
  }
  module.exports = resolveCommand;
});

// node_modules/cross-spawn/lib/util/escape.js
var require_escape = __commonJS((exports, module) => {
  var metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
  function escapeCommand(arg) {
    arg = arg.replace(metaCharsRegExp, "^$1");
    return arg;
  }
  function escapeArgument(arg, doubleEscapeMetaChars) {
    arg = `${arg}`;
    arg = arg.replace(/(?=(\\+?)?)\1"/g, "$1$1\\\"");
    arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
    arg = `"${arg}"`;
    arg = arg.replace(metaCharsRegExp, "^$1");
    if (doubleEscapeMetaChars) {
      arg = arg.replace(metaCharsRegExp, "^$1");
    }
    return arg;
  }
  exports.command = escapeCommand;
  exports.argument = escapeArgument;
});

// node_modules/shebang-regex/index.js
var require_shebang_regex = __commonJS((exports, module) => {
  module.exports = /^#!(.*)/;
});

// node_modules/shebang-command/index.js
var require_shebang_command = __commonJS((exports, module) => {
  var shebangRegex = require_shebang_regex();
  module.exports = (string5 = "") => {
    const match = string5.match(shebangRegex);
    if (!match) {
      return null;
    }
    const [path, argument] = match[0].replace(/#! ?/, "").split(" ");
    const binary = path.split("/").pop();
    if (binary === "env") {
      return argument;
    }
    return argument ? `${binary} ${argument}` : binary;
  };
});

// node_modules/cross-spawn/lib/util/readShebang.js
var require_readShebang = __commonJS((exports, module) => {
  var fs = __require("fs");
  var shebangCommand = require_shebang_command();
  function readShebang(command) {
    const size = 150;
    const buffer = Buffer.alloc(size);
    let fd;
    try {
      fd = fs.openSync(command, "r");
      fs.readSync(fd, buffer, 0, size, 0);
      fs.closeSync(fd);
    } catch (e) {}
    return shebangCommand(buffer.toString());
  }
  module.exports = readShebang;
});

// node_modules/cross-spawn/lib/parse.js
var require_parse = __commonJS((exports, module) => {
  var path = __require("path");
  var resolveCommand = require_resolveCommand();
  var escape2 = require_escape();
  var readShebang = require_readShebang();
  var isWin = process.platform === "win32";
  var isExecutableRegExp = /\.(?:com|exe)$/i;
  var isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
  function detectShebang(parsed) {
    parsed.file = resolveCommand(parsed);
    const shebang = parsed.file && readShebang(parsed.file);
    if (shebang) {
      parsed.args.unshift(parsed.file);
      parsed.command = shebang;
      return resolveCommand(parsed);
    }
    return parsed.file;
  }
  function parseNonShell(parsed) {
    if (!isWin) {
      return parsed;
    }
    const commandFile = detectShebang(parsed);
    const needsShell = !isExecutableRegExp.test(commandFile);
    if (parsed.options.forceShell || needsShell) {
      const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);
      parsed.command = path.normalize(parsed.command);
      parsed.command = escape2.command(parsed.command);
      parsed.args = parsed.args.map((arg) => escape2.argument(arg, needsDoubleEscapeMetaChars));
      const shellCommand = [parsed.command].concat(parsed.args).join(" ");
      parsed.args = ["/d", "/s", "/c", `"${shellCommand}"`];
      parsed.command = process.env.comspec || "cmd.exe";
      parsed.options.windowsVerbatimArguments = true;
    }
    return parsed;
  }
  function parse6(command, args, options) {
    if (args && !Array.isArray(args)) {
      options = args;
      args = null;
    }
    args = args ? args.slice(0) : [];
    options = Object.assign({}, options);
    const parsed = {
      command,
      args,
      options,
      file: undefined,
      original: {
        command,
        args
      }
    };
    return options.shell ? parsed : parseNonShell(parsed);
  }
  module.exports = parse6;
});

// node_modules/cross-spawn/lib/enoent.js
var require_enoent = __commonJS((exports, module) => {
  var isWin = process.platform === "win32";
  function notFoundError(original, syscall) {
    return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
      code: "ENOENT",
      errno: "ENOENT",
      syscall: `${syscall} ${original.command}`,
      path: original.command,
      spawnargs: original.args
    });
  }
  function hookChildProcess(cp, parsed) {
    if (!isWin) {
      return;
    }
    const originalEmit = cp.emit;
    cp.emit = function(name, arg1) {
      if (name === "exit") {
        const err = verifyENOENT(arg1, parsed);
        if (err) {
          return originalEmit.call(cp, "error", err);
        }
      }
      return originalEmit.apply(cp, arguments);
    };
  }
  function verifyENOENT(status, parsed) {
    if (isWin && status === 1 && !parsed.file) {
      return notFoundError(parsed.original, "spawn");
    }
    return null;
  }
  function verifyENOENTSync(status, parsed) {
    if (isWin && status === 1 && !parsed.file) {
      return notFoundError(parsed.original, "spawnSync");
    }
    return null;
  }
  module.exports = {
    hookChildProcess,
    verifyENOENT,
    verifyENOENTSync,
    notFoundError
  };
});

// node_modules/cross-spawn/index.js
var require_cross_spawn = __commonJS((exports, module) => {
  var cp = __require("child_process");
  var parse6 = require_parse();
  var enoent = require_enoent();
  function spawn(command, args, options) {
    const parsed = parse6(command, args, options);
    const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);
    enoent.hookChildProcess(spawned, parsed);
    return spawned;
  }
  function spawnSync(command, args, options) {
    const parsed = parse6(command, args, options);
    const result = cp.spawnSync(parsed.command, parsed.args, parsed.options);
    result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);
    return result;
  }
  module.exports = spawn;
  module.exports.spawn = spawn;
  module.exports.sync = spawnSync;
  module.exports._parse = parse6;
  module.exports._enoent = enoent;
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/shared/stdio.js
class ReadBuffer {
  append(chunk) {
    this._buffer = this._buffer ? Buffer.concat([this._buffer, chunk]) : chunk;
  }
  readMessage() {
    if (!this._buffer) {
      return null;
    }
    const index = this._buffer.indexOf(`
`);
    if (index === -1) {
      return null;
    }
    const line = this._buffer.toString("utf8", 0, index).replace(/\r$/, "");
    this._buffer = this._buffer.subarray(index + 1);
    return deserializeMessage(line);
  }
  clear() {
    this._buffer = undefined;
  }
}
function deserializeMessage(line) {
  return JSONRPCMessageSchema.parse(JSON.parse(line));
}
function serializeMessage(message) {
  return JSON.stringify(message) + `
`;
}
var init_stdio = __esm(() => {
  init_types();
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js
import process2 from "node:process";
import { PassThrough } from "node:stream";
function getDefaultEnvironment() {
  const env = {};
  for (const key of DEFAULT_INHERITED_ENV_VARS) {
    const value = process2.env[key];
    if (value === undefined) {
      continue;
    }
    if (value.startsWith("()")) {
      continue;
    }
    env[key] = value;
  }
  return env;
}

class StdioClientTransport {
  constructor(server) {
    this._readBuffer = new ReadBuffer;
    this._stderrStream = null;
    this._serverParams = server;
    if (server.stderr === "pipe" || server.stderr === "overlapped") {
      this._stderrStream = new PassThrough;
    }
  }
  async start() {
    if (this._process) {
      throw new Error("StdioClientTransport already started! If using Client class, note that connect() calls start() automatically.");
    }
    return new Promise((resolve2, reject) => {
      this._process = import_cross_spawn.default(this._serverParams.command, this._serverParams.args ?? [], {
        env: {
          ...getDefaultEnvironment(),
          ...this._serverParams.env
        },
        stdio: ["pipe", "pipe", this._serverParams.stderr ?? "inherit"],
        shell: false,
        windowsHide: process2.platform === "win32",
        cwd: this._serverParams.cwd
      });
      this._process.on("error", (error2) => {
        reject(error2);
        this.onerror?.(error2);
      });
      this._process.on("spawn", () => {
        resolve2();
      });
      this._process.on("close", (_code) => {
        this._process = undefined;
        this.onclose?.();
      });
      this._process.stdin?.on("error", (error2) => {
        this.onerror?.(error2);
      });
      this._process.stdout?.on("data", (chunk) => {
        this._readBuffer.append(chunk);
        this.processReadBuffer();
      });
      this._process.stdout?.on("error", (error2) => {
        this.onerror?.(error2);
      });
      if (this._stderrStream && this._process.stderr) {
        this._process.stderr.pipe(this._stderrStream);
      }
    });
  }
  get stderr() {
    if (this._stderrStream) {
      return this._stderrStream;
    }
    return this._process?.stderr ?? null;
  }
  get pid() {
    return this._process?.pid ?? null;
  }
  processReadBuffer() {
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) {
          break;
        }
        this.onmessage?.(message);
      } catch (error2) {
        this.onerror?.(error2);
      }
    }
  }
  async close() {
    if (this._process) {
      const processToClose = this._process;
      this._process = undefined;
      const closePromise = new Promise((resolve2) => {
        processToClose.once("close", () => {
          resolve2();
        });
      });
      try {
        processToClose.stdin?.end();
      } catch {}
      await Promise.race([closePromise, new Promise((resolve2) => setTimeout(resolve2, 2000).unref())]);
      if (processToClose.exitCode === null) {
        try {
          processToClose.kill("SIGTERM");
        } catch {}
        await Promise.race([closePromise, new Promise((resolve2) => setTimeout(resolve2, 2000).unref())]);
      }
      if (processToClose.exitCode === null) {
        try {
          processToClose.kill("SIGKILL");
        } catch {}
      }
    }
    this._readBuffer.clear();
  }
  send(message) {
    return new Promise((resolve2) => {
      if (!this._process?.stdin) {
        throw new Error("Not connected");
      }
      const json = serializeMessage(message);
      if (this._process.stdin.write(json)) {
        resolve2();
      } else {
        this._process.stdin.once("drain", resolve2);
      }
    });
  }
}
var import_cross_spawn, DEFAULT_INHERITED_ENV_VARS;
var init_stdio2 = __esm(() => {
  init_stdio();
  import_cross_spawn = __toESM(require_cross_spawn(), 1);
  DEFAULT_INHERITED_ENV_VARS = process2.platform === "win32" ? [
    "APPDATA",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "PATH",
    "PROCESSOR_ARCHITECTURE",
    "SYSTEMDRIVE",
    "SYSTEMROOT",
    "TEMP",
    "USERNAME",
    "USERPROFILE",
    "PROGRAMFILES"
  ] : ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"];
});

// node_modules/eventsource-parser/dist/index.js
function noop(_arg) {}
function createParser(callbacks) {
  if (typeof callbacks == "function")
    throw new TypeError("`callbacks` must be an object, got a function instead. Did you mean `{onEvent: fn}`?");
  const { onEvent = noop, onError = noop, onRetry = noop, onComment } = callbacks;
  let incompleteLine = "", isFirstChunk = true, id, data = "", eventType = "";
  function feed(newChunk) {
    const chunk = isFirstChunk ? newChunk.replace(/^\xEF\xBB\xBF/, "") : newChunk, [complete, incomplete] = splitLines(`${incompleteLine}${chunk}`);
    for (const line of complete)
      parseLine(line);
    incompleteLine = incomplete, isFirstChunk = false;
  }
  function parseLine(line) {
    if (line === "") {
      dispatchEvent();
      return;
    }
    if (line.startsWith(":")) {
      onComment && onComment(line.slice(line.startsWith(": ") ? 2 : 1));
      return;
    }
    const fieldSeparatorIndex = line.indexOf(":");
    if (fieldSeparatorIndex !== -1) {
      const field = line.slice(0, fieldSeparatorIndex), offset = line[fieldSeparatorIndex + 1] === " " ? 2 : 1, value = line.slice(fieldSeparatorIndex + offset);
      processField(field, value, line);
      return;
    }
    processField(line, "", line);
  }
  function processField(field, value, line) {
    switch (field) {
      case "event":
        eventType = value;
        break;
      case "data":
        data = `${data}${value}
`;
        break;
      case "id":
        id = value.includes("\x00") ? undefined : value;
        break;
      case "retry":
        /^\d+$/.test(value) ? onRetry(parseInt(value, 10)) : onError(new ParseError(`Invalid \`retry\` value: "${value}"`, {
          type: "invalid-retry",
          value,
          line
        }));
        break;
      default:
        onError(new ParseError(`Unknown field "${field.length > 20 ? `${field.slice(0, 20)}…` : field}"`, { type: "unknown-field", field, value, line }));
        break;
    }
  }
  function dispatchEvent() {
    data.length > 0 && onEvent({
      id,
      event: eventType || undefined,
      data: data.endsWith(`
`) ? data.slice(0, -1) : data
    }), id = undefined, data = "", eventType = "";
  }
  function reset(options = {}) {
    incompleteLine && options.consume && parseLine(incompleteLine), isFirstChunk = true, id = undefined, data = "", eventType = "", incompleteLine = "";
  }
  return { feed, reset };
}
function splitLines(chunk) {
  const lines = [];
  let incompleteLine = "", searchIndex = 0;
  for (;searchIndex < chunk.length; ) {
    const crIndex = chunk.indexOf("\r", searchIndex), lfIndex = chunk.indexOf(`
`, searchIndex);
    let lineEnd = -1;
    if (crIndex !== -1 && lfIndex !== -1 ? lineEnd = Math.min(crIndex, lfIndex) : crIndex !== -1 ? crIndex === chunk.length - 1 ? lineEnd = -1 : lineEnd = crIndex : lfIndex !== -1 && (lineEnd = lfIndex), lineEnd === -1) {
      incompleteLine = chunk.slice(searchIndex);
      break;
    } else {
      const line = chunk.slice(searchIndex, lineEnd);
      lines.push(line), searchIndex = lineEnd + 1, chunk[searchIndex - 1] === "\r" && chunk[searchIndex] === `
` && searchIndex++;
    }
  }
  return [lines, incompleteLine];
}
var ParseError;
var init_dist = __esm(() => {
  ParseError = class ParseError extends Error {
    constructor(message, options) {
      super(message), this.name = "ParseError", this.type = options.type, this.field = options.field, this.value = options.value, this.line = options.line;
    }
  };
});

// node_modules/eventsource/dist/index.js
function syntaxError(message) {
  const DomException = globalThis.DOMException;
  return typeof DomException == "function" ? new DomException(message, "SyntaxError") : new SyntaxError(message);
}
function flattenError2(err) {
  return err instanceof Error ? "errors" in err && Array.isArray(err.errors) ? err.errors.map(flattenError2).join(", ") : ("cause" in err) && err.cause instanceof Error ? `${err}: ${flattenError2(err.cause)}` : err.message : `${err}`;
}
function inspectableError(err) {
  return {
    type: err.type,
    message: err.message,
    code: err.code,
    defaultPrevented: err.defaultPrevented,
    cancelable: err.cancelable,
    timeStamp: err.timeStamp
  };
}
function getBaseURL() {
  const doc2 = "document" in globalThis ? globalThis.document : undefined;
  return doc2 && typeof doc2 == "object" && "baseURI" in doc2 && typeof doc2.baseURI == "string" ? doc2.baseURI : undefined;
}
var ErrorEvent, __typeError = (msg) => {
  throw TypeError(msg);
}, __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg), __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj)), __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value), __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), member.set(obj, value), value), __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method), _readyState, _url2, _redirectUrl, _withCredentials, _fetch, _reconnectInterval, _reconnectTimer, _lastEventId, _controller, _parser, _onError, _onMessage, _onOpen, _EventSource_instances, connect_fn, _onFetchResponse, _onFetchError, getRequestOptions_fn, _onEvent, _onRetryChange, failConnection_fn, scheduleReconnect_fn, _reconnect, EventSource;
var init_dist2 = __esm(() => {
  init_dist();
  ErrorEvent = class ErrorEvent extends Event {
    constructor(type, errorEventInitDict) {
      var _a, _b;
      super(type), this.code = (_a = errorEventInitDict == null ? undefined : errorEventInitDict.code) != null ? _a : undefined, this.message = (_b = errorEventInitDict == null ? undefined : errorEventInitDict.message) != null ? _b : undefined;
    }
    [Symbol.for("nodejs.util.inspect.custom")](_depth, options, inspect) {
      return inspect(inspectableError(this), options);
    }
    [Symbol.for("Deno.customInspect")](inspect, options) {
      return inspect(inspectableError(this), options);
    }
  };
  EventSource = class EventSource extends EventTarget {
    constructor(url2, eventSourceInitDict) {
      var _a, _b;
      super(), __privateAdd(this, _EventSource_instances), this.CONNECTING = 0, this.OPEN = 1, this.CLOSED = 2, __privateAdd(this, _readyState), __privateAdd(this, _url2), __privateAdd(this, _redirectUrl), __privateAdd(this, _withCredentials), __privateAdd(this, _fetch), __privateAdd(this, _reconnectInterval), __privateAdd(this, _reconnectTimer), __privateAdd(this, _lastEventId, null), __privateAdd(this, _controller), __privateAdd(this, _parser), __privateAdd(this, _onError, null), __privateAdd(this, _onMessage, null), __privateAdd(this, _onOpen, null), __privateAdd(this, _onFetchResponse, async (response) => {
        var _a2;
        __privateGet(this, _parser).reset();
        const { body, redirected, status, headers } = response;
        if (status === 204) {
          __privateMethod(this, _EventSource_instances, failConnection_fn).call(this, "Server sent HTTP 204, not reconnecting", 204), this.close();
          return;
        }
        if (redirected ? __privateSet(this, _redirectUrl, new URL(response.url)) : __privateSet(this, _redirectUrl, undefined), status !== 200) {
          __privateMethod(this, _EventSource_instances, failConnection_fn).call(this, `Non-200 status code (${status})`, status);
          return;
        }
        if (!(headers.get("content-type") || "").startsWith("text/event-stream")) {
          __privateMethod(this, _EventSource_instances, failConnection_fn).call(this, 'Invalid content type, expected "text/event-stream"', status);
          return;
        }
        if (__privateGet(this, _readyState) === this.CLOSED)
          return;
        __privateSet(this, _readyState, this.OPEN);
        const openEvent = new Event("open");
        if ((_a2 = __privateGet(this, _onOpen)) == null || _a2.call(this, openEvent), this.dispatchEvent(openEvent), typeof body != "object" || !body || !("getReader" in body)) {
          __privateMethod(this, _EventSource_instances, failConnection_fn).call(this, "Invalid response body, expected a web ReadableStream", status), this.close();
          return;
        }
        const decoder = new TextDecoder, reader = body.getReader();
        let open = true;
        do {
          const { done, value } = await reader.read();
          value && __privateGet(this, _parser).feed(decoder.decode(value, { stream: !done })), done && (open = false, __privateGet(this, _parser).reset(), __privateMethod(this, _EventSource_instances, scheduleReconnect_fn).call(this));
        } while (open);
      }), __privateAdd(this, _onFetchError, (err) => {
        __privateSet(this, _controller, undefined), !(err.name === "AbortError" || err.type === "aborted") && __privateMethod(this, _EventSource_instances, scheduleReconnect_fn).call(this, flattenError2(err));
      }), __privateAdd(this, _onEvent, (event) => {
        typeof event.id == "string" && __privateSet(this, _lastEventId, event.id);
        const messageEvent = new MessageEvent(event.event || "message", {
          data: event.data,
          origin: __privateGet(this, _redirectUrl) ? __privateGet(this, _redirectUrl).origin : __privateGet(this, _url2).origin,
          lastEventId: event.id || ""
        });
        __privateGet(this, _onMessage) && (!event.event || event.event === "message") && __privateGet(this, _onMessage).call(this, messageEvent), this.dispatchEvent(messageEvent);
      }), __privateAdd(this, _onRetryChange, (value) => {
        __privateSet(this, _reconnectInterval, value);
      }), __privateAdd(this, _reconnect, () => {
        __privateSet(this, _reconnectTimer, undefined), __privateGet(this, _readyState) === this.CONNECTING && __privateMethod(this, _EventSource_instances, connect_fn).call(this);
      });
      try {
        if (url2 instanceof URL)
          __privateSet(this, _url2, url2);
        else if (typeof url2 == "string")
          __privateSet(this, _url2, new URL(url2, getBaseURL()));
        else
          throw new Error("Invalid URL");
      } catch {
        throw syntaxError("An invalid or illegal string was specified");
      }
      __privateSet(this, _parser, createParser({
        onEvent: __privateGet(this, _onEvent),
        onRetry: __privateGet(this, _onRetryChange)
      })), __privateSet(this, _readyState, this.CONNECTING), __privateSet(this, _reconnectInterval, 3000), __privateSet(this, _fetch, (_a = eventSourceInitDict == null ? undefined : eventSourceInitDict.fetch) != null ? _a : globalThis.fetch), __privateSet(this, _withCredentials, (_b = eventSourceInitDict == null ? undefined : eventSourceInitDict.withCredentials) != null ? _b : false), __privateMethod(this, _EventSource_instances, connect_fn).call(this);
    }
    get readyState() {
      return __privateGet(this, _readyState);
    }
    get url() {
      return __privateGet(this, _url2).href;
    }
    get withCredentials() {
      return __privateGet(this, _withCredentials);
    }
    get onerror() {
      return __privateGet(this, _onError);
    }
    set onerror(value) {
      __privateSet(this, _onError, value);
    }
    get onmessage() {
      return __privateGet(this, _onMessage);
    }
    set onmessage(value) {
      __privateSet(this, _onMessage, value);
    }
    get onopen() {
      return __privateGet(this, _onOpen);
    }
    set onopen(value) {
      __privateSet(this, _onOpen, value);
    }
    addEventListener(type, listener, options) {
      const listen = listener;
      super.addEventListener(type, listen, options);
    }
    removeEventListener(type, listener, options) {
      const listen = listener;
      super.removeEventListener(type, listen, options);
    }
    close() {
      __privateGet(this, _reconnectTimer) && clearTimeout(__privateGet(this, _reconnectTimer)), __privateGet(this, _readyState) !== this.CLOSED && (__privateGet(this, _controller) && __privateGet(this, _controller).abort(), __privateSet(this, _readyState, this.CLOSED), __privateSet(this, _controller, undefined));
    }
  };
  _readyState = /* @__PURE__ */ new WeakMap, _url2 = /* @__PURE__ */ new WeakMap, _redirectUrl = /* @__PURE__ */ new WeakMap, _withCredentials = /* @__PURE__ */ new WeakMap, _fetch = /* @__PURE__ */ new WeakMap, _reconnectInterval = /* @__PURE__ */ new WeakMap, _reconnectTimer = /* @__PURE__ */ new WeakMap, _lastEventId = /* @__PURE__ */ new WeakMap, _controller = /* @__PURE__ */ new WeakMap, _parser = /* @__PURE__ */ new WeakMap, _onError = /* @__PURE__ */ new WeakMap, _onMessage = /* @__PURE__ */ new WeakMap, _onOpen = /* @__PURE__ */ new WeakMap, _EventSource_instances = /* @__PURE__ */ new WeakSet, connect_fn = function() {
    __privateSet(this, _readyState, this.CONNECTING), __privateSet(this, _controller, new AbortController), __privateGet(this, _fetch)(__privateGet(this, _url2), __privateMethod(this, _EventSource_instances, getRequestOptions_fn).call(this)).then(__privateGet(this, _onFetchResponse)).catch(__privateGet(this, _onFetchError));
  }, _onFetchResponse = /* @__PURE__ */ new WeakMap, _onFetchError = /* @__PURE__ */ new WeakMap, getRequestOptions_fn = function() {
    var _a;
    const init = {
      mode: "cors",
      redirect: "follow",
      headers: { Accept: "text/event-stream", ...__privateGet(this, _lastEventId) ? { "Last-Event-ID": __privateGet(this, _lastEventId) } : undefined },
      cache: "no-store",
      signal: (_a = __privateGet(this, _controller)) == null ? undefined : _a.signal
    };
    return "window" in globalThis && (init.credentials = this.withCredentials ? "include" : "same-origin"), init;
  }, _onEvent = /* @__PURE__ */ new WeakMap, _onRetryChange = /* @__PURE__ */ new WeakMap, failConnection_fn = function(message, code) {
    var _a;
    __privateGet(this, _readyState) !== this.CLOSED && __privateSet(this, _readyState, this.CLOSED);
    const errorEvent = new ErrorEvent("error", { code, message });
    (_a = __privateGet(this, _onError)) == null || _a.call(this, errorEvent), this.dispatchEvent(errorEvent);
  }, scheduleReconnect_fn = function(message, code) {
    var _a;
    if (__privateGet(this, _readyState) === this.CLOSED)
      return;
    __privateSet(this, _readyState, this.CONNECTING);
    const errorEvent = new ErrorEvent("error", { code, message });
    (_a = __privateGet(this, _onError)) == null || _a.call(this, errorEvent), this.dispatchEvent(errorEvent), __privateSet(this, _reconnectTimer, setTimeout(__privateGet(this, _reconnect), __privateGet(this, _reconnectInterval)));
  }, _reconnect = /* @__PURE__ */ new WeakMap, EventSource.CONNECTING = 0, EventSource.OPEN = 1, EventSource.CLOSED = 2;
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/shared/transport.js
function normalizeHeaders(headers) {
  if (!headers)
    return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}
function createFetchWithInit(baseFetch = fetch, baseInit) {
  if (!baseInit) {
    return baseFetch;
  }
  return async (url2, init) => {
    const mergedInit = {
      ...baseInit,
      ...init,
      headers: init?.headers ? { ...normalizeHeaders(baseInit.headers), ...normalizeHeaders(init.headers) } : baseInit.headers
    };
    return baseFetch(url2, mergedInit);
  };
}

// node_modules/pkce-challenge/dist/index.node.js
async function getRandomValues(size) {
  return (await crypto).getRandomValues(new Uint8Array(size));
}
async function random(size) {
  const mask = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  const evenDistCutoff = Math.pow(2, 8) - Math.pow(2, 8) % mask.length;
  let result = "";
  while (result.length < size) {
    const randomBytes = await getRandomValues(size - result.length);
    for (const randomByte of randomBytes) {
      if (randomByte < evenDistCutoff) {
        result += mask[randomByte % mask.length];
      }
    }
  }
  return result;
}
async function generateVerifier(length) {
  return await random(length);
}
async function generateChallenge(code_verifier) {
  const buffer = await (await crypto).subtle.digest("SHA-256", new TextEncoder().encode(code_verifier));
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\//g, "_").replace(/\+/g, "-").replace(/=/g, "");
}
async function pkceChallenge(length) {
  if (!length)
    length = 43;
  if (length < 43 || length > 128) {
    throw `Expected a length between 43 and 128. Received ${length}.`;
  }
  const verifier = await generateVerifier(length);
  const challenge = await generateChallenge(verifier);
  return {
    code_verifier: verifier,
    code_challenge: challenge
  };
}
var crypto;
var init_index_node = __esm(() => {
  crypto = globalThis.crypto?.webcrypto ?? globalThis.crypto ?? import("node:crypto").then((m) => m.webcrypto);
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/shared/auth.js
var SafeUrlSchema, OAuthProtectedResourceMetadataSchema, OAuthMetadataSchema, OpenIdProviderMetadataSchema, OpenIdProviderDiscoveryMetadataSchema, OAuthTokensSchema, OAuthErrorResponseSchema, OptionalSafeUrlSchema, OAuthClientMetadataSchema, OAuthClientInformationSchema, OAuthClientInformationFullSchema, OAuthClientRegistrationErrorSchema, OAuthTokenRevocationRequestSchema;
var init_auth = __esm(() => {
  init_v4();
  SafeUrlSchema = url().superRefine((val, ctx) => {
    if (!URL.canParse(val)) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: "URL must be parseable",
        fatal: true
      });
      return NEVER;
    }
  }).refine((url2) => {
    const u = new URL(url2);
    return u.protocol !== "javascript:" && u.protocol !== "data:" && u.protocol !== "vbscript:";
  }, { message: "URL cannot use javascript:, data:, or vbscript: scheme" });
  OAuthProtectedResourceMetadataSchema = looseObject({
    resource: string2().url(),
    authorization_servers: array(SafeUrlSchema).optional(),
    jwks_uri: string2().url().optional(),
    scopes_supported: array(string2()).optional(),
    bearer_methods_supported: array(string2()).optional(),
    resource_signing_alg_values_supported: array(string2()).optional(),
    resource_name: string2().optional(),
    resource_documentation: string2().optional(),
    resource_policy_uri: string2().url().optional(),
    resource_tos_uri: string2().url().optional(),
    tls_client_certificate_bound_access_tokens: boolean2().optional(),
    authorization_details_types_supported: array(string2()).optional(),
    dpop_signing_alg_values_supported: array(string2()).optional(),
    dpop_bound_access_tokens_required: boolean2().optional()
  });
  OAuthMetadataSchema = looseObject({
    issuer: string2(),
    authorization_endpoint: SafeUrlSchema,
    token_endpoint: SafeUrlSchema,
    registration_endpoint: SafeUrlSchema.optional(),
    scopes_supported: array(string2()).optional(),
    response_types_supported: array(string2()),
    response_modes_supported: array(string2()).optional(),
    grant_types_supported: array(string2()).optional(),
    token_endpoint_auth_methods_supported: array(string2()).optional(),
    token_endpoint_auth_signing_alg_values_supported: array(string2()).optional(),
    service_documentation: SafeUrlSchema.optional(),
    revocation_endpoint: SafeUrlSchema.optional(),
    revocation_endpoint_auth_methods_supported: array(string2()).optional(),
    revocation_endpoint_auth_signing_alg_values_supported: array(string2()).optional(),
    introspection_endpoint: string2().optional(),
    introspection_endpoint_auth_methods_supported: array(string2()).optional(),
    introspection_endpoint_auth_signing_alg_values_supported: array(string2()).optional(),
    code_challenge_methods_supported: array(string2()).optional(),
    client_id_metadata_document_supported: boolean2().optional()
  });
  OpenIdProviderMetadataSchema = looseObject({
    issuer: string2(),
    authorization_endpoint: SafeUrlSchema,
    token_endpoint: SafeUrlSchema,
    userinfo_endpoint: SafeUrlSchema.optional(),
    jwks_uri: SafeUrlSchema,
    registration_endpoint: SafeUrlSchema.optional(),
    scopes_supported: array(string2()).optional(),
    response_types_supported: array(string2()),
    response_modes_supported: array(string2()).optional(),
    grant_types_supported: array(string2()).optional(),
    acr_values_supported: array(string2()).optional(),
    subject_types_supported: array(string2()),
    id_token_signing_alg_values_supported: array(string2()),
    id_token_encryption_alg_values_supported: array(string2()).optional(),
    id_token_encryption_enc_values_supported: array(string2()).optional(),
    userinfo_signing_alg_values_supported: array(string2()).optional(),
    userinfo_encryption_alg_values_supported: array(string2()).optional(),
    userinfo_encryption_enc_values_supported: array(string2()).optional(),
    request_object_signing_alg_values_supported: array(string2()).optional(),
    request_object_encryption_alg_values_supported: array(string2()).optional(),
    request_object_encryption_enc_values_supported: array(string2()).optional(),
    token_endpoint_auth_methods_supported: array(string2()).optional(),
    token_endpoint_auth_signing_alg_values_supported: array(string2()).optional(),
    display_values_supported: array(string2()).optional(),
    claim_types_supported: array(string2()).optional(),
    claims_supported: array(string2()).optional(),
    service_documentation: string2().optional(),
    claims_locales_supported: array(string2()).optional(),
    ui_locales_supported: array(string2()).optional(),
    claims_parameter_supported: boolean2().optional(),
    request_parameter_supported: boolean2().optional(),
    request_uri_parameter_supported: boolean2().optional(),
    require_request_uri_registration: boolean2().optional(),
    op_policy_uri: SafeUrlSchema.optional(),
    op_tos_uri: SafeUrlSchema.optional(),
    client_id_metadata_document_supported: boolean2().optional()
  });
  OpenIdProviderDiscoveryMetadataSchema = object2({
    ...OpenIdProviderMetadataSchema.shape,
    ...OAuthMetadataSchema.pick({
      code_challenge_methods_supported: true
    }).shape
  });
  OAuthTokensSchema = object2({
    access_token: string2(),
    id_token: string2().optional(),
    token_type: string2(),
    expires_in: exports_coerce2.number().optional(),
    scope: string2().optional(),
    refresh_token: string2().optional()
  }).strip();
  OAuthErrorResponseSchema = object2({
    error: string2(),
    error_description: string2().optional(),
    error_uri: string2().optional()
  });
  OptionalSafeUrlSchema = SafeUrlSchema.optional().or(literal("").transform(() => {
    return;
  }));
  OAuthClientMetadataSchema = object2({
    redirect_uris: array(SafeUrlSchema),
    token_endpoint_auth_method: string2().optional(),
    grant_types: array(string2()).optional(),
    response_types: array(string2()).optional(),
    client_name: string2().optional(),
    client_uri: SafeUrlSchema.optional(),
    logo_uri: OptionalSafeUrlSchema,
    scope: string2().optional(),
    contacts: array(string2()).optional(),
    tos_uri: OptionalSafeUrlSchema,
    policy_uri: string2().optional(),
    jwks_uri: SafeUrlSchema.optional(),
    jwks: any().optional(),
    software_id: string2().optional(),
    software_version: string2().optional(),
    software_statement: string2().optional()
  }).strip();
  OAuthClientInformationSchema = object2({
    client_id: string2(),
    client_secret: string2().optional(),
    client_id_issued_at: number2().optional(),
    client_secret_expires_at: number2().optional()
  }).strip();
  OAuthClientInformationFullSchema = OAuthClientMetadataSchema.merge(OAuthClientInformationSchema);
  OAuthClientRegistrationErrorSchema = object2({
    error: string2(),
    error_description: string2().optional()
  }).strip();
  OAuthTokenRevocationRequestSchema = object2({
    token: string2(),
    token_type_hint: string2().optional()
  }).strip();
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/shared/auth-utils.js
function resourceUrlFromServerUrl(url2) {
  const resourceURL = typeof url2 === "string" ? new URL(url2) : new URL(url2.href);
  resourceURL.hash = "";
  return resourceURL;
}
function checkResourceAllowed({ requestedResource, configuredResource }) {
  const requested = typeof requestedResource === "string" ? new URL(requestedResource) : new URL(requestedResource.href);
  const configured = typeof configuredResource === "string" ? new URL(configuredResource) : new URL(configuredResource.href);
  if (requested.origin !== configured.origin) {
    return false;
  }
  if (requested.pathname.length < configured.pathname.length) {
    return false;
  }
  const requestedPath = requested.pathname.endsWith("/") ? requested.pathname : requested.pathname + "/";
  const configuredPath = configured.pathname.endsWith("/") ? configured.pathname : configured.pathname + "/";
  return requestedPath.startsWith(configuredPath);
}

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/errors.js
var OAuthError, InvalidRequestError, InvalidClientError, InvalidGrantError, UnauthorizedClientError, UnsupportedGrantTypeError, InvalidScopeError, AccessDeniedError, ServerError, TemporarilyUnavailableError, UnsupportedResponseTypeError, UnsupportedTokenTypeError, InvalidTokenError, MethodNotAllowedError, TooManyRequestsError, InvalidClientMetadataError, InsufficientScopeError, InvalidTargetError, OAUTH_ERRORS;
var init_errors3 = __esm(() => {
  OAuthError = class OAuthError extends Error {
    constructor(message, errorUri) {
      super(message);
      this.errorUri = errorUri;
      this.name = this.constructor.name;
    }
    toResponseObject() {
      const response = {
        error: this.errorCode,
        error_description: this.message
      };
      if (this.errorUri) {
        response.error_uri = this.errorUri;
      }
      return response;
    }
    get errorCode() {
      return this.constructor.errorCode;
    }
  };
  InvalidRequestError = class InvalidRequestError extends OAuthError {
  };
  InvalidRequestError.errorCode = "invalid_request";
  InvalidClientError = class InvalidClientError extends OAuthError {
  };
  InvalidClientError.errorCode = "invalid_client";
  InvalidGrantError = class InvalidGrantError extends OAuthError {
  };
  InvalidGrantError.errorCode = "invalid_grant";
  UnauthorizedClientError = class UnauthorizedClientError extends OAuthError {
  };
  UnauthorizedClientError.errorCode = "unauthorized_client";
  UnsupportedGrantTypeError = class UnsupportedGrantTypeError extends OAuthError {
  };
  UnsupportedGrantTypeError.errorCode = "unsupported_grant_type";
  InvalidScopeError = class InvalidScopeError extends OAuthError {
  };
  InvalidScopeError.errorCode = "invalid_scope";
  AccessDeniedError = class AccessDeniedError extends OAuthError {
  };
  AccessDeniedError.errorCode = "access_denied";
  ServerError = class ServerError extends OAuthError {
  };
  ServerError.errorCode = "server_error";
  TemporarilyUnavailableError = class TemporarilyUnavailableError extends OAuthError {
  };
  TemporarilyUnavailableError.errorCode = "temporarily_unavailable";
  UnsupportedResponseTypeError = class UnsupportedResponseTypeError extends OAuthError {
  };
  UnsupportedResponseTypeError.errorCode = "unsupported_response_type";
  UnsupportedTokenTypeError = class UnsupportedTokenTypeError extends OAuthError {
  };
  UnsupportedTokenTypeError.errorCode = "unsupported_token_type";
  InvalidTokenError = class InvalidTokenError extends OAuthError {
  };
  InvalidTokenError.errorCode = "invalid_token";
  MethodNotAllowedError = class MethodNotAllowedError extends OAuthError {
  };
  MethodNotAllowedError.errorCode = "method_not_allowed";
  TooManyRequestsError = class TooManyRequestsError extends OAuthError {
  };
  TooManyRequestsError.errorCode = "too_many_requests";
  InvalidClientMetadataError = class InvalidClientMetadataError extends OAuthError {
  };
  InvalidClientMetadataError.errorCode = "invalid_client_metadata";
  InsufficientScopeError = class InsufficientScopeError extends OAuthError {
  };
  InsufficientScopeError.errorCode = "insufficient_scope";
  InvalidTargetError = class InvalidTargetError extends OAuthError {
  };
  InvalidTargetError.errorCode = "invalid_target";
  OAUTH_ERRORS = {
    [InvalidRequestError.errorCode]: InvalidRequestError,
    [InvalidClientError.errorCode]: InvalidClientError,
    [InvalidGrantError.errorCode]: InvalidGrantError,
    [UnauthorizedClientError.errorCode]: UnauthorizedClientError,
    [UnsupportedGrantTypeError.errorCode]: UnsupportedGrantTypeError,
    [InvalidScopeError.errorCode]: InvalidScopeError,
    [AccessDeniedError.errorCode]: AccessDeniedError,
    [ServerError.errorCode]: ServerError,
    [TemporarilyUnavailableError.errorCode]: TemporarilyUnavailableError,
    [UnsupportedResponseTypeError.errorCode]: UnsupportedResponseTypeError,
    [UnsupportedTokenTypeError.errorCode]: UnsupportedTokenTypeError,
    [InvalidTokenError.errorCode]: InvalidTokenError,
    [MethodNotAllowedError.errorCode]: MethodNotAllowedError,
    [TooManyRequestsError.errorCode]: TooManyRequestsError,
    [InvalidClientMetadataError.errorCode]: InvalidClientMetadataError,
    [InsufficientScopeError.errorCode]: InsufficientScopeError,
    [InvalidTargetError.errorCode]: InvalidTargetError
  };
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/client/auth.js
function isClientAuthMethod(method) {
  return ["client_secret_basic", "client_secret_post", "none"].includes(method);
}
function selectClientAuthMethod(clientInformation, supportedMethods) {
  const hasClientSecret = clientInformation.client_secret !== undefined;
  if ("token_endpoint_auth_method" in clientInformation && clientInformation.token_endpoint_auth_method && isClientAuthMethod(clientInformation.token_endpoint_auth_method) && (supportedMethods.length === 0 || supportedMethods.includes(clientInformation.token_endpoint_auth_method))) {
    return clientInformation.token_endpoint_auth_method;
  }
  if (supportedMethods.length === 0) {
    return hasClientSecret ? "client_secret_basic" : "none";
  }
  if (hasClientSecret && supportedMethods.includes("client_secret_basic")) {
    return "client_secret_basic";
  }
  if (hasClientSecret && supportedMethods.includes("client_secret_post")) {
    return "client_secret_post";
  }
  if (supportedMethods.includes("none")) {
    return "none";
  }
  return hasClientSecret ? "client_secret_post" : "none";
}
function applyClientAuthentication(method, clientInformation, headers, params) {
  const { client_id, client_secret } = clientInformation;
  switch (method) {
    case "client_secret_basic":
      applyBasicAuth(client_id, client_secret, headers);
      return;
    case "client_secret_post":
      applyPostAuth(client_id, client_secret, params);
      return;
    case "none":
      applyPublicAuth(client_id, params);
      return;
    default:
      throw new Error(`Unsupported client authentication method: ${method}`);
  }
}
function applyBasicAuth(clientId, clientSecret, headers) {
  if (!clientSecret) {
    throw new Error("client_secret_basic authentication requires a client_secret");
  }
  const credentials = btoa(`${clientId}:${clientSecret}`);
  headers.set("Authorization", `Basic ${credentials}`);
}
function applyPostAuth(clientId, clientSecret, params) {
  params.set("client_id", clientId);
  if (clientSecret) {
    params.set("client_secret", clientSecret);
  }
}
function applyPublicAuth(clientId, params) {
  params.set("client_id", clientId);
}
async function parseErrorResponse(input) {
  const statusCode = input instanceof Response ? input.status : undefined;
  const body = input instanceof Response ? await input.text() : input;
  try {
    const result = OAuthErrorResponseSchema.parse(JSON.parse(body));
    const { error: error2, error_description, error_uri } = result;
    const errorClass = OAUTH_ERRORS[error2] || ServerError;
    return new errorClass(error_description || "", error_uri);
  } catch (error2) {
    const errorMessage = `${statusCode ? `HTTP ${statusCode}: ` : ""}Invalid OAuth error response: ${error2}. Raw body: ${body}`;
    return new ServerError(errorMessage);
  }
}
async function auth(provider, options) {
  try {
    return await authInternal(provider, options);
  } catch (error2) {
    if (error2 instanceof InvalidClientError || error2 instanceof UnauthorizedClientError) {
      await provider.invalidateCredentials?.("all");
      return await authInternal(provider, options);
    } else if (error2 instanceof InvalidGrantError) {
      await provider.invalidateCredentials?.("tokens");
      return await authInternal(provider, options);
    }
    throw error2;
  }
}
async function authInternal(provider, { serverUrl, authorizationCode, scope, resourceMetadataUrl, fetchFn }) {
  const cachedState = await provider.discoveryState?.();
  let resourceMetadata;
  let authorizationServerUrl;
  let metadata;
  let effectiveResourceMetadataUrl = resourceMetadataUrl;
  if (!effectiveResourceMetadataUrl && cachedState?.resourceMetadataUrl) {
    effectiveResourceMetadataUrl = new URL(cachedState.resourceMetadataUrl);
  }
  if (cachedState?.authorizationServerUrl) {
    authorizationServerUrl = cachedState.authorizationServerUrl;
    resourceMetadata = cachedState.resourceMetadata;
    metadata = cachedState.authorizationServerMetadata ?? await discoverAuthorizationServerMetadata(authorizationServerUrl, { fetchFn });
    if (!resourceMetadata) {
      try {
        resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl, { resourceMetadataUrl: effectiveResourceMetadataUrl }, fetchFn);
      } catch {}
    }
    if (metadata !== cachedState.authorizationServerMetadata || resourceMetadata !== cachedState.resourceMetadata) {
      await provider.saveDiscoveryState?.({
        authorizationServerUrl: String(authorizationServerUrl),
        resourceMetadataUrl: effectiveResourceMetadataUrl?.toString(),
        resourceMetadata,
        authorizationServerMetadata: metadata
      });
    }
  } else {
    const serverInfo = await discoverOAuthServerInfo(serverUrl, { resourceMetadataUrl: effectiveResourceMetadataUrl, fetchFn });
    authorizationServerUrl = serverInfo.authorizationServerUrl;
    metadata = serverInfo.authorizationServerMetadata;
    resourceMetadata = serverInfo.resourceMetadata;
    await provider.saveDiscoveryState?.({
      authorizationServerUrl: String(authorizationServerUrl),
      resourceMetadataUrl: effectiveResourceMetadataUrl?.toString(),
      resourceMetadata,
      authorizationServerMetadata: metadata
    });
  }
  const resource = await selectResourceURL(serverUrl, provider, resourceMetadata);
  const resolvedScope = scope || resourceMetadata?.scopes_supported?.join(" ") || provider.clientMetadata.scope;
  let clientInformation = await Promise.resolve(provider.clientInformation());
  if (!clientInformation) {
    if (authorizationCode !== undefined) {
      throw new Error("Existing OAuth client information is required when exchanging an authorization code");
    }
    const supportsUrlBasedClientId = metadata?.client_id_metadata_document_supported === true;
    const clientMetadataUrl = provider.clientMetadataUrl;
    if (clientMetadataUrl && !isHttpsUrl(clientMetadataUrl)) {
      throw new InvalidClientMetadataError(`clientMetadataUrl must be a valid HTTPS URL with a non-root pathname, got: ${clientMetadataUrl}`);
    }
    const shouldUseUrlBasedClientId = supportsUrlBasedClientId && clientMetadataUrl;
    if (shouldUseUrlBasedClientId) {
      clientInformation = {
        client_id: clientMetadataUrl
      };
      await provider.saveClientInformation?.(clientInformation);
    } else {
      if (!provider.saveClientInformation) {
        throw new Error("OAuth client information must be saveable for dynamic registration");
      }
      const fullInformation = await registerClient(authorizationServerUrl, {
        metadata,
        clientMetadata: provider.clientMetadata,
        scope: resolvedScope,
        fetchFn
      });
      await provider.saveClientInformation(fullInformation);
      clientInformation = fullInformation;
    }
  }
  const nonInteractiveFlow = !provider.redirectUrl;
  if (authorizationCode !== undefined || nonInteractiveFlow) {
    const tokens2 = await fetchToken(provider, authorizationServerUrl, {
      metadata,
      resource,
      authorizationCode,
      fetchFn
    });
    await provider.saveTokens(tokens2);
    return "AUTHORIZED";
  }
  const tokens = await provider.tokens();
  if (tokens?.refresh_token) {
    try {
      const newTokens = await refreshAuthorization(authorizationServerUrl, {
        metadata,
        clientInformation,
        refreshToken: tokens.refresh_token,
        resource,
        addClientAuthentication: provider.addClientAuthentication,
        fetchFn
      });
      await provider.saveTokens(newTokens);
      return "AUTHORIZED";
    } catch (error2) {
      if (!(error2 instanceof OAuthError) || error2 instanceof ServerError) {} else {
        throw error2;
      }
    }
  }
  const state = provider.state ? await provider.state() : undefined;
  const { authorizationUrl, codeVerifier } = await startAuthorization(authorizationServerUrl, {
    metadata,
    clientInformation,
    state,
    redirectUrl: provider.redirectUrl,
    scope: resolvedScope,
    resource
  });
  await provider.saveCodeVerifier(codeVerifier);
  await provider.redirectToAuthorization(authorizationUrl);
  return "REDIRECT";
}
function isHttpsUrl(value) {
  if (!value)
    return false;
  try {
    const url2 = new URL(value);
    return url2.protocol === "https:" && url2.pathname !== "/";
  } catch {
    return false;
  }
}
async function selectResourceURL(serverUrl, provider, resourceMetadata) {
  const defaultResource = resourceUrlFromServerUrl(serverUrl);
  if (provider.validateResourceURL) {
    return await provider.validateResourceURL(defaultResource, resourceMetadata?.resource);
  }
  if (!resourceMetadata) {
    return;
  }
  if (!checkResourceAllowed({ requestedResource: defaultResource, configuredResource: resourceMetadata.resource })) {
    throw new Error(`Protected resource ${resourceMetadata.resource} does not match expected ${defaultResource} (or origin)`);
  }
  return new URL(resourceMetadata.resource);
}
function extractWWWAuthenticateParams(res) {
  const authenticateHeader = res.headers.get("WWW-Authenticate");
  if (!authenticateHeader) {
    return {};
  }
  const [type, scheme] = authenticateHeader.split(" ");
  if (type.toLowerCase() !== "bearer" || !scheme) {
    return {};
  }
  const resourceMetadataMatch = extractFieldFromWwwAuth(res, "resource_metadata") || undefined;
  let resourceMetadataUrl;
  if (resourceMetadataMatch) {
    try {
      resourceMetadataUrl = new URL(resourceMetadataMatch);
    } catch {}
  }
  const scope = extractFieldFromWwwAuth(res, "scope") || undefined;
  const error2 = extractFieldFromWwwAuth(res, "error") || undefined;
  return {
    resourceMetadataUrl,
    scope,
    error: error2
  };
}
function extractFieldFromWwwAuth(response, fieldName) {
  const wwwAuthHeader = response.headers.get("WWW-Authenticate");
  if (!wwwAuthHeader) {
    return null;
  }
  const pattern = new RegExp(`${fieldName}=(?:"([^"]+)"|([^\\s,]+))`);
  const match = wwwAuthHeader.match(pattern);
  if (match) {
    return match[1] || match[2];
  }
  return null;
}
async function discoverOAuthProtectedResourceMetadata(serverUrl, opts, fetchFn = fetch) {
  const response = await discoverMetadataWithFallback(serverUrl, "oauth-protected-resource", fetchFn, {
    protocolVersion: opts?.protocolVersion,
    metadataUrl: opts?.resourceMetadataUrl
  });
  if (!response || response.status === 404) {
    await response?.body?.cancel();
    throw new Error(`Resource server does not implement OAuth 2.0 Protected Resource Metadata.`);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status} trying to load well-known OAuth protected resource metadata.`);
  }
  return OAuthProtectedResourceMetadataSchema.parse(await response.json());
}
async function fetchWithCorsRetry(url2, headers, fetchFn = fetch) {
  try {
    return await fetchFn(url2, { headers });
  } catch (error2) {
    if (error2 instanceof TypeError) {
      if (headers) {
        return fetchWithCorsRetry(url2, undefined, fetchFn);
      } else {
        return;
      }
    }
    throw error2;
  }
}
function buildWellKnownPath(wellKnownPrefix, pathname = "", options = {}) {
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return options.prependPathname ? `${pathname}/.well-known/${wellKnownPrefix}` : `/.well-known/${wellKnownPrefix}${pathname}`;
}
async function tryMetadataDiscovery(url2, protocolVersion, fetchFn = fetch) {
  const headers = {
    "MCP-Protocol-Version": protocolVersion
  };
  return await fetchWithCorsRetry(url2, headers, fetchFn);
}
function shouldAttemptFallback(response, pathname) {
  return !response || response.status >= 400 && response.status < 500 && pathname !== "/";
}
async function discoverMetadataWithFallback(serverUrl, wellKnownType, fetchFn, opts) {
  const issuer = new URL(serverUrl);
  const protocolVersion = opts?.protocolVersion ?? LATEST_PROTOCOL_VERSION;
  let url2;
  if (opts?.metadataUrl) {
    url2 = new URL(opts.metadataUrl);
  } else {
    const wellKnownPath = buildWellKnownPath(wellKnownType, issuer.pathname);
    url2 = new URL(wellKnownPath, opts?.metadataServerUrl ?? issuer);
    url2.search = issuer.search;
  }
  let response = await tryMetadataDiscovery(url2, protocolVersion, fetchFn);
  if (!opts?.metadataUrl && shouldAttemptFallback(response, issuer.pathname)) {
    const rootUrl = new URL(`/.well-known/${wellKnownType}`, issuer);
    response = await tryMetadataDiscovery(rootUrl, protocolVersion, fetchFn);
  }
  return response;
}
function buildDiscoveryUrls(authorizationServerUrl) {
  const url2 = typeof authorizationServerUrl === "string" ? new URL(authorizationServerUrl) : authorizationServerUrl;
  const hasPath = url2.pathname !== "/";
  const urlsToTry = [];
  if (!hasPath) {
    urlsToTry.push({
      url: new URL("/.well-known/oauth-authorization-server", url2.origin),
      type: "oauth"
    });
    urlsToTry.push({
      url: new URL(`/.well-known/openid-configuration`, url2.origin),
      type: "oidc"
    });
    return urlsToTry;
  }
  let pathname = url2.pathname;
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  urlsToTry.push({
    url: new URL(`/.well-known/oauth-authorization-server${pathname}`, url2.origin),
    type: "oauth"
  });
  urlsToTry.push({
    url: new URL(`/.well-known/openid-configuration${pathname}`, url2.origin),
    type: "oidc"
  });
  urlsToTry.push({
    url: new URL(`${pathname}/.well-known/openid-configuration`, url2.origin),
    type: "oidc"
  });
  return urlsToTry;
}
async function discoverAuthorizationServerMetadata(authorizationServerUrl, { fetchFn = fetch, protocolVersion = LATEST_PROTOCOL_VERSION } = {}) {
  const headers = {
    "MCP-Protocol-Version": protocolVersion,
    Accept: "application/json"
  };
  const urlsToTry = buildDiscoveryUrls(authorizationServerUrl);
  for (const { url: endpointUrl, type } of urlsToTry) {
    const response = await fetchWithCorsRetry(endpointUrl, headers, fetchFn);
    if (!response) {
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status >= 400 && response.status < 500) {
        continue;
      }
      throw new Error(`HTTP ${response.status} trying to load ${type === "oauth" ? "OAuth" : "OpenID provider"} metadata from ${endpointUrl}`);
    }
    if (type === "oauth") {
      return OAuthMetadataSchema.parse(await response.json());
    } else {
      return OpenIdProviderDiscoveryMetadataSchema.parse(await response.json());
    }
  }
  return;
}
async function discoverOAuthServerInfo(serverUrl, opts) {
  let resourceMetadata;
  let authorizationServerUrl;
  try {
    resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl, { resourceMetadataUrl: opts?.resourceMetadataUrl }, opts?.fetchFn);
    if (resourceMetadata.authorization_servers && resourceMetadata.authorization_servers.length > 0) {
      authorizationServerUrl = resourceMetadata.authorization_servers[0];
    }
  } catch {}
  if (!authorizationServerUrl) {
    authorizationServerUrl = String(new URL("/", serverUrl));
  }
  const authorizationServerMetadata = await discoverAuthorizationServerMetadata(authorizationServerUrl, { fetchFn: opts?.fetchFn });
  return {
    authorizationServerUrl,
    authorizationServerMetadata,
    resourceMetadata
  };
}
async function startAuthorization(authorizationServerUrl, { metadata, clientInformation, redirectUrl, scope, state, resource }) {
  let authorizationUrl;
  if (metadata) {
    authorizationUrl = new URL(metadata.authorization_endpoint);
    if (!metadata.response_types_supported.includes(AUTHORIZATION_CODE_RESPONSE_TYPE)) {
      throw new Error(`Incompatible auth server: does not support response type ${AUTHORIZATION_CODE_RESPONSE_TYPE}`);
    }
    if (metadata.code_challenge_methods_supported && !metadata.code_challenge_methods_supported.includes(AUTHORIZATION_CODE_CHALLENGE_METHOD)) {
      throw new Error(`Incompatible auth server: does not support code challenge method ${AUTHORIZATION_CODE_CHALLENGE_METHOD}`);
    }
  } else {
    authorizationUrl = new URL("/authorize", authorizationServerUrl);
  }
  const challenge = await pkceChallenge();
  const codeVerifier = challenge.code_verifier;
  const codeChallenge = challenge.code_challenge;
  authorizationUrl.searchParams.set("response_type", AUTHORIZATION_CODE_RESPONSE_TYPE);
  authorizationUrl.searchParams.set("client_id", clientInformation.client_id);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", AUTHORIZATION_CODE_CHALLENGE_METHOD);
  authorizationUrl.searchParams.set("redirect_uri", String(redirectUrl));
  if (state) {
    authorizationUrl.searchParams.set("state", state);
  }
  if (scope) {
    authorizationUrl.searchParams.set("scope", scope);
  }
  if (scope?.includes("offline_access")) {
    authorizationUrl.searchParams.append("prompt", "consent");
  }
  if (resource) {
    authorizationUrl.searchParams.set("resource", resource.href);
  }
  return { authorizationUrl, codeVerifier };
}
function prepareAuthorizationCodeRequest(authorizationCode, codeVerifier, redirectUri) {
  return new URLSearchParams({
    grant_type: "authorization_code",
    code: authorizationCode,
    code_verifier: codeVerifier,
    redirect_uri: String(redirectUri)
  });
}
async function executeTokenRequest(authorizationServerUrl, { metadata, tokenRequestParams, clientInformation, addClientAuthentication, resource, fetchFn }) {
  const tokenUrl = metadata?.token_endpoint ? new URL(metadata.token_endpoint) : new URL("/token", authorizationServerUrl);
  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json"
  });
  if (resource) {
    tokenRequestParams.set("resource", resource.href);
  }
  if (addClientAuthentication) {
    await addClientAuthentication(headers, tokenRequestParams, tokenUrl, metadata);
  } else if (clientInformation) {
    const supportedMethods = metadata?.token_endpoint_auth_methods_supported ?? [];
    const authMethod = selectClientAuthMethod(clientInformation, supportedMethods);
    applyClientAuthentication(authMethod, clientInformation, headers, tokenRequestParams);
  }
  const response = await (fetchFn ?? fetch)(tokenUrl, {
    method: "POST",
    headers,
    body: tokenRequestParams
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return OAuthTokensSchema.parse(await response.json());
}
async function refreshAuthorization(authorizationServerUrl, { metadata, clientInformation, refreshToken, resource, addClientAuthentication, fetchFn }) {
  const tokenRequestParams = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  const tokens = await executeTokenRequest(authorizationServerUrl, {
    metadata,
    tokenRequestParams,
    clientInformation,
    addClientAuthentication,
    resource,
    fetchFn
  });
  return { refresh_token: refreshToken, ...tokens };
}
async function fetchToken(provider, authorizationServerUrl, { metadata, resource, authorizationCode, fetchFn } = {}) {
  const scope = provider.clientMetadata.scope;
  let tokenRequestParams;
  if (provider.prepareTokenRequest) {
    tokenRequestParams = await provider.prepareTokenRequest(scope);
  }
  if (!tokenRequestParams) {
    if (!authorizationCode) {
      throw new Error("Either provider.prepareTokenRequest() or authorizationCode is required");
    }
    if (!provider.redirectUrl) {
      throw new Error("redirectUrl is required for authorization_code flow");
    }
    const codeVerifier = await provider.codeVerifier();
    tokenRequestParams = prepareAuthorizationCodeRequest(authorizationCode, codeVerifier, provider.redirectUrl);
  }
  const clientInformation = await provider.clientInformation();
  return executeTokenRequest(authorizationServerUrl, {
    metadata,
    tokenRequestParams,
    clientInformation: clientInformation ?? undefined,
    addClientAuthentication: provider.addClientAuthentication,
    resource,
    fetchFn
  });
}
async function registerClient(authorizationServerUrl, { metadata, clientMetadata, scope, fetchFn }) {
  let registrationUrl;
  if (metadata) {
    if (!metadata.registration_endpoint) {
      throw new Error("Incompatible auth server: does not support dynamic client registration");
    }
    registrationUrl = new URL(metadata.registration_endpoint);
  } else {
    registrationUrl = new URL("/register", authorizationServerUrl);
  }
  const response = await (fetchFn ?? fetch)(registrationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...clientMetadata,
      ...scope !== undefined ? { scope } : {}
    })
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return OAuthClientInformationFullSchema.parse(await response.json());
}
var UnauthorizedError, AUTHORIZATION_CODE_RESPONSE_TYPE = "code", AUTHORIZATION_CODE_CHALLENGE_METHOD = "S256";
var init_auth2 = __esm(() => {
  init_index_node();
  init_types();
  init_auth();
  init_auth();
  init_errors3();
  UnauthorizedError = class UnauthorizedError extends Error {
    constructor(message) {
      super(message ?? "Unauthorized");
    }
  };
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/client/sse.js
class SSEClientTransport {
  constructor(url2, opts) {
    this._url = url2;
    this._resourceMetadataUrl = undefined;
    this._scope = undefined;
    this._eventSourceInit = opts?.eventSourceInit;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
    this._fetch = opts?.fetch;
    this._fetchWithInit = createFetchWithInit(opts?.fetch, opts?.requestInit);
  }
  async _authThenStart() {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }
    let result;
    try {
      result = await auth(this._authProvider, {
        serverUrl: this._url,
        resourceMetadataUrl: this._resourceMetadataUrl,
        scope: this._scope,
        fetchFn: this._fetchWithInit
      });
    } catch (error2) {
      this.onerror?.(error2);
      throw error2;
    }
    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError;
    }
    return await this._startOrAuth();
  }
  async _commonHeaders() {
    const headers = {};
    if (this._authProvider) {
      const tokens = await this._authProvider.tokens();
      if (tokens) {
        headers["Authorization"] = `Bearer ${tokens.access_token}`;
      }
    }
    if (this._protocolVersion) {
      headers["mcp-protocol-version"] = this._protocolVersion;
    }
    const extraHeaders = normalizeHeaders(this._requestInit?.headers);
    return new Headers({
      ...headers,
      ...extraHeaders
    });
  }
  _startOrAuth() {
    const fetchImpl = this?._eventSourceInit?.fetch ?? this._fetch ?? fetch;
    return new Promise((resolve2, reject) => {
      this._eventSource = new EventSource(this._url.href, {
        ...this._eventSourceInit,
        fetch: async (url2, init) => {
          const headers = await this._commonHeaders();
          headers.set("Accept", "text/event-stream");
          const response = await fetchImpl(url2, {
            ...init,
            headers
          });
          if (response.status === 401 && response.headers.has("www-authenticate")) {
            const { resourceMetadataUrl, scope } = extractWWWAuthenticateParams(response);
            this._resourceMetadataUrl = resourceMetadataUrl;
            this._scope = scope;
          }
          return response;
        }
      });
      this._abortController = new AbortController;
      this._eventSource.onerror = (event) => {
        if (event.code === 401 && this._authProvider) {
          this._authThenStart().then(resolve2, reject);
          return;
        }
        const error2 = new SseError(event.code, event.message, event);
        reject(error2);
        this.onerror?.(error2);
      };
      this._eventSource.onopen = () => {};
      this._eventSource.addEventListener("endpoint", (event) => {
        const messageEvent = event;
        try {
          this._endpoint = new URL(messageEvent.data, this._url);
          if (this._endpoint.origin !== this._url.origin) {
            throw new Error(`Endpoint origin does not match connection origin: ${this._endpoint.origin}`);
          }
        } catch (error2) {
          reject(error2);
          this.onerror?.(error2);
          this.close();
          return;
        }
        resolve2();
      });
      this._eventSource.onmessage = (event) => {
        const messageEvent = event;
        let message;
        try {
          message = JSONRPCMessageSchema.parse(JSON.parse(messageEvent.data));
        } catch (error2) {
          this.onerror?.(error2);
          return;
        }
        this.onmessage?.(message);
      };
    });
  }
  async start() {
    if (this._eventSource) {
      throw new Error("SSEClientTransport already started! If using Client class, note that connect() calls start() automatically.");
    }
    return await this._startOrAuth();
  }
  async finishAuth(authorizationCode) {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }
    const result = await auth(this._authProvider, {
      serverUrl: this._url,
      authorizationCode,
      resourceMetadataUrl: this._resourceMetadataUrl,
      scope: this._scope,
      fetchFn: this._fetchWithInit
    });
    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError("Failed to authorize");
    }
  }
  async close() {
    this._abortController?.abort();
    this._eventSource?.close();
    this.onclose?.();
  }
  async send(message) {
    if (!this._endpoint) {
      throw new Error("Not connected");
    }
    try {
      const headers = await this._commonHeaders();
      headers.set("content-type", "application/json");
      const init = {
        ...this._requestInit,
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: this._abortController?.signal
      };
      const response = await (this._fetch ?? fetch)(this._endpoint, init);
      if (!response.ok) {
        const text = await response.text().catch(() => null);
        if (response.status === 401 && this._authProvider) {
          const { resourceMetadataUrl, scope } = extractWWWAuthenticateParams(response);
          this._resourceMetadataUrl = resourceMetadataUrl;
          this._scope = scope;
          const result = await auth(this._authProvider, {
            serverUrl: this._url,
            resourceMetadataUrl: this._resourceMetadataUrl,
            scope: this._scope,
            fetchFn: this._fetchWithInit
          });
          if (result !== "AUTHORIZED") {
            throw new UnauthorizedError;
          }
          return this.send(message);
        }
        throw new Error(`Error POSTing to endpoint (HTTP ${response.status}): ${text}`);
      }
      await response.body?.cancel();
    } catch (error2) {
      this.onerror?.(error2);
      throw error2;
    }
  }
  setProtocolVersion(version2) {
    this._protocolVersion = version2;
  }
}
var SseError;
var init_sse = __esm(() => {
  init_dist2();
  init_types();
  init_auth2();
  SseError = class SseError extends Error {
    constructor(code, message, event) {
      super(`SSE error: ${message}`);
      this.code = code;
      this.event = event;
    }
  };
});

// node_modules/eventsource-parser/dist/stream.js
var EventSourceParserStream;
var init_stream = __esm(() => {
  init_dist();
  EventSourceParserStream = class EventSourceParserStream extends TransformStream {
    constructor({ onError, onRetry, onComment } = {}) {
      let parser;
      super({
        start(controller) {
          parser = createParser({
            onEvent: (event) => {
              controller.enqueue(event);
            },
            onError(error2) {
              onError === "terminate" ? controller.error(error2) : typeof onError == "function" && onError(error2);
            },
            onRetry,
            onComment
          });
        },
        transform(chunk) {
          parser.feed(chunk);
        }
      });
    }
  };
});

// node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js
class StreamableHTTPClientTransport {
  constructor(url2, opts) {
    this._hasCompletedAuthFlow = false;
    this._url = url2;
    this._resourceMetadataUrl = undefined;
    this._scope = undefined;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
    this._fetch = opts?.fetch;
    this._fetchWithInit = createFetchWithInit(opts?.fetch, opts?.requestInit);
    this._sessionId = opts?.sessionId;
    this._reconnectionOptions = opts?.reconnectionOptions ?? DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS;
  }
  async _authThenStart() {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }
    let result;
    try {
      result = await auth(this._authProvider, {
        serverUrl: this._url,
        resourceMetadataUrl: this._resourceMetadataUrl,
        scope: this._scope,
        fetchFn: this._fetchWithInit
      });
    } catch (error2) {
      this.onerror?.(error2);
      throw error2;
    }
    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError;
    }
    return await this._startOrAuthSse({ resumptionToken: undefined });
  }
  async _commonHeaders() {
    const headers = {};
    if (this._authProvider) {
      const tokens = await this._authProvider.tokens();
      if (tokens) {
        headers["Authorization"] = `Bearer ${tokens.access_token}`;
      }
    }
    if (this._sessionId) {
      headers["mcp-session-id"] = this._sessionId;
    }
    if (this._protocolVersion) {
      headers["mcp-protocol-version"] = this._protocolVersion;
    }
    const extraHeaders = normalizeHeaders(this._requestInit?.headers);
    return new Headers({
      ...headers,
      ...extraHeaders
    });
  }
  async _startOrAuthSse(options) {
    const { resumptionToken } = options;
    try {
      const headers = await this._commonHeaders();
      headers.set("Accept", "text/event-stream");
      if (resumptionToken) {
        headers.set("last-event-id", resumptionToken);
      }
      const response = await (this._fetch ?? fetch)(this._url, {
        method: "GET",
        headers,
        signal: this._abortController?.signal
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 && this._authProvider) {
          return await this._authThenStart();
        }
        if (response.status === 405) {
          return;
        }
        throw new StreamableHTTPError(response.status, `Failed to open SSE stream: ${response.statusText}`);
      }
      this._handleSseStream(response.body, options, true);
    } catch (error2) {
      this.onerror?.(error2);
      throw error2;
    }
  }
  _getNextReconnectionDelay(attempt) {
    if (this._serverRetryMs !== undefined) {
      return this._serverRetryMs;
    }
    const initialDelay = this._reconnectionOptions.initialReconnectionDelay;
    const growFactor = this._reconnectionOptions.reconnectionDelayGrowFactor;
    const maxDelay = this._reconnectionOptions.maxReconnectionDelay;
    return Math.min(initialDelay * Math.pow(growFactor, attempt), maxDelay);
  }
  _scheduleReconnection(options, attemptCount = 0) {
    const maxRetries = this._reconnectionOptions.maxRetries;
    if (attemptCount >= maxRetries) {
      this.onerror?.(new Error(`Maximum reconnection attempts (${maxRetries}) exceeded.`));
      return;
    }
    const delay = this._getNextReconnectionDelay(attemptCount);
    this._reconnectionTimeout = setTimeout(() => {
      this._startOrAuthSse(options).catch((error2) => {
        this.onerror?.(new Error(`Failed to reconnect SSE stream: ${error2 instanceof Error ? error2.message : String(error2)}`));
        this._scheduleReconnection(options, attemptCount + 1);
      });
    }, delay);
  }
  _handleSseStream(stream, options, isReconnectable) {
    if (!stream) {
      return;
    }
    const { onresumptiontoken, replayMessageId } = options;
    let lastEventId;
    let hasPrimingEvent = false;
    let receivedResponse = false;
    const processStream = async () => {
      try {
        const reader = stream.pipeThrough(new TextDecoderStream).pipeThrough(new EventSourceParserStream({
          onRetry: (retryMs) => {
            this._serverRetryMs = retryMs;
          }
        })).getReader();
        while (true) {
          const { value: event, done } = await reader.read();
          if (done) {
            break;
          }
          if (event.id) {
            lastEventId = event.id;
            hasPrimingEvent = true;
            onresumptiontoken?.(event.id);
          }
          if (!event.data) {
            continue;
          }
          if (!event.event || event.event === "message") {
            try {
              const message = JSONRPCMessageSchema.parse(JSON.parse(event.data));
              if (isJSONRPCResultResponse(message)) {
                receivedResponse = true;
                if (replayMessageId !== undefined) {
                  message.id = replayMessageId;
                }
              }
              this.onmessage?.(message);
            } catch (error2) {
              this.onerror?.(error2);
            }
          }
        }
        const canResume = isReconnectable || hasPrimingEvent;
        const needsReconnect = canResume && !receivedResponse;
        if (needsReconnect && this._abortController && !this._abortController.signal.aborted) {
          this._scheduleReconnection({
            resumptionToken: lastEventId,
            onresumptiontoken,
            replayMessageId
          }, 0);
        }
      } catch (error2) {
        this.onerror?.(new Error(`SSE stream disconnected: ${error2}`));
        const canResume = isReconnectable || hasPrimingEvent;
        const needsReconnect = canResume && !receivedResponse;
        if (needsReconnect && this._abortController && !this._abortController.signal.aborted) {
          try {
            this._scheduleReconnection({
              resumptionToken: lastEventId,
              onresumptiontoken,
              replayMessageId
            }, 0);
          } catch (error3) {
            this.onerror?.(new Error(`Failed to reconnect: ${error3 instanceof Error ? error3.message : String(error3)}`));
          }
        }
      }
    };
    processStream();
  }
  async start() {
    if (this._abortController) {
      throw new Error("StreamableHTTPClientTransport already started! If using Client class, note that connect() calls start() automatically.");
    }
    this._abortController = new AbortController;
  }
  async finishAuth(authorizationCode) {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }
    const result = await auth(this._authProvider, {
      serverUrl: this._url,
      authorizationCode,
      resourceMetadataUrl: this._resourceMetadataUrl,
      scope: this._scope,
      fetchFn: this._fetchWithInit
    });
    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError("Failed to authorize");
    }
  }
  async close() {
    if (this._reconnectionTimeout) {
      clearTimeout(this._reconnectionTimeout);
      this._reconnectionTimeout = undefined;
    }
    this._abortController?.abort();
    this.onclose?.();
  }
  async send(message, options) {
    try {
      const { resumptionToken, onresumptiontoken } = options || {};
      if (resumptionToken) {
        this._startOrAuthSse({ resumptionToken, replayMessageId: isJSONRPCRequest(message) ? message.id : undefined }).catch((err) => this.onerror?.(err));
        return;
      }
      const headers = await this._commonHeaders();
      headers.set("content-type", "application/json");
      headers.set("accept", "application/json, text/event-stream");
      const init = {
        ...this._requestInit,
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: this._abortController?.signal
      };
      const response = await (this._fetch ?? fetch)(this._url, init);
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) {
        this._sessionId = sessionId;
      }
      if (!response.ok) {
        const text = await response.text().catch(() => null);
        if (response.status === 401 && this._authProvider) {
          if (this._hasCompletedAuthFlow) {
            throw new StreamableHTTPError(401, "Server returned 401 after successful authentication");
          }
          const { resourceMetadataUrl, scope } = extractWWWAuthenticateParams(response);
          this._resourceMetadataUrl = resourceMetadataUrl;
          this._scope = scope;
          const result = await auth(this._authProvider, {
            serverUrl: this._url,
            resourceMetadataUrl: this._resourceMetadataUrl,
            scope: this._scope,
            fetchFn: this._fetchWithInit
          });
          if (result !== "AUTHORIZED") {
            throw new UnauthorizedError;
          }
          this._hasCompletedAuthFlow = true;
          return this.send(message);
        }
        if (response.status === 403 && this._authProvider) {
          const { resourceMetadataUrl, scope, error: error2 } = extractWWWAuthenticateParams(response);
          if (error2 === "insufficient_scope") {
            const wwwAuthHeader = response.headers.get("WWW-Authenticate");
            if (this._lastUpscopingHeader === wwwAuthHeader) {
              throw new StreamableHTTPError(403, "Server returned 403 after trying upscoping");
            }
            if (scope) {
              this._scope = scope;
            }
            if (resourceMetadataUrl) {
              this._resourceMetadataUrl = resourceMetadataUrl;
            }
            this._lastUpscopingHeader = wwwAuthHeader ?? undefined;
            const result = await auth(this._authProvider, {
              serverUrl: this._url,
              resourceMetadataUrl: this._resourceMetadataUrl,
              scope: this._scope,
              fetchFn: this._fetch
            });
            if (result !== "AUTHORIZED") {
              throw new UnauthorizedError;
            }
            return this.send(message);
          }
        }
        throw new StreamableHTTPError(response.status, `Error POSTing to endpoint: ${text}`);
      }
      this._hasCompletedAuthFlow = false;
      this._lastUpscopingHeader = undefined;
      if (response.status === 202) {
        await response.body?.cancel();
        if (isInitializedNotification(message)) {
          this._startOrAuthSse({ resumptionToken: undefined }).catch((err) => this.onerror?.(err));
        }
        return;
      }
      const messages = Array.isArray(message) ? message : [message];
      const hasRequests = messages.filter((msg) => ("method" in msg) && ("id" in msg) && msg.id !== undefined).length > 0;
      const contentType = response.headers.get("content-type");
      if (hasRequests) {
        if (contentType?.includes("text/event-stream")) {
          this._handleSseStream(response.body, { onresumptiontoken }, false);
        } else if (contentType?.includes("application/json")) {
          const data = await response.json();
          const responseMessages = Array.isArray(data) ? data.map((msg) => JSONRPCMessageSchema.parse(msg)) : [JSONRPCMessageSchema.parse(data)];
          for (const msg of responseMessages) {
            this.onmessage?.(msg);
          }
        } else {
          await response.body?.cancel();
          throw new StreamableHTTPError(-1, `Unexpected content type: ${contentType}`);
        }
      } else {
        await response.body?.cancel();
      }
    } catch (error2) {
      this.onerror?.(error2);
      throw error2;
    }
  }
  get sessionId() {
    return this._sessionId;
  }
  async terminateSession() {
    if (!this._sessionId) {
      return;
    }
    try {
      const headers = await this._commonHeaders();
      const init = {
        ...this._requestInit,
        method: "DELETE",
        headers,
        signal: this._abortController?.signal
      };
      const response = await (this._fetch ?? fetch)(this._url, init);
      await response.body?.cancel();
      if (!response.ok && response.status !== 405) {
        throw new StreamableHTTPError(response.status, `Failed to terminate session: ${response.statusText}`);
      }
      this._sessionId = undefined;
    } catch (error2) {
      this.onerror?.(error2);
      throw error2;
    }
  }
  setProtocolVersion(version2) {
    this._protocolVersion = version2;
  }
  get protocolVersion() {
    return this._protocolVersion;
  }
  async resumeStream(lastEventId, options) {
    await this._startOrAuthSse({
      resumptionToken: lastEventId,
      onresumptiontoken: options?.onresumptiontoken
    });
  }
}
var DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS, StreamableHTTPError;
var init_streamableHttp = __esm(() => {
  init_types();
  init_auth2();
  init_stream();
  DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS = {
    initialReconnectionDelay: 1000,
    maxReconnectionDelay: 30000,
    reconnectionDelayGrowFactor: 1.5,
    maxRetries: 2
  };
  StreamableHTTPError = class StreamableHTTPError extends Error {
    constructor(code, message) {
      super(`Streamable HTTP error: ${message}`);
      this.code = code;
    }
  };
});

// src/mcp/client.ts
import { readFileSync as readFileSync2, existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";

class MCPClientManager {
  servers = new Map;
  configPath;
  constructor() {
    this.configPath = join2(homedir2(), ".nole-code", "mcp.json");
  }
  loadConfigs() {
    if (!existsSync2(this.configPath)) {
      return this.getDefaultServers();
    }
    try {
      const data = JSON.parse(readFileSync2(this.configPath, "utf-8"));
      if (Array.isArray(data))
        return data;
      return data.servers || this.getDefaultServers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`
\x1B[33m⚠ Failed to parse ${this.configPath}: ${msg}\x1B[0m`);
      return this.getDefaultServers();
    }
  }
  getDefaultServers() {
    return [];
  }
  async connect(config2) {
    if (this.servers.has(config2.name)) {
      return this.servers.get(config2.name);
    }
    const server = {
      name: config2.name,
      client: new Client({
        name: "nole-code",
        version: "1.0.0"
      }),
      transport: null,
      tools: [],
      status: "connecting"
    };
    try {
      switch (config2.transport) {
        case "stdio":
          await this.connectStdio(server, config2);
          break;
        case "sse":
          await this.connectSSE(server, config2);
          break;
        case "streamable-http":
          await this.connectStreamableHTTP(server, config2);
          break;
        case "websocket":
          await this.connectWebSocket(server, config2);
          break;
        default:
          throw new Error(`Unknown transport type: ${config2.transport}`);
      }
      const toolsResult = await server.client.request({ method: "tools/list" }, ListToolsResultSchema);
      server.tools = toolsResult.tools || [];
      server.status = "connected";
      this.servers.set(config2.name, server);
      console.log(`
✅ MCP server "${config2.name}" connected with ${server.tools.length} tools`);
    } catch (error2) {
      server.status = "error";
      server.error = error2 instanceof Error ? error2.message : String(error2);
      console.error(`
❌ MCP server "${config2.name}" failed: ${server.error}`);
    }
    return server;
  }
  async connectStdio(server, config2) {
    if (!config2.command) {
      throw new Error("stdio transport requires command");
    }
    const options = {
      command: config2.command,
      args: config2.args || [],
      env: {
        ...process.env,
        ...config2.env
      },
      stderr: "pipe"
    };
    const transport = new StdioClientTransport(options);
    server.transport = transport;
    transport.stderr?.on("data", (data) => {
      const lines = data.toString().trim().split(`
`);
      for (const line of lines) {
        if (line) {
          console.error(`[${config2.name}] ${line}`);
        }
      }
    });
    transport.onclose = () => {
      console.log(`[${config2.name}] Process closed`);
      server.status = "disconnected";
    };
    await server.client.connect(transport);
    server.process = transport.stdin ? transport._proc : undefined;
  }
  async connectSSE(server, config2) {
    if (!config2.url) {
      throw new Error("SSE transport requires URL");
    }
    const options = {
      url: config2.url,
      eventSourceInitDict: {
        headers: config2.headers
      }
    };
    const transport = new SSEClientTransport(options);
    server.transport = transport;
    await server.client.connect(transport);
  }
  async connectStreamableHTTP(server, config2) {
    if (!config2.url) {
      throw new Error("streamable-http transport requires URL");
    }
    const headers = {
      ...config2.headers
    };
    if (config2.auth) {
      if (config2.auth.type === "bearer" && config2.auth.token) {
        headers["Authorization"] = `Bearer ${config2.auth.token}`;
      } else if (config2.auth.type === "basic" && config2.auth.username) {
        const credentials = Buffer.from(`${config2.auth.username}:${config2.auth.password || ""}`).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
      }
    }
    const options = {
      requestInit: {
        headers
      }
    };
    const transport = new StreamableHTTPClientTransport(config2.url, options);
    server.transport = transport;
    await server.client.connect(transport);
  }
  async connectWebSocket(server, config2) {
    if (!config2.url) {
      throw new Error("websocket transport requires URL");
    }
    if (config2.url.startsWith("ws://") || config2.url.startsWith("wss://")) {
      console.warn(`WebSocket not yet fully implemented, using HTTP fallback`);
    }
    await this.connectStreamableHTTP(server, config2);
  }
  async callTool(serverName, toolName, arguments_) {
    const server = this.servers.get(serverName);
    if (!server || server.status !== "connected") {
      throw new Error(`MCP server "${serverName}" not connected`);
    }
    try {
      const result = await server.client.request({
        method: "tools/call",
        params: {
          name: toolName,
          arguments: arguments_
        }
      }, CallToolResultSchema);
      const content = result.content.map((block) => {
        if (block.type === "text")
          return block.text;
        if (block.type === "image")
          return `[Image: ${block.source?.mimeType || "unknown"}]`;
        if (block.type === "resource")
          return `[Resource: ${block.resource?.uri || "unknown"}]`;
        return JSON.stringify(block);
      }).join(`
`);
      const isError = result.isError || content.includes("error") || content.includes("Error");
      return { content, isError };
    } catch (error2) {
      return {
        content: `Error calling ${toolName}: ${error2 instanceof Error ? error2.message : String(error2)}`,
        isError: true
      };
    }
  }
  getAllTools() {
    const tools = [];
    for (const [serverName, server] of this.servers) {
      if (server.status !== "connected")
        continue;
      for (const tool of server.tools) {
        tools.push({
          name: `mcp__${serverName}__${tool.name}`,
          description: tool.description || "",
          inputSchema: tool.inputSchema || {},
          serverName
        });
      }
    }
    return tools;
  }
  getStatus() {
    return Array.from(this.servers.values()).map((s) => ({
      name: s.name,
      status: s.status,
      toolCount: s.tools.length,
      error: s.error
    }));
  }
  async disconnect(name) {
    const server = this.servers.get(name);
    if (!server)
      return;
    await server.client.close();
    if (server.process) {
      server.process.kill();
    }
    this.servers.delete(name);
  }
  async disconnectAll() {
    for (const name of this.servers.keys()) {
      await this.disconnect(name);
    }
  }
}
async function loadMCPServers() {
  const configs = mcpClient.loadConfigs();
  for (const config2 of configs) {
    await mcpClient.connect(config2);
  }
}

class MCPRegistry {
  client = mcpClient;
  getTools() {
    return this.client.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
  }
  parseMCPToolName(name) {
    const firstSep = name.indexOf("__");
    if (firstSep < 0 || !name.startsWith("mcp__"))
      return null;
    const rest = name.slice(firstSep + 2);
    const secondSep = rest.indexOf("__");
    if (secondSep < 0)
      return null;
    return { server: rest.slice(0, secondSep), tool: rest.slice(secondSep + 2) };
  }
  async callTool(server, tool, input) {
    const result = await this.client.callTool(server, tool, input);
    return result.content;
  }
}
var mcpClient, mcpRegistry;
var init_client3 = __esm(() => {
  init_client2();
  init_stdio2();
  init_sse();
  init_streamableHttp();
  init_types();
  mcpClient = new MCPClientManager;
  mcpRegistry = new MCPRegistry;
});

// src/agents/spawner.ts
var exports_spawner = {};
__export(exports_spawner, {
  spawnAgent: () => spawnAgent,
  sendToAgent: () => sendToAgent,
  removeWorktree: () => removeWorktree,
  onAgentMessage: () => onAgentMessage,
  killAgent: () => killAgent,
  getAllAgents: () => getAllAgents,
  getAgent: () => getAgent
});
import { spawn as spawn2, execSync } from "child_process";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { join as join3 } from "path";
import { writeFileSync, mkdirSync, existsSync as existsSync3 } from "fs";
import { homedir as homedir3 } from "os";
function getAgent(id) {
  return agents.get(id);
}
function getAllAgents() {
  return Array.from(agents.values());
}
function killAgent(id) {
  const proc = agentProcesses.get(id);
  if (proc && !proc.killed) {
    proc.kill("SIGTERM");
    agentProcesses.delete(id);
  }
  const agent = agents.get(id);
  if (agent) {
    agent.status = "cancelled";
  }
  return true;
}
function sendToAgent(agentId, message) {
  const proc = agentProcesses.get(agentId);
  if (proc && proc.stdin) {
    proc.stdin.write(JSON.stringify({ type: "message", content: message }) + `
`);
  }
}
function onAgentMessage(cb) {
  agentEmitter.on("message", cb);
  return () => agentEmitter.off("message", cb);
}
async function spawnAgent(options) {
  const id = `agent_${randomUUID().slice(0, 8)}`;
  const workDir = options.cwd || process.cwd();
  let actualCwd = workDir;
  if (options.isolation === "worktree") {
    actualCwd = await createWorktree(workDir, id);
  }
  const agent = {
    id,
    name: options.name || id,
    description: options.description,
    status: "pending",
    createdAt: new Date,
    cwd: actualCwd,
    parentSessionId: ""
  };
  agents.set(id, agent);
  const agentScript = createAgentScript({
    id,
    description: options.description,
    prompt: options.prompt,
    cwd: actualCwd,
    apiKey: MINIMAX_API_KEY
  });
  const scriptPath = join3(homedir3(), ".nole-code", "agents", `${id}.js`);
  mkdirSync(join3(homedir3(), ".nole-code", "agents"), { recursive: true });
  writeFileSync(scriptPath, agentScript, "utf-8");
  const proc = spawn2("node", [scriptPath], {
    cwd: actualCwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, MINIMAX_API_KEY }
  });
  agent.pid = proc.pid;
  agent.status = "running";
  agentProcesses.set(id, proc);
  proc.stdout?.on("data", (data) => {
    const lines = data.toString().split(`
`).filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === "output") {
          agentEmitter.emit("message", msg);
        } else if (msg.type === "done") {
          agent.status = "done";
          agent.result = msg.payload;
          agentEmitter.emit("message", { ...msg, agentId: id });
        } else if (msg.type === "error") {
          agent.status = "error";
          agentEmitter.emit("message", { ...msg, agentId: id });
        } else if (msg.type === "progress") {
          agentEmitter.emit("message", { ...msg, agentId: id });
        }
      } catch {}
    }
  });
  proc.stderr?.on("data", (data) => {
    agentEmitter.emit("message", {
      type: "error",
      agentId: id,
      payload: data.toString()
    });
  });
  proc.on("exit", (code) => {
    if (code !== 0 && agent.status !== "done") {
      agent.status = "error";
    }
    agentProcesses.delete(id);
  });
  return agent;
}
function createAgentScript(opts) {
  const safePrompt = opts.prompt.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  const safeDesc = opts.description.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  const safeCwd = opts.cwd.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  return `
// Nole Code Agent - ${opts.id}
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const API_KEY = process.env.MINIMAX_API_KEY || '';
const BASE_URL = 'https://api.minimax.io/anthropic/v1/messages';
const AGENT_CWD = ${JSON.stringify(opts.cwd)};

const TOOLS = [
  { name: 'Bash', description: 'Execute shell command', input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
  { name: 'Read', description: 'Read a file', input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'Write', description: 'Write a file', input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
  { name: 'Edit', description: 'Edit file by replacing text', input_schema: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['path', 'old_text', 'new_text'] } },
  { name: 'Grep', description: 'Search for pattern in files', input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern', 'path'] } },
];

async function chat(messages) {
  const sysMsg = messages.find(m => m.role === 'system');
  const body = {
    model: 'MiniMax-M2.7',
    max_tokens: 4096,
    messages: messages.filter(m => m.role !== 'system'),
    tools: TOOLS,
  };
  if (sysMsg) body.system = sysMsg.content;
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API error: ' + res.status + ' ' + (await res.text()));
  return await res.json();
}

function execTool(name, input) {
  try {
    if (name === 'Bash') return execFileSync('/bin/bash', ['-c', input.command], { cwd: AGENT_CWD, timeout: 30000, maxBuffer: 10*1024*1024 }).toString();
    if (name === 'Read') return fs.readFileSync(path.resolve(AGENT_CWD, input.path), 'utf8').slice(0, 10000);
    if (name === 'Write') { fs.writeFileSync(path.resolve(AGENT_CWD, input.path), input.content, 'utf8'); return 'Written ' + input.content.length + ' chars'; }
    if (name === 'Edit') { const p = path.resolve(AGENT_CWD, input.path); let c = fs.readFileSync(p, 'utf8'); c = c.replace(input.old_text, input.new_text); fs.writeFileSync(p, c, 'utf8'); return 'Edited ' + input.path; }
    if (name === 'Grep') return execFileSync('grep', ['-rn', input.pattern, path.resolve(AGENT_CWD, input.path)], { timeout: 10000 }).toString().slice(0, 3000);
    return 'Unknown tool: ' + name;
  } catch (e) { return 'Error: ' + e.message; }
}

async function run() {
  const messages = [
    { role: 'system', content: ${JSON.stringify(`You are Nole, an expert AI coding assistant.

Task: ${opts.description}

${opts.prompt}

Work in: ${opts.cwd}
Be concise. Write real working code. Report completion with a summary.`)} },
    { role: 'user', content: ${JSON.stringify(opts.prompt)} },
  ];

  for (let turn = 0; turn < 15; turn++) {
    process.stdout.write(JSON.stringify({ type: 'progress', agentId: ${JSON.stringify(opts.id)}, payload: 'Turn ' + (turn+1) }) + '\\n');

    const data = await chat(messages);
    const content = data.content || [];

    let text = '';
    const toolCalls = [];
    for (const block of content) {
      if (block.type === 'text') text += block.text;
      if (block.type === 'tool_use') toolCalls.push(block);
    }

    if (text) {
      process.stdout.write(JSON.stringify({ type: 'output', agentId: ${JSON.stringify(opts.id)}, payload: text }) + '\\n');
    }

    if (toolCalls.length === 0) {
      messages.push({ role: 'assistant', content: text });
      break;
    }

    messages.push({ role: 'assistant', content: content });

    for (const tc of toolCalls) {
      const result = execTool(tc.name, tc.input || {});
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: tc.id, content: result.slice(0, 5000) }] });
    }
  }

  const summary = messages.filter(m => m.role === 'assistant').map(m => typeof m.content === 'string' ? m.content : '').join('\\n').slice(0, 1000);
  process.stdout.write(JSON.stringify({ type: 'done', agentId: ${JSON.stringify(opts.id)}, payload: summary || 'Completed' }) + '\\n');
  process.exit(0);
}

run().catch(e => {
  process.stderr.write(e.message + '\\n');
  process.exit(1);
});
`;
}
async function createWorktree(repoPath, slug) {
  const worktreeDir = join3(homedir3(), ".nole-code", "worktrees", slug);
  try {
    const gitDir = join3(repoPath, ".git");
    if (!existsSync3(gitDir)) {
      return repoPath;
    }
    mkdirSync(worktreeDir, { recursive: true });
    execSync(`git worktree add "${worktreeDir}" --checkout`, {
      cwd: repoPath,
      stdio: "ignore"
    });
    return worktreeDir;
  } catch {
    return repoPath;
  }
}
async function removeWorktree(slug) {
  const worktreeDir = join3(homedir3(), ".nole-code", "worktrees", slug);
  try {
    execSync(`git worktree remove "${worktreeDir}" --force`, {
      stdio: "ignore"
    });
  } catch {}
}
var agents, agentProcesses, agentEmitter;
var init_spawner = __esm(() => {
  init_env();
  agents = new Map;
  agentProcesses = new Map;
  agentEmitter = new EventEmitter;
});

// src/agents/team.ts
var exports_team = {};
__export(exports_team, {
  sendTeamMessage: () => sendTeamMessage,
  onTeamMessage: () => onTeamMessage,
  getTeamHistory: () => getTeamHistory,
  getTeam: () => getTeam,
  getInbox: () => getInbox,
  getAllTeams: () => getAllTeams,
  dissolveTeam: () => dissolveTeam,
  createTeam: () => createTeam,
  broadcast: () => broadcast,
  TEAM_ROLES: () => TEAM_ROLES
});
import { EventEmitter as EventEmitter2 } from "events";
import { randomUUID as randomUUID2 } from "crypto";
async function createTeam(opts) {
  const id = `team_${randomUUID2().slice(0, 8)}`;
  const team = {
    id,
    name: opts.name,
    members: new Map,
    messages: [],
    createdAt: new Date().toISOString(),
    parentSessionId: opts.parentSessionId || ""
  };
  for (const member of opts.members || []) {
    const agent = await spawnAgent({
      name: member.name,
      description: member.role,
      prompt: member.prompt || `You are ${member.name}, a ${member.role} on a team.`,
      background: true
    });
    const tm = {
      id: randomUUID2().slice(0, 8),
      name: member.name,
      role: member.role,
      agentId: agent.id,
      status: "idle",
      inbox: []
    };
    team.members.set(member.name, tm);
  }
  teams.set(id, team);
  return team;
}
function getTeam(id) {
  return teams.get(id);
}
function getAllTeams() {
  return Array.from(teams.values());
}
function dissolveTeam(id) {
  const team = teams.get(id);
  if (!team)
    return false;
  for (const [, member] of team.members) {
    killAgent(member.agentId);
  }
  teams.delete(id);
  return true;
}
function sendTeamMessage(opts) {
  const team = teams.get(opts.teamId);
  if (!team)
    return null;
  const message = {
    id: `msg_${randomUUID2().slice(0, 8)}`,
    from: opts.from,
    to: opts.to,
    content: opts.content,
    timestamp: new Date().toISOString(),
    type: opts.type || "message",
    taskId: opts.taskId
  };
  team.messages.push(message);
  const recipient = team.members.get(opts.to);
  if (recipient) {
    recipient.inbox.push(message);
    recipient.status = "busy";
  }
  teamEmitter.emit("message", { teamId: opts.teamId, message });
  return message;
}
function getInbox(teamId, memberName) {
  const team = teams.get(teamId);
  if (!team)
    return [];
  const member = team.members.get(memberName);
  if (!member)
    return [];
  const inbox = [...member.inbox];
  member.inbox = [];
  member.status = "idle";
  return inbox;
}
function broadcast(teamId, from, content) {
  const team = teams.get(teamId);
  if (!team)
    return;
  for (const [name, member] of team.members) {
    if (name !== from) {
      sendTeamMessage({ teamId, from, to: name, content, type: "message" });
    }
  }
}
function getTeamHistory(teamId, limit = 50) {
  const team = teams.get(teamId);
  if (!team)
    return [];
  return team.messages.slice(-limit);
}
function onTeamMessage(cb) {
  teamEmitter.on("message", cb);
  return () => teamEmitter.off("message", cb);
}
var teams, teamEmitter, TEAM_ROLES;
var init_team = __esm(() => {
  init_spawner();
  teams = new Map;
  teamEmitter = new EventEmitter2;
  TEAM_ROLES = {
    coder: {
      name: "Coder",
      role: "Software Engineer",
      prompt: "You are Coder, an expert software engineer. Write, edit, and review code. Focus on implementation quality and best practices."
    },
    reviewer: {
      name: "Reviewer",
      role: "Code Reviewer",
      prompt: "You are Reviewer, a code review specialist. Analyze code for bugs, security issues, performance problems, and improvement opportunities."
    },
    researcher: {
      name: "Researcher",
      role: "Research Analyst",
      prompt: "You are Researcher, a research analyst. Investigate topics, find information, and synthesize findings into clear reports."
    },
    planner: {
      name: "Planner",
      role: "Technical Lead",
      prompt: "You are Planner, a technical lead. Break down complex tasks into actionable steps, estimate effort, and coordinate team work."
    }
  };
});

// src/feature-flags/index.ts
function feature(name) {
  return ENABLED_FEATURES.has(name);
}
function setFeature(name, enabled) {
  if (enabled) {
    ENABLED_FEATURES.add(name);
  } else {
    ENABLED_FEATURES.delete(name);
  }
}
var ENABLED_FEATURES, envFeatures;
var init_feature_flags = __esm(() => {
  ENABLED_FEATURES = new Set([
    "TOOL_RESULT_STREAMING",
    "VERBOSE_OUTPUT"
  ]);
  envFeatures = process.env.NOLE_FEATURES;
  if (envFeatures) {
    for (const f of envFeatures.split(",")) {
      const trimmed = f.trim();
      if (trimmed)
        ENABLED_FEATURES.add(trimmed);
    }
  }
});

// src/permissions/bash-security.ts
import { resolve as resolve2, normalize, isAbsolute } from "path";
function checkCommandSecurity(command) {
  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(command.trim())) {
      return {
        allowed: true,
        reason: "Matches safe command pattern",
        risk: "safe",
        requiresConfirmation: false
      };
    }
  }
  const foundDangerous = [];
  for (const { pattern, name } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      foundDangerous.push(name);
    }
  }
  if (foundDangerous.length > 0) {
    const risk = foundDangerous.some((d) => d.includes("execution") || d.includes("substitution")) ? "critical" : "high";
    return {
      allowed: false,
      reason: `Dangerous patterns: ${foundDangerous.join(", ")}`,
      risk,
      requiresConfirmation: true,
      dangerousPatterns: foundDangerous
    };
  }
  return {
    allowed: true,
    reason: "Command not in safe list - proceeding with caution",
    risk: "medium",
    requiresConfirmation: false
  };
}
function validatePath(path, cwd, allowedPaths) {
  let resolvedPath;
  try {
    resolvedPath = isAbsolute(path) ? normalize(path) : resolve2(cwd, path);
  } catch {
    return {
      valid: false,
      reason: "Invalid path"
    };
  }
  for (const pattern of DENIED_PATTERNS) {
    if (pattern.test(resolvedPath)) {
      return {
        valid: false,
        reason: "Access to system files denied",
        resolvedPath
      };
    }
  }
  if (allowedPaths && allowedPaths.length > 0) {
    const isAllowed = allowedPaths.some((allowed) => resolvedPath.startsWith(normalize(allowed)));
    if (!isAllowed) {
      return {
        valid: false,
        reason: "Path outside allowed directory",
        resolvedPath
      };
    }
  }
  const parts = resolvedPath.split("/");
  if (parts.includes("..")) {
    const normalized = normalize(resolvedPath);
    if (normalized.includes("..")) {
      return {
        valid: false,
        reason: "Path traversal detected",
        resolvedPath: normalized
      };
    }
  }
  return {
    valid: true,
    reason: "Path validated",
    resolvedPath
  };
}
var DANGEROUS_PATTERNS, SAFE_PATTERNS, DENIED_PATTERNS;
var init_bash_security = __esm(() => {
  init_feature_flags();
  DANGEROUS_PATTERNS = [
    { pattern: /\$\(/, name: "$() command substitution" },
    { pattern: /`[^`]+`/, name: "backtick command substitution" },
    { pattern: /<\(/, name: "process substitution <()" },
    { pattern: />\(/, name: "process substitution >()" },
    { pattern: /\$\{[^}]+\}/, name: "${} parameter expansion" },
    { pattern: /\$\[/, name: "$[] arithmetic expansion" },
    { pattern: />\s*\/dev\/null/, name: "redirect to /dev/null (may hide output)" },
    { pattern: /2>&1/, name: "redirect stderr to stdout" },
    { pattern: /\bcurl\s+-[A-Za-z]*\s*[A-Za-z]*\s*http/, name: "curl HTTP request" },
    { pattern: /\bwget\s+/, name: "wget download" },
    { pattern: /\bnc\s+/, name: "netcat connection" },
    { pattern: /\bncat\s+/, name: "ncat connection" },
    { pattern: /\bsocat\s+/, name: "socat connection" },
    { pattern: /\bopenssl\s+s_client/, name: "OpenSSL client" },
    { pattern: /\bpython[23]?\s+-c\s+/, name: "python -c code execution" },
    { pattern: /\bnode\s+-e\s+/, name: "node -e code execution" },
    { pattern: /\bruby\s+-e\s+/, name: "ruby -e code execution" },
    { pattern: /\bperl\s+-e\s+/, name: "perl -e code execution" },
    { pattern: /\bphp\s+-r\s+/, name: "php -r code execution" },
    { pattern: /\bbash\s+-[cC]\s+/, name: "bash -c code execution" },
    { pattern: /\bsh\s+-[cC]\s+/, name: "sh -c code execution" },
    { pattern: /\bsudo\s+/, name: "sudo command" },
    { pattern: /\bsu\s+/, name: "switch user" },
    { pattern: /\bchmod\s+[0-7][0-7][0-7]/, name: "chmod with full permissions" },
    { pattern: /\bchmod\s+\+[sx]/, name: "chmod +x (add executable)" },
    { pattern: /\bwget\s+http/, name: "wget HTTP download" },
    { pattern: /\bcurl\s+http/, name: "curl HTTP request" },
    { pattern: /\bgit\s+clone\s+http/, name: "git clone over HTTP" }
  ];
  SAFE_PATTERNS = [
    /^(ls|ll|la|dir|tree)\s/,
    /^(cd|pwd|mkdir|rmdir)\s/,
    /^(cat|head|tail|grep|find|locate)\s/,
    /^(wc|sort|uniq|cut|tr|awk|sed)\s/,
    /^(git\s+(status|log|diff|branch))\s/,
    /^(npm\s+(install|run|test|build|start))\s/,
    /^(bun\s+(install|run|add|dev|build))\s/,
    /^(yarn\s+(install|run|start|build))\s/,
    /^(pnpm\s+(install|run|dev|build))\s/,
    /^(python[3]?\s+(-m\s+)?(pip|venv|http\.server))\s/,
    /^(docker\s+(ps|images|logs|exec))\s/,
    /^(kubectl\s+(get|describe|logs))\s/,
    /^(curl\s+-s\s+(http|https):\/\/)/,
    /^(echo|printf|true|false|:)\s/,
    /^(cp|mv|rm|ln)\s+/
  ];
  DENIED_PATTERNS = [
    /^\/etc\/passwd$/,
    /^\/etc\/shadow$/,
    /^\/etc\/sudoers$/,
    /^\/etc\/group$/,
    /^\/etc\/shadow$/,
    /^\.ssh\//,
    /^\/root\//,
    /^\/home\/[^\/]+\/\.aws\//,
    /^\/home\/[^\/]+\/\.config\/[^/]+\/credentials$/
  ];
});

// src/utils/audit.ts
var exports_audit = {};
__export(exports_audit, {
  logToolCall: () => logToolCall,
  getAuditLog: () => getAuditLog
});
import { appendFileSync, mkdirSync as mkdirSync2, existsSync as existsSync4, readFileSync as readFileSync4 } from "fs";
import { join as join5, dirname as dirname3 } from "path";
import { homedir as homedir4 } from "os";
function logToolCall(entry) {
  try {
    const dir = dirname3(AUDIT_FILE);
    if (!existsSync4(dir))
      mkdirSync2(dir, { recursive: true });
    const safeInput = {};
    for (const [k, v] of Object.entries(entry.input)) {
      const str = String(v);
      safeInput[k] = str.length > 200 ? str.slice(0, 200) + "..." : v;
    }
    const line = JSON.stringify({
      t: entry.timestamp,
      s: entry.sessionId,
      tool: entry.tool,
      input: safeInput,
      len: entry.resultLength,
      err: entry.isError || undefined,
      ms: entry.durationMs
    });
    appendFileSync(AUDIT_FILE, line + `
`);
  } catch {}
}
function getAuditLog(limit = 50, sessionId) {
  if (!existsSync4(AUDIT_FILE))
    return [];
  try {
    const lines = readFileSync4(AUDIT_FILE, "utf-8").trim().split(`
`).filter(Boolean);
    const entries = lines.slice(-limit * 2).map((line) => {
      try {
        const d = JSON.parse(line);
        return {
          timestamp: d.t,
          sessionId: d.s,
          tool: d.tool,
          input: d.input,
          resultLength: d.len,
          isError: d.err || false,
          durationMs: d.ms
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
    const filtered = sessionId ? entries.filter((e) => e.sessionId === sessionId) : entries;
    return filtered.slice(-limit);
  } catch {
    return [];
  }
}
var AUDIT_FILE;
var init_audit = __esm(() => {
  AUDIT_FILE = join5(homedir4(), ".nole-code", "audit.jsonl");
});

// src/permissions/rules-engine.ts
var exports_rules_engine = {};
__export(exports_rules_engine, {
  setPermissionMode: () => setPermissionMode,
  savePermissions: () => savePermissions,
  resetRules: () => resetRules,
  removeRule: () => removeRule,
  loadPermissions: () => loadPermissions,
  getRules: () => getRules,
  getPermissionMode: () => getPermissionMode,
  formatPermission: () => formatPermission,
  checkPermission: () => checkPermission,
  addRule: () => addRule
});
import { existsSync as existsSync5, readFileSync as readFileSync5, writeFileSync as writeFileSync2 } from "fs";
import { homedir as homedir5 } from "node:os";
import { join as join6 } from "node:path";
function loadPermissions() {
  if (!existsSync5(PERMISSIONS_FILE)) {
    permissionRules = [...DEFAULT_RULES];
    savePermissions();
    return;
  }
  try {
    const data = JSON.parse(readFileSync5(PERMISSIONS_FILE, "utf-8"));
    permissionRules = data.rules || [...DEFAULT_RULES];
    currentMode = data.mode || "default";
  } catch {
    permissionRules = [...DEFAULT_RULES];
  }
}
function savePermissions() {
  const data = {
    rules: permissionRules,
    mode: currentMode,
    updated: new Date().toISOString()
  };
  writeFileSync2(PERMISSIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
}
function setPermissionMode(mode) {
  currentMode = mode;
  savePermissions();
  console.log(`Permission mode: ${mode}`);
}
function getPermissionMode() {
  return currentMode;
}
function addRule(rule) {
  permissionRules = permissionRules.filter((r) => r.pattern !== rule.pattern);
  permissionRules.push(rule);
  savePermissions();
}
function removeRule(pattern) {
  permissionRules = permissionRules.filter((r) => r.pattern !== pattern);
  savePermissions();
}
function matchPattern(pattern, toolName, input) {
  const match = pattern.match(/^(\w+)\((.*)\)$/);
  if (!match) {
    return toolName === pattern || pattern === "*";
  }
  const [, patternTool, patternInput] = match;
  if (patternTool !== toolName && patternTool !== "*") {
    return false;
  }
  if (patternInput === "*") {
    return true;
  }
  if (toolName === "Bash" && typeof input.command === "string") {
    const command = input.command;
    const regex = new RegExp("^" + patternInput.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    return regex.test(command);
  }
  const inputStr = JSON.stringify(input);
  return inputStr.includes(patternInput);
}
function checkPermission(context) {
  if (!feature("PERMISSION_RULES")) {
    return { result: "allow", reason: "Permission rules disabled" };
  }
  if (currentMode === "bypass") {
    return { result: "allow", reason: "Bypass mode enabled" };
  }
  if (currentMode === "readonly") {
    const readOnlyTools = ["Read", "Glob", "Grep", "WebSearch", "WebFetch", "Bash"];
    const isReadOnly = readOnlyTools.includes(context.toolName) && context.toolName !== "Bash" || context.toolName === "Bash" && /^(ls|cat|grep|find|pwd|git status|git log|git diff)/.test(context.input.command || "");
    if (!isReadOnly) {
      return { result: "deny", reason: "Read-only mode enabled" };
    }
  }
  let matchingRule;
  for (const rule of permissionRules) {
    if (matchPattern(rule.pattern, context.toolName, context.input)) {
      matchingRule = rule;
    }
  }
  if (matchingRule) {
    return {
      result: matchingRule.action,
      reason: matchingRule.reason || `Rule: ${matchingRule.pattern}`,
      rule: matchingRule
    };
  }
  if (currentMode === "auto") {
    const safeTools = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"];
    if (safeTools.includes(context.toolName)) {
      return { result: "allow", reason: "Auto-allowed safe tool" };
    }
    return { result: "ask", reason: "No rule found, prompting user" };
  }
  return { result: "ask", reason: "No matching rule found" };
}
function getRules() {
  return [...permissionRules];
}
function resetRules() {
  permissionRules = [...DEFAULT_RULES];
  savePermissions();
}
function formatPermission(toolName, input, result, reason) {
  const icon = result === "allow" ? "✅" : result === "deny" ? "❌" : "⚠️";
  const cmd = input.command ? ` ${input.command.slice(0, 50)}` : "";
  return `${icon} ${toolName}${cmd}: ${result} (${reason})`;
}
var PERMISSIONS_DIR, PERMISSIONS_FILE, DEFAULT_RULES, permissionRules, currentMode = "default";
var init_rules_engine = __esm(() => {
  init_feature_flags();
  PERMISSIONS_DIR = join6(homedir5(), ".nole-code");
  PERMISSIONS_FILE = join6(PERMISSIONS_DIR, "permissions.json");
  DEFAULT_RULES = [
    { pattern: "Bash(ls *)", action: "allow", reason: "Listing directories is safe" },
    { pattern: "Bash(cat *)", action: "allow", reason: "Reading files is safe" },
    { pattern: "Bash(grep *)", action: "allow", reason: "Searching is safe" },
    { pattern: "Bash(find *)", action: "allow", reason: "Finding files is safe" },
    { pattern: "Read(*)", action: "allow", reason: "Reading files is safe" },
    { pattern: "Glob(*)", action: "allow", reason: "Finding patterns is safe" },
    { pattern: "WebSearch(*)", action: "allow", reason: "Web searches are safe" },
    { pattern: "WebFetch(*)", action: "allow", reason: "Fetching URLs is safe" },
    { pattern: "Bash(git status *)", action: "allow", reason: "Git status is read-only" },
    { pattern: "Bash(git log *)", action: "allow", reason: "Git log is read-only" },
    { pattern: "Bash(git diff *)", action: "allow", reason: "Git diff is read-only" },
    { pattern: "Bash(git branch *)", action: "allow", reason: "Git branch listing is safe" },
    { pattern: "Bash(npm install *)", action: "ask", reason: "Installing packages modifies node_modules" },
    { pattern: "Bash(bun install *)", action: "ask", reason: "Installing packages modifies node_modules" },
    { pattern: "Bash(yarn install *)", action: "ask", reason: "Installing packages modifies node_modules" },
    { pattern: "Bash(pnpm install *)", action: "ask", reason: "Installing packages modifies node_modules" },
    { pattern: "Bash(rm *)", action: "ask", reason: "Removing files is destructive", tool: "Bash" },
    { pattern: "Bash(rmdir *)", action: "ask", reason: "Removing directories is destructive", tool: "Bash" },
    { pattern: "Bash(mv *)", action: "ask", reason: "Moving files can overwrite", tool: "Bash" },
    { pattern: "Bash(chmod *)", action: "ask", reason: "Changing permissions can break access", tool: "Bash" },
    { pattern: "Bash(chown *)", action: "ask", reason: "Changing ownership can lock out access", tool: "Bash" },
    { pattern: "Bash(sudo *)", action: "deny", reason: "Privilege escalation is dangerous", tool: "Bash" },
    { pattern: "Bash(curl http*)", action: "ask", reason: "Network requests have risks", tool: "Bash" },
    { pattern: "Write(*)", action: "ask", reason: "Creating files modifies the project", tool: "Write" },
    { pattern: "Edit(*)", action: "ask", reason: "Editing files modifies the project", tool: "Edit" },
    { pattern: "Bash(npm run build *)", action: "ask", reason: "Build commands execute code", tool: "Bash" },
    { pattern: "Bash(bun run *)", action: "ask", reason: "Running scripts executes code", tool: "Bash" }
  ];
  permissionRules = [...DEFAULT_RULES];
});

// src/tools/registry.ts
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync as readFileSync6, writeFileSync as writeFileSync3, existsSync as existsSync6, mkdirSync as mkdirSync3, readdirSync, statSync } from "fs";
import { join as join7, relative as relative2, resolve as resolve3 } from "path";
import { homedir as homedir6 } from "os";
async function promptPermission(toolName, input, reason) {
  if (!process.stdin.isTTY) {
    process.stderr.write(`\x1B[33m⚠ Auto-allowed (non-interactive): ${toolName}\x1B[0m
`);
    return true;
  }
  const preview = toolName === "Bash" && input.command ? String(input.command).slice(0, 80) : JSON.stringify(input).slice(0, 80);
  return new Promise((resolve4) => {
    const rl = __require("readline").createInterface({ input: process.stdin, output: process.stdout });
    const timeout = setTimeout(() => {
      rl.close();
      process.stderr.write(`\x1B[33m⚠ Permission timeout, auto-allowed: ${toolName}\x1B[0m
`);
      resolve4(true);
    }, 30000);
    const prompt = `
\x1B[33m⚠ Permission required:\x1B[0m ${toolName}(${preview})
  Reason: ${reason}
  Allow? [y/n/a(lways)] (auto-allows in 30s): `;
    rl.question(prompt, (answer) => {
      clearTimeout(timeout);
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "a" || a === "always") {
        const { addRule: addRule2 } = (init_rules_engine(), __toCommonJS(exports_rules_engine));
        addRule2({ pattern: `${toolName}(*)`, action: "allow", reason: "User chose always-allow" });
        resolve4(true);
        return;
      }
      resolve4(["y", "yes", ""].includes(a));
    });
  });
}
function registerTool(tool) {
  tools.set(tool.name, tool);
}
function getToolDefinitions(context) {
  const contextLower = (context || "").toLowerCase();
  const defs = Array.from(tools.values()).filter((t) => {
    if (CORE_TOOLS.has(t.name))
      return true;
    const keywords = TOOL_KEYWORDS[t.name];
    if (!keywords)
      return true;
    if (!context)
      return true;
    return keywords.some((kw) => contextLower.includes(kw));
  }).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema
  }));
  const mcpTools = mcpRegistry.getTools();
  if (mcpTools.length > 0) {
    defs.push(...mcpTools);
  }
  return defs;
}
async function executeTool(name, input, ctx) {
  const toolStart = Date.now();
  if (feature("PERMISSION_RULES")) {
    const permCtx = {
      mode: "default",
      toolName: name,
      input,
      cwd: ctx.cwd
    };
    const perm = checkPermission(permCtx);
    if (perm.result === "deny") {
      return { content: `Permission denied: ${perm.reason}`, isError: true };
    }
    if (perm.result === "ask") {
      const allowed = await promptPermission(name, input, perm.reason);
      if (!allowed) {
        return { content: `Permission denied by user: ${name}`, isError: true };
      }
    }
  }
  if (name === "Bash" && typeof input.command === "string") {
    const security = checkCommandSecurity(input.command);
    if (!security.allowed && security.risk === "critical") {
      return {
        content: `Blocked: ${security.reason}
Dangerous patterns: ${security.dangerousPatterns?.join(", ") || "unknown"}`,
        isError: true
      };
    }
  }
  let result;
  const mcpParsed = mcpRegistry.parseMCPToolName(name);
  if (mcpParsed) {
    try {
      const content = await mcpRegistry.callTool(mcpParsed.server, mcpParsed.tool, input);
      result = { content };
    } catch (err) {
      result = { content: `MCP error: ${err}`, isError: true };
    }
  } else {
    const tool = tools.get(name);
    if (!tool) {
      result = { content: `Tool ${name} not found`, isError: true };
    } else {
      try {
        const content = await tool.execute(input, ctx);
        result = { content };
      } catch (err) {
        result = { content: `Error: ${err}`, isError: true };
      }
    }
  }
  logToolCall({
    timestamp: new Date().toISOString(),
    sessionId: ctx.sessionId,
    tool: name,
    input,
    resultLength: result.content.length,
    isError: result.isError || false,
    durationMs: Date.now() - toolStart
  });
  return result;
}
async function runBash(command, timeout = 30000) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      cwd: process.cwd(),
      shell: "/bin/bash",
      maxBuffer: 10 * 1024 * 1024
    });
    let out = stdout;
    if (stderr) {
      const stderrClean = stderr.trim();
      if (stderrClean)
        out += `
${stderrClean}`;
    }
    return out || "(no output)";
  } catch (e) {
    const err = e;
    const parts = [];
    if (err.killed)
      parts.push("Command timed out");
    else if (err.code)
      parts.push(`Exit code ${err.code}`);
    if (err.stdout)
      parts.push(err.stdout);
    if (err.stderr)
      parts.push(err.stderr);
    if (parts.length === 0)
      parts.push(err.message || "Unknown error");
    return parts.join(`
`);
  }
}
function loadTasks() {
  try {
    if (existsSync6(TASKS_FILE)) {
      const data = JSON.parse(readFileSync6(TASKS_FILE, "utf-8"));
      return new Map(Object.entries(data));
    }
  } catch {}
  return new Map;
}
function saveTasks(tasks) {
  const dir = join7(TASKS_FILE, "..");
  if (!existsSync6(dir))
    mkdirSync3(dir, { recursive: true });
  const obj = Object.fromEntries(tasks);
  writeFileSync3(TASKS_FILE, JSON.stringify(obj, null, 2));
}
function formatSize(bytes) {
  if (bytes < 1024)
    return `${bytes}B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}
var execAsync, tools, CORE_TOOLS, TOOL_KEYWORDS, TASKS_FILE;
var init_registry = __esm(() => {
  init_client3();
  init_spawner();
  init_team();
  init_bash_security();
  init_audit();
  init_rules_engine();
  init_feature_flags();
  execAsync = promisify(exec);
  tools = new Map;
  CORE_TOOLS = new Set([
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "TodoWrite",
    "LS"
  ]);
  TOOL_KEYWORDS = {
    MultiEdit: ["edit", "refactor", "rename", "replace", "change"],
    Tree: ["structure", "layout", "directory", "project", "overview"],
    HttpRequest: ["api", "http", "request", "endpoint", "curl", "fetch", "post", "webhook"],
    FindReplace: ["replace", "find", "sed", "across", "rename", "refactor"],
    GitStatus: ["git", "branch", "commit", "changes", "status"],
    GitDiff: ["git", "diff", "changes", "compare"],
    GitCommit: ["git", "commit", "save", "push"],
    RunTests: ["test", "spec", "jest", "vitest", "pytest", "failing"],
    Spawn: ["server", "start", "run", "background", "dev", "watch"],
    Diff: ["compare", "diff", "difference"],
    Rename: ["rename", "move", "mv"],
    Delete: ["delete", "remove", "rm", "clean"],
    Agent: ["agent", "parallel", "spawn", "delegate"],
    TeamCreate: ["team", "agent", "coordinate"],
    SendMessage: ["agent", "message", "send"],
    NotebookEdit: ["notebook", "jupyter", "ipynb"]
  };
  registerTool({
    name: "Bash",
    description: "Execute a shell command. Use for git, npm, builds, tests, and system commands.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        timeout: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
        cwd: { type: "string", description: "Working directory (default: project root)" }
      },
      required: ["command"]
    },
    execute: async (input, ctx) => {
      const bashCwd = input.cwd ? resolve3(process.cwd(), input.cwd) : ctx.cwd || process.cwd();
      const origCwd = process.cwd();
      try {
        process.chdir(bashCwd);
        return await runBash(input.command, input.timeout || 30000);
      } finally {
        process.chdir(origCwd);
      }
    }
  });
  registerTool({
    name: "Read",
    description: "Read file contents with line numbers. Supports images (base64), PDFs (text extraction), and binary detection.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
        limit: { type: "number", description: "Max lines to read" },
        offset: { type: "number", description: "Line offset (1-indexed)" }
      },
      required: ["path"]
    },
    execute: async (input, _ctx) => {
      const path = resolve3(process.cwd(), input.path);
      const pathCheck = validatePath(input.path, process.cwd());
      if (!pathCheck.valid)
        return `Access denied: ${pathCheck.reason}`;
      if (!existsSync6(path))
        return `File not found: ${path}`;
      const ext = path.split(".").pop()?.toLowerCase() || "";
      const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"];
      if (imageExts.includes(ext)) {
        try {
          const buf = readFileSync6(path);
          const size = statSync(path).size;
          const base642 = buf.toString("base64").slice(0, 1000);
          return `[Image: ${ext.toUpperCase()}, ${formatSize(size)}]
Base64 preview: ${base642}...
Path: ${path}`;
        } catch (err) {
          return `Error reading image: ${err}`;
        }
      }
      const binaryExts = ["zip", "tar", "gz", "exe", "dll", "so", "o", "wasm", "pdf"];
      if (binaryExts.includes(ext)) {
        const size = statSync(path).size;
        if (ext === "pdf") {
          try {
            const pdfText = await runBash(`pdftotext "${path}" - 2>/dev/null | head -200`);
            if (pdfText.trim())
              return `[PDF: ${formatSize(size)}]

${pdfText}`;
          } catch {}
        }
        return `[Binary file: ${ext.toUpperCase()}, ${formatSize(size)}] — cannot display contents`;
      }
      try {
        const raw = readFileSync6(path, "utf-8");
        const allLines = raw.split(`
`);
        const offset = input.offset || 1;
        const limit = input.limit;
        const start = Math.max(0, offset - 1);
        const end = limit ? Math.min(start + limit, allLines.length) : allLines.length;
        const slice = allLines.slice(start, end);
        const padWidth = String(end).length;
        const numbered = slice.map((line, i) => {
          const lineNum = String(start + i + 1).padStart(padWidth);
          return `${lineNum}	${line}`;
        });
        let content = numbered.join(`
`);
        if (start > 0)
          content = `... (from line ${offset})
${content}`;
        if (end < allLines.length)
          content += `
... (${allLines.length - end} more lines)`;
        if (content.length > 1e5)
          content = content.slice(0, 1e5) + `
... (truncated)`;
        return content;
      } catch (err) {
        return `Error reading ${path}: ${err}`;
      }
    }
  });
  registerTool({
    name: "Write",
    description: "Write content to a file. Creates the file if it does not exist.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["path", "content"]
    },
    execute: async (input, _ctx) => {
      const path = resolve3(process.cwd(), input.path);
      const pathCheck = validatePath(input.path, process.cwd());
      if (!pathCheck.valid)
        return `Access denied: ${pathCheck.reason}`;
      try {
        const dir = join7(path, "..");
        if (!existsSync6(dir))
          mkdirSync3(dir, { recursive: true });
        writeFileSync3(path, input.content, "utf-8");
        return `Written ${input.content.length} chars to ${path}`;
      } catch (err) {
        return `Error writing ${path}: ${err}`;
      }
    }
  });
  registerTool({
    name: "Edit",
    description: "Edit a file by replacing exact text. Use when you need to change specific parts of a file.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File to edit" },
        old_text: { type: "string", description: "Exact text to replace" },
        new_text: { type: "string", description: "Replacement text" }
      },
      required: ["path", "old_text", "new_text"]
    },
    execute: async (input, _ctx) => {
      const path = resolve3(process.cwd(), input.path);
      const pathCheck = validatePath(input.path, process.cwd());
      if (!pathCheck.valid)
        return `Access denied: ${pathCheck.reason}`;
      if (!existsSync6(path))
        return `File not found: ${path}`;
      try {
        let content = readFileSync6(path, "utf-8");
        const oldText = input.old_text;
        const newText = input.new_text;
        if (!content.includes(oldText)) {
          const oldTrimmed = oldText.replace(/[ \t]+/g, " ").trim();
          const contentNorm = content.replace(/[ \t]+/g, " ");
          const fuzzyIdx = contentNorm.indexOf(oldTrimmed);
          if (fuzzyIdx >= 0) {
            const firstLine = oldText.split(`
`)[0].trim();
            const lineIdx = content.indexOf(firstLine);
            if (lineIdx >= 0) {
              const lastLine = oldText.split(`
`).pop().trim();
              const endIdx = content.indexOf(lastLine, lineIdx);
              if (endIdx >= 0) {
                const actualOld = content.slice(lineIdx, endIdx + lastLine.length);
                content = content.replace(actualOld, newText);
                writeFileSync3(path, content, "utf-8");
                const relPath2 = relative2(process.cwd(), path) || path;
                const diffLines2 = [`${relPath2} (fuzzy match — whitespace differences):`];
                for (const l of actualOld.split(`
`))
                  diffLines2.push(`\x1B[31m- ${l}\x1B[0m`);
                for (const l of newText.split(`
`))
                  diffLines2.push(`\x1B[32m+ ${l}\x1B[0m`);
                return diffLines2.join(`
`);
              }
            }
          }
          const lines = content.split(`
`);
          const firstOldLine = oldText.split(`
`)[0].trim();
          const similar = lines.filter((l) => l.includes(firstOldLine.slice(0, 20))).slice(0, 3);
          let hint = `Could not find the specified text in ${relative2(process.cwd(), path)}.`;
          if (similar.length > 0) {
            hint += `
Similar lines found:
${similar.map((l) => `  ${l.trim()}`).join(`
`)}`;
          }
          hint += `
Tip: Use Read to check the exact content first.`;
          return hint;
        }
        content = content.replace(oldText, newText);
        writeFileSync3(path, content, "utf-8");
        const relPath = relative2(process.cwd(), path) || path;
        const oldLines = oldText.split(`
`);
        const newLines = newText.split(`
`);
        const diffLines = [relPath + ":"];
        for (const line of oldLines)
          diffLines.push(`\x1B[31m- ${line}\x1B[0m`);
        for (const line of newLines)
          diffLines.push(`\x1B[32m+ ${line}\x1B[0m`);
        const verify = readFileSync6(path, "utf-8");
        if (!verify.includes(newText)) {
          diffLines.push(`\x1B[31m⚠ VERIFICATION FAILED: new text not found after edit\x1B[0m`);
        }
        return diffLines.join(`
`);
      } catch (err) {
        return `Error editing ${path}: ${err}`;
      }
    }
  });
  registerTool({
    name: "Glob",
    description: "Find files matching a glob pattern. Use ** for recursive, * for any characters.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (e.g. **/*.ts, src/*.js)" },
        cwd: { type: "string", description: "Directory to search in" }
      },
      required: ["pattern"]
    },
    execute: async (input, _ctx) => {
      const cwd = input.cwd || process.cwd();
      const pattern = input.pattern;
      const parts = pattern.split("/");
      const filePattern = parts[parts.length - 1] || "*";
      const dirParts = parts.slice(0, -1).filter((p) => p !== "**" && p !== "*");
      const searchDir = dirParts.length > 0 ? join7(cwd, ...dirParts) : cwd;
      const isRecursive = pattern.includes("**");
      let cmd;
      if (isRecursive) {
        cmd = `find "${searchDir}" -type f -name "${filePattern}" 2>/dev/null | head -100`;
      } else {
        cmd = `find "${searchDir}" -maxdepth 1 -type f -name "${filePattern}" 2>/dev/null | head -100`;
      }
      return runBash(cmd);
    }
  });
  registerTool({
    name: "Grep",
    description: "Search for text or regex patterns in files.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex or text pattern to search" },
        path: { type: "string", description: "File or directory to search" },
        context: { type: "number", description: "Lines of context around matches" },
        file_only: { type: "boolean", description: "Only show filenames with matches" }
      },
      required: ["pattern", "path"]
    },
    execute: async (input, _ctx) => {
      const flags = input.file_only ? "-rl" : "-rn";
      const ctxFlag = input.context ? `-C ${Number(input.context)}` : "";
      const pattern = input.pattern;
      const searchPath = resolve3(process.cwd(), input.path);
      const safePattern = pattern.replace(/'/g, `'"'"'`);
      const cmd = `grep ${flags} ${ctxFlag} -- '${safePattern}' '${searchPath}' 2>/dev/null | head -100`;
      return runBash(cmd);
    }
  });
  registerTool({
    name: "WebSearch",
    description: "Search the web for information. Always cite sources with [Title](URL) links.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        count: { type: "number", description: "Number of results (default: 5)" }
      },
      required: ["query"]
    },
    execute: async (input, _ctx) => {
      const { query, count = 5 } = input;
      return webSearch(query, count);
    }
  });
  registerTool({
    name: "WebFetch",
    description: "Fetch and extract readable content from a URL.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
        max_chars: { type: "number", description: "Max characters to return" }
      },
      required: ["url"]
    },
    execute: async (input, _ctx) => {
      const { url: url2, max_chars = 1e4 } = input;
      return webFetch(url2, max_chars);
    }
  });
  registerTool({
    name: "TodoWrite",
    description: "Create and manage a todo list for tracking tasks.",
    inputSchema: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          description: "List of todos",
          items: {
            type: "object",
            properties: {
              content: { type: "string", description: "Task description" },
              status: { type: "string", enum: ["in_progress", "pending", "completed"], description: "Task status" },
              activeForm: { type: "string", description: "Current action being taken" }
            }
          }
        }
      },
      required: ["todos"]
    },
    execute: async (input, _ctx) => {
      const todos = input.todos;
      const lines = todos.map((t) => {
        const icon = t.status === "completed" ? "✅" : t.status === "in_progress" ? "\uD83D\uDD04" : "⬜";
        const active = t.activeForm ? ` — ${t.activeForm}` : "";
        return `${icon} ${t.content}${active}`;
      });
      return lines.join(`
`);
    }
  });
  TASKS_FILE = join7(homedir6(), ".nole-code", "tasks.json");
  registerTool({
    name: "TaskCreate",
    description: "Create a new background task and get a task ID.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Task description" }
      },
      required: ["description"]
    },
    execute: async (input, _ctx) => {
      const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const tasks = loadTasks();
      tasks.set(id, {
        id,
        description: input.description,
        status: "pending",
        createdAt: new Date
      });
      saveTasks(tasks);
      return id;
    }
  });
  registerTool({
    name: "TaskList",
    description: "List all background tasks and their status.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    execute: async (_input, _ctx) => {
      const tasks = loadTasks();
      if (tasks.size === 0)
        return "No tasks";
      return Array.from(tasks.values()).map((t) => `[${t.status.toUpperCase()}] ${t.id}: ${t.description}${t.result ? `
  Result: ${t.result}` : ""}`).join(`
`);
    }
  });
  registerTool({
    name: "TaskUpdate",
    description: "Update a task status or result.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID" },
        status: { type: "string", enum: ["pending", "running", "done"], description: "New status" },
        result: { type: "string", description: "Task result/output" }
      },
      required: ["task_id"]
    },
    execute: async (input, _ctx) => {
      const tasks = loadTasks();
      const task = tasks.get(input.task_id);
      if (!task)
        return `Task not found: ${input.task_id}`;
      if (input.status)
        task.status = input.status;
      if (input.result)
        task.result = input.result;
      saveTasks(tasks);
      return `Updated ${input.task_id}`;
    }
  });
  registerTool({
    name: "TaskGet",
    description: "Get the status and result of a specific task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID" }
      },
      required: ["task_id"]
    },
    execute: async (input, _ctx) => {
      const tasks = loadTasks();
      const task = tasks.get(input.task_id);
      if (!task)
        return `Task not found: ${input.task_id}`;
      return `Status: ${task.status}
Description: ${task.description}
${task.result ? `Result: ${task.result}` : ""}`;
    }
  });
  registerTool({
    name: "TaskStop",
    description: "Stop a running task by marking it as cancelled.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID to stop" }
      },
      required: ["task_id"]
    },
    execute: async (input, _ctx) => {
      const tasks = loadTasks();
      const task = tasks.get(input.task_id);
      if (!task)
        return `Task not found: ${input.task_id}`;
      task.status = "done";
      task.result = "Stopped by user";
      saveTasks(tasks);
      return `Stopped ${input.task_id}`;
    }
  });
  registerTool({
    name: "Agent",
    description: "Spawn a sub-agent to perform a task in parallel. Results are returned when complete.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Short description of the task (3-5 words)" },
        prompt: { type: "string", description: "Detailed task for the agent to perform" },
        run_in_background: { type: "boolean", description: "Run in background (returns immediately)" },
        cwd: { type: "string", description: "Working directory for the agent" }
      },
      required: ["description", "prompt"]
    },
    execute: async (input, ctx) => {
      const { description, prompt, cwd, run_in_background } = input;
      const agentCwd = cwd || ctx.cwd;
      try {
        const agent = await spawnAgent({
          name: description,
          description,
          prompt,
          cwd: agentCwd,
          background: run_in_background
        });
        if (run_in_background) {
          return `[AGENT SPAWNED] ${description}
Agent ID: ${agent.id}
PID: ${agent.pid}
Running in background. Check status with /agents`;
        }
        const result = await new Promise((resolve4) => {
          const timeout = setTimeout(() => resolve4(`Agent ${agent.id} timed out after 120s`), 120000);
          const unsub = onAgentMessage((msg) => {
            if (msg.agentId === agent.id && (msg.type === "done" || msg.type === "error")) {
              clearTimeout(timeout);
              unsub();
              resolve4(String(msg.payload || "Agent completed"));
            }
          });
        });
        return result;
      } catch (err) {
        return `Agent spawn error: ${err}`;
      }
    }
  });
  registerTool({
    name: "TeamCreate",
    description: "Create a team of agents that can communicate with each other.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Team name" },
        agents: {
          type: "array",
          description: "List of agent names to create",
          items: { type: "string" }
        }
      },
      required: ["name"]
    },
    execute: async (input, ctx) => {
      const team = await createTeam({
        name: input.name,
        members: (input.agents || []).map((name) => ({
          name,
          role: name
        })),
        parentSessionId: ctx.sessionId
      });
      return `[TEAM CREATED] ${team.name} (${team.id})
Members: ${team.members.size}
Manage with /team list or /team send`;
    }
  });
  registerTool({
    name: "SendMessage",
    description: "Send a message to a teammate agent.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient agent name" },
        message: { type: "string", description: "Message content" }
      },
      required: ["to", "message"]
    },
    execute: async (input, _ctx) => {
      const { sendToAgent: sendToAgent2, getAgent: getAgent3, getAllAgents: getAllAgents2 } = await Promise.resolve().then(() => (init_spawner(), exports_spawner));
      const target = String(input.to);
      const agents2 = getAllAgents2();
      const agent = agents2.find((a) => a.id === target || a.name === target);
      if (!agent) {
        return `Agent "${target}" not found. Active agents: ${agents2.map((a) => a.name || a.id).join(", ") || "none"}`;
      }
      sendToAgent2(agent.id, String(input.message));
      return `[MESSAGE SENT to ${agent.name || agent.id}]: ${input.message}`;
    }
  });
  registerTool({
    name: "NotebookEdit",
    description: "Edit a Jupyter notebook cell.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to .ipynb file" },
        cell_index: { type: "number", description: "Cell index to edit" },
        new_text: { type: "string", description: "New cell content" },
        cell_type: { type: "string", enum: ["code", "markdown"], description: "Cell type" }
      },
      required: ["path", "cell_index", "new_text"]
    },
    execute: async (input, _ctx) => {
      const path = resolve3(process.cwd(), input.path);
      if (!existsSync6(path))
        return `Notebook not found: ${path}`;
      try {
        const nb = JSON.parse(readFileSync6(path, "utf-8"));
        const idx = input.cell_index;
        if (!nb.cells || !nb.cells[idx])
          return `Cell ${idx} not found`;
        nb.cells[idx].source = input.new_text;
        if (input.cell_type)
          nb.cells[idx].cell_type = input.cell_type;
        writeFileSync3(path, JSON.stringify(nb, null, 2));
        return `Edited cell ${idx} in ${path}`;
      } catch (err) {
        return `Error: ${err}`;
      }
    }
  });
  registerTool({
    name: "GrepTool",
    description: "Search for patterns in code (alias for Grep with code-focused defaults).",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Pattern to search" },
        path: { type: "string", description: "Directory to search" },
        context: { type: "number", description: "Lines of context" }
      },
      required: ["pattern", "path"]
    },
    execute: async (input, _ctx) => {
      const ctx = input.context ? `-C ${input.context}` : "-C 2";
      const pattern = input.pattern.replace(/'/g, "'\\''");
      const path = resolve3(process.cwd(), input.path);
      return runBash(`grep ${ctx} -r -- "${pattern}" "${path}" 2>/dev/null | head -50`);
    }
  });
  registerTool({
    name: "GlobTool",
    description: "Find files by pattern (alias for Glob).",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern" },
        cwd: { type: "string", description: "Directory to search" }
      },
      required: ["pattern"]
    },
    execute: async (input, _ctx) => {
      const cwd = input.cwd || process.cwd();
      const pattern = input.pattern;
      return runBash(`find "${cwd}" -type f -name "${pattern}" 2>/dev/null | head -100`);
    }
  });
  registerTool({
    name: "Sleep",
    description: "Wait for a specified time in milliseconds.",
    inputSchema: {
      type: "object",
      properties: {
        ms: { type: "number", description: "Milliseconds to sleep" }
      },
      required: ["ms"]
    },
    execute: async (input, _ctx) => {
      await new Promise((r) => setTimeout(r, input.ms));
      return `Slept ${input.ms}ms`;
    }
  });
  registerTool({
    name: "Exit",
    description: "End the current Nole Code session.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    execute: async (_input, _ctx) => {
      return "[SESSION ENDED] Thank you for using Nole Code!";
    }
  });
  registerTool({
    name: "LS",
    description: "List directory contents with file sizes, types, and permissions.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (default: cwd)" },
        all: { type: "boolean", description: "Show hidden files" },
        long: { type: "boolean", description: "Long format with sizes and dates" }
      },
      required: []
    },
    execute: async (input, _ctx) => {
      const dir = resolve3(process.cwd(), input.path || ".");
      if (!existsSync6(dir))
        return `Directory not found: ${dir}`;
      try {
        const entries = readdirSync(dir);
        const showHidden = input.all;
        const longFormat = input.long !== false;
        const filtered = showHidden ? entries : entries.filter((e) => !e.startsWith("."));
        if (filtered.length === 0)
          return "(empty directory)";
        if (!longFormat)
          return filtered.join(`
`);
        const lines = filtered.map((name) => {
          try {
            const fullPath = join7(dir, name);
            const stat = statSync(fullPath);
            const isDir = stat.isDirectory();
            const size = isDir ? "-" : formatSize(stat.size);
            const date5 = stat.mtime.toISOString().slice(0, 10);
            const type = isDir ? "d" : "-";
            return `${type} ${size.padStart(8)} ${date5} ${name}${isDir ? "/" : ""}`;
          } catch {
            return `? ${name}`;
          }
        });
        return lines.join(`
`);
      } catch (err) {
        return `Error: ${err}`;
      }
    }
  });
  registerTool({
    name: "Tree",
    description: "Show directory tree structure. Use for understanding project layout.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Root directory (default: cwd)" },
        depth: { type: "number", description: "Max depth (default: 3)" },
        pattern: { type: "string", description: "Filter by file extension (e.g., .ts, .py)" }
      },
      required: []
    },
    execute: async (input, _ctx) => {
      const root = resolve3(process.cwd(), input.path || ".");
      const maxDepth = input.depth || 3;
      const pattern = input.pattern;
      const lines = [];
      let fileCount = 0;
      let dirCount = 0;
      function walk(dir, prefix, depth) {
        if (depth > maxDepth)
          return;
        try {
          const entries = readdirSync(dir).filter((e) => !e.startsWith(".") && e !== "node_modules" && e !== ".git").sort((a, b) => {
            const aIsDir = statSync(join7(dir, a)).isDirectory();
            const bIsDir = statSync(join7(dir, b)).isDirectory();
            if (aIsDir !== bIsDir)
              return aIsDir ? -1 : 1;
            return a.localeCompare(b);
          });
          for (let i = 0;i < entries.length; i++) {
            const name = entries[i];
            const fullPath = join7(dir, name);
            const isLast = i === entries.length - 1;
            const connector = isLast ? "└── " : "├── ";
            const childPrefix = isLast ? "    " : "│   ";
            try {
              const isDir = statSync(fullPath).isDirectory();
              if (isDir) {
                dirCount++;
                lines.push(`${prefix}${connector}${name}/`);
                walk(fullPath, prefix + childPrefix, depth + 1);
              } else {
                if (pattern && !name.endsWith(pattern))
                  return;
                fileCount++;
                lines.push(`${prefix}${connector}${name}`);
              }
            } catch {}
          }
        } catch {}
      }
      const rootName = root.split("/").pop() || root;
      lines.push(rootName + "/");
      walk(root, "", 1);
      lines.push(`
${dirCount} directories, ${fileCount} files`);
      return lines.join(`
`);
    }
  });
  registerTool({
    name: "MultiEdit",
    description: "Make multiple edits to a file in one operation. More efficient than multiple Edit calls.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File to edit" },
        edits: {
          type: "array",
          description: "List of edits to apply in order",
          items: {
            type: "object",
            properties: {
              old_text: { type: "string", description: "Text to find" },
              new_text: { type: "string", description: "Replacement text" }
            },
            required: ["old_text", "new_text"]
          }
        }
      },
      required: ["path", "edits"]
    },
    execute: async (input, _ctx) => {
      const filePath = resolve3(process.cwd(), input.path);
      const pathCheck = validatePath(input.path, process.cwd());
      if (!pathCheck.valid)
        return `Access denied: ${pathCheck.reason}`;
      if (!existsSync6(filePath))
        return `File not found: ${filePath}`;
      const edits = input.edits;
      let content = readFileSync6(filePath, "utf-8");
      const diffs = [];
      let applied = 0;
      for (const edit of edits) {
        if (!content.includes(edit.old_text)) {
          diffs.push(`\x1B[33m! Could not find: "${edit.old_text.slice(0, 40)}..."\x1B[0m`);
          continue;
        }
        content = content.replace(edit.old_text, edit.new_text);
        applied++;
        const oldLines = edit.old_text.split(`
`);
        const newLines = edit.new_text.split(`
`);
        for (const l of oldLines)
          diffs.push(`\x1B[31m- ${l}\x1B[0m`);
        for (const l of newLines)
          diffs.push(`\x1B[32m+ ${l}\x1B[0m`);
        diffs.push("");
      }
      writeFileSync3(filePath, content, "utf-8");
      const verify = readFileSync6(filePath, "utf-8");
      let verified = 0;
      for (const edit of edits) {
        if (verify.includes(edit.new_text))
          verified++;
      }
      if (verified < applied) {
        diffs.push(`\x1B[31m⚠ VERIFICATION: only ${verified}/${applied} edits confirmed in file\x1B[0m`);
      }
      const relPath = relative2(process.cwd(), filePath);
      return `${relPath}: ${applied}/${edits.length} edits applied

${diffs.join(`
`)}`;
    }
  });
  registerTool({
    name: "HttpRequest",
    description: "Make HTTP requests with full control over method, headers, and body. Use for APIs, webhooks, testing endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to request" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], description: "HTTP method (default: GET)" },
        headers: { type: "object", description: "Request headers as key-value pairs" },
        body: { type: "string", description: "Request body (string or JSON)" },
        json: { type: "object", description: "JSON body (auto-sets Content-Type)" }
      },
      required: ["url"]
    },
    execute: async (input, _ctx) => {
      const url2 = input.url;
      const method = input.method || "GET";
      const headers = {
        "User-Agent": "Nole-Code/1.12",
        ...input.headers || {}
      };
      let body;
      if (input.json) {
        body = JSON.stringify(input.json);
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
      } else if (input.body) {
        body = input.body;
      }
      try {
        const response = await fetch(url2, { method, headers, body });
        const status = response.status;
        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();
        const respHeaders = Array.from(response.headers.entries()).map(([k, v]) => `  ${k}: ${v}`).join(`
`);
        let responseBody = text;
        if (contentType.includes("json")) {
          try {
            responseBody = JSON.stringify(JSON.parse(text), null, 2);
          } catch {}
        }
        if (responseBody.length > 1e4) {
          responseBody = responseBody.slice(0, 1e4) + `
... (truncated)`;
        }
        return `HTTP ${status} ${response.statusText}

Headers:
${respHeaders}

Body:
${responseBody}`;
      } catch (err) {
        return `Request failed: ${err}`;
      }
    }
  });
  registerTool({
    name: "FindReplace",
    description: "Search and replace text across multiple files. Like sed but safer — shows a preview of changes.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Text or regex pattern to find" },
        replacement: { type: "string", description: "Replacement text" },
        path: { type: "string", description: "Directory to search in (default: cwd)" },
        glob: { type: "string", description: "File pattern to match (e.g., *.ts, *.py)" },
        dry_run: { type: "boolean", description: "Preview changes without applying (default: true)" }
      },
      required: ["pattern", "replacement"]
    },
    execute: async (input, _ctx) => {
      const searchDir = resolve3(process.cwd(), input.path || ".");
      const pattern = input.pattern;
      const replacement = input.replacement;
      const fileGlob = input.glob || "*";
      const dryRun = input.dry_run !== false;
      const result = await runBash(`find "${searchDir}" -type f -name "${fileGlob}" ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null | head -50`);
      const files = result.trim().split(`
`).filter(Boolean);
      const changes = [];
      let totalMatches = 0;
      for (const file of files) {
        try {
          const content = readFileSync6(file, "utf-8");
          const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
          const matches = content.match(regex);
          if (matches && matches.length > 0) {
            totalMatches += matches.length;
            const relPath = relative2(process.cwd(), file);
            if (!dryRun) {
              const newContent = content.split(pattern).join(replacement);
              writeFileSync3(file, newContent, "utf-8");
            }
            changes.push(`  ${relPath}: ${matches.length} match${matches.length > 1 ? "es" : ""}`);
          }
        } catch {}
      }
      if (changes.length === 0) {
        return `No matches found for "${pattern}" in ${fileGlob} files`;
      }
      const action = dryRun ? "Would replace" : "Replaced";
      return `${action} "${pattern}" → "${replacement}"
${totalMatches} matches in ${changes.length} files:

${changes.join(`
`)}${dryRun ? `

Run with dry_run=false to apply.` : ""}`;
    }
  });
  registerTool({
    name: "GitStatus",
    description: "Show git repository status — branch, staged/unstaged changes, ahead/behind.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    execute: async (input, _ctx) => {
      const parts = [];
      try {
        const branch = await runBash("git branch --show-current 2>/dev/null");
        const status = await runBash("git status --short 2>/dev/null");
        const log = await runBash("git log --oneline -5 2>/dev/null");
        const ahead = await runBash("git rev-list --count @{u}..HEAD 2>/dev/null");
        const behind = await runBash("git rev-list --count HEAD..@{u} 2>/dev/null");
        parts.push(`Branch: ${branch.trim()}`);
        const a = parseInt(ahead.trim()) || 0;
        const b = parseInt(behind.trim()) || 0;
        if (a || b)
          parts.push(`Ahead: ${a}, Behind: ${b}`);
        if (status.trim()) {
          parts.push(`
Changes:
${status.trim()}`);
        } else {
          parts.push(`
Working tree clean`);
        }
        parts.push(`
Recent commits:
${log.trim()}`);
      } catch (err) {
        return `Not a git repository or git error: ${err}`;
      }
      return parts.join(`
`);
    }
  });
  registerTool({
    name: "GitCommit",
    description: "Stage files and create a git commit. Safer than running git commands manually.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Commit message" },
        files: {
          type: "array",
          items: { type: "string" },
          description: "Files to stage (default: all changed files)"
        },
        all: { type: "boolean", description: "Stage all changes (git add -A)" }
      },
      required: ["message"]
    },
    execute: async (input, _ctx) => {
      const message = input.message;
      const files = input.files;
      const all = input.all;
      try {
        if (files && files.length > 0) {
          for (const f of files) {
            await runBash(`git add "${f}"`);
          }
        } else if (all !== false) {
          await runBash("git add -A");
        }
        const staged = await runBash("git diff --cached --stat 2>/dev/null");
        if (!staged.trim())
          return "Nothing to commit (no staged changes)";
        const { execFileSync } = __require("child_process");
        execFileSync("git", ["commit", "-m", message], { encoding: "utf-8", cwd: process.cwd() });
        const hash = await runBash("git log --oneline -1");
        return `Committed: ${hash.trim()}

${staged.trim()}`;
      } catch (err) {
        return `Commit failed: ${err}`;
      }
    }
  });
  registerTool({
    name: "GitDiff",
    description: "Show git diff — staged, unstaged, or between refs.",
    inputSchema: {
      type: "object",
      properties: {
        staged: { type: "boolean", description: "Show staged changes (--cached)" },
        ref: { type: "string", description: "Compare against ref (branch, commit, HEAD~N)" },
        file: { type: "string", description: "Limit to specific file" },
        stat: { type: "boolean", description: "Show stat summary only" }
      },
      required: []
    },
    execute: async (input, _ctx) => {
      const parts = ["git", "diff"];
      if (input.staged)
        parts.push("--cached");
      if (input.stat)
        parts.push("--stat");
      if (input.ref)
        parts.push(String(input.ref));
      if (input.file)
        parts.push("--", String(input.file));
      const result = await runBash(parts.join(" ") + " 2>/dev/null");
      return result.trim() || "No differences";
    }
  });
  registerTool({
    name: "RunTests",
    description: "Run project tests and return results. Auto-detects test framework (jest, vitest, pytest, bun test, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Custom test command (overrides auto-detection)" },
        file: { type: "string", description: "Run tests for a specific file only" },
        filter: { type: "string", description: "Filter tests by name/pattern" }
      },
      required: []
    },
    execute: async (input, _ctx) => {
      let cmd = input.command;
      if (!cmd) {
        const cwd = process.cwd();
        if (existsSync6(join7(cwd, "package.json"))) {
          const pkg = JSON.parse(readFileSync6(join7(cwd, "package.json"), "utf-8"));
          const scripts = pkg.scripts || {};
          if (scripts.test) {
            cmd = "npm test";
          } else if (existsSync6(join7(cwd, "vitest.config.ts")) || existsSync6(join7(cwd, "vitest.config.js"))) {
            cmd = "npx vitest run";
          } else if (existsSync6(join7(cwd, "jest.config.ts")) || existsSync6(join7(cwd, "jest.config.js"))) {
            cmd = "npx jest";
          } else if (existsSync6(join7(cwd, "bun.lock")) || existsSync6(join7(cwd, "bunfig.toml"))) {
            cmd = "bun test";
          }
        }
        if (existsSync6(join7(process.cwd(), "pytest.ini")) || existsSync6(join7(process.cwd(), "pyproject.toml"))) {
          cmd = cmd || "python -m pytest -v";
        }
        if (existsSync6(join7(process.cwd(), "Cargo.toml"))) {
          cmd = cmd || "cargo test";
        }
        if (existsSync6(join7(process.cwd(), "go.mod"))) {
          cmd = cmd || "go test ./...";
        }
        cmd = cmd || 'echo "No test framework detected. Use command parameter to specify."';
      }
      if (input.file)
        cmd += ` ${input.file}`;
      if (input.filter)
        cmd += ` --filter "${input.filter}"`;
      return runBash(cmd, 120000);
    }
  });
  registerTool({
    name: "Spawn",
    description: "Start a long-running background process (dev server, watcher, etc.). Returns process ID.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to run in background" },
        name: { type: "string", description: "Name for this process" }
      },
      required: ["command"]
    },
    execute: async (input, _ctx) => {
      const { spawn: spawnProc } = __require("child_process");
      const command = input.command;
      const name = input.name || command.split(" ")[0];
      const proc = spawnProc("/bin/bash", ["-c", command], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        detached: true
      });
      let output = "";
      const timeout = setTimeout(() => {}, 3000);
      proc.stdout?.on("data", (data) => {
        output += data.toString();
      });
      proc.stderr?.on("data", (data) => {
        output += data.toString();
      });
      proc.unref();
      await new Promise((r) => setTimeout(r, 1000));
      clearTimeout(timeout);
      if (proc.exitCode !== null) {
        return `Process "${name}" exited immediately (code ${proc.exitCode})
${output}`;
      }
      return `Started "${name}" (PID: ${proc.pid})
Command: ${command}

Initial output:
${output.slice(0, 500) || "(no output yet)"}`;
    }
  });
  registerTool({
    name: "Diff",
    description: "Compare two files and show differences.",
    inputSchema: {
      type: "object",
      properties: {
        file1: { type: "string", description: "First file path" },
        file2: { type: "string", description: "Second file path" }
      },
      required: ["file1", "file2"]
    },
    execute: async (input, _ctx) => {
      const f1 = resolve3(process.cwd(), input.file1);
      const f2 = resolve3(process.cwd(), input.file2);
      if (!existsSync6(f1))
        return `File not found: ${f1}`;
      if (!existsSync6(f2))
        return `File not found: ${f2}`;
      const result = await runBash(`diff --color=never -u "${f1}" "${f2}" 2>/dev/null`);
      if (!result.trim())
        return "Files are identical";
      const colored = result.split(`
`).map((line) => {
        if (line.startsWith("+") && !line.startsWith("+++"))
          return `\x1B[32m${line}\x1B[0m`;
        if (line.startsWith("-") && !line.startsWith("---"))
          return `\x1B[31m${line}\x1B[0m`;
        if (line.startsWith("@@"))
          return `\x1B[36m${line}\x1B[0m`;
        return line;
      }).join(`
`);
      return colored;
    }
  });
  registerTool({
    name: "Rename",
    description: "Rename or move a file/directory.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Current path" },
        to: { type: "string", description: "New path" }
      },
      required: ["from", "to"]
    },
    execute: async (input, _ctx) => {
      const from = resolve3(process.cwd(), input.from);
      const to = resolve3(process.cwd(), input.to);
      if (!existsSync6(from))
        return `Not found: ${from}`;
      if (existsSync6(to))
        return `Target already exists: ${to}`;
      const { renameSync } = __require("fs");
      try {
        renameSync(from, to);
        return `Renamed: ${relative2(process.cwd(), from)} → ${relative2(process.cwd(), to)}`;
      } catch (err) {
        return `Error: ${err}`;
      }
    }
  });
  registerTool({
    name: "Delete",
    description: "Delete a file. Requires confirmation for directories.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File or directory to delete" },
        recursive: { type: "boolean", description: "Delete directory recursively (required for directories)" }
      },
      required: ["path"]
    },
    execute: async (input, _ctx) => {
      const targetPath = resolve3(process.cwd(), input.path);
      const pathCheck = validatePath(input.path, process.cwd());
      if (!pathCheck.valid)
        return `Access denied: ${pathCheck.reason}`;
      if (!existsSync6(targetPath))
        return `Not found: ${targetPath}`;
      try {
        const stat = statSync(targetPath);
        if (stat.isDirectory()) {
          if (!input.recursive)
            return `"${input.path}" is a directory. Set recursive=true to delete.`;
          const { rmSync } = __require("fs");
          rmSync(targetPath, { recursive: true });
        } else {
          const { unlinkSync } = __require("fs");
          unlinkSync(targetPath);
        }
        return `Deleted: ${relative2(process.cwd(), targetPath)}`;
      } catch (err) {
        return `Error: ${err}`;
      }
    }
  });
});

// src/session/manager.ts
var exports_manager = {};
__export(exports_manager, {
  saveSession: () => saveSession,
  loadSession: () => loadSession,
  listSessions: () => listSessions,
  getSessionMeta: () => getSessionMeta,
  forkSession: () => forkSession,
  exportSession: () => exportSession,
  deleteSession: () => deleteSession,
  createSession: () => createSession,
  compactSession: () => compactSession
});
import {
  existsSync as existsSync7,
  mkdirSync as mkdirSync4,
  readFileSync as readFileSync7,
  writeFileSync as writeFileSync4,
  readdirSync as readdirSync2,
  unlinkSync,
  renameSync
} from "fs";
import { join as join8 } from "path";
import { homedir as homedir7 } from "os";
function ensureSessionDir() {
  mkdirSync4(SESSION_DIR, { recursive: true });
}
function listSessions(limit = 20) {
  ensureSessionDir();
  const files = readdirSync2(SESSION_DIR).filter((f) => f.endsWith(".json"));
  const sessions = files.map((f) => {
    try {
      return JSON.parse(readFileSync7(join8(SESSION_DIR, f), "utf-8"));
    } catch {
      return null;
    }
  }).filter(Boolean).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return sessions.slice(0, limit);
}
function loadSession(id) {
  const file = join8(SESSION_DIR, `${id}.json`);
  if (!existsSync7(file))
    return null;
  try {
    return JSON.parse(readFileSync7(file, "utf-8"));
  } catch {
    return null;
  }
}
function saveSession(session) {
  ensureSessionDir();
  session.updatedAt = new Date().toISOString();
  const file = join8(SESSION_DIR, `${session.id}.json`);
  const tmp = file + `.tmp.${Date.now()}`;
  writeFileSync4(tmp, JSON.stringify(session, null, 2), "utf-8");
  renameSync(tmp, file);
}
function deleteSession(id) {
  const file = join8(SESSION_DIR, `${id}.json`);
  if (existsSync7(file)) {
    unlinkSync(file);
    return true;
  }
  return false;
}
function createSession(cwdOrOpts) {
  const opts = typeof cwdOrOpts === "string" ? { cwd: cwdOrOpts } : cwdOrOpts || {};
  const id = `nole-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const session = {
    id,
    messages: [],
    createdAt: now,
    updatedAt: now,
    cwd: opts.cwd || process.cwd(),
    model: opts.model || "MiniMax-Text-01"
  };
  if (opts.parentId) {
    session.parentId = opts.parentId;
  }
  saveSession(session);
  return session;
}
function forkSession(parentId, reason) {
  const parent = loadSession(parentId);
  if (!parent)
    return null;
  const forked = createSession({
    parentId,
    cwd: parent.cwd,
    model: parent.model
  });
  forked.messages = [...parent.messages];
  forked.messages.push({
    role: "system",
    content: `Session forked from ${parentId}${reason ? `: ${reason}` : ""}`,
    timestamp: new Date().toISOString()
  });
  saveSession(forked);
  return forked;
}
function compactSession(id, keepMessages = 10) {
  const session = loadSession(id);
  if (!session)
    return null;
  const toolIndices = [];
  for (let i = 0;i < session.messages.length; i++) {
    if (session.messages[i].role === "tool")
      toolIndices.push(i);
  }
  const indicesToRemove = new Set(toolIndices.slice(0, Math.max(0, toolIndices.length - keepMessages)));
  const removedCount = indicesToRemove.size;
  if (removedCount === 0) {
    return session;
  }
  const newMessages = [];
  let addedSummary = false;
  for (let i = 0;i < session.messages.length; i++) {
    if (indicesToRemove.has(i)) {
      if (!addedSummary) {
        addedSummary = true;
        newMessages.push({
          role: "system",
          content: `[${removedCount} older tool results omitted during compaction]`,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      newMessages.push(session.messages[i]);
    }
  }
  session.messages = newMessages;
  saveSession(session);
  return session;
}
function getSessionMeta(id) {
  const session = loadSession(id);
  if (!session)
    return null;
  const created = new Date(session.createdAt);
  const now = new Date;
  const ageMs = now.getTime() - created.getTime();
  const ageHours = Math.round(ageMs / (1000 * 60 * 60));
  return {
    messageCount: session.messages.length,
    createdAt: created.toLocaleString(),
    age: `${ageHours}h ago`,
    parentId: session.parentId
  };
}
function exportSession(id) {
  const session = loadSession(id);
  if (!session)
    return null;
  const lines = [`# Nole Code Session - ${session.id}`, `Created: ${session.createdAt}`, ""];
  for (const msg of session.messages) {
    if (msg.role === "system")
      continue;
    const label = msg.role === "user" ? "➜ you" : msg.role === "nole" ? "\uD83E\uDD16 nole" : "\uD83D\uDD27 tool";
    lines.push(`**${label}**`);
    lines.push(msg.content.slice(0, 2000));
    lines.push("");
  }
  return lines.join(`
`);
}
var SESSION_DIR;
var init_manager = __esm(() => {
  SESSION_DIR = join8(homedir7(), ".nole-code", "sessions");
});

// src/project/onboarding.ts
var exports_onboarding = {};
__export(exports_onboarding, {
  saveSettings: () => saveSettings,
  markOnboardingComplete: () => markOnboardingComplete,
  loadSettings: () => loadSettings,
  loadProjectContext: () => loadProjectContext,
  isOnboardingComplete: () => isOnboardingComplete,
  isDirEmpty: () => isDirEmpty,
  getOnboardingSteps: () => getOnboardingSteps,
  createNoleMd: () => createNoleMd
});
import {
  existsSync as existsSync8,
  readFileSync as readFileSync8,
  writeFileSync as writeFileSync5,
  mkdirSync as mkdirSync5
} from "fs";
import { join as join9 } from "path";
import { homedir as homedir8 } from "os";
function loadProjectConfig() {
  mkdirSync5(CONFIG_DIR, { recursive: true });
  if (existsSync8(PROJECT_CONFIG)) {
    try {
      return JSON.parse(readFileSync8(PROJECT_CONFIG, "utf-8"));
    } catch {}
  }
  return {};
}
function saveProjectConfig(config2) {
  mkdirSync5(CONFIG_DIR, { recursive: true });
  writeFileSync5(PROJECT_CONFIG, JSON.stringify(config2, null, 2));
}
function isDirEmpty(cwd) {
  try {
    const { execSync: execSync2 } = __require("child_process");
    const output = execSync2(`ls -A "${cwd}" 2>/dev/null`, { encoding: "utf-8" });
    return !output.trim();
  } catch {
    return true;
  }
}
function getOnboardingSteps(cwd) {
  const noleMdPath = join9(cwd, "NOLE.md");
  const empty = isDirEmpty(cwd);
  return [
    {
      key: "workspace",
      text: "Create a new app or clone a repository",
      isComplete: !empty,
      isCompletable: true,
      isEnabled: empty
    },
    {
      key: "nolemd",
      text: "Run /init to create a NOLE.md file",
      isComplete: existsSync8(noleMdPath),
      isCompletable: true,
      isEnabled: !empty
    },
    {
      key: "context",
      text: "Add project context files",
      isComplete: existsSync8(join9(cwd, ".nolecode")) || existsSync8(join9(cwd, "NOLE.md")),
      isCompletable: true,
      isEnabled: !empty
    }
  ];
}
function isOnboardingComplete(cwd) {
  return getOnboardingSteps(cwd).filter((s) => s.isCompletable && s.isEnabled).every((s) => s.isComplete);
}
function markOnboardingComplete(cwd) {
  const config2 = loadProjectConfig();
  if (!config2[cwd])
    config2[cwd] = {};
  config2[cwd].hasCompletedOnboarding = true;
  saveProjectConfig(config2);
}
function createNoleMd(cwd, projectName) {
  const name = projectName || cwd.split("/").pop() || "this project";
  let techStack = "";
  let commands = "";
  let description = "Brief description of what this project does.";
  const pkgPath = join9(cwd, "package.json");
  if (existsSync8(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync8(pkgPath, "utf-8"));
      if (pkg.description)
        description = pkg.description;
      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      const allDeps = [...deps, ...devDeps];
      const detected = [];
      if (allDeps.some((d) => d.includes("react")))
        detected.push("React");
      if (allDeps.some((d) => d.includes("vue")))
        detected.push("Vue");
      if (allDeps.some((d) => d.includes("next")))
        detected.push("Next.js");
      if (allDeps.some((d) => d.includes("express")))
        detected.push("Express");
      if (allDeps.some((d) => d.includes("fastify")))
        detected.push("Fastify");
      if (devDeps.some((d) => d.includes("typescript")))
        detected.push("TypeScript");
      if (allDeps.some((d) => d.includes("prisma")))
        detected.push("Prisma");
      if (allDeps.some((d) => d.includes("drizzle")))
        detected.push("Drizzle");
      if (detected.length > 0)
        techStack = detected.join(", ");
      else
        techStack = deps.slice(0, 5).join(", ") || "Node.js";
      const scripts = pkg.scripts || {};
      const cmdLines = [];
      if (scripts.dev)
        cmdLines.push(`npm run dev    # ${scripts.dev.slice(0, 40)}`);
      if (scripts.build)
        cmdLines.push(`npm run build  # ${scripts.build.slice(0, 40)}`);
      if (scripts.test)
        cmdLines.push(`npm test       # ${scripts.test.slice(0, 40)}`);
      if (scripts.start)
        cmdLines.push(`npm start      # ${scripts.start.slice(0, 40)}`);
      commands = cmdLines.join(`
`) || "npm run dev";
    } catch {}
  }
  if (existsSync8(join9(cwd, "pyproject.toml")) || existsSync8(join9(cwd, "setup.py"))) {
    techStack = techStack || "Python";
    commands = commands || `python -m pytest
python main.py`;
  }
  if (existsSync8(join9(cwd, "Cargo.toml"))) {
    techStack = techStack || "Rust";
    commands = commands || `cargo build
cargo test
cargo run`;
  }
  if (existsSync8(join9(cwd, "go.mod"))) {
    techStack = techStack || "Go";
    commands = commands || `go build
go test ./...
go run .`;
  }
  let structure = "";
  try {
    const { execSync: ex } = __require("child_process");
    structure = ex('find . -maxdepth 2 -type d ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" | head -20', {
      encoding: "utf-8",
      cwd,
      timeout: 3000
    }).trim();
  } catch {}
  const template = `# ${name}

## Overview
${description}

## Tech Stack
${techStack || "- Add your tech stack here"}

## Commands
\`\`\`bash
${commands || "# Add your development commands"}
\`\`\`

## Structure
\`\`\`
${structure || "# Project directory structure"}
\`\`\`

## Notes
- Important things to know when working in this project
`;
  const path = join9(cwd, "NOLE.md");
  writeFileSync5(path, template, "utf-8");
  return path;
}
function loadProjectContext(cwd) {
  const paths = [
    join9(cwd, "NOLE.md"),
    join9(cwd, ".nole.md"),
    join9(cwd, ".nolecode"),
    join9(cwd, "CONTEXT.md")
  ];
  for (const p of paths) {
    if (existsSync8(p)) {
      try {
        return readFileSync8(p, "utf-8");
      } catch {}
    }
  }
  return null;
}
function loadSettings() {
  if (existsSync8(SETTINGS_FILE)) {
    try {
      return JSON.parse(readFileSync8(SETTINGS_FILE, "utf-8"));
    } catch {}
  }
  return {
    autoSaveSession: true,
    streamResponses: true,
    showTimestamps: false,
    toolPermissions: "all",
    temperature: 0.7,
    maxTokens: 4096,
    editor: process.env.EDITOR || "vim",
    shell: process.env.SHELL || "/bin/bash"
  };
}
function saveSettings(settings) {
  const current = loadSettings();
  const updated = { ...current, ...settings };
  writeFileSync5(SETTINGS_FILE, JSON.stringify(updated, null, 2));
  return updated;
}
var CONFIG_DIR, PROJECT_CONFIG, SETTINGS_FILE;
var init_onboarding = __esm(() => {
  CONFIG_DIR = join9(homedir8(), ".nole-code");
  PROJECT_CONFIG = join9(CONFIG_DIR, "projects.json");
  SETTINGS_FILE = join9(CONFIG_DIR, "settings.json");
});

// src/plan/index.ts
var exports_plan = {};
__export(exports_plan, {
  skipStep: () => skipStep,
  promptForPlanAction: () => promptForPlanAction,
  modifyStep: () => modifyStep,
  isPlanModeActive: () => isPlanModeActive,
  handlePlanCommand: () => handlePlanCommand,
  getCurrentStep: () => getCurrentStep,
  getCurrentPlan: () => getCurrentPlan,
  generatePlanSteps: () => generatePlanSteps,
  enterPlanMode: () => enterPlanMode,
  displayPlan: () => displayPlan,
  denyStep: () => denyStep,
  cleanupPlanMode: () => cleanupPlanMode,
  approveStep: () => approveStep,
  abortPlan: () => abortPlan
});
import * as readline from "readline";
function enterPlanMode(goal, steps) {
  if (currentPlan && currentPlan.status === "active") {
    console.log(`
⚠️  Plan already active. Use /plan approve to continue or /plan abort to cancel.`);
    return currentPlan;
  }
  const cleanGoal = goal.replace(/^(let['’]?s?\s+)?(make\s+a\s+plan|plan|break\s+this\s+down|walk\s+me\s+through|step\s+by\s+step|enter\s+plan\s*mode)\s*/i, "").trim();
  const title = cleanGoal ? cleanGoal.slice(0, 60) : goal.slice(0, 60);
  currentPlan = {
    id: `plan_${Date.now()}`,
    title,
    goal,
    steps: steps.map((s, i) => ({ ...s, id: `step_${i}`, status: "pending" })),
    currentStep: 0,
    status: "active",
    createdAt: new Date().toISOString()
  };
  console.log(`
` + "=".repeat(60));
  console.log("\uD83D\uDCCB PLAN MODE");
  console.log("=".repeat(60));
  console.log(`
Goal: ${goal}
`);
  displayPlan(currentPlan);
  console.log(`
Commands:`);
  console.log("  approve (y)  - Approve current step");
  console.log("  deny (n)      - Deny current step");
  console.log("  modify (m)   - Modify step input");
  console.log("  skip (s)      - Skip this step");
  console.log("  abort         - Cancel entire plan");
  console.log(`  help         - Show this help
`);
  return currentPlan;
}
function displayPlan(plan) {
  console.log(`Plan: ${plan.title}`);
  console.log(`Progress: ${plan.currentStep + 1}/${plan.steps.length} steps
`);
  for (let i = 0;i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const prefix = i === plan.currentStep ? "  → " : i < plan.currentStep ? "    " : "    ";
    const statusIcon = step.status === "approved" ? "✅" : step.status === "denied" ? "❌" : step.status === "skipped" ? "⏭" : step.status === "modified" ? "✏️" : i === plan.currentStep ? "⏳" : "  ";
    const toolPart = step.tool ? `[${step.tool}] ` : "";
    console.log(`${prefix}${statusIcon} ${toolPart}${step.description}`);
    if (step.status === "denied" && step.reason) {
      console.log(`${prefix}   Reason: ${step.reason}`);
    }
    if (step.status === "modified" && step.modifiedInput) {
      console.log(`${prefix}   Modified: ${JSON.stringify(step.modifiedInput)}`);
    }
  }
}
function getCurrentPlan() {
  return currentPlan;
}
function getCurrentStep() {
  if (!currentPlan)
    return null;
  if (currentPlan.currentStep >= currentPlan.steps.length)
    return null;
  return currentPlan.steps[currentPlan.currentStep];
}
function approveStep() {
  if (!currentPlan || currentPlan.status !== "active") {
    return { approved: false };
  }
  const step = getCurrentStep();
  if (!step) {
    return { approved: false };
  }
  step.status = "approved";
  currentPlan.currentStep++;
  if (currentPlan.currentStep >= currentPlan.steps.length) {
    currentPlan.status = "completed";
    console.log(`
✅ Plan completed!`);
  } else {
    console.log(`
✅ Step approved. ${currentPlan.steps.length - currentPlan.currentStep} steps remaining.`);
    displayPlan(currentPlan);
  }
  return { approved: true, step, plan: currentPlan };
}
function denyStep(reason) {
  if (!currentPlan || currentPlan.status !== "active") {
    return { denied: false };
  }
  const step = getCurrentStep();
  if (!step) {
    return { denied: false };
  }
  step.status = "denied";
  step.reason = reason || "User denied this step";
  currentPlan.status = "aborted";
  console.log(`
❌ Step denied: ${reason || "User denied"}`);
  console.log("Plan aborted.");
  return { denied: true, step, plan: currentPlan };
}
function skipStep() {
  if (!currentPlan || currentPlan.status !== "active") {
    return { skipped: false };
  }
  const step = getCurrentStep();
  if (!step) {
    return { skipped: false };
  }
  step.status = "skipped";
  currentPlan.currentStep++;
  if (currentPlan.currentStep >= currentPlan.steps.length) {
    currentPlan.status = "completed";
    console.log(`
✅ Plan completed (with skips)!`);
  } else {
    console.log(`
⏭  Step skipped. ${currentPlan.steps.length - currentPlan.currentStep} steps remaining.`);
    displayPlan(currentPlan);
  }
  return { skipped: true, step, plan: currentPlan };
}
function modifyStep(newInput) {
  if (!currentPlan || currentPlan.status !== "active") {
    return { modified: false };
  }
  const step = getCurrentStep();
  if (!step) {
    return { modified: false };
  }
  step.modifiedInput = { ...step.input, ...newInput };
  step.status = "modified";
  console.log(`
✏️  Step modified: ${JSON.stringify(step.modifiedInput)}`);
  return { modified: true, step, plan: currentPlan };
}
function abortPlan() {
  if (!currentPlan)
    return null;
  currentPlan.status = "aborted";
  const plan = currentPlan;
  currentPlan = null;
  console.log(`
\uD83D\uDED1 Plan aborted.`);
  return plan;
}
async function promptForPlanAction() {
  return new Promise((resolve5) => {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(`
Plan action: `, (answer) => {
      resolve5(answer.trim().toLowerCase());
    });
  });
}
function handlePlanCommand(input) {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "y" || trimmed === "yes" || trimmed === "approve") {
    return { action: "approve" };
  }
  if (trimmed === "n" || trimmed === "no" || trimmed === "deny") {
    return { action: "deny" };
  }
  if (trimmed === "s" || trimmed === "skip") {
    return { action: "skip" };
  }
  if (trimmed === "m" || trimmed === "modify") {
    return { action: "modify" };
  }
  if (trimmed === "abort" || trimmed === "cancel") {
    return { action: "abort" };
  }
  if (trimmed === "help" || trimmed === "?") {
    console.log(`
Commands:`);
    console.log("  approve (y)  - Approve current step");
    console.log("  deny (n)     - Deny current step");
    console.log("  modify (m)  - Modify step input");
    console.log("  skip (s)     - Skip this step");
    console.log(`  abort       - Cancel entire plan
`);
    return { action: "none" };
  }
  return { action: "none" };
}
function isPlanModeActive() {
  return currentPlan !== null && currentPlan.status === "active";
}
function generatePlanSteps(goal) {
  const steps = [];
  let cleanGoal = goal.replace(/^(plan|lets?\s+make\s+a\s+plan|lets?\s+plan|make\s+a\s+plan|step\s+by\s+step|enter\s+plan\s*mode)\s*/i, "").trim();
  if (!cleanGoal)
    cleanGoal = goal;
  const lowerGoal = cleanGoal.toLowerCase();
  if (lowerGoal.includes("create") || lowerGoal.includes("build") || lowerGoal.includes("make")) {
    steps.push({
      id: "",
      description: "Understand requirements and project structure",
      status: "pending"
    });
    steps.push({
      id: "",
      description: "Create/update necessary files",
      status: "pending"
    });
    steps.push({
      id: "",
      description: "Test the implementation",
      status: "pending"
    });
  }
  if (lowerGoal.includes("fix") || lowerGoal.includes("bug") || lowerGoal.includes("error")) {
    steps.push({
      id: "",
      description: "Identify the root cause",
      status: "pending"
    });
    steps.push({
      id: "",
      description: "Implement the fix",
      status: "pending"
    });
    steps.push({
      id: "",
      description: "Verify the fix works",
      status: "pending"
    });
  }
  if (lowerGoal.includes("test") || lowerGoal.includes("spec")) {
    steps.push({
      id: "",
      description: "Write or update tests",
      status: "pending"
    });
    steps.push({
      id: "",
      description: "Run tests to verify",
      status: "pending"
    });
  }
  if (steps.length === 0) {
    steps.push({
      id: "",
      description: goal,
      status: "pending"
    });
  }
  return steps;
}
function cleanupPlanMode() {
  if (rl) {
    rl.close();
    rl = null;
  }
}
var currentPlan = null, rl = null;
var init_plan = () => {};

// src/utils/count-tokens.ts
var exports_count_tokens = {};
__export(exports_count_tokens, {
  roughTokenCount: () => roughTokenCount,
  estimateTotalTokens: () => estimateTotalTokens,
  estimateMessageTokens: () => estimateMessageTokens,
  compactToTokenBudget: () => compactToTokenBudget
});
function roughTokenCount(text) {
  if (!text)
    return 0;
  if (typeof text !== "string") {
    return roughTokenCount(JSON.stringify(text));
  }
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordTokens = words.length * 1.3;
  const lineBreakTokens = (text.match(/\n/g) || []).length * 2;
  const specialTokens = (text.match(/[^\w\s]/g) || []).length * 0.5;
  return Math.ceil(wordTokens + lineBreakTokens + specialTokens);
}
function estimateMessageTokens(message) {
  let tokens = 4;
  if (message.name) {
    tokens += roughTokenCount(message.name) + 2;
  }
  if (message.content) {
    tokens += roughTokenCount(String(message.content));
  }
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      tokens += roughTokenCount(tc.name) + roughTokenCount(tc.input) + 10;
    }
  }
  return tokens;
}
function estimateTotalTokens(messages) {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}
function compactToTokenBudget(text, maxTokens) {
  const currentTokens = roughTokenCount(text);
  if (currentTokens <= maxTokens)
    return text;
  let start = 0;
  let end = text.length;
  while (start < end) {
    const mid = Math.floor((start + end) / 2);
    const estimate = roughTokenCount(text.slice(0, mid));
    if (estimate < maxTokens) {
      start = mid + 1;
    } else {
      end = mid;
    }
  }
  const truncated = text.slice(0, start);
  return truncated + `

[_compacted_]`;
}

// src/utils/cost.ts
var exports_cost = {};
__export(exports_cost, {
  table: () => table,
  spinner: () => spinner,
  costTracker: () => costTracker,
  c: () => c,
  box: () => box,
  applyStyle: () => applyStyle
});
import { existsSync as existsSync9, readFileSync as readFileSync9, mkdirSync as mkdirSync6, appendFileSync as appendFileSync2 } from "fs";
import { homedir as homedir9 } from "node:os";
import { join as join10, dirname as dirname4 } from "node:path";

class CostTracker {
  sessionCosts = new Map;
  currentSession = null;
  startSession(sessionId) {
    this.currentSession = {
      sessionId,
      inputTokens: 0,
      outputTokens: 0,
      requests: 0,
      startTime: new Date().toISOString()
    };
    this.sessionCosts.set(sessionId, this.currentSession);
  }
  trackRequest(model, inputTokens, outputTokens) {
    const entry = {
      date: new Date().toISOString().split("T")[0],
      inputTokens,
      outputTokens,
      model,
      cost: this.calculateCost(model, inputTokens, outputTokens),
      requests: 1
    };
    mkdirSync6(dirname4(COST_FILE), { recursive: true });
    appendFileSync2(COST_FILE, JSON.stringify(entry) + `
`);
    if (this.currentSession) {
      this.currentSession.inputTokens += inputTokens;
      this.currentSession.outputTokens += outputTokens;
      this.currentSession.requests++;
    }
  }
  endSession() {
    if (this.currentSession) {
      this.currentSession.endTime = new Date().toISOString();
      this.currentSession = null;
    }
  }
  calculateCost(model, input, output) {
    const prices = PRICING[model] || PRICING.default;
    return (input * prices.input + output * prices.output) / 1e6;
  }
  getSummary(startDate, endDate) {
    const summary = {
      totalCost: 0,
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byModel: {}
    };
    if (!existsSync9(COST_FILE))
      return summary;
    const lines = readFileSync9(COST_FILE, "utf-8").trim().split(`
`);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (startDate && entry.date < startDate)
          continue;
        if (endDate && entry.date > endDate)
          continue;
        summary.totalCost += entry.cost;
        summary.totalRequests += entry.requests;
        summary.totalInputTokens += entry.inputTokens;
        summary.totalOutputTokens += entry.outputTokens;
        if (!summary.byModel[entry.model]) {
          summary.byModel[entry.model] = { cost: 0, requests: 0 };
        }
        summary.byModel[entry.model].cost += entry.cost;
        summary.byModel[entry.model].requests += entry.requests;
      } catch {}
    }
    return summary;
  }
  getToday() {
    const today = new Date().toISOString().split("T")[0];
    const summary = this.getSummary(today, today);
    return { cost: summary.totalCost, requests: summary.totalRequests };
  }
  formatCost(cost) {
    if (cost < 0.001)
      return `$${(cost * 1000).toFixed(4)}m`;
    if (cost < 1)
      return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  }
  getCurrentSession() {
    return this.currentSession;
  }
  clearHistory() {
    const { unlinkSync: unlinkSync2 } = __require("fs");
    try {
      if (existsSync9(COST_FILE)) {
        unlinkSync2(COST_FILE);
      }
    } catch {}
  }
}
function applyStyle(text, styleName) {
  const style = STYLES[styleName];
  if (!style)
    return text;
  const codes = [];
  const colors = {
    "#60A5FA": 39,
    "#A78BFA": 35,
    "#F472B6": 35,
    "#EF4444": 31,
    "#22C55E": 32,
    "#F59E0B": 33
  };
  if (style.color && colors[style.color]) {
    codes.push(`\x1B[${colors[style.color]}m`);
  }
  if (style.bold)
    codes.push("\x1B[1m");
  if (style.dim)
    codes.push("\x1B[2m");
  if (style.italic)
    codes.push("\x1B[3m");
  if (style.underline)
    codes.push("\x1B[4m");
  const reset = "\x1B[0m";
  return codes.join("") + text + reset;
}
function spinner(frame) {
  return STYLES[frame % SPINNER_FRAMES.length];
}
function box(text, options = {}) {
  const border = options.border ? "│" : "";
  const lines = text.split(`
`);
  const width = Math.max(...lines.map((l) => l.length), 40);
  if (!options.border) {
    return lines.map((l) => `${border} ${l.padEnd(width)} ${border}`).join(`
`);
  }
  const top = `┌${"─".repeat(width + 2)}┐`;
  const bottom = `└${"─".repeat(width + 2)}┘`;
  const middle = lines.map((l) => `${border} ${l.padEnd(width)} ${border}`).join(`
`);
  return [top, middle, bottom].join(`
`);
}
function table(headers, rows, options = {}) {
  const { maxWidth = 100, align = "left" } = options;
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] || "").length)));
  const totalWidth = widths.reduce((a, w) => a + w + 3, 1);
  if (totalWidth > maxWidth) {
    const scale = maxWidth / totalWidth;
    widths.forEach((w, i) => {
      widths[i] = Math.floor(w * scale);
    });
  }
  function formatRow(cells) {
    return cells.map((cell, i) => {
      const padded = cell.padEnd(widths[i]).slice(0, widths[i]);
      return `  ${padded}`;
    }).join("│") + "│";
  }
  const sep = widths.map((w) => "─".repeat(w)).join("─┼─");
  return [
    formatRow(headers).replace(/│/g, "├").replace(/^├/, "┌").replace(/│$/, "┐") + `
` + "├" + sep + "┤",
    ...rows.map((r) => formatRow(r)),
    "└" + sep + "┘"
  ].join(`
`);
}
var PRICING, COST_FILE, costTracker, STYLES, c, SPINNER_FRAMES;
var init_cost = __esm(() => {
  PRICING = {
    "MiniMax-Text-01": { input: 0.01, output: 0.01 },
    "MiniMax-M2.7": { input: 0.01, output: 0.01 },
    "MiniMax-M2.5": { input: 0.005, output: 0.005 },
    default: { input: 0.01, output: 0.01 }
  };
  COST_FILE = join10(homedir9(), ".nole-code", "costs.jsonl");
  costTracker = new CostTracker;
  STYLES = {
    user: { color: "#60A5FA" },
    nole: { color: "#A78BFA" },
    tool: { color: "#F472B6" },
    error: { color: "#EF4444", bold: true },
    success: { color: "#22C55E" },
    warning: { color: "#F59E0B" },
    dim: { dim: true },
    bold: { bold: true }
  };
  c = {
    user: (text) => applyStyle(text, "user"),
    nole: (text) => applyStyle(text, "nole"),
    tool: (text) => applyStyle(text, "tool"),
    error: (text) => applyStyle(text, "error"),
    success: (text) => applyStyle(text, "success"),
    warning: (text) => applyStyle(text, "warning"),
    dim: (text) => applyStyle(text, "dim"),
    bold: (text) => applyStyle(text, "bold"),
    hex: (text, color) => {
      const colors = {
        red: 31,
        green: 32,
        yellow: 33,
        blue: 34,
        magenta: 35,
        cyan: 36
      };
      const code = colors[color.toLowerCase()] || 36;
      return `\x1B[${code}m${text}\x1B[0m`;
    }
  };
  SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
});

// src/commands/index.ts
var exports_commands = {};
__export(exports_commands, {
  registerCommand: () => registerCommand,
  parseCommand: () => parseCommand,
  getCommand: () => getCommand,
  getAllCommands: () => getAllCommands
});
import { exec as exec2 } from "child_process";
import { promisify as promisify2 } from "util";
import { existsSync as existsSync10, readFileSync as readFileSync10 } from "fs";
import { join as join11 } from "path";
import { homedir as homedir10 } from "os";
function getAge(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime();
  if (ms < 60000)
    return "just now";
  if (ms < 3600000)
    return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000)
    return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}
function registerCommand(cmd) {
  commands.set(cmd.name, cmd);
  cmd.aliases?.forEach((a) => commands.set(a, cmd));
}
function getCommand(name) {
  return commands.get(name);
}
function getAllCommands() {
  return Array.from(commands.values()).filter((c2, i, arr) => arr.indexOf(c2) === i);
}
function parseCommand(input) {
  if (!input.startsWith("/"))
    return null;
  const parts = input.slice(1).split(/\s+/);
  return { cmd: parts[0], args: parts.slice(1) };
}
var execAsync2, commands;
var init_commands = __esm(() => {
  init_env();
  execAsync2 = promisify2(exec2);
  commands = new Map;
  registerCommand({
    name: "help",
    description: "Show available commands",
    aliases: ["h", "?"],
    execute: async () => {
      const cmds = getAllCommands();
      return `\uD83E\uDD9E NOLE CODE — Available Commands:

` + cmds.map((c2) => `  /${c2.name}${c2.aliases?.length ? ` (${c2.aliases.join(", ")})` : ""}
    ${c2.description}`).join(`

`) + `

\uD83D\uDCA1 Regular chat: Just type your message without /
   Tools are called automatically when needed.
`;
    }
  });
  registerCommand({
    name: "clear",
    description: "Clear screen. Use /clear context to also reset conversation history.",
    aliases: ["cls"],
    execute: async (args, ctx) => {
      process.stdout.write("\x1B[2J\x1B[H");
      if (args[0] === "context" || args[0] === "all") {
        const { loadSession: load, saveSession: save } = await Promise.resolve().then(() => (init_manager(), exports_manager));
        const session = load(ctx.sessionId);
        if (session) {
          session.messages = session.messages.filter((m) => m.role === "system");
          save(session);
          return "Screen and context cleared.";
        }
      }
      return "";
    }
  });
  registerCommand({
    name: "sessions",
    description: "List all sessions with details",
    aliases: ["session"],
    execute: async (_args, ctx) => {
      const { listSessions: listSessions2 } = await Promise.resolve().then(() => (init_manager(), exports_manager));
      const sessions = listSessions2(15);
      if (sessions.length === 0)
        return "No sessions found";
      const lines = sessions.map((s) => {
        const current = s.id === ctx.sessionId ? " \x1B[32m← current\x1B[0m" : "";
        const userMsgs = s.messages.filter((m) => m.role === "user").length;
        const dir = s.cwd ? s.cwd.split("/").pop() : "?";
        const age = getAge(s.updatedAt);
        return `  ${s.id.slice(0, 20).padEnd(20)} ${String(userMsgs).padStart(3)} msgs  ${dir?.padEnd(15)}  ${age}${current}`;
      });
      return `Sessions:

  ${"ID".padEnd(20)} ${"Msgs".padStart(4)}  ${"Directory".padEnd(15)}  Age
${lines.join(`
`)}`;
    }
  });
  registerCommand({
    name: "commit",
    description: "Git commit with message",
    aliases: ["ci"],
    execute: async (args) => {
      if (args.length === 0)
        return "Usage: /commit <message>";
      const msg = args.join(" ");
      await execAsync2("git add -A", { cwd: process.cwd() });
      const { stdout, stderr } = await execAsync2('git commit -m "$COMMIT_MSG"', {
        cwd: process.cwd(),
        env: { ...process.env, COMMIT_MSG: msg }
      });
      return (stdout + stderr).trim() || "Committed";
    }
  });
  registerCommand({
    name: "diff",
    description: "Show git diff",
    aliases: ["d"],
    execute: async (args) => {
      const target = args[0] || "";
      const { stdout } = await execAsync2("git diff -- " + (target ? `"${target.replace(/'/g, `'"'"'`)}"` : ""), { cwd: process.cwd() });
      return stdout || "No changes";
    }
  });
  registerCommand({
    name: "status",
    description: "Show git status",
    aliases: ["st"],
    execute: async () => {
      const { stdout } = await execAsync2("git status --short", { cwd: process.cwd() });
      return stdout || "Clean working tree";
    }
  });
  registerCommand({
    name: "log",
    description: "Show recent git commits",
    aliases: ["lg"],
    execute: async (args) => {
      const n = args[0] || "10";
      const { stdout } = await execAsync2("git log --oneline -n " + String(n), { cwd: process.cwd() });
      return stdout || "No commits";
    }
  });
  registerCommand({
    name: "branch",
    description: "Show git branches",
    aliases: ["br"],
    execute: async () => {
      const { stdout } = await execAsync2("git branch -v", { cwd: process.cwd() });
      return stdout || "No branches";
    }
  });
  registerCommand({
    name: "checkout",
    description: "Git checkout a branch or file",
    execute: async (args) => {
      if (args.length === 0)
        return "Usage: /checkout <branch|file>";
      try {
        const { stdout, stderr } = await execAsync2("git checkout -- " + args.map((a) => `'${a.replace(/'/g, `'"'"'`)}'`).join(" "), { cwd: process.cwd() });
        return (stdout + stderr).trim() || `Checked out ${args[0]}`;
      } catch (e) {
        const err = e;
        return `Checkout failed: ${err.message || String(e)}`;
      }
    }
  });
  registerCommand({
    name: "lsof",
    description: "Show open ports or file handles",
    execute: async (args) => {
      const port = args[0] || "";
      const cmd = port ? `lsof -i :${port}` : "lsof -i -P";
      try {
        const { stdout } = await execAsync2(cmd);
        return stdout || "No results";
      } catch {
        return "lsof not available";
      }
    }
  });
  registerCommand({
    name: "ps",
    description: "Show running processes",
    execute: async (args) => {
      const filter = args.join(" ") || "aux";
      const { stdout } = await execAsync2(`ps ${filter} | head -20`);
      return stdout || "No processes";
    }
  });
  registerCommand({
    name: "env",
    description: "Show environment variables (filtered)",
    aliases: ["environment"],
    execute: async (args) => {
      const filter = (args[0] || "").toLowerCase();
      const SENSITIVE_KEYS = ["KEY", "SECRET", "TOKEN", "PASSWORD", "CREDENTIAL", "AUTH", "PASS"];
      const env = Object.entries(process.env).filter(([k]) => !filter || k.toLowerCase().includes(filter)).map(([k, v]) => {
        const isSensitive = SENSITIVE_KEYS.some((s) => k.toUpperCase().includes(s));
        return `${k}=${isSensitive ? "***" : v}`;
      }).join(`
`);
      return env || "No matching variables";
    }
  });
  registerCommand({
    name: "exit",
    description: "Exit Nole Code",
    aliases: ["quit", "q"],
    execute: async () => {
      console.log(`
\uD83D\uDC4B Goodbye!
`);
      process.exit(0);
    }
  });
  registerCommand({
    name: "cost",
    description: "Show estimated API usage for this session",
    execute: async (_args, ctx) => {
      const sessionFile = join11(homedir10(), ".nole-code", "sessions", `${ctx.sessionId}.json`);
      if (!existsSync10(sessionFile))
        return "Session not found";
      try {
        const session = JSON.parse(readFileSync10(sessionFile, "utf-8"));
        const msgs = session.messages?.length || 0;
        return `Session: ${ctx.sessionId}
Messages: ${msgs}
Estimated turns: ${Math.ceil(msgs / 2)}
Note: Actual token usage available in provider dashboard.`;
      } catch {
        return "Could not read session";
      }
    }
  });
  registerCommand({
    name: "doctor",
    description: "Check Nole Code setup health",
    execute: async () => {
      const checks4 = [
        ["Node.js", process.version],
        ["API Key", MINIMAX_API_KEY ? "✅ set" : "❌ missing"],
        ["Session Dir", existsSync10(join11(homedir10(), ".nole-code")) ? "✅ exists" : "❌ missing"]
      ];
      return `\uD83E\uDD9E NOLE CODE — Health Check:

` + checks4.map(([name, status]) => `  ${status.startsWith("❌") ? "❌" : "✅"} ${name}: ${status}`).join(`
`);
    }
  });
  registerCommand({
    name: "init",
    description: "Create a NOLE.md project context file in current directory",
    aliases: ["init-project"],
    execute: async (_args, ctx) => {
      const { createNoleMd: createNoleMd2 } = await Promise.resolve().then(() => (init_onboarding(), exports_onboarding));
      const path = createNoleMd2(ctx.cwd);
      return `✅ Created ${path}
Edit this file to configure project context for Nole Code.`;
    }
  });
  registerCommand({
    name: "fork",
    description: "Fork the current session",
    aliases: ["session-fork"],
    execute: async (args, ctx) => {
      const { forkSession: forkSession2, loadSession: loadSession2 } = await Promise.resolve().then(() => (init_manager(), exports_manager));
      const parent = loadSession2(ctx.sessionId);
      if (!parent)
        return "❌ Session not found";
      const reason = args.join(" ") || undefined;
      const forked = forkSession2(ctx.sessionId, reason);
      if (forked) {
        return `✅ Forked session: ${forked.id}
Resume with: nole-code --session ${forked.id}`;
      }
      return "❌ Failed to fork session";
    }
  });
  registerCommand({
    name: "team",
    description: "Create or manage a team of agents",
    execute: async (args, ctx) => {
      const { createTeam: createTeam2, getAllTeams: getAllTeams2, sendTeamMessage: sendTeamMessage2 } = await Promise.resolve().then(() => (init_team(), exports_team));
      const action = args[0];
      if (action === "create") {
        const name = args[1] || "my-team";
        const team = await createTeam2({ name, parentSessionId: ctx.sessionId });
        return `✅ Team created: ${team.name} (${team.id})`;
      }
      if (action === "list") {
        const allTeams = getAllTeams2();
        if (allTeams.length === 0)
          return "No teams created yet";
        return allTeams.map((t) => `${t.name} (${t.id}) - ${t.members.size} members`).join(`
`);
      }
      if (action === "send") {
        const [to, ...msgParts] = args.slice(1);
        if (!to || msgParts.length === 0)
          return "Usage: /team send <to> <message>";
        return "⚠️ Send requires specifying a team ID";
      }
      return `Usage:
  /team create <name>
  /team list
  /team send <to> <message>`;
    }
  });
  registerCommand({
    name: "agents",
    description: "List and manage running agents",
    aliases: ["tasks"],
    execute: async (args, ctx) => {
      const { getAllAgents: getAllAgents2, killAgent: killAgent2 } = await Promise.resolve().then(() => (init_spawner(), exports_spawner));
      const action = args[0];
      const agents2 = getAllAgents2();
      if (action === "kill" && args[1]) {
        const killed = killAgent2(args[1]);
        return killed ? `✅ Killed ${args[1]}` : `❌ Agent ${args[1]} not found`;
      }
      if (agents2.length === 0)
        return "No active agents";
      return agents2.map((a) => `[${a.status.toUpperCase()}] ${a.id}: ${a.description} (PID: ${a.pid || "N/A"})`).join(`
`);
    }
  });
  registerCommand({
    name: "plan",
    description: "Enter plan mode for step-by-step approval",
    aliases: ["steps"],
    execute: async (args, ctx) => {
      const goal = args.join(" ") || "Build and verify the requested feature";
      const { enterPlanMode: enterPlanMode2, getCurrentPlan: getCurrentPlan2, displayPlan: displayPlan2, isPlanModeActive: isPlanModeActive2 } = await Promise.resolve().then(() => (init_plan(), exports_plan));
      if (isPlanModeActive2()) {
        const plan2 = getCurrentPlan2();
        if (plan2) {
          displayPlan2(plan2);
          return "Use /plan approve, /plan deny, /plan skip, or /plan abort";
        }
      }
      const { generatePlanSteps: generatePlanSteps2 } = await Promise.resolve().then(() => (init_plan(), exports_plan));
      const steps = generatePlanSteps2(goal);
      const plan = enterPlanMode2(goal, steps);
      return `\uD83D\uDCCB Plan created: ${plan.title}
${plan.steps.length} steps identified.
Use /plan approve to proceed step by step.`;
    }
  });
  registerCommand({
    name: "compact",
    description: "Compact session to reduce token usage",
    aliases: ["compress"],
    execute: async (_args, ctx) => {
      const { compactSession: compactSession2 } = await Promise.resolve().then(() => (init_manager(), exports_manager));
      const compacted = compactSession2(ctx.sessionId, 5);
      if (compacted) {
        const before = compacted.messages.length;
        return `✅ Session compacted (kept last 5 tool results)`;
      }
      return "❌ Failed to compact session";
    }
  });
  registerCommand({
    name: "onboarding",
    description: "Show project onboarding status",
    aliases: ["setup"],
    execute: async (_args, ctx) => {
      const { getOnboardingSteps: getOnboardingSteps2, isOnboardingComplete: isOnboardingComplete2 } = await Promise.resolve().then(() => (init_onboarding(), exports_onboarding));
      const steps = getOnboardingSteps2(ctx.cwd);
      const done = isOnboardingComplete2(ctx.cwd);
      const lines = [`\uD83E\uDD9E Project Setup:
`];
      for (const s of steps) {
        const icon = s.isComplete ? "✅" : s.isEnabled ? "⬜" : "\uD83D\uDD12";
        lines.push(`  ${icon} ${s.text}`);
      }
      if (done)
        lines.push(`
✅ Project setup complete!`);
      return lines.join(`
`);
    }
  });
  registerCommand({
    name: "export",
    description: "Export conversation as markdown file",
    aliases: ["save-chat"],
    execute: async (_args, ctx) => {
      const { loadSession: load, exportSession: exportSession2 } = await Promise.resolve().then(() => (init_manager(), exports_manager));
      const { writeFileSync: writeFileSync7 } = __require("fs");
      const { join: join12 } = __require("path");
      const transcript = exportSession2(ctx.sessionId);
      if (!transcript)
        return "Session not found";
      const filename = `nole-session-${ctx.sessionId.slice(5, 15)}.md`;
      const outPath = join12(ctx.cwd, filename);
      writeFileSync7(outPath, transcript, "utf-8");
      return `Exported to ${filename} (${transcript.split(`
`).length} lines)`;
    }
  });
  registerCommand({
    name: "changes",
    description: "Show all files changed in this session (git diff from session start)",
    aliases: ["review"],
    execute: async (_args, ctx) => {
      const { execFileSync } = __require("child_process");
      try {
        const stat = execFileSync("git", ["diff", "--stat"], { encoding: "utf-8", cwd: ctx.cwd }).trim();
        const diffOutput = execFileSync("git", ["diff", "--name-status"], { encoding: "utf-8", cwd: ctx.cwd }).trim();
        if (!stat && !diffOutput) {
          const staged = execFileSync("git", ["diff", "--cached", "--name-status"], { encoding: "utf-8", cwd: ctx.cwd }).trim();
          if (!staged)
            return "No changes detected.";
          return `Staged changes:
${staged}`;
        }
        const lines = [`Files changed:
`];
        for (const line of diffOutput.split(`
`)) {
          if (!line)
            continue;
          const [status, ...fileParts] = line.split("\t");
          const file = fileParts.join("\t");
          const icon = status === "M" ? "\x1B[33mM\x1B[0m" : status === "A" ? "\x1B[32mA\x1B[0m" : status === "D" ? "\x1B[31mD\x1B[0m" : status === "R" ? "\x1B[36mR\x1B[0m" : status;
          lines.push(`  ${icon} ${file}`);
        }
        lines.push(`
${stat.split(`
`).pop() || ""}`);
        return lines.join(`
`);
      } catch {
        return "Not a git repository or no changes.";
      }
    }
  });
  registerCommand({
    name: "new",
    description: "Start a fresh session (discards current context)",
    aliases: ["reset"],
    execute: async (_args, ctx) => {
      const { createSession: create, saveSession: save } = await Promise.resolve().then(() => (init_manager(), exports_manager));
      const session = create(ctx.cwd);
      return `New session: ${session.id}
Restart nole to use it, or /fork to keep the current one.`;
    }
  });
  registerCommand({
    name: "settings",
    description: "View or change settings (model, temperature, maxTokens)",
    aliases: ["config", "set"],
    execute: async (args) => {
      const { loadSettings: loadSettings2, saveSettings: saveSettings2 } = await Promise.resolve().then(() => (init_onboarding(), exports_onboarding));
      const current = loadSettings2();
      if (args.length === 0) {
        return `Current Settings:

  model:        ${current.model || "MiniMax-M2.7"}
  temperature:  ${current.temperature ?? 0.7}
  maxTokens:    ${current.maxTokens ?? 4096}
  maxTurns:     ${current.maxTurns ?? 50}
  shell:        ${current.shell || "/bin/bash"}
  autoSave:     ${current.autoSaveSession ?? true}
  permissions:  ${current.toolPermissions || "all"}

Usage: /settings <key> <value>`;
      }
      const [key, ...valueParts] = args;
      const value = valueParts.join(" ");
      if (!value)
        return `Usage: /settings ${key} <value>`;
      const updates = {};
      switch (key) {
        case "model":
          updates.model = value;
          break;
        case "temperature":
        case "temp":
          const temp = parseFloat(value);
          if (isNaN(temp) || temp < 0 || temp > 2)
            return "Temperature must be 0-2";
          updates.temperature = temp;
          break;
        case "maxTokens":
        case "max_tokens":
        case "tokens":
          const tokens = parseInt(value);
          if (isNaN(tokens) || tokens < 256)
            return "maxTokens must be >= 256";
          updates.maxTokens = tokens;
          break;
        case "maxTurns":
        case "max_turns":
        case "turns":
          const turns = parseInt(value);
          if (isNaN(turns) || turns < 5)
            return "maxTurns must be >= 5";
          updates.maxTurns = turns;
          break;
        case "permissions":
          if (!["all", "ask", "none"].includes(value))
            return "permissions must be: all, ask, or none";
          updates.toolPermissions = value;
          break;
        default:
          return `Unknown setting: ${key}. Available: model, temperature, maxTokens, maxTurns, permissions`;
      }
      saveSettings2(updates);
      return `Updated ${key} = ${value}`;
    }
  });
  registerCommand({
    name: "undo",
    description: "Remove the last user message and assistant response",
    aliases: ["pop"],
    execute: async (_args, ctx) => {
      const { loadSession: load, saveSession: save } = await Promise.resolve().then(() => (init_manager(), exports_manager));
      const session = load(ctx.sessionId);
      if (!session)
        return "Session not found";
      let removed = 0;
      while (session.messages.length > 1) {
        const last = session.messages[session.messages.length - 1];
        if (last.role === "system")
          break;
        if (last.role === "user" && removed > 0) {
          session.messages.pop();
          removed++;
          break;
        }
        session.messages.pop();
        removed++;
      }
      if (removed === 0)
        return "Nothing to undo";
      save(session);
      return `Removed ${removed} messages. Session rolled back.`;
    }
  });
  registerCommand({
    name: "model",
    description: "Switch the LLM model mid-session",
    execute: async (args) => {
      if (args.length === 0) {
        const { loadSettings: loadSettings2 } = await Promise.resolve().then(() => (init_onboarding(), exports_onboarding));
        const s = loadSettings2();
        return `Current model: ${s.model || "MiniMax-M2.7"}

Usage: /model <name>
Examples: /model MiniMax-M2.7, /model MiniMax-Text-01`;
      }
      const { saveSettings: saveSettings2 } = await Promise.resolve().then(() => (init_onboarding(), exports_onboarding));
      const model = args.join(" ");
      saveSettings2({ model });
      try {
        const { activeClient } = await Promise.resolve().then(() => (init_src(), exports_src));
        if (activeClient)
          activeClient.setModel(model);
      } catch {}
      return `Model switched to: ${model} (active now)`;
    }
  });
  registerCommand({
    name: "replay",
    description: "Replay a session — shows the conversation without re-executing",
    execute: async (args, ctx) => {
      const { loadSession: load } = await Promise.resolve().then(() => (init_manager(), exports_manager));
      const id = args[0] || ctx.sessionId;
      const session = load(id);
      if (!session)
        return `Session not found: ${id}`;
      const lines = [`Session: ${session.id}`, `Created: ${session.createdAt}`, ""];
      for (const msg of session.messages) {
        if (msg.role === "system")
          continue;
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        if (msg.role === "user") {
          lines.push(`\x1B[34m> ${content.slice(0, 200)}\x1B[0m`);
        } else if (msg.role === "assistant") {
          lines.push(`\x1B[35m${content.slice(0, 300)}\x1B[0m`);
        } else if (msg.role === "tool") {
          lines.push(`\x1B[33m  [${msg.name}] ${content.slice(0, 100)}\x1B[0m`);
        }
      }
      lines.push(`
${session.messages.length} messages total.`);
      return lines.join(`
`);
    }
  });
  registerCommand({
    name: "audit",
    description: "Show recent tool execution log",
    execute: async (args, ctx) => {
      const { getAuditLog: getAuditLog2 } = await Promise.resolve().then(() => (init_audit(), exports_audit));
      const limit = parseInt(args[0]) || 20;
      const entries = getAuditLog2(limit, args.includes("--session") ? ctx.sessionId : undefined);
      if (entries.length === 0)
        return "No audit entries.";
      const lines = entries.map((e) => {
        const time3 = e.timestamp.slice(11, 19);
        const err = e.isError ? " \x1B[31mERR\x1B[0m" : "";
        const preview = Object.values(e.input)[0];
        const inputStr = preview ? String(preview).slice(0, 40) : "";
        return `  ${time3} ${e.tool.padEnd(12)} ${e.durationMs}ms ${inputStr}${err}`;
      });
      return `Audit log (last ${entries.length}):

${lines.join(`
`)}`;
    }
  });
  registerCommand({
    name: "plugins",
    description: "List installed plugins",
    execute: async () => {
      const { existsSync: existsSync11, readdirSync: readdirSync3 } = __require("fs");
      const { join: join12 } = __require("path");
      const { homedir: homedir11 } = __require("os");
      const dir = join12(homedir11(), ".nole-code", "plugins");
      if (!existsSync11(dir)) {
        return `No plugins directory.
Create ~/.nole-code/plugins/ and add .js files.

Example plugin:
  module.exports = {
    name: 'Hello',
    description: 'Say hello',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    execute: async (input) => 'Hello, ' + input.name
  }`;
      }
      const files = readdirSync3(dir).filter((f) => f.endsWith(".js"));
      if (files.length === 0)
        return `No plugins installed.
Add .js files to ~/.nole-code/plugins/`;
      return `Installed plugins:
${files.map((f) => "  " + f).join(`
`)}`;
    }
  });
  registerCommand({
    name: "context",
    description: "Show current session context — tokens, messages, model, git",
    aliases: ["info", "stats"],
    execute: async (_args, ctx) => {
      const { loadSession: load } = await Promise.resolve().then(() => (init_manager(), exports_manager));
      const { estimateTotalTokens: estimateTotalTokens2 } = await Promise.resolve().then(() => exports_count_tokens);
      const { loadSettings: loadSettings2 } = await Promise.resolve().then(() => (init_onboarding(), exports_onboarding));
      const { costTracker: costTracker2 } = await Promise.resolve().then(() => (init_cost(), exports_cost));
      const { execFileSync } = __require("child_process");
      const session = load(ctx.sessionId);
      if (!session)
        return "Session not found";
      const settings = loadSettings2();
      const tokens = estimateTotalTokens2(session.messages);
      const maxTokens = 50000;
      const percent = Math.round(tokens / maxTokens * 100);
      const bar = "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5));
      const userMsgs = session.messages.filter((m) => m.role === "user").length;
      const assistantMsgs = session.messages.filter((m) => m.role === "assistant").length;
      const toolMsgs = session.messages.filter((m) => m.role === "tool").length;
      const sessionCost = costTracker2.getCurrentSession();
      let git = "";
      try {
        const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf-8", cwd: ctx.cwd }).trim();
        const status = execFileSync("git", ["status", "--short"], { encoding: "utf-8", cwd: ctx.cwd }).trim();
        const changed = status ? status.split(`
`).length : 0;
        if (branch)
          git = `
  Git:       ${branch}${changed ? ` (${changed} changed)` : " (clean)"}`;
      } catch {}
      return `Session Context:

  Session:   ${session.id}
  Model:     ${settings.model || "MiniMax-M2.7"}
  CWD:       ${session.cwd || ctx.cwd}${git}
  Messages:  ${session.messages.length} (${userMsgs} user, ${assistantMsgs} assistant, ${toolMsgs} tool)
  Tokens:    [${bar}] ~${tokens}/${maxTokens} (${percent}%)
  Created:   ${new Date(session.createdAt).toLocaleString()}
` + (sessionCost ? `  Requests:  ${sessionCost.requests} (${sessionCost.inputTokens} in, ${sessionCost.outputTokens} out)
` : "") + (session.parentId ? `  Forked:    ${session.parentId}
` : "");
    }
  });
});

// src/ui/output/styles.ts
function bold(text) {
  return `${ESC}1m${text}${ESC}0m`;
}
function dim(text) {
  return `${ESC}2m${text}${ESC}0m`;
}
function italic(text) {
  return `${ESC}3m${text}${ESC}0m`;
}
function underline(text) {
  return `${ESC}4m${text}${ESC}0m`;
}
function divider(char = "─", length = 80) {
  return `${ESC}2m${char.repeat(length)}${ESC}0m`;
}
function tokenBudgetDisplay(used, max) {
  const percent = Math.round(used / max * 100);
  const barLength = 20;
  const filled = Math.round(used / max * barLength);
  const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
  const color = percent > 80 ? "91" : percent > 60 ? "93" : "92";
  return `${c2.dim("[")}${ESC}${color}m${bar}${ESC}0m${c2.dim(`] ${used}/${max} tokens (${percent}%)`)}`;
}
var ESC = "\x1B[", c2;
var init_styles = __esm(() => {
  c2 = {
    black: (text) => `${ESC}30m${text}${ESC}0m`,
    red: (text) => `${ESC}31m${text}${ESC}0m`,
    green: (text) => `${ESC}32m${text}${ESC}0m`,
    yellow: (text) => `${ESC}33m${text}${ESC}0m`,
    blue: (text) => `${ESC}34m${text}${ESC}0m`,
    magenta: (text) => `${ESC}35m${text}${ESC}0m`,
    cyan: (text) => `${ESC}36m${text}${ESC}0m`,
    white: (text) => `${ESC}37m${text}${ESC}0m`,
    gray: (text) => `${ESC}90m${text}${ESC}0m`,
    brightRed: (text) => `${ESC}91m${text}${ESC}0m`,
    brightGreen: (text) => `${ESC}92m${text}${ESC}0m`,
    brightYellow: (text) => `${ESC}93m${text}${ESC}0m`,
    brightBlue: (text) => `${ESC}94m${text}${ESC}0m`,
    brightMagenta: (text) => `${ESC}95m${text}${ESC}0m`,
    brightCyan: (text) => `${ESC}96m${text}${ESC}0m`,
    primary: (text) => `${ESC}96m${text}${ESC}0m`,
    secondary: (text) => `${ESC}33m${text}${ESC}0m`,
    success: (text) => `${ESC}92m${text}${ESC}0m`,
    error: (text) => `${ESC}91m${text}${ESC}0m`,
    warning: (text) => `${ESC}93m${text}${ESC}0m`,
    info: (text) => `${ESC}94m${text}${ESC}0m`,
    user: (text) => `${ESC}94m${text}${ESC}0m`,
    assistant: (text) => `${ESC}95m${text}${ESC}0m`,
    tool: (text) => `${ESC}93m${text}${ESC}0m`,
    system: (text) => `${ESC}90m${text}${ESC}0m`,
    bold,
    dim,
    italic,
    underline,
    reset: () => `${ESC}0m`
  };
});

// src/session-memory/index.ts
var exports_session_memory = {};
__export(exports_session_memory, {
  updateMemorySection: () => updateMemorySection,
  saveMemory: () => saveMemory,
  parseMemoryContent: () => parseMemoryContent,
  loadMemory: () => loadMemory,
  getMemorySummary: () => getMemorySummary,
  getMemoryPath: () => getMemoryPath,
  formatMemory: () => formatMemory,
  extractMemoryFromConversation: () => extractMemoryFromConversation,
  addToWorklog: () => addToWorklog
});
import { existsSync as existsSync11, readFileSync as readFileSync11, writeFileSync as writeFileSync7, mkdirSync as mkdirSync7 } from "fs";
import { join as join12 } from "path";
import { homedir as homedir11 } from "os";
function getMemoryPath(sessionId) {
  mkdirSync7(MEMORY_DIR, { recursive: true });
  return join12(MEMORY_DIR, `${sessionId}.md`);
}
function loadMemory(sessionId) {
  const path = getMemoryPath(sessionId);
  if (!existsSync11(path)) {
    return {
      title: "",
      currentState: "",
      taskSpec: "",
      filesAndFunctions: "",
      workflow: "",
      errorsAndFixes: "",
      keyResults: "",
      worklog: "",
      lastUpdated: new Date().toISOString()
    };
  }
  const content = readFileSync11(path, "utf-8");
  return parseMemoryContent(content);
}
function parseMemoryContent(content) {
  const sections = {
    title: extractSection(content, "Session Title"),
    currentState: extractSection(content, "Current State"),
    taskSpec: extractSection(content, "Task Specification"),
    filesAndFunctions: extractSection(content, "Files and Functions"),
    workflow: extractSection(content, "Workflow"),
    errorsAndFixes: extractSection(content, "Errors & Fixes"),
    keyResults: extractSection(content, "Key Results"),
    worklog: extractSection(content, "Worklog")
  };
  return {
    ...sections,
    lastUpdated: new Date().toISOString()
  };
}
function extractSection(content, sectionName) {
  const lines = content.split(`
`);
  let inSection = false;
  const sectionLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === `# ${sectionName}` || trimmed === `## ${sectionName}`) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (line.startsWith("# ") || line.startsWith("## ")) {
        break;
      }
      sectionLines.push(line);
    }
  }
  return sectionLines.join(`
`).trim();
}
function saveMemory(sessionId, memory) {
  const existing = loadMemory(sessionId);
  const merged = { ...existing, ...memory, lastUpdated: new Date().toISOString() };
  const path = getMemoryPath(sessionId);
  const content = formatMemory(merged);
  writeFileSync7(path, content, "utf-8");
}
function formatMemory(memory) {
  return `# Session Title
${memory.title || "_Short descriptive title_"}

# Current State
${memory.currentState || "_What is being worked on_"}

# Task Specification
${memory.taskSpec || "_What was asked to build_"}

# Files and Functions
${memory.filesAndFunctions || "_Important files and their purpose_"}

# Workflow
${memory.workflow || "_Bash commands and their purpose_"}

# Errors & Fixes
${memory.errorsAndFixes || "_Errors encountered and solutions_"}

# Key Results
${memory.keyResults || "_Specific outputs created_"}

# Worklog
${memory.worklog || "_Step-by-step summary of actions_"}

---
_Last updated: ${memory.lastUpdated}_
`;
}
function updateMemorySection(sessionId, section, content, append = false) {
  const memory = loadMemory(sessionId);
  const existing = memory[section] || "";
  const newContent = append && existing ? `${existing}
- ${content}` : content;
  saveMemory(sessionId, { [section]: newContent });
}
function addToWorklog(sessionId, entry) {
  const memory = loadMemory(sessionId);
  const timestamp = new Date().toISOString().slice(11, 19);
  const logEntry = `[${timestamp}] ${entry}`;
  const existing = memory.worklog || "";
  saveMemory(sessionId, {
    worklog: existing ? `${existing}
${logEntry}` : logEntry
  });
}
async function extractMemoryFromConversation(messages, sessionId) {
  const BLOCKED_PREFIXES = ["/dev/", "/tmp/", "/proc/", "/sys/", "/.ssh/"];
  const filePatterns = [
    /(?:Created|Wrote|Saved|Modified|Edited)\s+([^\s'"`\n]+)/gi,
    /(?:File|Path):\s+([^\s'"`\n]+)/gi
  ];
  const files = new Set;
  for (const msg of messages) {
    const text = typeof msg.content === "string" ? msg.content : "";
    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const file = match[1].trim();
        if (file.length > 1 && !BLOCKED_PREFIXES.some((p) => file.startsWith(p)) && !file.startsWith("http") && !file.match(/^[0-9a-f]{8,}/i)) {
          files.add(file);
        }
      }
    }
  }
  const errorPattern = /(?:Error|error|failed|Failed|exception):\s*(.+)/gi;
  const errors3 = [];
  for (const msg of messages) {
    const text = typeof msg.content === "string" ? msg.content : "";
    let match;
    while ((match = errorPattern.exec(text)) !== null) {
      errors3.push(match[1].trim().slice(0, 100));
    }
  }
  if (files.size > 0) {
    updateMemorySection(sessionId, "filesAndFunctions", Array.from(files).join(", "), true);
  }
  if (errors3.length > 0) {
    updateMemorySection(sessionId, "errorsAndFixes", errors3.slice(-5).join(" | "), true);
  }
}
function getMemorySummary(sessionId) {
  const memory = loadMemory(sessionId);
  if (!memory.title && !memory.currentState && !memory.worklog) {
    return "";
  }
  const parts = [];
  if (memory.title) {
    parts.push(`Session: ${memory.title}`);
  }
  if (memory.currentState) {
    parts.push(`Current: ${memory.currentState}`);
  }
  if (memory.filesAndFunctions) {
    parts.push(`Files: ${memory.filesAndFunctions}`);
  }
  if (memory.errorsAndFixes) {
    parts.push(`Errors: ${memory.errorsAndFixes}`);
  }
  return parts.join(" | ");
}
var MEMORY_DIR;
var init_session_memory = __esm(() => {
  MEMORY_DIR = join12(homedir11(), ".nole-code", "memory");
});

// src/services/compact/index.ts
var exports_compact = {};
__export(exports_compact, {
  needsCompaction: () => needsCompaction,
  maybeCompact: () => maybeCompact,
  getTokenBudget: () => getTokenBudget,
  compactSession: () => compactSession2
});
function needsCompaction(messages) {
  if (!feature("SESSION_COMPACT"))
    return false;
  const totalTokens = estimateTotalTokens(messages);
  return totalTokens > COMPACT_CONFIG.maxTokens * COMPACT_CONFIG.compactThreshold;
}
function getTokenBudget(messages) {
  const used = estimateTotalTokens(messages);
  const max = COMPACT_CONFIG.maxTokens;
  return {
    used,
    max,
    percent: Math.round(used / max * 100),
    needsCompact: needsCompaction(messages)
  };
}
function compactSession2(messages, sessionId) {
  const originalTokens = estimateTotalTokens(messages);
  if (originalTokens < COMPACT_CONFIG.maxTokens) {
    return {
      originalTokens,
      compactedTokens: originalTokens,
      messagesPruned: 0,
      summary: "No compaction needed"
    };
  }
  const systemMessages = messages.filter((m) => m.role === "system");
  const recentCutoff = COMPACT_CONFIG.minMessages;
  const recentMessages = messages.slice(-recentCutoff);
  const olderMessages = messages.slice(0, -recentCutoff);
  const summary = generateSessionSummary(olderMessages);
  const compressedRecent = recentMessages.map((msg) => {
    if (msg.role === "tool" && typeof msg.content === "string" && msg.content.length > 2000) {
      return {
        ...msg,
        content: compressToolResult(msg.content)
      };
    }
    return msg;
  });
  const compactedMessages = [
    ...systemMessages,
    {
      role: "system",
      content: `[Previous session context summarized]

${summary}`,
      timestamp: new Date().toISOString()
    },
    ...compressedRecent
  ];
  const compactedTokens = estimateTotalTokens(compactedMessages);
  const messagesPruned = messages.length - compactedMessages.length;
  messages.length = 0;
  messages.push(...compactedMessages);
  addToWorklog(sessionId, `Session compacted: ${originalTokens - compactedTokens} tokens saved`);
  console.log(`
\uD83D\uDCE6 Session compacted:`);
  console.log(`   Before: ${originalTokens} tokens`);
  console.log(`   After: ${compactedTokens} tokens`);
  console.log(`   Pruned: ${messagesPruned} messages
`);
  return {
    originalTokens,
    compactedTokens,
    messagesPruned,
    summary
  };
}
function generateSessionSummary(messages) {
  if (messages.length === 0)
    return "";
  const toolResults = messages.filter((m) => m.role === "tool").map((m) => {
    const text = typeof m.content === "string" ? m.content : "";
    const firstLine = text.split(`
`)[0] || "";
    return firstLine.slice(0, 100);
  }).slice(-10);
  const filesCreated = extractFilesCreated(messages);
  const errors3 = extractErrors(messages);
  let summary = `Session had ${messages.length} messages. `;
  if (filesCreated.length > 0) {
    summary += `Files created/modified: ${filesCreated.join(", ")}. `;
  }
  if (toolResults.length > 0) {
    summary += `Recent operations: ${toolResults.join(" | ")}. `;
  }
  if (errors3.length > 0) {
    summary += `Errors encountered: ${errors3.slice(0, 3).join(", ")}. `;
  }
  return summary || "Coding session with various file operations and tool executions.";
}
function extractFilesCreated(messages) {
  const BLOCKED_PREFIXES = ["/dev/", "/tmp/", "/proc/", "/sys/", "/.ssh/"];
  const patterns = [
    /(?:Created|Wrote|Saved|Modified|Edited)\s+([^\s'"`\n]+)/gi,
    /(?:File|Path):\s+([^\s'"`\n]+)/gi
  ];
  const files = new Set;
  for (const msg of messages) {
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(msg.content)) !== null) {
        const file = match[1].trim();
        if (file.length > 1 && !BLOCKED_PREFIXES.some((p) => file.startsWith(p)) && !file.startsWith("http") && !file.match(/^[0-9a-f]{8,}/i)) {
          files.add(file);
        }
      }
    }
  }
  return Array.from(files).slice(0, 10);
}
function extractErrors(messages) {
  const errors3 = [];
  for (const msg of messages) {
    const errText = typeof msg.content === "string" ? msg.content : "";
    if (msg.isError || /error|failed|exception/i.test(errText)) {
      const firstLine = errText.split(`
`)[0] || "";
      errors3.push(firstLine.slice(0, 80));
    }
  }
  return errors3;
}
function compressToolResult(content) {
  const lines = content.split(`
`);
  if (lines.length <= 20)
    return content;
  const keptLines = lines.slice(0, 5);
  const droppedLines = lines.slice(5);
  const lastLines = lines.slice(-3);
  const summary = `[... ${droppedLines.length} lines omitted ...]
` + `Last ${lastLines.length} lines: ${lastLines.join(" | ").slice(0, 150)}`;
  return [...keptLines, summary].join(`
`);
}
function maybeCompact(messages, sessionId) {
  if (!feature("AUTO_COMPACT"))
    return false;
  if (!needsCompaction(messages))
    return false;
  compactSession2(messages, sessionId);
  return true;
}
var COMPACT_CONFIG;
var init_compact = __esm(() => {
  init_session_memory();
  init_feature_flags();
  COMPACT_CONFIG = {
    minTokens: 8000,
    maxTokens: 1e5,
    minMessages: 10,
    systemPromptTokens: 2000,
    compactThreshold: 0.8
  };
});

// src/ui/output/verbose.ts
function initVerboseOutput() {
  isVerbose = feature("VERBOSE_OUTPUT");
  showTimings = feature("TOOL_TIMING");
  streamingEnabled = feature("TOOL_RESULT_STREAMING");
  if (isVerbose) {
    console.log(c2.dim(`
\uD83D\uDD0D Verbose output enabled
`));
  }
}
function setVerbose(enabled) {
  isVerbose = enabled;
}
function setShowTimings(enabled) {
  showTimings = enabled;
}
function printTokenBudget(messages) {
  if (!feature("AUTO_COMPACT") && !feature("SESSION_COMPACT"))
    return;
  const budget = getTokenBudget(messages);
  console.log(c2.dim(`
${tokenBudgetDisplay(budget.used, budget.max)}
`));
}
function printContextHeader(sessionInfo) {
  if (!isVerbose)
    return;
  console.log(c2.dim(divider()));
  console.log(`Session: ${sessionInfo.sessionId}`);
  console.log(`CWD: ${sessionInfo.cwd}`);
  console.log(`Model: ${sessionInfo.model}`);
  console.log(c2.dim(divider()));
}
function printError(message, options = {}) {
  const { details, stack } = options;
  console.error(`
${c2.red("✗ Error:")} ${message}`);
  if (details && isVerbose) {
    console.error(`  ${c2.dim(details)}`);
  }
  if (stack && isVerbose) {
    console.error(c2.dim(stack));
  }
}
function printWarning(message) {
  console.log(`
${c2.yellow("⚠")} ${message}
`);
}
var isVerbose = false, showTimings = false, streamingEnabled = false;
var init_verbose = __esm(() => {
  init_styles();
  init_feature_flags();
  init_compact();
});

// src/ui/output/spinner.ts
function formatVerboseResult(toolName, result, options = {}) {
  const {
    isError = false,
    timestamp,
    maxLines = 50,
    streaming = false
  } = options;
  const parts = [];
  const green = "\x1B[32m";
  const red = "\x1B[31m";
  const dim2 = "\x1B[2m";
  const reset = "\x1B[0m";
  const bold2 = "\x1B[1m";
  const status = isError ? `${red}✗${reset}` : `${green}✓${reset}`;
  let timingStr = "";
  if (timestamp !== undefined) {
    const elapsed = Date.now() - timestamp;
    timingStr = elapsed > 1000 ? ` ${dim2}[${(elapsed / 1000).toFixed(1)}s]${reset}` : ` ${dim2}[${elapsed}ms]${reset}`;
  }
  parts.push(`  ${status} ${bold2}${toolName}${reset}${timingStr}`);
  const lines = result.split(`
`);
  const truncated = lines.length > maxLines;
  const displayLines = truncated ? lines.slice(0, maxLines) : lines;
  if (displayLines.length > 0) {
    parts.push("");
    for (const line of displayLines) {
      const displayLine = line.length > 120 ? line.slice(0, 117) + "..." : line;
      parts.push(`  ${dim2}${displayLine}${reset}`);
    }
    if (truncated) {
      parts.push(`  ${dim2}+${lines.length - maxLines} more lines${reset}`);
    }
  }
  return parts.join(`
`);
}
var init_spinner = __esm(() => {
  init_feature_flags();
});

// src/ui/output/streaming.ts
function formatCancelled(reason) {
  return `${yellow}${CANCELLED}: ${reason}${reset}`;
}
function formatShortcuts() {
  return `${dim2}Esc to cancel · ctrl+e to explain · ctrl+o to expand${reset}`;
}
var CANCELLED = "⏱ Cancelled", dim2 = "\x1B[2m", reset = "\x1B[0m", yellow = "\x1B[33m";
var init_streaming = __esm(() => {
  init_spinner();
});

// src/ui/markdown.ts
function renderInline(text) {
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, `${BOLD}${ITALIC}$1${RESET}`);
  text = text.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`);
  text = text.replace(/(?<![/\w])\*([^*\n]+?)\*(?![/\w])/g, `${ITALIC}$1${RESET}`);
  text = text.replace(/`([^`\n]+?)`/g, `${GREEN}$1${RESET}`);
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `${UNDERLINE}$1${RESET} ${DIM}($2)${RESET}`);
  text = text.replace(/~~(.+?)~~/g, `${DIM}$1${RESET}`);
  return text;
}
function createStreamingMarkdown() {
  let buffer = "";
  let inCodeBlock = false;
  return {
    write(chunk) {
      buffer += chunk;
      while (buffer.includes(`
`)) {
        const idx = buffer.indexOf(`
`);
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.trimStart().startsWith("```")) {
          if (!inCodeBlock) {
            inCodeBlock = true;
            const lang = line.trim().slice(3).trim();
            process.stdout.write(`${DIM}┌─${lang ? ` ${lang} ` : ""}${"─".repeat(Math.max(0, 60 - (lang?.length || 0)))}${RESET}
`);
          } else {
            inCodeBlock = false;
            process.stdout.write(`${DIM}└${"─".repeat(62)}${RESET}
`);
          }
          continue;
        }
        if (inCodeBlock) {
          process.stdout.write(`${DIM}│${RESET} ${GREEN}${line}${RESET}
`);
          continue;
        }
        if (line.startsWith("### ")) {
          process.stdout.write(`${BOLD}${CYAN}   ${line.slice(4)}${RESET}
`);
          continue;
        }
        if (line.startsWith("## ")) {
          process.stdout.write(`${BOLD}${CYAN}  ${line.slice(3)}${RESET}
`);
          continue;
        }
        if (line.startsWith("# ")) {
          process.stdout.write(`${BOLD}${CYAN}${line.slice(2)}${RESET}
`);
          continue;
        }
        if (/^[-*_]{3,}\s*$/.test(line)) {
          process.stdout.write(`${DIM}${"─".repeat(60)}${RESET}
`);
          continue;
        }
        process.stdout.write(renderInline(line) + `
`);
      }
    },
    flush() {
      if (buffer) {
        if (inCodeBlock) {
          process.stdout.write(`${DIM}│${RESET} ${GREEN}${buffer}${RESET}`);
        } else {
          process.stdout.write(renderInline(buffer));
        }
        buffer = "";
      }
      if (inCodeBlock) {
        process.stdout.write(`
${DIM}└${"─".repeat(62)}${RESET}
`);
      }
    }
  };
}
var ESC2 = "\x1B[", RESET, BOLD, DIM, ITALIC, UNDERLINE, CYAN, GREEN, YELLOW, GRAY, BLUE, MAGENTA;
var init_markdown = __esm(() => {
  RESET = `${ESC2}0m`;
  BOLD = `${ESC2}1m`;
  DIM = `${ESC2}2m`;
  ITALIC = `${ESC2}3m`;
  UNDERLINE = `${ESC2}4m`;
  CYAN = `${ESC2}36m`;
  GREEN = `${ESC2}32m`;
  YELLOW = `${ESC2}33m`;
  GRAY = `${ESC2}90m`;
  BLUE = `${ESC2}34m`;
  MAGENTA = `${ESC2}35m`;
});

// src/plugins/loader.ts
var exports_loader = {};
__export(exports_loader, {
  loadPlugins: () => loadPlugins
});
import { existsSync as existsSync12, readdirSync as readdirSync3 } from "fs";
import { join as join13 } from "path";
import { homedir as homedir12 } from "os";
async function loadPlugins() {
  if (!existsSync12(PLUGINS_DIR))
    return [];
  const files = readdirSync3(PLUGINS_DIR).filter((f) => f.endsWith(".js"));
  const loaded = [];
  for (const file of files) {
    try {
      const pluginPath = join13(PLUGINS_DIR, file);
      const plugin = __require(pluginPath);
      if (!plugin.name || !plugin.execute) {
        console.error(`Plugin ${file}: missing name or execute`);
        continue;
      }
      registerTool({
        name: plugin.name,
        description: plugin.description || `Plugin: ${plugin.name}`,
        inputSchema: plugin.inputSchema || { type: "object", properties: {}, required: [] },
        execute: async (input, ctx) => {
          try {
            return await plugin.execute(input, ctx);
          } catch (err) {
            return `Plugin error (${plugin.name}): ${err}`;
          }
        }
      });
      loaded.push(plugin.name);
    } catch (err) {
      console.error(`Failed to load plugin ${file}: ${err}`);
    }
  }
  return loaded;
}
var PLUGINS_DIR;
var init_loader = __esm(() => {
  init_registry();
  PLUGINS_DIR = join13(homedir12(), ".nole-code", "plugins");
});

// src/index.ts
var exports_src = {};
__export(exports_src, {
  activeClient: () => activeClient
});
import { existsSync as existsSync13, readFileSync as readFileSync12, mkdirSync as mkdirSync8 } from "fs";
import { homedir as homedir13 } from "node:os";
import { join as join14 } from "node:path";
import * as readline2 from "readline";
async function streamOutput(lines, maxLines, delayMs = 10) {
  const shown = [];
  const truncated = lines.length > maxLines;
  const toShow = truncated ? lines.slice(0, maxLines) : lines;
  for (let i = 0;i < toShow.length; i++) {
    shown.push(toShow[i]);
    if (i > 0 || delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    if (i === 0) {
      process.stdout.write("  " + toShow[i]);
    } else {
      process.stdout.write(`
  ` + toShow[i]);
    }
  }
  if (truncated) {
    const more = lines.length - maxLines;
    const moreHint = more > 5 ? " (ctrl+o to expand)" : "";
    process.stdout.write(`
  ` + dim("+" + more + " more lines" + moreHint));
  }
  return { shown, truncated, total: lines.length };
}
function getMiniMaxToken() {
  try {
    const authPath = join14(homedir13(), ".openclaw", "agents", "main", "agent", "auth-profiles.json");
    if (existsSync13(authPath)) {
      const auth2 = JSON.parse(readFileSync12(authPath, "utf-8"));
      return auth2.profiles?.["minimax-portal:default"]?.access || "";
    }
  } catch {}
  return process.env.MINIMAX_API_KEY || "";
}
function detectPlanIntent(input) {
  const trimmed = input.trim();
  for (const pattern of PLAN_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return trimmed;
    }
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("plan ") && trimmed.length > 10) {
    return trimmed;
  }
  return null;
}
function getBanner(cwd, verbose = false) {
  const v = verbose ? `${dim("· ")}verbose` : "";
  return `
${bold(c2.cyan("▐▛███▜▌"))} ${bold("Nole Code v1.16")} ${dim("· MiniMax")}
${dim("▝▜█████▛▘")} ${dim(cwd)} ${v}

${divider()}
${formatShortcuts()}
`;
}
async function runRepl(opts) {
  if (opts.verbose || feature("VERBOSE_OUTPUT")) {
    setFeature("VERBOSE_OUTPUT", true);
    setVerbose(true);
    setShowTimings(feature("TOOL_TIMING"));
    initVerboseOutput();
  }
  const settings = loadSettings();
  const { hasAnyProvider: hasAnyProvider2 } = await Promise.resolve().then(() => (init_env(), exports_env));
  const token = getMiniMaxToken();
  if (!token && !hasAnyProvider2()) {
    console.clear();
    console.log(`
${bold(c2.cyan("▐▛███▜▌"))} ${bold("Welcome to Nole Code!")}
${dim("▝▜█████▛▘")} ${dim("First-time setup")}

${bold("You need an API key to get started.")}

${c2.cyan("Option 1 — OpenRouter")} ${dim("(recommended, many free models)")}
  1. Go to ${c2.cyan("https://openrouter.ai/keys")}
  2. Create a free account and generate a key
  3. Run: ${bold("export OPENROUTER_API_KEY=sk-or-...")}

${c2.cyan("Option 2 — MiniMax")} ${dim("(free tier, can be slow)")}
  1. Go to ${c2.cyan("https://platform.minimaxi.com")}
  2. Get your API key
  3. Run: ${bold("export MINIMAX_API_KEY=your-key")}

${c2.cyan("Option 3 — OpenAI")}
  1. Go to ${c2.cyan("https://platform.openai.com/api-keys")}
  2. Run: ${bold("export OPENAI_API_KEY=sk-...")}

${dim("Or add keys to ~/.nole-code/.env:")}
  ${dim('echo "OPENROUTER_API_KEY=sk-or-..." > ~/.nole-code/.env')}

Then run ${bold("nole")} again.
`);
    const configDir = join14(homedir13(), ".nole-code");
    if (!existsSync13(configDir)) {
      mkdirSync8(configDir, { recursive: true });
      console.log(dim(`  Created ${configDir}/`));
    }
    process.exit(0);
  }
  const { OPENROUTER_API_KEY: OPENROUTER_API_KEY2, OPENAI_API_KEY: OPENAI_API_KEY2 } = await Promise.resolve().then(() => (init_env(), exports_env));
  let primaryKey = token;
  let primaryModel = settings.model || "MiniMax-M2.7";
  if (OPENROUTER_API_KEY2 && !token) {
    primaryKey = OPENROUTER_API_KEY2;
    primaryModel = settings.model || "google/gemini-2.5-flash";
  } else if (!token && OPENAI_API_KEY2) {
    primaryKey = OPENAI_API_KEY2;
    primaryModel = settings.model || "gpt-4o-mini";
  }
  if (!primaryKey) {
    primaryKey = token || OPENROUTER_API_KEY2 || OPENAI_API_KEY2;
  }
  const client = new LLMClient(primaryKey, primaryModel);
  activeClient = client;
  try {
    await loadMCPServers();
  } catch {}
  try {
    const { loadPlugins: loadPlugins2 } = await Promise.resolve().then(() => (init_loader(), exports_loader));
    const plugins = await loadPlugins2();
    if (plugins.length > 0) {
      console.log(dim(`  Loaded ${plugins.length} plugin${plugins.length > 1 ? "s" : ""}: ${plugins.join(", ")}`));
    }
  } catch {}
  const cwd = opts.cwd || process.cwd();
  let session;
  if (opts.session) {
    session = loadSession(opts.session) || createSession(cwd);
  } else {
    const recent = listSessions(5);
    const lastForCwd = recent.find((s) => s.cwd === cwd && s.messages.length > 1);
    if (lastForCwd) {
      session = lastForCwd;
      console.log(dim(`  Resuming session ${session.id.slice(0, 20)}... (${session.messages.length} messages)`));
      console.log(dim(`  Use /fork to branch off, /compact to shrink context
`));
    } else {
      session = createSession(cwd);
    }
  }
  costTracker.startSession(session.id);
  const projectContext = loadProjectContext(opts.cwd || process.cwd());
  const { getMemorySummary: getMemorySummary2 } = await Promise.resolve().then(() => (init_session_memory(), exports_session_memory));
  const memorySummary = getMemorySummary2(session.id);
  let gitContext = "";
  try {
    const { execFileSync } = __require("child_process");
    const cwd2 = opts.cwd || process.cwd();
    const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf-8", cwd: cwd2 }).trim();
    const status = execFileSync("git", ["status", "--short"], { encoding: "utf-8", cwd: cwd2 }).trim();
    const changed = status ? status.split(`
`).length : 0;
    const lastCommit = execFileSync("git", ["log", "--oneline", "-1"], { encoding: "utf-8", cwd: cwd2 }).trim();
    if (branch) {
      gitContext = `
- Git branch: ${branch}${changed ? ` (${changed} files changed)` : " (clean)"}`;
      if (lastCommit)
        gitContext += `
- Last commit: ${lastCommit}`;
    }
  } catch {}
  let resumeContext = "";
  if (session.messages.length > 1) {
    const userMsgs = session.messages.filter((m) => m.role === "user");
    const assistantMsgs = session.messages.filter((m) => m.role === "assistant");
    const toolMsgs = session.messages.filter((m) => m.role === "tool");
    const recentRequests = userMsgs.slice(-3).map((m) => {
      const text = typeof m.content === "string" ? m.content : "";
      return `- "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`;
    });
    const toolsUsed = new Set;
    for (const m of toolMsgs) {
      if (m.name)
        toolsUsed.add(m.name);
    }
    const filesEdited = new Set;
    for (const m of session.messages) {
      const content = typeof m.content === "string" ? m.content : "";
      const editMatch = content.match(/^([^\n:]+):$/m);
      if (editMatch && (content.includes("\x1B[31m-") || content.includes("\x1B[32m+"))) {
        filesEdited.add(editMatch[1]);
      }
    }
    resumeContext = `

# Resumed Session (${session.messages.length} messages, ${userMsgs.length} turns)`;
    resumeContext += `
Recent requests:
${recentRequests.join(`
`)}`;
    if (toolsUsed.size > 0)
      resumeContext += `
Tools used: ${Array.from(toolsUsed).join(", ")}`;
    if (filesEdited.size > 0)
      resumeContext += `
Files edited: ${Array.from(filesEdited).slice(0, 10).join(", ")}`;
  }
  const systemPrompt = `You are Nole, an expert AI coding assistant built by Nole Code. You help users with software engineering tasks. You are NOT a model name — never say you are "MiniMax" or any model identifier.

# Environment
- Working directory: ${opts.cwd || process.cwd()}
- Platform: ${process.platform}
- Shell: ${process.env.SHELL || "/bin/bash"}
- Node: ${process.version}${gitContext}

# Tools
You have access to these tools. Call them when needed — do not ask for permission:

**File operations:**
- Read: Read file contents with line numbers (supports offset/limit)
- Write: Create or overwrite files
- Edit: Replace exact text in a file — shows colored diff
- MultiEdit: Make multiple edits to a file in one operation
- Glob: Find files matching a pattern (e.g., **/*.ts)
- Grep: Search file contents with regex
- LS: List directory contents with sizes and dates
- Tree: Show directory tree structure
- Rename: Move or rename files/directories
- Delete: Delete files (recursive for directories)
- Diff: Compare two files side by side
- FindReplace: Search and replace across multiple files (dry-run by default)

**Shell & processes:**
- Bash: Execute shell commands
- Spawn: Start background processes (dev servers, watchers)
- RunTests: Auto-detect and run project tests (jest, vitest, pytest, bun, cargo, go)

**Git (dedicated — safer than raw bash):**
- GitStatus: Branch, changes, ahead/behind, recent commits
- GitDiff: Staged/unstaged diffs, compare refs
- GitCommit: Stage files and commit (injection-safe)

**Web & HTTP:**
- WebSearch: Search the web. Always cite sources with [Title](URL)
- WebFetch: Fetch and extract readable content from a URL
- HttpRequest: Full HTTP client — GET/POST/PUT/DELETE with headers and body

**Task management:**
- TodoWrite: Track tasks with status (pending/in_progress/completed)
- TaskCreate/TaskList/TaskUpdate/TaskGet/TaskStop: Background tasks

**Multi-agent:**
- Agent: Spawn a sub-agent for parallel work
- TeamCreate: Create a team of coordinating agents
- SendMessage: Send message to a running agent

# Guidelines
- Be concise and direct. Lead with the answer, not the reasoning.
- Write real working code — no placeholders, no TODOs, no "implement here"
- Read files before editing them. Understand existing code before modifying.
- Don't add features beyond what was asked. A bug fix doesn't need surrounding cleanup.
- When running commands, prefer dedicated tools over Bash (Read over cat, Grep over grep)
- For multi-step tasks, use TodoWrite to track progress
- Report errors clearly with what went wrong and how to fix it
- Users can reference files with @filename — the contents are inlined into the message
${projectContext ? `
# Project Context (from NOLE.md)
${projectContext}` : ""}
${memorySummary ? `
# Session Memory
${memorySummary}` : ""}${resumeContext}`;
  if (session.messages.length === 0) {
    session.messages.push({ role: "system", content: systemPrompt, timestamp: new Date().toISOString() });
  }
  saveSession(session);
  console.clear();
  const providerName = client.getActiveProviderName();
  console.log(getBanner(opts.cwd || process.cwd(), opts.verbose));
  if (opts.verbose) {
    printContextHeader({
      sessionId: session.id,
      cwd: opts.cwd || process.cwd(),
      model: "MiniMax-M2.7"
    });
  }
  const completer = (line) => {
    if (line.startsWith("/")) {
      const { getAllCommands: getAllCommands2 } = (init_commands(), __toCommonJS(exports_commands));
      const cmds = getAllCommands2().map((c3) => "/" + c3.name);
      const hits = cmds.filter((c3) => c3.startsWith(line));
      return [hits.length ? hits : cmds, line];
    }
    const parts = line.split(/\s+/);
    const last = parts[parts.length - 1] || "";
    if (last.includes("/") || last.includes(".")) {
      try {
        const dir = last.includes("/") ? last.substring(0, last.lastIndexOf("/") + 1) : "./";
        const prefix = last.includes("/") ? last.substring(last.lastIndexOf("/") + 1) : last;
        const { readdirSync: readdirSync4, statSync: statSync2 } = __require("fs");
        const { resolve: resolvePath } = __require("path");
        const fullDir = resolvePath(process.cwd(), dir);
        const entries = readdirSync4(fullDir).filter((f) => f.startsWith(prefix));
        const completions = entries.map((f) => {
          try {
            const isDir = statSync2(resolvePath(fullDir, f)).isDirectory();
            return dir + f + (isDir ? "/" : "");
          } catch {
            return dir + f;
          }
        });
        const withContext = parts.slice(0, -1).join(" ");
        const hits = completions.map((c3) => withContext ? withContext + " " + c3 : c3);
        return [hits, line];
      } catch {}
    }
    return [[], line];
  };
  const rl2 = readline2.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer
  });
  const prompt = () => process.stdout.write(`${dim("❯")} `);
  let toolCallId = 0;
  const unsubAgent = onAgentMessage((msg) => {
    if (msg.type === "output") {
      console.log(`
${c2.magenta("\uD83E\uDD16 Agent:")} ${msg.payload}`);
    }
  });
  let sigintCount = 0;
  process.on("SIGINT", () => {
    if (isProcessing) {
      cancelRequested = true;
      isProcessing = false;
      sigintCount = 0;
      console.log(`
${c2.yellow("⏹")} Cancelled`);
      prompt();
      return;
    }
    sigintCount++;
    if (sigintCount >= 2) {
      unsubAgent();
      const { getAllAgents: getAllAgents2, killAgent: ka } = (init_spawner(), __toCommonJS(exports_spawner));
      for (const agent of getAllAgents2()) {
        if (agent.status === "running")
          ka(agent.id);
      }
      costTracker.endSession();
      saveSession(session);
      console.log(`
${dim("\uD83D\uDC4B Goodbye!")}
`);
      process.exit(0);
    }
    console.log(`
${dim("Press Ctrl+C again to exit, or type a message.")}`);
    prompt();
    setTimeout(() => {
      sigintCount = 0;
    }, 2000);
  });
  process.on("SIGTSTP", () => {
    saveSession(session);
  });
  process.on("SIGCONT", () => {
    console.log("");
    prompt();
  });
  const processInput = async (input) => {
    if (!input.trim()) {
      prompt();
      return;
    }
    if (input.length > 50000) {
      console.log(`
${c2.yellow("⚠")} Message too large (${(input.length / 1024).toFixed(0)}KB). Max ~50KB.`);
      console.log(dim("Use @filename to reference files instead of pasting contents."));
      prompt();
      return;
    }
    const planIntent = detectPlanIntent(input);
    if (planIntent) {
      const { generatePlanSteps: generatePlanSteps2, enterPlanMode: enterPlanMode2 } = await Promise.resolve().then(() => (init_plan(), exports_plan));
      const steps = generatePlanSteps2(planIntent);
      const plan = enterPlanMode2(planIntent, steps);
      console.log(`
${c2.cyan("\uD83D\uDCCB PLAN MODE")} — triggered by "${input.slice(0, 50)}..."`);
      console.log(`${plan.steps.length} steps identified. Use /plan approve to proceed.`);
      prompt();
      return;
    }
    if (input.startsWith("!")) {
      const shellCmd = input.slice(1).trim();
      if (!shellCmd) {
        console.log(`
${dim("Usage: ! <command>")}`);
        prompt();
        return;
      }
      try {
        const { execSync: execS } = __require("child_process");
        const output = execS(shellCmd, {
          encoding: "utf-8",
          cwd: opts.cwd || process.cwd(),
          timeout: 30000,
          stdio: ["inherit", "pipe", "pipe"]
        });
        if (output)
          process.stdout.write(output);
      } catch (err) {
        if (err.stdout)
          process.stdout.write(err.stdout);
        if (err.stderr)
          process.stderr.write(err.stderr);
      }
      console.log("");
      prompt();
      return;
    }
    const parsed = parseCommand(input);
    if (parsed) {
      const cmd = getCommand(parsed.cmd);
      if (cmd) {
        try {
          const result = await cmd.execute(parsed.args, {
            cwd: opts.cwd || process.cwd(),
            sessionId: session.id
          });
          if (result)
            console.log(`
${result}
`);
        } catch (err) {
          printError(String(err));
        }
        prompt();
        return;
      } else {
        console.log(`
${c2.yellow("❓ Unknown command:")} /${parsed.cmd}`);
        prompt();
        return;
      }
    }
    cancelRequested = false;
    isProcessing = true;
    const sessionStartTime = Date.now();
    let toolErrorCount = 0;
    lastUserMessage = input;
    let expandedInput = input;
    const fileRefs = input.match(/@([\w.\/\-]+)/g);
    if (fileRefs) {
      for (const ref of fileRefs) {
        const filePath = ref.slice(1);
        const fullPath = resolve(opts.cwd || process.cwd(), filePath);
        if (existsSync13(fullPath)) {
          try {
            const content = readFileSync12(fullPath, "utf-8");
            const truncated = content.length > 5000 ? content.slice(0, 5000) + `
... (truncated)` : content;
            expandedInput = expandedInput.replace(ref, `
\`\`\`${filePath}
${truncated}
\`\`\``);
            console.log(dim(`  Attached ${filePath} (${content.split(`
`).length} lines)`));
          } catch {}
        }
      }
    }
    console.log(`${c2.blue("➜ you")} │ ${input}`);
    session.messages.push({
      role: "user",
      content: expandedInput,
      timestamp: new Date().toISOString()
    });
    const toolDefs = getToolDefinitions(expandedInput);
    let responseText = "";
    let toolCalls = [];
    console.log(`
${divider()}
`);
    console.log(`${c2.magenta("\uD83E\uDD16 nole")} │ `);
    const startTime = Date.now();
    try {
      const MAX_TURNS = parseInt(process.env.NOLE_MAX_TURNS || "") || settings.maxTurns || 50;
      let turn = 0;
      while (turn < MAX_TURNS) {
        turn++;
        responseText = "";
        toolCalls = [];
        if (cancelRequested)
          break;
        const { estimateTotalTokens: estTokens } = await Promise.resolve().then(() => exports_count_tokens);
        const currentTokens = estTokens(session.messages);
        if (currentTokens > 1e5) {
          console.log(dim(`  Context large (~${(currentTokens / 1000).toFixed(0)}K tokens), compacting...`));
          const { maybeCompact: compact } = await Promise.resolve().then(() => (init_compact(), exports_compact));
          compact(session.messages, session.id);
          saveSession(session);
        }
        let spinnerInterval = null;
        let hasOutput = false;
        const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        const VERBS = [
          "Thinking",
          "Reasoning",
          "Analyzing",
          "Compiling thoughts",
          "Reticulating splines",
          "Allocating braincells",
          "Herding tokens",
          "Milking the API",
          "Harvesting answers",
          "Consulting the oracle",
          "Summoning wisdom",
          "Warming up hamsters",
          "Polishing the crystal ball",
          "Asking nicely",
          "Feeding the squirrels",
          "Definitely not guessing",
          "Almost there probably",
          "Winging it professionally",
          "Faking confidence",
          "Pretending to work",
          "Bribing the AI gods"
        ];
        let spinFrame = 0;
        spinnerInterval = setInterval(() => {
          if (!hasOutput && process.stdout.writable) {
            const frame = SPINNER_CHARS[spinFrame % SPINNER_CHARS.length];
            const verb = VERBS[Math.floor(spinFrame / 5) % VERBS.length];
            const elapsed2 = ((Date.now() - sessionStartTime) / 1000).toFixed(0);
            try {
              process.stdout.write(`\r${c2.cyan(frame)} ${dim(verb + "...")} ${dim(`(${elapsed2}s)`)}  `);
            } catch {}
            spinFrame++;
          }
        }, 150);
        const mdStream = createStreamingMarkdown();
        const usage = await client.chatStream(session.messages.map((m) => {
          const msg = { role: m.role, content: m.content };
          if (m.tool_call_id)
            msg.tool_call_id = m.tool_call_id;
          if (m.name)
            msg.name = m.name;
          if (m.tool_calls)
            msg.tool_calls = m.tool_calls;
          return msg;
        }), { tools: toolDefs, max_tokens: settings.maxTokens || 4096 }, (chunk) => {
          if (!hasOutput && spinnerInterval) {
            clearInterval(spinnerInterval);
            spinnerInterval = null;
            process.stdout.write("\r\x1B[K");
          }
          hasOutput = true;
          responseText += chunk;
          mdStream.write(chunk);
        }, (tc) => {
          toolCalls.push({ id: tc.id || `tool_${Date.now()}`, name: tc.name, input: tc.input });
        });
        if (spinnerInterval) {
          clearInterval(spinnerInterval);
          spinnerInterval = null;
          process.stdout.write("\r\x1B[K");
        }
        mdStream.flush();
        console.log("");
        const assistantMsg = {
          role: "assistant",
          content: responseText,
          timestamp: new Date().toISOString()
        };
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            input: tc.input
          }));
        }
        session.messages.push(assistantMsg);
        if (usage) {
          costTracker.trackRequest(settings.model || "MiniMax-M2.7", usage.input, usage.output);
        }
        if (toolCalls.length === 0)
          break;
        const { maybeCompact: maybeCompact2 } = await Promise.resolve().then(() => (init_compact(), exports_compact));
        if (maybeCompact2(session.messages, session.id)) {
          saveSession(session);
        }
        if (feature("AUTO_COMPACT") || feature("SESSION_COMPACT")) {
          printTokenBudget(session.messages);
        }
        const MAX_TOOL_RESULT = 8000;
        const toolResults = [];
        if (cancelRequested) {
          console.log(formatCancelled("Skipped tools"));
        } else if (toolCalls.length === 1) {
          const tc = toolCalls[0];
          const toolStart = Date.now();
          const preview = tc.input.command ? String(tc.input.command).slice(0, 60) : JSON.stringify(tc.input).slice(0, 60);
          process.stdout.write(`\r${c2.cyan("⟳")} ${tc.name} ${dim(`(${preview})`)}
`);
          const result = await executeTool(tc.name, tc.input, { cwd: opts.cwd || process.cwd(), sessionId: session.id });
          toolResults.push({ tc, result, ms: Date.now() - toolStart });
        } else {
          console.log(dim(`  Running ${toolCalls.length} tools in parallel...`));
          const promises = toolCalls.map(async (tc) => {
            const toolStart = Date.now();
            const result = await executeTool(tc.name, tc.input, { cwd: opts.cwd || process.cwd(), sessionId: session.id });
            return { tc, result, ms: Date.now() - toolStart };
          });
          const results = await Promise.all(promises);
          toolResults.push(...results);
        }
        for (const { tc, result, ms } of toolResults) {
          let llmContent = result.content;
          if (llmContent.length > MAX_TOOL_RESULT) {
            const lines = llmContent.split(`
`);
            const kept = lines.slice(0, 50);
            const tail = lines.slice(-5);
            llmContent = kept.join(`
`) + `

[... ${lines.length - 55} lines truncated ...]

` + tail.join(`
`);
          }
          session.messages.push({
            role: "tool",
            content: llmContent,
            tool_call_id: tc.id,
            name: tc.name,
            timestamp: new Date().toISOString()
          });
          const displayLines = result.content.split(`
`);
          const maxLines = opts.verbose ? 50 : 10;
          const elapsed2 = ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
          if (opts.verbose) {
            console.log(formatVerboseResult(tc.name, result.content, {
              isError: result.isError,
              timestamp: Date.now() - ms,
              maxLines
            }));
          } else {
            if (result.isError)
              toolErrorCount++;
            streamOutput(displayLines, maxLines, displayLines.length > 20 ? 5 : 0);
          }
          const status = result.isError ? "❌" : "✅";
          console.log(`  ${status} ${tc.name} ${dim(`[${elapsed2}]`)}
`);
        }
        if (cancelRequested)
          break;
      }
      if (turn >= MAX_TURNS) {
        console.log(`
${c2.yellow("⚠")} Reached maximum ${MAX_TURNS} turns in agentic loop.
`);
      }
      const { estimateTotalTokens: estimateTotalTokens2 } = await Promise.resolve().then(() => exports_count_tokens);
      const totalTokens = estimateTotalTokens2(session.messages);
      const maxCtx = 128000;
      const pct = Math.min(100, Math.round(totalTokens / maxCtx * 100));
      const elapsed = ((Date.now() - sessionStartTime) / 1000).toFixed(1);
      const turnInfo = turn > 1 ? ` · ${turn} turns` : "";
      const toolInfo = "";
      const warning = pct > 80 ? " ⚠ context filling up" : "";
      const provider = client.getActiveProviderName();
      const providerTag = provider !== "minimax" ? ` · ${provider}` : "";
      console.log(dim(`${elapsed}s · ~${totalTokens} tokens (${pct}%)${turnInfo}${toolInfo}${providerTag}${warning}`));
      saveSession(session);
      const { extractMemoryFromConversation: extractMemoryFromConversation2 } = await Promise.resolve().then(() => (init_session_memory(), exports_session_memory));
      extractMemoryFromConversation2(session.messages, session.id).catch(() => {});
    } catch (err) {
      const msg = String(err);
      if (msg.includes("overloaded")) {
        printWarning("API is overloaded. Try again in a moment.");
      } else if (msg.includes("authentication")) {
        printError("Invalid API key. Check your MINIMAX_API_KEY in ~/.nole-code/.env or environment.");
      } else if (msg.includes("rate_limit") || msg.includes("429")) {
        printWarning("Rate limited. Wait a few seconds and try again.");
      } else {
        printError(msg.replace("Error: ", ""));
      }
    } finally {
      isProcessing = false;
    }
    console.log("");
    prompt();
  };
  rl2.on("line", async (line) => {
    await processInput(line);
  });
  if (opts.message) {
    await processInput(opts.message);
    process.exit(0);
  }
  prompt();
}
function parseArgs() {
  const opts = { cwd: process.cwd() };
  const args = process.argv.slice(2);
  if (args[0] === "init") {
    const { createNoleMd: createNoleMd2 } = (init_onboarding(), __toCommonJS(exports_onboarding));
    const cwd = args[1] || process.cwd();
    const path = createNoleMd2(cwd);
    console.log(`Created ${path}`);
    console.log("Edit this file to configure project context for Nole.");
    process.exit(0);
  }
  for (let i = 0;i < args.length; i++) {
    switch (args[i]) {
      case "-s":
      case "--session":
        opts.session = args[++i];
        break;
      case "-c":
      case "--cwd":
        opts.cwd = args[++i];
        break;
      case "-m":
      case "--message":
        opts.message = args.slice(i + 1).join(" ");
        i = args.length;
        break;
      case "--verbose":
      case "-v":
        opts.verbose = true;
        break;
      case "--list-sessions":
        const sessions = listSessions();
        console.log(`
Sessions:`);
        for (const s of sessions) {
          console.log(`  ${s.id} — ${s.cwd} (${s.messages.length} messages)`);
        }
        console.log("");
        process.exit(0);
        break;
      case "--delete-session":
        deleteSession(args[++i]);
        console.log(`Deleted session ${args[i - 1]}`);
        process.exit(0);
        break;
      case "--version":
        console.log("Nole Code v1.16.0");
        process.exit(0);
        break;
      case "--help":
      case "-h":
        console.log(`
${bold("Nole Code")} — AI Coding Assistant

${dim("Usage:")}
  nole [options]
  nole init              Create NOLE.md in current project
  nole -m "do something" Run a single task and exit

${dim("Options:")}
  -s, --session <id>    Resume a session
  -c, --cwd <path>       Working directory (default: cwd)
  -m, --message <text>   Run single message and exit
  --verbose              Verbose output with timings
  --list-sessions        List all sessions
  --delete-session <id>  Delete a session
  -v, --version          Show version
  -h, --help             Show this help

${dim("Commands (in REPL):")}
  /help       Show help
  /context    Session stats (tokens, git, model)
  /settings   View/change settings
  /model      Switch LLM model
  /undo       Roll back last turn
  /compact    Compact session context
  /fork       Fork current session
  /new        Start fresh session
  /export     Save conversation as markdown
  /changes    Review all file changes
  /plugins    List custom plugins
  /plan       Step-by-step approval mode
  /init       Create NOLE.md (auto-detects project)
  /quit       Exit

${dim("Shortcuts:")}
  ctrl+c     Cancel current / double to exit
  ctrl+l     Clear screen
  ! <cmd>    Run shell command inline
`);
        process.exit(0);
        break;
    }
  }
  return opts;
}
async function main() {
  const opts = parseArgs();
  await runRepl(opts);
}
var cancelRequested = false, isProcessing = false, lastUserMessage = "", activeClient = null, PLAN_INTENT_PATTERNS;
var init_src = __esm(() => {
  init_llm();
  init_registry();
  init_client3();
  init_commands();
  init_spawner();
  init_manager();
  init_onboarding();
  init_cost();
  init_feature_flags();
  init_styles();
  init_verbose();
  init_spinner();
  init_streaming();
  init_markdown();
  PLAN_INTENT_PATTERNS = [
    /^let['’]?s?\s+(make\s+a\s+plan|plan|break\s+this\s+down|walk\s+me\s+through)/i,
    /^plan\s+(this|it|that|out|for|our|the)/i,
    /^make\s+a\s+plan/i,
    /^step\s+by\s+step/i,
    /^enter\s+plan\s*mode/i,
    /^walk\s+me\s+through/i,
    /^go\s+through\s+(it|this)\s+step\s+by\s+step/i,
    /^outline\s+the\s+steps/i,
    /^what\s+are\s+the\s+steps?/i,
    /^list\s+the\s+steps?/i,
    /^break\s+(this|it)\s+down/i,
    /^plan\s+out/i,
    /^can\s+(we|you)\s+plan/i,
    /^should\s+we\s+plan/i,
    /^approach\s+(this|it)\s+step\s+by\s+step/i
  ];
  main().catch((err) => {
    console.error("FATAL ERR:", err?.message, err?.stack?.split(`
`).slice(0, 3).join("|"));
    process.exit(1);
  });
});
init_src();

export {
  activeClient
};
