// Nole Code - Extended Tools
// Additional tools adapted from Nole Code's leaked source

import { execSync, spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'

// ============ Brief Tool (SendUserMessage) ============
// Send a message directly to the user

export interface BriefMessage {
  type: 'message' | 'progress' | 'error' | 'done'
  content: string
  status?: 'normal' | 'proactive'
  attachments?: string[]
}

class BriefOutput {
  private messages: BriefMessage[] = []

  send(content: string, opts?: { status?: 'normal' | 'proactive'; attachments?: string[] }) {
    this.messages.push({
      type: 'message',
      content,
      status: opts?.status || 'normal',
      attachments: opts?.attachments,
    })
  }

  progress(content: string) {
    this.messages.push({ type: 'progress', content })
  }

  error(content: string) {
    this.messages.push({ type: 'error', content })
  }

  done(content: string) {
    this.messages.push({ type: 'done', content })
  }

  getMessages(): BriefMessage[] {
    return this.messages
  }

  clear() {
    this.messages = []
  }
}

export const brief = new BriefOutput()

// ============ Config Tool ============
// Read and write Nole Code settings

export interface NoleConfig {
  [key: string]: unknown
}

const CONFIG_FILE = join(homedir(), '.nole-code', 'settings.json')

export function getConfig(key?: string): NoleConfig | unknown {
  try {
    if (!existsSync(CONFIG_FILE)) return {}
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    if (key) return config[key]
    return config
  } catch { return key ? undefined : {} }
}

export function setConfig(key: string, value: unknown): void {
  try {
    let config: NoleConfig = {}
    if (existsSync(CONFIG_FILE)) {
      config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    }
    config[key] = value
    mkdirSync(dirname(CONFIG_FILE), { recursive: true })
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch (err) {
    throw new Error(`Failed to set config: ${err}`)
  }
}

export function deleteConfig(key: string): void {
  try {
    if (!existsSync(CONFIG_FILE)) return
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    delete config[key]
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch {}
}

// ============ SyntheticOutput Tool ============
// Format and display structured output

export interface OutputStyle {
  type: 'code' | 'table' | 'list' | 'json' | 'markdown' | 'diff'
  content: string
  language?: string
}

export class SyntheticOutput {
  static code(content: string, language = ''): OutputStyle {
    return { type: 'code', content, language }
  }

  static table(headers: string[], rows: string[][]): OutputStyle {
    const lines = [
      headers.join(' | '),
      headers.map(() => '---').join(' | '),
      ...rows.map(r => r.join(' | ')),
    ]
    return { type: 'table', content: lines.join('\n') }
  }

  static list(items: string[]): OutputStyle {
    return { type: 'list', content: items.map((i, n) => `${n + 1}. ${i}`).join('\n') }
  }

  static json(data: unknown, pretty = true): OutputStyle {
    return { type: 'json', content: JSON.stringify(data, null, pretty ? 2 : 0) }
  }

  static diff(oldContent: string, newContent: string): OutputStyle {
    // Simple line-by-line diff
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    const result: string[] = []

    for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
      if (oldLines[i] !== newLines[i]) {
        if (oldLines[i] !== undefined) result.push(`- ${oldLines[i]}`)
        if (newLines[i] !== undefined) result.push(`+ ${newLines[i]}`)
      }
    }

    return { type: 'diff', content: result.join('\n') }
  }

  static markdown(content: string): OutputStyle {
    return { type: 'markdown', content }
  }

  static render(style: OutputStyle): string {
    switch (style.type) {
      case 'code':
        return `\`\`\`${style.language || ''}\n${style.content}\n\`\`\``
      case 'table':
      case 'list':
      case 'markdown':
        return style.content
      case 'json':
        return `\`\`\`json\n${style.content}\n\`\`\``
      case 'diff':
        return `\`\`\`diff\n${style.content}\n\`\`\``
      default:
        return style.content
    }
  }
}

// ============ RemoteTrigger Tool ============
// Trigger actions in remote sessions

export interface RemoteTriggerConfig {
  url: string
  token?: string
}

export async function remoteTrigger(
  url: string,
  action: string,
  params?: Record<string, unknown>,
  token?: string,
): Promise<string> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action, ...params }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return JSON.stringify(data)
  } catch (err) {
    return `Remote trigger error: ${err}`
  }
}

// ============ ScheduleCron Tool ============
// Schedule tasks for later execution

export interface ScheduledTask {
  id: string
  cron: string
  command: string
  cwd?: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
}

const CRON_FILE = join(homedir(), '.nole-code', 'cron.json')

function loadCronTasks(): ScheduledTask[] {
  try {
    if (existsSync(CRON_FILE)) {
      return JSON.parse(readFileSync(CRON_FILE, 'utf-8'))
    }
  } catch {}
  return []
}

function saveCronTasks(tasks: ScheduledTask[]): void {
  mkdirSync(dirname(CRON_FILE), { recursive: true })
  writeFileSync(CRON_FILE, JSON.stringify(tasks, null, 2))
}

export function scheduleTask(cron: string, command: string, cwd?: string): ScheduledTask {
  const tasks = loadCronTasks()
  const task: ScheduledTask = {
    id: `cron_${Date.now()}`,
    cron,
    command,
    cwd,
    enabled: true,
  }
  tasks.push(task)
  saveCronTasks(tasks)
  return task
}

export function listScheduledTasks(): ScheduledTask[] {
  return loadCronTasks()
}

