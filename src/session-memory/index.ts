/**
 * Session Memory System
 * Extracts and preserves key facts from coding sessions
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { roughTokenCount } from '../utils/count-tokens.js'

// Default session memory template
const SESSION_MEMORY_TEMPLATE = `# Session Title
_A short 5-10 word descriptive title for this session_

# Current State
_What is being worked on right now. Pending tasks. Immediate next steps._

# Task Specification
_What did the user ask to build? Design decisions made._

# Files and Functions
_Important files and their purpose_

# Workflow
_Bash commands typically run and their purpose_

# Errors & Fixes
_Errors encountered and solutions found_

# Key Results
_Specific outputs: answers, tables, documents created_

# Worklog
_Step-by-step terse summary of what was done_
`

const MEMORY_DIR = join(homedir(), '.nole-code', 'memory')

export interface SessionMemory {
  title: string
  currentState: string
  taskSpec: string
  filesAndFunctions: string
  workflow: string
  errorsAndFixes: string
  keyResults: string
  worklog: string
  lastUpdated: string
}

/**
 * Get memory file path for a session
 */
export function getMemoryPath(sessionId: string): string {
  mkdirSync(MEMORY_DIR, { recursive: true })
  return join(MEMORY_DIR, `${sessionId}.md`)
}

/**
 * Load session memory
 */
export function loadMemory(sessionId: string): SessionMemory {
  const path = getMemoryPath(sessionId)
  if (!existsSync(path)) {
    return {
      title: '',
      currentState: '',
      taskSpec: '',
      filesAndFunctions: '',
      workflow: '',
      errorsAndFixes: '',
      keyResults: '',
      worklog: '',
      lastUpdated: new Date().toISOString(),
    }
  }
  
  const content = readFileSync(path, 'utf-8')
  return parseMemoryContent(content)
}

/**
 * Parse memory content into structured format
 */
export function parseMemoryContent(content: string): SessionMemory {
  const sections = {
    title: extractSection(content, 'Session Title'),
    currentState: extractSection(content, 'Current State'),
    taskSpec: extractSection(content, 'Task Specification'),
    filesAndFunctions: extractSection(content, 'Files and Functions'),
    workflow: extractSection(content, 'Workflow'),
    errorsAndFixes: extractSection(content, 'Errors & Fixes'),
    keyResults: extractSection(content, 'Key Results'),
    worklog: extractSection(content, 'Worklog'),
  }
  
  return {
    ...sections,
    lastUpdated: new Date().toISOString(),
  }
}

function extractSection(content: string, sectionName: string): string {
  const lines = content.split('\n')
  let inSection = false
  const sectionLines: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed === `# ${sectionName}` || trimmed === `## ${sectionName}`) {
      inSection = true
      continue
    }
    
    if (inSection) {
      if (line.startsWith('# ') || line.startsWith('## ')) {
        break // Next section
      }
      sectionLines.push(line)
    }
  }
  
  return sectionLines.join('\n').trim()
}

/**
 * Save session memory
 */
export function saveMemory(sessionId: string, memory: Partial<SessionMemory>): void {
  const existing = loadMemory(sessionId)
  const merged = { ...existing, ...memory, lastUpdated: new Date().toISOString() }
  
  const path = getMemoryPath(sessionId)
  const content = formatMemory(merged)
  writeFileSync(path, content, 'utf-8')
}

/**
 * Format memory as markdown
 */
export function formatMemory(memory: SessionMemory): string {
  return `# Session Title
${memory.title || '_Short descriptive title_'}

# Current State
${memory.currentState || '_What is being worked on_'}

# Task Specification
${memory.taskSpec || '_What was asked to build_'}

# Files and Functions
${memory.filesAndFunctions || '_Important files and their purpose_'}

# Workflow
${memory.workflow || '_Bash commands and their purpose_'}

# Errors & Fixes
${memory.errorsAndFixes || '_Errors encountered and solutions_'}

# Key Results
${memory.keyResults || '_Specific outputs created_'}

# Worklog
${memory.worklog || '_Step-by-step summary of actions_'}

---
_Last updated: ${memory.lastUpdated}_
`
}

/**
 * Update specific memory section
 */
export function updateMemorySection(
  sessionId: string, 
  section: keyof SessionMemory, 
  content: string,
  append = false
): void {
  const memory = loadMemory(sessionId)
  const existing = (memory[section] as string) || ''
  const newContent = append && existing 
    ? `${existing}\n- ${content}`
    : content
  saveMemory(sessionId, { [section]: newContent })
}

/**
 * Add to worklog
 */
export function addToWorklog(sessionId: string, entry: string): void {
  const memory = loadMemory(sessionId)
  const timestamp = new Date().toISOString().slice(11, 19)
  const logEntry = `[${timestamp}] ${entry}`
  const existing = memory.worklog || ''
  saveMemory(sessionId, { 
    worklog: existing ? `${existing}\n${logEntry}` : logEntry 
  })
}

/**
 * Extract key facts from conversation
 * Called during compaction to preserve important information
 */
export async function extractMemoryFromConversation(
  messages: Array<{role: string, content: string}>,
  sessionId: string
): Promise<void> {
  // Paths that should never be recorded
  const BLOCKED_PREFIXES = ['/dev/', '/tmp/', '/proc/', '/sys/', '/.ssh/']

  // Extract files that were created or modified
  const filePatterns = [
    /(?:Created|Wrote|Saved|Modified|Edited)\s+([^\s'"`\n]+)/gi,
    /(?:File|Path):\s+([^\s'"`\n]+)/gi,
  ]
  const files = new Set<string>()
  for (const msg of messages) {
    const text = typeof msg.content === 'string' ? msg.content : ''
    for (const pattern of filePatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const file = match[1].trim()
        if (
          file.length > 1 &&
          !BLOCKED_PREFIXES.some(p => file.startsWith(p)) &&
          !file.startsWith('http') &&
          !file.match(/^[0-9a-f]{8,}/i)
        ) {
          files.add(file)
        }
      }
    }
  }

  // Extract errors and solutions
  const errorPattern = /(?:Error|error|failed|Failed|exception):\s*(.+)/gi
  const errors: string[] = []
  for (const msg of messages) {
    const text = typeof msg.content === 'string' ? msg.content : ''
    let match
    while ((match = errorPattern.exec(text)) !== null) {
      errors.push(match[1].trim().slice(0, 100))
    }
  }

  // Update memory with findings
  if (files.size > 0) {
    updateMemorySection(
      sessionId,
      'filesAndFunctions',
      Array.from(files).join(', '),
      true
    )
  }

  if (errors.length > 0) {
    updateMemorySection(
      sessionId,
      'errorsAndFixes',
      errors.slice(-5).join(' | '),
      true
    )
  }
}

/**
 * Get memory summary for system prompt
 */
export function getMemorySummary(sessionId: string): string {
  const memory = loadMemory(sessionId)
  
  if (!memory.title && !memory.currentState && !memory.worklog) {
    return '' // No memory yet
  }
  
  const parts: string[] = []
  
  if (memory.title) {
    parts.push(`Session: ${memory.title}`)
  }
  if (memory.currentState) {
    parts.push(`Current: ${memory.currentState}`)
  }
  if (memory.filesAndFunctions) {
    parts.push(`Files: ${memory.filesAndFunctions}`)
  }
  if (memory.errorsAndFixes) {
    parts.push(`Errors: ${memory.errorsAndFixes}`)
  }
  
  return parts.join(' | ')
}
