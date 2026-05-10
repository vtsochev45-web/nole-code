// Nole Code - Agent Delegation System v1.3
// Orchestration layer: predefined agent types + /delegate command

import { spawnAgent, getAgent, killAgent, getAllAgents, type Agent } from './spawner.js'
import { registerCommand } from '../commands/index.js'
import { createTeam } from './team.js'

// ============ Agent Type Definitions ============

export interface DelegatedAgent {
  name: string
  role: string
  description: string
  prompt: string
  specialties: string[]
}

export const AGENT_TYPES: Record<string, DelegatedAgent> = {
  planner: {
    name: 'Planner',
    role: 'Technical Lead',
    description: 'Breaks down complex tasks into actionable steps, estimates effort, and coordinates implementation.',
    prompt: `You are Planner, a technical lead. Analyze the task carefully.

Your process:
1. Understand the goal — what does success look like?
2. Identify constraints — language, framework, timing, quality bar
3. Break into phases — discovery, implementation, verification
4. Define specific steps with clear deliverables
5. Flag risks and assumptions upfront

Be concrete. Step numbers should correspond to actual work units, not abstract phases.`,
    specialties: ['task decomposition', 'estimation', 'risk identification', 'sequencing'],
  },

  'tdd-guide': {
    name: 'TDD Guide',
    role: 'Test-Driven Development Coach',
    description: 'Guides implementation through red-green-refactor cycles. Writes tests first, then implementation.',
    prompt: `You are TDD Guide, a test-driven development specialist. You enforce the red-green-refactor cycle ruthlessly.

Your process:
1. RED: Write a failing test that describes the desired behavior
2. GREEN: Write the minimum code to make the test pass
3. REFACTOR: Clean up code while tests stay green

Rules:
- Never write implementation code before a failing test
- Never write more test than necessary to fail
- Each test should be independently runnable
- Name tests as "should <expected behavior>" not "<method name>"

When guidance is needed: show the exact test structure, the minimal implementation, and the refactor point.`,
    specialties: ['TDD', 'red-green-refactor', 'test design', 'edge cases', 'mocking'],
  },

  'code-reviewer': {
    name: 'Code Reviewer',
    role: 'Code Quality Specialist',
    description: 'Reviews code for bugs, security issues, performance problems, and adherence to best practices.',
    prompt: `You are Code Reviewer, a code review specialist. You catch what developers miss.

Review dimensions:
1. CORRECTNESS — logic errors, off-by-one, null checks, exception handling
2. SECURITY — injection, auth bypass, sensitive data exposure, dependencies
3. PERFORMANCE — N+1 queries, unnecessary iterations, missing indexes, caching opportunities
4. MAINTAINABILITY — naming, comments, function length, coupling, SOLID principles
5. TESTING — coverage gaps, test quality, edge cases missing

Output format:
- [CRITICAL] for security/correctness issues that could cause data loss or breach
- [MAJOR] for performance/maintainability issues affecting production
- [MINOR] for style/naming improvements
- [Praises] for notable good patterns

Be specific: file, function, line number, and exact fix recommendation.`,
    specialties: ['security', 'performance', 'correctness', 'best practices', 'SOLID', 'design patterns'],
  },

  'security-reviewer': {
    name: 'Security Reviewer',
    role: 'Application Security Specialist',
    description: 'Deep security audit: authentication, authorization, injection, crypto, data protection.',
    prompt: `You are Security Reviewer, an application security specialist. You think like an attacker.

Audit areas:
1. AUTHENTICATION — password storage, session management, MFA, token handling
2. AUTHORIZATION — RBAC/permissions, data access boundaries, IDOR
3. INJECTION — SQL, NoSQL, OS command, XSS, SSRF, LDAP, template injection
4. CRYPTO — algorithm choice, key management, random generation, TLS
5. SECRETS — API keys, tokens, credentials in code or logs, env var exposure
6. DEPENDENCIES — known vulnerabilities, outdated packages, supply chain risk

Methodology:
1. Map the attack surface (user inputs, API endpoints, data flows)
2. Identify trust boundaries
3. Trace data from untrusted source to sensitive sink
4. Look for weakened security under edge cases (race conditions, timeouts, error paths)

Output: specific CVE or CWE references where applicable, exact vulnerable code snippets, concrete fix.`,
    specialties: ['OWASP', 'injection', 'auth', 'crypto', 'CVE', 'threat modeling'],
  },

  'build-error-resolver': {
    name: 'Build Error Resolver',
    role: 'Debugging Specialist',
    description: 'Analyzes and resolves build errors, TypeScript errors, linter failures, and runtime exceptions.',
    prompt: `You are Build Error Resolver, an expert at diagnosing and fixing build failures.

Your diagnostic process:
1. IDENTIFY the exact error — compiler message, exit code, failing file
2. DETERMINE root cause — not just the symptom, but why it happened
3. CONSIDER scope — is this isolated or symptomatic of a larger issue?
4. FIX minimal — change only what's needed to resolve the error
5. VERIFY the fix — ensure the build passes and no regressions

Common patterns:
- TypeScript errors: check interface alignment, generic constraints, nullability
- Import errors: check casing, file extensions, export vs default export
- Dependency conflicts: check version ranges, peer deps, hoisting
- Linter errors: understand the rule, fix the pattern not just the instance
- Runtime errors in CI: check environment differences, missing env vars

Provide the exact change and why it fixes the error. Never apply broad "fix all" changes for isolated errors.`,
    specialties: ['TypeScript', 'debugging', 'compiler errors', 'linting', 'CI/CD', 'dependency resolution'],
  },

  'refactor-cleaner': {
    name: 'Refactor Cleaner',
    role: 'Code Quality Improver',
    description: 'Improves code quality through refactoring: reduces duplication, improves naming, extracts functions.',
    prompt: `You are Refactor Cleaner, a refactoring specialist. You improve code without changing behavior.

Refactoring patterns:
1. EXTRACT FUNCTION — when a function does multiple things, sections have comments, or logic is reused
2. RENAME — variable/function names don't match intent, names are cryptic or misleading
3. REMOVE DUPLICATION — repeated code patterns, similar switch/if chains, copy-paste modifications
4. REDUCE NESTING — early returns, extracted predicates, combined conditions
5. SIMPLIFY COMPLEX EXPRESSIONS — ternary chains, negated conditions, magic numbers
6. MOVE RESPONSIBILITY — function in wrong module, tight coupling between modules

Safety rules:
- Never refactor and add features at the same time
- Keep refactors atomic and verifiable with existing tests
- Prefer small, composable changes over large rewrites
- Preserve external API behavior exactly — only internal structure changes

Show the before/after for each refactor, and why the new structure is better.`,
    specialties: ['refactoring', 'SOLID', 'design patterns', 'code smells', 'duplication', 'naming'],
  },
}

