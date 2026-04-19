// Nole Code - Web Tools
// Web search and fetch utilities

import { checkUrlSafety } from '../utils/url-safety.js'

export async function webSearch(query: string, count = 5): Promise<string> {
  // Handle time queries specially
  const timeMatch = query.match(/(?:current )?time (?:is )?in ([A-Za-z_\s]+?)(?:\?|$)/i)
  if (timeMatch) {
    const tz = timeMatch[1].trim().replace(/ /g, '_')
    const now = new Date()
    const zones: Record<string, string> = {
      'New_York': 'America/New_York',
      'London': 'Europe/London',
      'Tokyo': 'Asia/Tokyo',
      'Sydney': 'Australia/Sydney',
      'Paris': 'Europe/Paris',
      'Berlin': 'Europe/Berlin',
      'Los_Angeles': 'America/Los_Angeles',
      'Chicago': 'America/Chicago',
      'Toronto': 'America/Toronto',
    }
    const zone = zones[tz] || tz.replace(/_/g, '/')
    const localTime = now.toLocaleString('en-US', { timeZone: zone })
    return `Current time in ${tz.replace(/_/g, ' ')}: ${localTime}\nUTC: ${now.toISOString()}`
  }

  // Try DuckDuckGo HTML search (more reliable than JSON API)
  try {
    const results = await ddgHtmlSearch(query, count)
    if (results.length > 0) {
      return `Search results for "${query}":\n\n${results.join('\n\n')}`
    }
  } catch {}

  // Fallback: DuckDuckGo JSON API (instant answers)
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Nole-Code/1.12' },
    })
    const data = await response.json() as Record<string, unknown>

    const results: string[] = []

    if (data.Abstract && data.AbstractURL) {
      results.push(`${data.Abstract}\nSource: ${data.AbstractURL}`)
    }

    if (Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, count)) {
        if (topic.Text && topic.FirstURL) {
          results.push(`- ${topic.Text}\n  ${topic.FirstURL}`)
        }
      }
    }

    if (results.length > 0) {
      return `Search results for "${query}":\n\n${results.join('\n\n')}`
    }
  } catch {}

  return `No results found for: ${query}\nTry using WebFetch with a specific URL instead.`
}

// DuckDuckGo HTML search - scrapes lite version for actual results
async function ddgHtmlSearch(query: string, count: number): Promise<string[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Nole-Code/1.12)',
      'Accept': 'text/html',
    },
  })

  const html = await response.text()
  const results: string[] = []

  // Parse result links and snippets from DDG lite HTML
  const resultPattern = /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi
  const snippetPattern = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi

  const links: Array<{ url: string; title: string }> = []
  let match
  while ((match = resultPattern.exec(html)) !== null) {
    const resultUrl = match[1].replace(/&amp;/g, '&')
    const title = match[2].trim()
    if (title && resultUrl && !resultUrl.includes('duckduckgo.com')) {
      links.push({ url: resultUrl, title })
    }
  }

  const snippets: string[] = []
  while ((match = snippetPattern.exec(html)) !== null) {
    const snippet = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim()
    if (snippet) snippets.push(snippet)
  }

  for (let i = 0; i < Math.min(links.length, count); i++) {
    const { url: linkUrl, title } = links[i]
    const snippet = snippets[i] || ''
    results.push(`- **${title}**\n  ${snippet}\n  ${linkUrl}`)
  }

  return results
}

export async function webFetch(url: string, maxChars = 10000): Promise<string> {
  const safety = checkUrlSafety(url)
  if (!safety.safe) {
    return `WebFetch blocked: ${safety.reason}`
  }
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Nole-Code/1.12)',
        'Accept': 'text/html,application/xhtml+xml,application/json',
      },
    })

    const contentType = response.headers.get('content-type') || ''

    // Handle JSON responses directly
    if (contentType.includes('application/json')) {
      const json = await response.text()
      return json.slice(0, maxChars)
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    // Strip non-content elements then all tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Decode HTML entities
    text = text
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')

    if (text.length > maxChars) {
      text = text.slice(0, maxChars) + '\n\n... (content truncated)'
    }

    return title ? `# ${title}\n\n${text}` : text || '(No readable content)'
  } catch (err) {
    return `Fetch error: ${err}`
  }
}
