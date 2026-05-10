/**
 * Skills System — Types and interfaces for the skills framework.
 */

// Minimal shape a skill needs from the tool registry. Avoids a circular
// import on tools/registry.ts and keeps skills decoupled from the concrete
// registry implementation.
export interface ToolRegistry {
  has(name: string): boolean
  execute(name: string, input: Record<string, unknown>): Promise<{ content: string; isError?: boolean }>
}

export interface SkillContext {
  cwd: string
  model: string
  tools: ToolRegistry
}

export interface Skill {
  name: string
  description: string
  read_when: string[]      // keywords that trigger this skill
  allowed_tools: string[]  // tools this skill is allowed to use
  execute(skill_input: string, context: SkillContext): Promise<string>
}

export interface LoadedSkill extends Skill {
  source: 'builtin' | 'user' | 'plugin'
  path?: string
}