// Nole Code - Terminal UI
// Rich terminal interface inspired by Nole Code's REPL
// Adapted from Nole Code's UI architecture

import { EventEmitter } from 'events'
import { Readline } from 'readline'
import { c } from './output/styles.js'

// Vim mode imports
import { createInitialVimState, type VimState, type CommandState } from '../vim/types.js'
import { transition, type TransitionContext, type TransitionResult } from '../vim/transitions.js'
import { Cursor } from '../utils/Cursor.js'
import type { FindType, Operator, RecordedChange, TextObjScope } from '../vim/types.js'

export interface MessageBlock {
  id: string
  type: 'user' | 'nole' | 'tool' | 'system'
  content: string
  collapsed?: boolean
  expanded?: boolean
  background?: boolean
  lines?: number
  toolName?: string
  timestamp: string
}

export interface Shortcut {
  key: string
  description: string
  handler: () => void
}

class TerminalUI extends EventEmitter {
  private blocks: Map<string, MessageBlock> = new Map()
  private activeBlockId: string | null = null
  private backgroundTasks: Set<string> = new Set()
  private history: string[] = []
  private historyIndex = -1
  private shortcuts: Map<string, () => void> = new Map()
  private isLoading = false
  private loadingMessage = ''

  // Vim state
  private vimState: VimState = createInitialVimState()
  private vimText = ''
  private vimRegister = ''
  private vimRegisterLinewise = false
  private vimLastFind: { type: FindType; char: string } | null = null
  private vimLastChange: RecordedChange | null = null

  constructor() {
    super()
    this.registerDefaultShortcuts()
  }

  private registerDefaultShortcuts() {
    // Basic navigation
    this.shortcuts.set('ctrl-c', () => this.emit('interrupt'))
    this.shortcuts.set('ctrl-l', () => this.clearScreen())
    this.shortcuts.set('ctrl-o', () => this.expandActiveBlock())
    this.shortcuts.set('?', () => this.showShortcuts())
    this.shortcuts.set('q', () => this.quit())
    this.shortcuts.set('up', () => this.historyUp())
    this.shortcuts.set('down', () => this.historyDown())
    this.shortcuts.set('tab', () => this.cycleBlock())
    // Vim mode shortcuts
    this.shortcuts.set('esc', () => this.vimEnterNormal())
    this.shortcuts.set('i', () => this.vimEnterInsert())
    this.shortcuts.set('v', () => this.vimEnterVisual())
  }

  // ============ Vim Mode ============

  /**
   * Process a key through vim mode.
   * Returns true if the key was handled by vim, false to pass through.
   */
  processVimKey(key: string): boolean {
    // Handle ESC explicitly
    if (key === '\x1b') {
      this.vimEnterNormal()
      return true
    }

    const cmdState =
      this.vimState.mode === 'NORMAL'
        ? this.vimState.command
        : null

    if (cmdState) {
      const ctx = this.createVimContext()
      const result = transition(cmdState, key, ctx)

      if (result.execute) {
        result.execute()
      }

      if (result.next) {
        this.vimState = { mode: 'NORMAL', command: result.next }
      } else if (!result.next && !result.execute) {
        // Input didn't transition - check if it's a motion or other handled key
        // Stay in current state
      }

      return true // Always handle in NORMAL mode
    }

    // In INSERT mode, only ESC is handled specially
    if (this.vimState.mode === 'INSERT' && key === '\x1b') {
      this.vimEnterNormal()
      return true
    }

    return false // Pass to normal input handling
  }

  private createVimContext(): TransitionContext {
    const cursor = new Cursor(this.vimText, 0)
    let currentOffset = 0

    return {
      cursor,
      text: this.vimText,
      setText: (text: string) => {
        this.vimText = text
      },
      setOffset: (offset: number) => {
        currentOffset = offset
      },
      enterInsert: (offset: number) => {
        this.vimState = { mode: 'INSERT', insertedText: '' }
        currentOffset = offset
      },
      getRegister: () => this.vimRegister,
      setRegister: (content: string, linewise: boolean) => {
        this.vimRegister = content
        this.vimRegisterLinewise = linewise
      },
      getLastFind: () => this.vimLastFind,
      setLastFind: (type: FindType, char: string) => {
        this.vimLastFind = { type, char }
      },
      recordChange: (change: RecordedChange) => {
        this.vimLastChange = change
      },
    }
  }

  private vimEnterNormal(): void {
    this.vimState = { mode: 'NORMAL', command: { type: 'idle' } }
  }

  private vimEnterInsert(): void {
    this.vimState = { mode: 'INSERT', insertedText: '' }
  }

  private vimEnterVisual(): void {
    // Visual mode - future enhancement
    this.vimState = { mode: 'NORMAL', command: { type: 'idle' } }
  }

  /** Get current vim mode for display */
  getVimMode(): string {
    return this.vimState.mode
  }

  // ============ Message Rendering ============

  formatBlock(block: MessageBlock): string {
    const lines: string[] = []
    const border = '─'.repeat(60)

    switch (block.type) {
      case 'user':
        lines.push(c.bold(`\n❯ ${block.content}`))
        break

      case 'nole':
        lines.push(`\n${border}`)
        if (block.collapsed && block.lines) {
          lines.push(`● ${c.dim(block.content.slice(0, 80))}... +${block.lines} lines (ctrl+o to expand)`)
        } else {
          lines.push(`▼ ${c.dim(block.content.slice(0, 80))}`)
          lines.push(...block.content.split('\n').map((l: string) => `  ${l}`))
        }
        break

      case 'tool':
        lines.push(`\n${border}`)
        const icon = block.background ? '⟳' : '●'
        const prefix = block.toolName ? `[${block.toolName}] ` : ''
        if (block.collapsed && block.lines) {
          lines.push(`${icon} ${c.pink(prefix + block.content.slice(0, 80))}... +${block.lines} lines`)
        } else {
          lines.push(`${icon} ${c.pink(prefix + block.content)}`)
          if (block.background) {
            lines.push(`  ${c.dim('Running in the background (↓ to manage)')}`)
          }
        }
        break

      case 'system':
        lines.push(`\n${c.dim(`[${block.content}]`)}`)
        break
    }

    return lines.join('\n')
  }

