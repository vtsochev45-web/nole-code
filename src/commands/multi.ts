// Nole Code - /multi command: Best-of-N LLM calls

import { LLMClient, Message } from '../api/llm.js'

// Create a fresh client for multi
function createClient(): LLMClient {
  return new LLMClient()
}

interface MultiResult {
  index: number
  content: string
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>
}

// Make a single LLM call
async function makeCall(client: LLMClient, prompt: string): Promise<MultiResult> {
  const messages: Message[] = [
    { role: 'user', content: prompt }
  ]

  const result = await client.chat(messages, { temperature: 0.7 })
  return {
    index: 0,
    content: result.content,
    toolCalls: result.toolCalls
  }
}

// Find differences between responses
function findDifferences(responses: MultiResult[]): Set<number> {
  const diffLines = new Set<number>()
  
  // Split each response into lines
  const allLines = responses.map(r => r.content.split('\n'))
  const maxLines = Math.max(...allLines.map(l => l.length))
  
  for (let i = 0; i < maxLines; i++) {
    const lines = allLines.map(l => l[i] || '')
    const first = lines[0]
    if (lines.some(l => l !== first && l.trim() !== '')) {
      diffLines.add(i)
    }
  }
  
  return diffLines
}

// Display responses side by side
function displayResponses(responses: MultiResult[]): string {
  const header = '╔════════════════════════════════════════════════════════════════╗\n' +
    '║           BEST-OF-3 LLM RESPONSES                         ║\n' +
    '╠════════════════════════════════════════════════════════════════╣'
  
  const diffLines = findDifferences(responses)
  
  const responseBlocks = responses.map((r, idx) => {
    const lines = r.content.split('\n')
    const prefix = `║ [${idx + 1}]`
    
    return lines.map((line, lineIdx) => {
      const truncated = line.length > 58 ? line.slice(0, 55) + '...' : line
      const diffMark = diffLines.has(lineIdx) ? '◆' : ' '
      return `${prefix} ${diffMark} ${truncated.padEnd(58)}║`
    }).join('\n')
  })
  
  // Merge blocks side by side
  const merged: string[] = []
  for (let i = 0; i < Math.max(...responseBlocks.map(b => b.split('\n').length)); i++) {
    // This is simplified - just show one response at a time with numbers
  }
  
  // Actually, let's just number them sequentially
  const allContent: string[] = []
  for (const r of responses) {
    allContent.push(`\n─── Response ${r.index + 1} ───\n`)
    allContent.push(r.content)
  }
  
  return header + '\n' + allContent.join('\n\n') + '\n╚════════════════════════════════════════════════════════════════╝'
}

export function registerMultiCommand(registerCmd: (cmd: import('./index.js').Command) => void) {
  registerCmd({
    name: 'multi',
    description: 'Run LLM 3 times and pick the best response',
    aliases: ['bestof', 'branch'],
    execute: async (args) => {
      const prompt = args.join(' ')
      if (!prompt) {
        return `Usage: /multi <prompt>

Runs the same prompt through the LLM 3 times concurrently
and lets you pick the best response.

Examples:
  /multi Write a function to parse JSON
  /multi Explain quantum computing simply
`
      }

      // Create 3 clients for parallel calls
      const clients = [createClient(), createClient(), createClient()]
      
      // Make all 3 calls concurrently
      const results = await Promise.all(
        clients.map((client, idx) => 
          makeCall(client, prompt).then(r => ({ ...r, index: idx + 1 }))
        )
      )

      // Display results
      const diffLines = findDifferences(results)
      const lines: string[] = [
        '═══ BEST-OF-3 RESULTS ═══',
        '',
        `Prompt: ${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}`,
        ''
      ]

      // Group by similarity - count unique responses
      const uniqueContents = new Set(results.map(r => r.content.slice(0, 100)))
      const isUnique = uniqueContents.size === results.length

      for (const r of results) {
        lines.push(`┌─ Response ${r.index} ──────────────────────────────`)
        const content = r.content.split('\n')
        // Show first 8 lines
        for (let i = 0; i < Math.min(content.length, 8); i++) {
          const mark = diffLines.has(i) ? ' ◆' : '  '
          lines.push(`│${mark} ${content[i]}`)
        }
        if (content.length > 8) {
          lines.push(`│   ... (${content.length - 8} more lines)`)
        }
      }

      lines.push('')
      lines.push('Which response do you want to use? (1/2/3/r)')
      lines.push('')
      lines.push('Tip: r = regenerate all 3')

      return lines.join('\n')
    },
  })
}