export function deleteScheduledTask(id: string): boolean {
  const tasks = loadCronTasks()
  const filtered = tasks.filter(t => t.id !== id)
  if (filtered.length !== tasks.length) {
    saveCronTasks(filtered)
    return true
  }
  return false
}

export function toggleScheduledTask(id: string, enabled: boolean): boolean {
  const tasks = loadCronTasks()
  const task = tasks.find(t => t.id === id)
  if (task) {
    task.enabled = enabled
    saveCronTasks(tasks)
    return true
  }
  return false
}

// ============ ToolSearch Tool ============
// Search for available tools

export interface ToolInfo {
  name: string
  description: string
  category: string
  source: 'builtin' | 'mcp' | 'plugin'
}

const TOOL_REGISTRY: ToolInfo[] = [
  // Built-in
  { name: 'Bash', description: 'Execute shell commands', category: 'system', source: 'builtin' },
  { name: 'Read', description: 'Read file contents', category: 'file', source: 'builtin' },
  { name: 'Write', description: 'Write files', category: 'file', source: 'builtin' },
  { name: 'Edit', description: 'Edit files with search/replace', category: 'file', source: 'builtin' },
  { name: 'Glob', description: 'Find files by pattern', category: 'file', source: 'builtin' },
  { name: 'Grep', description: 'Search text in files', category: 'file', source: 'builtin' },
  { name: 'WebSearch', description: 'Search the web', category: 'web', source: 'builtin' },
  { name: 'WebFetch', description: 'Fetch URL content', category: 'web', source: 'builtin' },
  { name: 'TodoWrite', description: 'Track task list', category: 'task', source: 'builtin' },
  { name: 'TaskCreate', description: 'Create background task', category: 'task', source: 'builtin' },
  { name: 'TaskList', description: 'List tasks', category: 'task', source: 'builtin' },
  { name: 'Agent', description: 'Spawn sub-agent', category: 'agent', source: 'builtin' },
  { name: 'TeamCreate', description: 'Create agent team', category: 'agent', source: 'builtin' },
  { name: 'SendMessage', description: 'Send message to agent', category: 'agent', source: 'builtin' },
  { name: 'Sleep', description: 'Wait for duration', category: 'system', source: 'builtin' },
  { name: 'Exit', description: 'End session', category: 'system', source: 'builtin' },
]

export function searchTools(query: string, category?: string): ToolInfo[] {
  let tools = TOOL_REGISTRY

  if (category) {
    tools = tools.filter(t => t.category === category)
  }

  if (query) {
    const q = query.toLowerCase()
    tools = tools.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    )
  }

  return tools
}

export function getToolCategories(): string[] {
  const cats = new Set(TOOL_REGISTRY.map(t => t.category))
  return Array.from(cats).sort()
}

// ============ Notifier Tool ============
// Send desktop/system notifications

export function notify(title: string, body: string, urgent = false): void {
  try {
    if (process.platform === 'darwin') {
      execSync(`osascript -e 'display notification "${body.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"'`, { stdio: 'ignore' })
    } else if (process.platform === 'linux') {
      execSync(`notify-send ${urgent ? '-u critical' : ''} "${title}" "${body}"`, { stdio: 'ignore' })
    }
  } catch {
    // Fallback: just print
    console.log(`[NOTIFICATION] ${title}: ${body}`)
  }
}

// ============ WordPress Tools ============

export const wordpressTools = [
  {
    name: 'WordPressPost',
    description: 'Create a new WordPress post via REST API',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Post title' },
        content: { type: 'string', description: 'Post body content' },
        status: { type: 'string', description: 'draft, publish, or private', default: 'draft' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'WordPressUpdate',
    description: 'Update an existing WordPress post',
    input_schema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'Post ID to update' },
        title: { type: 'string', description: 'New post title' },
        content: { type: 'string', description: 'New post content' },
        status: { type: 'string', description: 'draft, publish, or private' },
      },
      required: ['post_id'],
    },
  },
]

// WordPress via Bash (curl) - no new tool registration needed
// Use Bash tool with: curl -s -X POST ...

export async function executeWordPressTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ content: string; isError?: boolean }> {
  const { WP_USER, WP_APP_PASSWORD, WP_API_URL } = await import('../utils/env.js')
  
  if (!WP_USER || !WP_APP_PASSWORD || !WP_API_URL) {
    return { content: 'WordPress credentials not configured. Set WP_USER, WP_APP_PASSWORD, WP_API_URL in .env', isError: true }
  }
  
  const credentials = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')
  
  if (name === 'WordPressPost') {
    const { title, content, status = 'draft' } = input as { title: string; content: string; status?: string }
    
    const response = await fetch(`${WP_API_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content, status }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      return { content: `WP post failed: ${response.status} ${error}`, isError: true }
    }
    
    const post = await response.json() as { id: number; link: string; title: { rendered: string } }
    return { content: `Post created: ID=${post.id} | ${post.link}` }
  }
  
  if (name === 'WordPressUpdate') {
    const { post_id, title, content, status } = input as { post_id: string; title?: string; content?: string; status?: string }
    
    const body: Record<string, unknown> = {}
    if (title) body.title = title
    if (content) body.content = content
    if (status) body.status = status
    
    const response = await fetch(`${WP_API_URL}/posts/${post_id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      const error = await response.text()
      return { content: `WP update failed: ${response.status} ${error}`, isError: true }
    }
    
    const post = await response.json() as { id: number; link: string }
    return { content: `Post ${post.id} updated: ${post.link}` }
  }
  
  return { content: `Unknown WP tool: ${name}`, isError: true }
}