  // ============ User Input ============

  createPrompt(rl: Readline): string {
    let prompt = '\n'
    if (this.isLoading) {
      prompt += c.dim('⟳ ')
    } else {
      prompt += `${c.cyan('❯')} `
    }
    return prompt
  }

  // ============ Message Management ============

  addUserMessage(content: string): string {
    const block: MessageBlock = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    this.blocks.set(block.id, block)
    this.activeBlockId = block.id
    return block.id
  }

  addNoleMessage(content: string, collapsed = false, lines?: number): string {
    const block: MessageBlock = {
      id: `msg_${Date.now()}`,
      type: 'nole',
      content,
      collapsed,
      lines,
      timestamp: new Date().toISOString(),
    }
    this.blocks.set(block.id, block)
    this.activeBlockId = block.id
    return block.id
  }

  addToolMessage(
    content: string,
    toolName?: string,
    opts: { collapsed?: boolean; lines?: number; background?: boolean } = {},
  ): string {
    const block: MessageBlock = {
      id: `tool_${Date.now()}`,
      type: 'tool',
      content,
      toolName,
      collapsed: opts.collapsed,
      lines: opts.lines,
      background: opts.background,
      timestamp: new Date().toISOString(),
    }
    this.blocks.set(block.id, block)
    if (opts.background) {
      this.backgroundTasks.add(block.id)
    }
    this.activeBlockId = block.id
    return block.id
  }

  addSystemMessage(content: string): string {
    const block: MessageBlock = {
      id: `sys_${Date.now()}`,
      type: 'system',
      content,
      timestamp: new Date().toISOString(),
    }
    this.blocks.set(block.id, block)
    return block.id
  }

  updateBlock(id: string, updates: Partial<MessageBlock>): void {
    const block = this.blocks.get(id)
    if (block) {
      Object.assign(block, updates)
    }
  }

  expandBlock(id: string): void {
    const block = this.blocks.get(id)
    if (block) {
      block.collapsed = false
      block.expanded = true
    }
  }

  collapseBlock(id: string): void {
    const block = this.blocks.get(id)
    if (block) {
      block.collapsed = true
      block.expanded = false
    }
  }

  toggleBlock(id: string): void {
    const block = this.blocks.get(id)
    if (block) {
      if (block.collapsed) {
        this.expandBlock(id)
      } else {
        this.collapseBlock(id)
      }
    }
  }

  private expandActiveBlock(): void {
    if (this.activeBlockId) {
      this.expandBlock(this.activeBlockId)
    }
  }

  // ============ Loading States ============

  setLoading(loading: boolean, message = ''): void {
    this.isLoading = loading
    this.loadingMessage = message
  }

  // ============ Background Tasks ============

  markBackground(id: string): void {
    this.backgroundTasks.add(id)
    const block = this.blocks.get(id)
    if (block) block.background = true
  }

  unmarkBackground(id: string): void {
    this.backgroundTasks.delete(id)
    const block = this.blocks.get(id)
    if (block) block.background = false
  }

  getBackgroundTasks(): MessageBlock[] {
    return Array.from(this.backgroundTasks).map(id => this.blocks.get(id)!).filter(Boolean)
  }

  // ============ History Navigation ============

  addToHistory(input: string): void {
    if (input && this.history[this.history.length - 1] !== input) {
      this.history.push(input)
      this.historyIndex = this.history.length
    }
  }

  historyUp(): string | null {
    if (this.historyIndex > 0) {
      this.historyIndex--
      return this.history[this.historyIndex]
    }
    return null
  }

  historyDown(): string | null {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++
      return this.history[this.historyIndex]
    }
    return ''
  }

  // ============ Utilities ============

  clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[H')
  }

  showShortcuts(): void {
    const lines = [
      '',
      'Shortcuts:',
      '─────────────────────────────────',
    ]
    for (const [key, fn] of this.shortcuts) {
      const desc = this.getShortcutDescription(key)
      lines.push(`  ${key.padEnd(12)} ${desc}`)
    }
    lines.push('─────────────────────────────────')
    process.stdout.write(lines.join('\n') + '\n')
  }

  private getShortcutDescription(key: string): string {
    const descriptions: Record<string, string> = {
      'ctrl-c': 'Cancel current operation',
      'ctrl-l': 'Clear screen',
      'ctrl-o': 'Expand current block',
      '?': 'Show shortcuts',
      'q': 'Quit',
      'tab': 'Cycle through blocks',
    }
    return descriptions[key] || ''
  }

  private cycleBlock(): void {
    const ids = Array.from(this.blocks.keys())
    if (ids.length === 0) return
    const idx = ids.indexOf(this.activeBlockId || '')
    this.activeBlockId = ids[(idx + 1) % ids.length]
  }

  private quit(): void {
    this.emit('quit')
  }

  // ============ Render All ============

  renderAll(): string {
    const lines: string[] = []
    for (const [, block] of this.blocks) {
      lines.push(this.formatBlock(block))
    }
    return lines.join('\n')
  }

  // ============ ANSI Color Helpers ============

  static readonly colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    pink: '\x1b[38;5;206m',
    red: '\x1b[31m',
    white: '\x1b[37m',
  }
}

export const term = new TerminalUI()
