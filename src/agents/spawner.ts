// Nole Code - Agent Spawner
// Spawns sub-agents as isolated child processes
// Architecture from Nole Code's AgentTool

import { spawn, execSync, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { LLMClient } from '../api/llm.js'
import { getToolDefinitions, executeTool } from '../tools/registry.js'
import { MINIMAX_API_KEY } from '../utils/env.js'

export interface Agent {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled'
  pid?: number
  result?: string
  createdAt: Date
  cwd: string
  parentSessionId: string
}

export interface AgentMessage {
  type: 'tool_call' | 'tool_result' | 'output' | 'error' | 'done' | 'progress'
  agentId: string
  payload: unknown
}

// Agent registry
const agents = new Map<string, Agent>()
const agentProcesses = new Map<string, ChildProcess>()
const agentEmitter = new EventEmitter()

export function getAgent(id: string): Agent | undefined {
  return agents.get(id)
}

export function getAllAgents(): Agent[] {
  return Array.from(agents.values())
}

export function killAgent(id: string): boolean {
  const proc = agentProcesses.get(id)
  if (proc && !proc.killed) {
    proc.kill('SIGTERM')
    agentProcesses.delete(id)
  }
  const agent = agents.get(id)
  if (agent) {
    agent.status = 'cancelled'
  }
  return true
}

// Message bus for agent communication
export function sendToAgent(agentId: string, message: string): void {
  const proc = agentProcesses.get(agentId)
  if (proc && proc.stdin) {
    proc.stdin.write(JSON.stringify({ type: 'message', content: message }) + '\n')
  }
}

export function onAgentMessage(cb: (msg: AgentMessage) => void): () => void {
  agentEmitter.on('message', cb)
  return () => agentEmitter.off('message', cb)
}

// Spawn a sub-agent
export async function spawnAgent(options: {
  name?: string
  description: string
  prompt: string
  cwd?: string
  background?: boolean
  isolation?: 'worktree' | 'none'
}): Promise<Agent> {
  const id = `agent_${randomUUID().slice(0, 8)}`
  const workDir = options.cwd || process.cwd()

  // Create worktree if isolation requested
  let actualCwd = workDir
  if (options.isolation === 'worktree') {
    actualCwd = await createWorktree(workDir, id)
  }

  const agent: Agent = {
    id,
    name: options.name || id,
    description: options.description,
    status: 'pending',
    createdAt: new Date(),
    cwd: actualCwd,
    parentSessionId: '',
  }

  agents.set(id, agent)

  // Create the agent script
  const agentScript = createAgentScript({
    id,
    description: options.description,
    prompt: options.prompt,
    cwd: actualCwd,
    apiKey: MINIMAX_API_KEY,
  })

  const scriptPath = join(homedir(), '.nole-code', 'agents', `${id}.js`)
  mkdirSync(join(homedir(), '.nole-code', 'agents'), { recursive: true })
  writeFileSync(scriptPath, agentScript, 'utf-8')

  // Spawn the agent process
  const proc = spawn('node', [scriptPath], {
    cwd: actualCwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MINIMAX_API_KEY },
  })

  agent.pid = proc.pid
  agent.status = 'running'
  agentProcesses.set(id, proc)

  // Handle output
  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as AgentMessage
        if (msg.type === 'output') {
          agentEmitter.emit('message', msg)
        } else if (msg.type === 'done') {
          agent.status = 'done'
          agent.result = msg.payload as string
          agentEmitter.emit('message', { ...msg, agentId: id })
        } else if (msg.type === 'error') {
          agent.status = 'error'
          agentEmitter.emit('message', { ...msg, agentId: id })
        } else if (msg.type === 'progress') {
          agentEmitter.emit('message', { ...msg, agentId: id })
        }
      } catch {}
    }
  })

  proc.stderr?.on('data', (data: Buffer) => {
    agentEmitter.emit('message', {
      type: 'error',
      agentId: id,
      payload: data.toString(),
    } as AgentMessage)
  })

  proc.on('exit', (code) => {
    if (code !== 0 && agent.status !== 'done') {
      agent.status = 'error'
    }
    agentProcesses.delete(id)
  })

  return agent
}

