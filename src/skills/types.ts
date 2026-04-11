/**
 * Skills System — Types and interfaces for the skills framework.
 */

// ToolRegistry imported from tools/registry.ts at runtime

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