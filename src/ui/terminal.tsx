// Nole Code - Terminal UI
// Rebranded from Claude Code's Ink-based terminal interface

import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Text,
  Newline,
  useInput,
  useStdin,
} from 'ink'

// Brand colors
const BRAND = {
  primary: '#00D4AA',    // Nole cyan/teal
  secondary: '#FF6B35', // Orange accent
  dim: '#6B7280',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  user: '#60A5FA',       // Blue for user
  assistant: '#A78BFA', // Purple for assistant
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: Date
}

interface TerminalProps {
  onSend: (message: string) => void
  messages: Message[]
  isLoading: boolean
  onInterrupt?: () => void
}

export function Terminal({ onSend, messages, isLoading, onInterrupt }: TerminalProps) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [cursorPos, setCursorPos] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useInput((input, key) => {
    if (key.return) {
      if (input.trim()) {
        onSend(input.trim())
        setHistory(prev => [input.trim(), ...prev.slice(0, 49)])
        setHistoryIndex(-1)
        setInput('')
        setCursorPos(0)
      }
    } else if (key.backspace) {
      setInput(prev => prev.slice(0, -1))
      setCursorPos(prev => Math.max(0, prev - 1))
    } else if (key.delete) {
      setInput(prev => prev.slice(0, cursorPos) + prev.slice(cursorPos + 1))
    } else if (key.leftArrow) {
      setCursorPos(prev => Math.max(0, prev - 1))
    } else if (key.rightArrow) {
      setCursorPos(prev => Math.min(input.length, prev + 1))
    } else if (key.upArrow) {
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
        setCursorPos(history[newIndex].length)
      }
    } else if (key.downArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
        setCursorPos(history[newIndex].length)
      } else {
        setHistoryIndex(-1)
        setInput('')
        setCursorPos(0)
      }
    } else if (key.ctrlC) {
      onInterrupt?.()
    } else if (input && !key.ctrl && !key.shift) {
      setInput(prev => prev.slice(0, cursorPos) + input + prev.slice(cursorPos))
      setCursorPos(prev => prev + input.length)
    }
  })

  return (
    <Box flexDirection="column" width={process.stdout.columns || 80}>
      {/* Header */}
      <Box flexDirection="column" borderStyle="round" borderColor={BRAND.primary} padding={1}>
        <Text bold color={BRAND.primary}>
          🦞 NOLE CODE
        </Text>
        <Text dimColor>
          AI coding assistant · Powered by MiniMax · Ctrl+C to interrupt · Ctrl+L to clear
        </Text>
      </Box>

      <Newline />

      {/* Messages */}
      <Box flexDirection="column" overflow="hidden">
        {messages.map(msg => (
          <MessageBlock key={msg.id} message={msg} />
        ))}
      </Box>

      {/* Loading indicator */}
      {isLoading && (
        <Box>
          <Text color={BRAND.primary}>⏳ Nole is thinking...</Text>
        </Box>
      )}

      <Newline />

      {/* Input */}
      <Box flexDirection="row">
        <Text color={BRAND.user}>➜</Text>
        <Text color={BRAND.dim}> </Text>
        <Text color={BRAND.user}>you</Text>
        <Text color={BRAND.dim}> │ </Text>
        <Box flexDirection="row" flexGrow={1}>
          <Text color={BRAND.secondary}>
            {input.slice(0, cursorPos)}
          </Text>
          <Text color={BRAND.secondary} bold>
            ▌
          </Text>
          <Text color={BRAND.secondary}>
            {input.slice(cursorPos + 1)}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}

function MessageBlock({ message }: { message: Message }) {
  const roleColor = message.role === 'user'
    ? BRAND.user
    : message.role === 'assistant'
    ? BRAND.assistant
    : message.role === 'tool'
    ? BRAND.warning
    : BRAND.dim

  const roleLabel = message.role === 'user' ? 'you' : message.role === 'assistant' ? 'nole' : message.role

  const prefix = message.role === 'user' ? '➜' : message.role === 'assistant' ? '🤖' : '🔧'

  return (
    <Box flexDirection="column" marginY={0}>
      <Box flexDirection="row">
        <Text dimColor>{prefix} </Text>
        <Text color={roleColor} bold>{roleLabel}</Text>
        <Text dimColor>: </Text>
      </Box>
      <Box paddingLeft={3} flexDirection="column">
        <Text white wrap="wrap">
          {message.content}
        </Text>
      </Box>
      <Newline />
    </Box>
  )
}

// Welcome screen
export function Welcome() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={BRAND.primary} fontSize="large">
        🦞 NOLE CODE
      </Text>
      <Text dimColor>v1.0.0 · AI coding assistant</Text>
      <Newline />
      <Text>
        <Text color={BRAND.success}>✓</Text>{' '}
        <Text color={BRAND.primary}>MiniMax</Text> connected
      </Text>
      <Text>
        <Text color={BRAND.success}>✓</Text>{' '}
        Tool system ready
      </Text>
      <Text>
        <Text color={BRAND.success}>✓</Text>{' '}
        MCP servers supported
      </Text>
      <Newline />
      <Text dimColor>
        Type your message and press Enter to start coding.
      </Text>
      <Text dimColor>
        Example: "Create a Node.js REST API with Express"
      </Text>
    </Box>
  )
}

export { BRAND }
