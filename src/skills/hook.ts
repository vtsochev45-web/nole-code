/**
 * Skills Hook — Wire skills into REPL.
 * Before processing input, check if a skill matches.
 */

import type { LoadedSkill, SkillContext } from './types.js'
import { skillLoader } from './loader.js'

/**
 * Check input for skill match and run if found.
 * Returns the skill result if matched, or null to continue normal processing.
 */
export async function checkSkillMatch(input: string): Promise<string | null> {
  const skill = skillLoader.findSkill(input)
  if (!skill) return null

  // Build context
  const context: SkillContext = {
    cwd: process.cwd(),
    model: process.env.MODEL || 'default',
    tools: {} as any, // tools will be passed at call time if needed
  }

  try {
    return await skillLoader.runSkill(skill.name, input, context)
  } catch (err) {
    return `Skill error: ${err}`
  }
}

/**
 * Get skill from loader by name.
 */
export async function getSkillByName(name: string): Promise<LoadedSkill | undefined> {
  skillLoader.loadSkills()
  return skillLoader.getAllSkills().find(s => s.name === name)
}

/**
 * List all available skills.
 */
export async function listSkills(): Promise<string[]> {
  skillLoader.loadSkills()
  return skillLoader.getAllSkills().map(s => s.name)
}