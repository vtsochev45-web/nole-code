/**
 * Token Counting Utilities
 * Simple estimation based on character count
 * (In production, would use tiktoken or similar)
 */

/**
 * Rough token estimation
 * ~4 characters per token for English text
 */
export function roughTokenCount(text: string | unknown): number {
  if (!text) return 0
  if (typeof text !== 'string') {
    // Handle arrays (tool_use blocks) or objects
    return roughTokenCount(JSON.stringify(text))
  }
  // Split by whitespace and count words
  const words = text.trim().split(/\s+/).filter(Boolean)
  // Average ~1.3 tokens per word in English
  const wordTokens = words.length * 1.3
  // Plus ~2 tokens per line break
  const lineBreakTokens = (text.match(/\n/g) || []).length * 2
  // Plus ~1 token per special character
  const specialTokens = (text.match(/[^\w\s]/g) || []).length * 0.5
  return Math.ceil(wordTokens + lineBreakTokens + specialTokens)
}

/**
 * Estimate tokens for a message
 */
export function estimateMessageTokens(message: {
  role: string
  content: string
  name?: string
  tool_call_id?: string
  tool_calls?: Array<{ name: string, input: string }>
}): number {
  let tokens = 4 // Role overhead
  
  if (message.name) {
    tokens += roughTokenCount(message.name) + 2
  }
  
  if (message.content) {
    tokens += roughTokenCount(String(message.content))
  }
  
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      tokens += roughTokenCount(tc.name) + roughTokenCount(tc.input) + 10
    }
  }
  
  return tokens
}

/**
 * Estimate total tokens for a message array
 */
export function estimateTotalTokens(messages: Array<{
  role: string
  content: string
  name?: string
  tool_call_id?: string
  tool_calls?: Array<{ name: string, input: string }>
}>): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}

/**
 * Compact a string to fit within token budget
 */
export function compactToTokenBudget(text: string, maxTokens: number): string {
  const currentTokens = roughTokenCount(text)
  if (currentTokens <= maxTokens) return text
  
  // Binary search for the right length
  let start = 0
  let end = text.length
  
  while (start < end) {
    const mid = Math.floor((start + end) / 2)
    const estimate = roughTokenCount(text.slice(0, mid))
    
    if (estimate < maxTokens) {
      start = mid + 1
    } else {
      end = mid
    }
  }
  
  const truncated = text.slice(0, start)
  return truncated + '\n\n[_compacted_]'
}
