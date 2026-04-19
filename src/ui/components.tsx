// Nole Code - Ink Terminal UI Components
// Full Claude Code-style terminal with React/Ink
// Branded as Nole Code

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Text,
  Newline,
  Spacer,
  useInput,
} from 'ink'

// Brand colors
export const C = {
  primary: '#00D4AA',    // Nole teal
  accent: '#FF6B35',     // Orange
  dim: '#6B7280',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  user: '#60A5FA',       // Blue for user
  assistant: '#A78BFA',  // Purple for Nole
  tool: '#F472B6',       // Pink for tools
  system: '#94A3B8',
}

interface Message {
  id: string
  role: 'user' | 'nole' | 'tool' | 'system' | 'error'
  content: string
  timestamp: Date
  toolName?: string
}

interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'running' | 'done' | 'error'
  result?: string
}

interface TerminalProps {
  messages: Message[]
  toolCalls: ToolCall[]
  onSend: (text: string) => void
  onInterrupt: () => void
  isLoading: boolean
}

export function Terminal({ messages, toolCalls, onSend, onInterrupt, isLoading }: TerminalProps) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [scrollOffset, setScrollOffset] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const maxVisible = 20

  useInput((input, key) => {
    if (key.return) {
      if (input.trim()) {
        onSend(input.trim())
        setHistory(prev => [input.trim(), ...prev.slice(0, 49)])
        setHistoryIndex(-1)
        setInput('')
      }
    } else if (key.backspace) {
      setInput(prev => prev.slice(0, -1))
    } else if (key.upArrow) {
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
      }
    } else if (key.downArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    } else if (key.ctrlC) {
      onInterrupt()
    } else if (key.ctrlL) {
      setScrollOffset(0)
    } else if (key.pageUp) {
      setScrollOffset(prev => Math.min(prev + maxVisible, Math.max(0, messages.length - maxVisible)))
    } else if (key.pageDown) {
      setScrollOffset(prev => Math.max(0, prev - maxVisible))
    } else if (input && !key.ctrl && !key.meta) {
      setInput(prev => prev + input)
    }
  })

  // scrollOffset 0 = show latest messages (bottom), increasing = scroll toward older
  const start = Math.max(0, messages.length - maxVisible - scrollOffset)
  const visibleMessages = messages.slice(start, start + maxVisible)

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={C.primary}
        paddingX={1}
        marginBottom={1}
      >
        <Text bold color={C.primary}>🦞 NOLE CODE</Text>
        <Text dimColor>Ctrl+C interrupt · Ctrl+L clear · ↑↓ history</Text>
      </Box>

      <Newline />

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {visibleMessages.map((msg, i) => (
          <MessageView key={msg.id} message={msg} isLast={i === visibleMessages.length - 1} />
        ))}
      </Box>

      {/* Tool calls in progress */}
      {toolCalls.length > 0 && (
        <Box flexDirection="column" marginY={1}>
          {toolCalls.map(tc => (
            <Box key={tc.id} flexDirection="row">
              <Text color={C.dim}>  </Text>
              {tc.status === 'pending' && <Text color={C.dim}>⏳ {tc.name}</Text>}
              {tc.status === 'running' && <Text color={C.warning}>🔄 {tc.name}</Text>}
              {tc.status === 'done' && <Text color={C.success}>✅ {tc.name}</Text>}
              {tc.status === 'error' && <Text color={C.error}>❌ {tc.name}</Text>}
            </Box>
          ))}
        </Box>
      )}

      {/* Loading indicator */}
      {isLoading && toolCalls.length === 0 && (
        <Text color={C.primary}>⏳ Nole is thinking...</Text>
      )}

      <Newline />

      {/* Input */}
      <Box flexDirection="row" alignItems="center">
        <Text color={C.user}>➜</Text>
        <Text color={C.dim}> you │ </Text>
        <Text color={C.assistant} bold>{input}</Text>
        <Text color={C.primary} bold>▌</Text>
      </Box>
    </Box>
  )
}

function MessageView({ message, isLast }: { message: Message; isLast: boolean }) {
  const roleColor = message.role === 'user' ? C.user
    : message.role === 'nole' ? C.assistant
    : message.role === 'tool' ? C.tool
    : message.role === 'error' ? C.error
    : C.dim

  const roleIcon = message.role === 'user' ? '➜'
    : message.role === 'nole' ? '🤖'
    : message.role === 'tool' ? '🔧'
    : message.role === 'error' ? '❌'
    : 'ℹ'

  const roleLabel = message.role === 'user' ? 'you'
    : message.role === 'nole' ? 'nole'
    : message.role === 'tool' ? (message.toolName || 'tool')
    : message.role === 'error' ? 'error'
    : 'system'

  // Word wrap content
  const maxWidth = process.stdout.columns || 80
  const contentWidth = maxWidth - 6

  return (
    <Box flexDirection="column" marginY={0}>
      <Box flexDirection="row">
        <Text dimColor>{roleIcon} </Text>
        <Text color={roleColor} bold>{roleLabel}</Text>
        <Text dimColor>: </Text>
        {message.toolName && (
          <Text color={C.tool}>[{message.toolName}] </Text>
        )}
      </Box>
      <Box paddingLeft={3} flexDirection="column">
        <Text wrap="wrap" white>{message.content}</Text>
      </Box>
    </Box>
  )
}

// Welcome screen
export function Welcome({ hasApiKey }: { hasApiKey: boolean }) {
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor={C.primary}>
      <Text bold color={C.primary} >🦞 NOLE CODE</Text>
      <Text dimColor>v1.0.0 · AI coding assistant powered by MiniMax</Text>
      <Newline />
      {hasApiKey ? (
        <>
          <Text color={C.success}>✅ MiniMax API connected</Text>
          <Text color={C.success}>✅ Tool system ready</Text>
          <Text color={C.success}>✅ MCP servers supported</Text>
        </>
      ) : (
        <>
          <Text color={C.error}>❌ MINIMAX_API_KEY not set</Text>
          <Text dimColor>Run: export MINIMAX_API_KEY=your_key</Text>
        </>
      )}
      <Newline />
      <Text dimColor>Type your message and press Enter.</Text>
      <Text dimColor>Example: "Create a REST API with Express and TypeScript"</Text>
      <Newline />
      <Text dimColor>Commands: /help /sessions /cost /doctor</Text>
    </Box>
  )
}

// Spinner component for loading states
export function Spinner({ label }: { label: string }) {
  const [frame, setFrame] = useState(0)
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % frames.length), 80)
    return () => clearInterval(id)
  }, [])

  return (
    <Text color={C.primary}>
      {frames[frame]} {label}
    </Text>
  )
}

// Progress bar
export function ProgressBar({
  value,
  max,
  label,
  width = 40,
}: {
  value: number
  max: number
  label?: string
  width?: number
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const filled = Math.round((value / max) * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return (
    <Text>
      {label && `${label} `}
      <Text color={C.primary}>[{bar}]</Text>
      <Text dimColor> {pct}%</Text>
    </Text>
  )
}