function createAgentScript(opts: {
  id: string
  description: string
  prompt: string
  cwd: string
  apiKey: string
}): string {
  // Escape for safe embedding in template literal
  const safePrompt = opts.prompt.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
  const safeDesc = opts.description.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
  const safeCwd = opts.cwd.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')

  return `
// Nole Code Agent - ${opts.id}
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const API_KEY = process.env.MINIMAX_API_KEY || '';
const BASE_URL = 'https://api.minimax.io/anthropic/v1/messages';
const AGENT_CWD = ${JSON.stringify(opts.cwd)};

const TOOLS = [
  { name: 'Bash', description: 'Execute shell command', input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
  { name: 'Read', description: 'Read a file', input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'Write', description: 'Write a file', input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
  { name: 'Edit', description: 'Edit file by replacing text', input_schema: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['path', 'old_text', 'new_text'] } },
  { name: 'Grep', description: 'Search for pattern in files', input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern', 'path'] } },
];

async function chat(messages) {
  const sysMsg = messages.find(m => m.role === 'system');
  const body = {
    model: 'MiniMax-M2.7',
    max_tokens: 4096,
    messages: messages.filter(m => m.role !== 'system'),
    tools: TOOLS,
  };
  if (sysMsg) body.system = sysMsg.content;
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API error: ' + res.status + ' ' + (await res.text()));
  return await res.json();
}

function execTool(name, input) {
  try {
    if (name === 'Bash') return execFileSync('/bin/bash', ['-c', input.command], { cwd: AGENT_CWD, timeout: 30000, maxBuffer: 10*1024*1024 }).toString();
    if (name === 'Read') return fs.readFileSync(path.resolve(AGENT_CWD, input.path), 'utf8').slice(0, 10000);
    if (name === 'Write') { fs.writeFileSync(path.resolve(AGENT_CWD, input.path), input.content, 'utf8'); return 'Written ' + input.content.length + ' chars'; }
    if (name === 'Edit') { const p = path.resolve(AGENT_CWD, input.path); let c = fs.readFileSync(p, 'utf8'); c = c.replace(input.old_text, input.new_text); fs.writeFileSync(p, c, 'utf8'); return 'Edited ' + input.path; }
    if (name === 'Grep') return execFileSync('grep', ['-rn', input.pattern, path.resolve(AGENT_CWD, input.path)], { timeout: 10000 }).toString().slice(0, 3000);
    return 'Unknown tool: ' + name;
  } catch (e) { return 'Error: ' + e.message; }
}

async function run() {
  const messages = [
    { role: 'system', content: ${JSON.stringify(`You are Nole, an expert AI coding assistant.\n\nTask: ${opts.description}\n\n${opts.prompt}\n\nWork in: ${opts.cwd}\nBe concise. Write real working code. Report completion with a summary.`)} },
    { role: 'user', content: ${JSON.stringify(opts.prompt)} },
  ];

  for (let turn = 0; turn < 15; turn++) {
    process.stdout.write(JSON.stringify({ type: 'progress', agentId: ${JSON.stringify(opts.id)}, payload: 'Turn ' + (turn+1) }) + '\\n');

    const data = await chat(messages);
    const content = data.content || [];

    let text = '';
    const toolCalls = [];
    for (const block of content) {
      if (block.type === 'text') text += block.text;
      if (block.type === 'tool_use') toolCalls.push(block);
    }

    if (text) {
      process.stdout.write(JSON.stringify({ type: 'output', agentId: ${JSON.stringify(opts.id)}, payload: text }) + '\\n');
    }

    if (toolCalls.length === 0) {
      messages.push({ role: 'assistant', content: text });
      break;
    }

    messages.push({ role: 'assistant', content: content });

    for (const tc of toolCalls) {
      const result = execTool(tc.name, tc.input || {});
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: tc.id, content: result.slice(0, 5000) }] });
    }
  }

  const summary = messages.filter(m => m.role === 'assistant').map(m => typeof m.content === 'string' ? m.content : '').join('\\n').slice(0, 1000);
  process.stdout.write(JSON.stringify({ type: 'done', agentId: ${JSON.stringify(opts.id)}, payload: summary || 'Completed' }) + '\\n');
  process.exit(0);
}

run().catch(e => {
  process.stderr.write(e.message + '\\n');
  process.exit(1);
});
`
}

// Worktree management
async function createWorktree(repoPath: string, slug: string): Promise<string> {
  const worktreeDir = join(homedir(), '.nole-code', 'worktrees', slug)

  try {
    // Check if we're in a git repo
    const gitDir = join(repoPath, '.git')
    if (!existsSync(gitDir)) {
      // Not a git repo, just use the directory as-is
      return repoPath
    }

    mkdirSync(worktreeDir, { recursive: true })

    // Create worktree
    execSync(`git worktree add "${worktreeDir}" --checkout`, {
      cwd: repoPath,
      stdio: 'ignore',
    })

    return worktreeDir
  } catch {
    // Fallback: use the original directory
    return repoPath
  }
}

export async function removeWorktree(slug: string): Promise<void> {
  const worktreeDir = join(homedir(), '.nole-code', 'worktrees', slug)

  try {
    execSync(`git worktree remove "${worktreeDir}" --force`, {
      stdio: 'ignore',
    })
  } catch {}
}
