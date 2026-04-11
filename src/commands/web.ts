// Nole Code - /web command: Web search and fetch

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface WebResult {
  title: string
  url: string
  snippet: string
}

async function webSearch(query: string, count = 5): Promise<WebResult[]> {
  try {
    // Use DuckDuckGo HTML search
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const html = await response.text()

    const results: WebResult[] = []
    // Match result blocks
    const resultRegex = /<a class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
    let match
    let idx = 0
    while ((match = resultRegex.exec(html)) !== null && idx < count) {
      const url = decodeURIComponent(match[1].replace(/\/redirect\?q=/, '').replace(/\s/g, ''))
      const title = match[2].replace(/<[^>]*>/g, '').trim()
      const snippet = match[3].replace(/<[^>]*>/g, '').trim()
      if (title && url) {
        results.push({ title, url, snippet })
        idx++
      }
    }

    if (results.length > 0) {
      return results
    }
  } catch {}

  // Fallback to DuckDuckGo JSON API
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&skip_disambig=1`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Nole-Code/1.0' },
    })
    const data = await response.json() as Record<string, unknown>

    const results: WebResult[] = []

    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: String(data.AbstractText).slice(0, 100),
        url: String(data.AbstractURL),
        snippet: String(data.AbstractText),
      })
    }

    if (Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, count)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: String(topic.Text).slice(0, 100),
            url: String(topic.FirstURL),
            snippet: String(topic.Text),
          })
        }
      }
    }

    return results.slice(0, count)
  } catch {
    return []
  }
}

async function fetchUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    const text = await response.text()
    // Extract readable content
    const withoutTags = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return withoutTags.slice(0, 2000)
  } catch {
    return 'Failed to fetch URL'
  }
}

export function registerWebCommand(registerCmd: (cmd: import('./index.js').Command) => void) {
  registerCmd({
    name: 'web',
    description: 'Search the web and optionally fetch a result',
    execute: async (args) => {
      if (args.length === 0) {
        return 'Usage: /web <query>\nSearches the web and shows results.'
      }

      const query = args.join(' ')
      const results = await webSearch(query, 5)

      if (results.length === 0) {
        return `No results found for "${query}"`
      }

      const lines = results.map((r, i) => 
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet?.slice(0, 150) || ''}`
      )

      return `Search results for "${query}":\n\n${lines.join('\n\n')}\n\nFetch a result? (enter number 1-5 or skip)`
    },
  })
}