// /retry — Retry the last failed command
import { promisify } from 'util'
import { Command, CommandContext, registerCommand } from './index.js'

// Ring buffer for last 5 failed commands
const MAX_FAILURES = 5
let failures: string[] = []

// Last failed command (most recent)
let lastFailedCommand = ''

/**
 * Record a failed command for potential retry
 * @param command The command that failed
 */
export function recordFailure(command: string) {
  lastFailedCommand = command
  
  // Add to ring buffer
  failures.push(command)
  if (failures.length > MAX_FAILURES) {
    failures.shift()
  }
}

/**
 * Get the last failed command
 */
export function getLastFailedCommand(): string {
  return lastFailedCommand
}

/**
 * Get all recorded failures (most recent first)
 */
export function getFailures(): string[] {
  return [...failures].reverse()
}

export function registerRetryCommand(register: typeof registerCommand) {
  register({
    name: 'retry',
    description: 'Retry the last failed command',
    execute: async (args: string[], ctx: CommandContext): Promise<string> => {
      const showOnly = args[0] === '--show'

      if (!lastFailedCommand) {
        return 'No failed command to retry.\nUse recordFailure() from other code to mark commands as failed.'
      }

      if (showOnly) {
        return `Last failed command:\n\n${lastFailedCommand}\n\nRecent failures (${failures.length}):\n` +
          failures.map((f, i) => `  ${i + 1}. ${f.slice(0, 60)}${f.length > 60 ? '...' : ''}`).join('\n')
      }

      // Re-run the failed command through the LLM
      try {
        const { loadSession: load, saveSession: save } = await import('../session/manager.js')
        const { LLMClient } = await import('../api/llm.js')
        const { getMiniMaxToken } = await import('../index.js')
        const { getToolDefinitions, executeTool } = await import('../tools/registry.js')
        const { loadSettings } = await import('../project/onboarding.js')

        const session = load(ctx.sessionId)
        if (!session) return 'Session not found'

        const settings = loadSettings()
        const token = getMiniMaxToken()
        
        if (!token) return 'No API key configured'

        const client = new LLMClient(token, settings.model || 'MiniMax-M2.7')
        client.setModel(settings.model || 'MiniMax-M2.7')

        // Add the failed command to session
        session.messages.push({
          role: 'user',
          content: lastFailedCommand,
          timestamp: new Date().toISOString(),
        })

        const toolDefs = getToolDefinitions(lastFailedCommand)
        let responseText = ''
        let toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

        // Stream response (single turn only)
        const mdStream = (await import('../ui/markdown.js')).createStreamingMarkdown()
        
        await client.chatStream(
          session.messages.map(m => {
            const msg: any = { role: m.role, content: m.content }
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
            if (m.name) msg.name = m.name
            if ((m as any).tool_calls) msg.tool_calls = (m as any).tool_calls
            return msg
          }),
          { tools: toolDefs, max_tokens: settings.maxTokens || 4096 },
          (chunk) => {
            responseText += chunk
            mdStream.write(chunk)
          },
          (tc) => {
            toolCalls.push({ id: tc.id || `tool_${Date.now()}`, name: tc.name, input: tc.input })
          },
        )

        mdStream.flush()

        // Save assistant response
        const assistantMsg: any = {
          role: 'assistant',
          content: responseText,
          timestamp: new Date().toISOString(),
        }
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            input: tc.input,
          }))
        }
        session.messages.push(assistantMsg)

        // Execute tools if any
        if (toolCalls.length > 0 && toolCalls[0]) {
          const tc = toolCalls[0]
          const result = await executeTool(tc.name, tc.input, { cwd: ctx.cwd, sessionId: ctx.sessionId })
          
          session.messages.push({
            role: 'tool',
            content: result.content,
            tool_call_id: tc.id,
            name: tc.name,
            timestamp: new Date().toISOString(),
          })
        }

        save(session)

        // Clear failure after successful retry
        const retryOf = lastFailedCommand
        lastFailedCommand = ''

        return `Retried: "${retryOf.slice(0, 50)}..."\n\nResponse:\n${responseText.slice(0, 500)}${responseText.length > 500 ? '...' : ''}`
      } catch (err: unknown) {
        const error = err as { message?: string }
        return `Retry failed: ${error.message || String(err)}`
      }
    },
  })
}