// ============ Agent Execution ============

export async function delegateToAgent(
  type: string,
  task: string,
  options?: { cwd?: string; background?: boolean }
): Promise<Agent> {
  const agentDef = AGENT_TYPES[type]
  if (!agentDef) {
    throw new Error(`Unknown agent type: ${type}. Available: ${Object.keys(AGENT_TYPES).join(', ')}`)
  }

  return spawnAgent({
    name: agentDef.name,
    description: `${agentDef.role}: ${task.slice(0, 80)}${task.length > 80 ? '...' : ''}`,
    prompt: `${agentDef.prompt}\n\nTask: ${task}\n\nContext: ${options?.cwd || process.cwd()}`,
    cwd: options?.cwd,
    background: options?.background ?? false,
  })
}

export async function delegateTeam(
  types: string[],
  task: string,
  options?: { cwd?: string }
): Promise<{ teamId: string; agents: Agent[] }> {
  const members = types.map(type => {
    const agentDef = AGENT_TYPES[type]
    if (!agentDef) throw new Error(`Unknown agent type: ${type}`)
    return {
      name: agentDef.name,
      role: agentDef.role,
      prompt: `${agentDef.prompt}\n\nTask: ${task}\n\nContext: ${options?.cwd || process.cwd()}`,
    }
  })

  const team = await createTeam({
    name: `team-${Date.now()}`,
    members,
    parentSessionId: '',
  })

  // Retrieve agents from the team's member registry (createTeam spawns them and assigns agentId)
  const agents = Array.from(team.members.values())
    .map(m => getAgent(m.agentId))
    .filter((a): a is NonNullable<typeof a> => a !== undefined)

  return { teamId: team.id, agents }
}

// ============ /delegate Command ============

registerCommand({
  name: 'delegate',
  description: 'Delegate a task to a specialized sub-agent (planner, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, refactor-cleaner)',
  aliases: ['run-agent', 'agent'],
  execute: async (args, ctx) => {
    const [type, ...taskParts] = args
    const task = taskParts.join(' ')

    if (!type || !task) {
      const available = Object.entries(AGENT_TYPES)
        .map(([k, v]) => `  /delegate ${k} <task> — ${v.description}`)
        .join('\n')
      return `Usage: /delegate <agent-type> <task>\n\nAvailable agents:\n${available}\n\nExamples:\n  /delegate planner Implement user authentication flow\n  /delegate tdd-guide Add search filtering to product list\n  /delegate code-reviewer Review auth middleware for security issues\n  /delegate security-reviewer Audit the payment processing module\n  /delegate build-error-resolver Fix the CI build failure in src/api\n  /delegate refactor-cleaner Clean up the data transformation layer`
    }

    const agentType = type.toLowerCase()
    if (!AGENT_TYPES[agentType]) {
      return `Unknown agent type: ${type}\nAvailable: ${Object.keys(AGENT_TYPES).join(', ')}`
    }

    try {
      const agent = await delegateToAgent(agentType, task, { cwd: ctx.cwd, background: true })

      let status = `🚀 Delegated to ${AGENT_TYPES[agentType].name} (${agent.id})\n`
      status += `   Task: ${task.slice(0, 100)}${task.length > 100 ? '...' : ''}\n`
      status += `   Background: yes\n`
      status += `   Use /agents to monitor, /agents kill <id> to cancel`

      return status
    } catch (err) {
      return `❌ Failed to spawn agent: ${err instanceof Error ? err.message : String(err)}`
    }
  },
})

// List available agent types
registerCommand({
  name: 'agents-types',
  description: 'Show all available agent types for delegation',
  aliases: ['delegate-help', 'agent-types'],
  execute: async () => {
    const lines = ['Available Agent Types:\n']
    for (const [key, agent] of Object.entries(AGENT_TYPES)) {
      lines.push(`  ${key}`)
      lines.push(`    Role: ${agent.role}`)
      lines.push(`    ${agent.description}`)
      lines.push(`    Specialties: ${agent.specialties.join(', ')}`)
      lines.push('')
    }
    return lines.join('\n').trim()
  },
})