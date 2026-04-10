/**
 * LLM-powered session summarization.
 * When context gets large, uses a cheap LLM call to generate a concise
 * summary of older messages, replacing them with a single system message.
 */

import { LLMClient } from '../api/llm.js'

export async function summarizeMessages(
  messages: Array<{ role: string; content: string; name?: string; timestamp?: string }>,
  client: LLMClient,
  keepRecent = 10,
): Promise<{ summary: string; messagesRemoved: number }> {
  // Split: old messages to summarize, recent to keep
  const systemMsgs = messages.filter(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  if (nonSystem.length <= keepRecent) {
    return { summary: '', messagesRemoved: 0 }
  }

  const toSummarize = nonSystem.slice(0, -keepRecent)
  const toKeep = nonSystem.slice(-keepRecent)

  // Build a condensed transcript for the LLM
  const transcript = toSummarize.map(m => {
    const content = typeof m.content === 'string' ? m.content : ''
    const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : `Tool(${m.name || '?'})`
    return `${role}: ${content.slice(0, 200)}`
  }).join('\n')

  // Use a minimal LLM call to summarize
  try {
    const result = await client.chat([
      {
        role: 'user',
        content: `Summarize this coding session in 3-5 bullet points. Focus on: what was asked, what files were changed, what tools were used, and any errors encountered. Be concise.\n\n${transcript.slice(0, 8000)}`,
      },
    ], {
      max_tokens: 300,
      temperature: 0,
    })

    const summary = result.content.trim()

    // Replace old messages with summary
    messages.length = 0
    messages.push(...systemMsgs)
    messages.push({
      role: 'system',
      content: `[Session summary — ${toSummarize.length} messages compacted]\n${summary}`,
      timestamp: new Date().toISOString(),
    })
    messages.push(...toKeep)

    return { summary, messagesRemoved: toSummarize.length }
  } catch {
    // Fallback: if LLM call fails, just do basic compaction
    return { summary: '', messagesRemoved: 0 }
  }
}
