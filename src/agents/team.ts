// Nole Code - Team System
// Multi-agent coordination with message passing
// Adapted from Nole Code's TeamCreate/SendMessage architecture

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { spawnAgent, getAgent, killAgent, type Agent } from './spawner.js'
import { loadSession, saveSession, createSession, type Session } from '../session/manager.js'

export interface TeamMember {
  id: string
  name: string
  role: string
  agentId: string
  status: 'idle' | 'busy' | 'offline'
  inbox: TeamMessage[]
}

export interface TeamMessage {
  id: string
  from: string
  to: string
  content: string
  timestamp: string
  type: 'message' | 'task' | 'result' | 'error'
  taskId?: string
}

export interface Team {
  id: string
  name: string
  members: Map<string, TeamMember>
  messages: TeamMessage[]
  createdAt: string
  parentSessionId: string
}

// Team registry
const teams = new Map<string, Team>()
const teamEmitter = new EventEmitter()

export async function createTeam(opts: {
  name: string
  members?: Array<{ name: string; role: string; prompt?: string }>
  parentSessionId?: string
}): Promise<Team> {
  const id = `team_${randomUUID().slice(0, 8)}`
  const team: Team = {
    id,
    name: opts.name,
    members: new Map(),
    messages: [],
    createdAt: new Date().toISOString(),
    parentSessionId: opts.parentSessionId || '',
  }

  // Spawn member agents
  for (const member of opts.members || []) {
    const agent = await spawnAgent({
      name: member.name,
      description: member.role,
      prompt: member.prompt || `You are ${member.name}, a ${member.role} on a team.`,
      background: true,
    })

    const tm: TeamMember = {
      id: randomUUID().slice(0, 8),
      name: member.name,
      role: member.role,
      agentId: agent.id,
      status: 'idle',
      inbox: [],
    }

    team.members.set(member.name, tm)
  }

  teams.set(id, team)
  return team
}

export function getTeam(id: string): Team | undefined {
  return teams.get(id)
}

export function getAllTeams(): Team[] {
  return Array.from(teams.values())
}

export function dissolveTeam(id: string): boolean {
  const team = teams.get(id)
  if (!team) return false

  // Kill all member agents
  for (const [, member] of team.members) {
    killAgent(member.agentId)
  }

  teams.delete(id)
  return true
}

// Send a message to a team member
export function sendTeamMessage(opts: {
  teamId: string
  from: string
  to: string
  content: string
  type?: 'message' | 'task' | 'result'
  taskId?: string
}): TeamMessage | null {
  const team = teams.get(opts.teamId)
  if (!team) return null

  const message: TeamMessage = {
    id: `msg_${randomUUID().slice(0, 8)}`,
    from: opts.from,
    to: opts.to,
    content: opts.content,
    timestamp: new Date().toISOString(),
    type: opts.type || 'message',
    taskId: opts.taskId,
  }

  team.messages.push(message)

  // Deliver to recipient's inbox
  const recipient = team.members.get(opts.to)
  if (recipient) {
    recipient.inbox.push(message)
    recipient.status = 'busy'
  }

  // Emit event for listeners
  teamEmitter.emit('message', { teamId: opts.teamId, message })

  return message
}

// Get messages for a team member
export function getInbox(teamId: string, memberName: string): TeamMessage[] {
  const team = teams.get(teamId)
  if (!team) return []

  const member = team.members.get(memberName)
  if (!member) return []

  const inbox = [...member.inbox]
  member.inbox = [] // Clear after reading
  member.status = 'idle'

  return inbox
}

// Broadcast to all team members
export function broadcast(teamId: string, from: string, content: string): void {
  const team = teams.get(teamId)
  if (!team) return

  for (const [name, member] of team.members) {
    if (name !== from) {
      sendTeamMessage({ teamId, from, to: name, content, type: 'message' })
    }
  }
}

// Get team message history
export function getTeamHistory(teamId: string, limit = 50): TeamMessage[] {
  const team = teams.get(teamId)
  if (!team) return []
  return team.messages.slice(-limit)
}

// Team event subscription
export function onTeamMessage(cb: (data: { teamId: string; message: TeamMessage }) => void): () => void {
  teamEmitter.on('message', cb)
  return () => teamEmitter.off('message', cb)
}

// Built-in team roles
export const TEAM_ROLES = {
  coder: {
    name: 'Coder',
    role: 'Software Engineer',
    prompt: 'You are Coder, an expert software engineer. Write, edit, and review code. Focus on implementation quality and best practices.',
  },
  reviewer: {
    name: 'Reviewer',
    role: 'Code Reviewer',
    prompt: 'You are Reviewer, a code review specialist. Analyze code for bugs, security issues, performance problems, and improvement opportunities.',
  },
  researcher: {
    name: 'Researcher',
    role: 'Research Analyst',
    prompt: 'You are Researcher, a research analyst. Investigate topics, find information, and synthesize findings into clear reports.',
  },
  planner: {
    name: 'Planner',
    role: 'Technical Lead',
    prompt: 'You are Planner, a technical lead. Break down complex tasks into actionable steps, estimate effort, and coordinate team work.',
  },
}
