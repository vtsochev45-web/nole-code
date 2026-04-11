/**
 * Skills Loader — Load and manage skills from filesystem.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { LoadedSkill, Skill, SkillContext } from './types.js'
import { builtinSkills } from './registry.js'

const SKILLS_DIR = join(homedir(), '.nole-code', 'skills')
const PLUGINS_DIR = join(homedir(), '.nole-code', 'plugins')

export class SkillLoader {
  private skills: LoadedSkill[] = []
  private loaded = false

  /**
   * Load all skills from filesystem and built-in registry.
   */
  loadSkills(): LoadedSkill[] {
    if (this.loaded) return this.skills

    // Add built-in skills first
    for (const skill of builtinSkills) {
      this.skills.push({ ...skill, source: 'builtin' })
    }

    // Load from ~/.nole-code/skills/
    if (existsSync(SKILLS_DIR)) {
      this.loadFromDirectory(SKILLS_DIR, 'user')
    }

    // Load from ~/.nole-code/plugins/
    if (existsSync(PLUGINS_DIR)) {
      this.loadFromDirectory(PLUGINS_DIR, 'plugin')
    }

    this.loaded = true
    return this.skills
  }

  /**
   * Load skills from a directory.
   * Each skill is a subdirectory with skill.md (prompt) and optional run.ts (custom code).
   */
  private loadFromDirectory(dir: string, source: 'user' | 'plugin') {
    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        const skillPath = join(dir, entry)
        // Skip non-directories
        try {
          const { statSync } = require('fs')
          if (!statSync(skillPath).isDirectory()) continue
        } catch {
          continue
        }

        const skillMd = join(skillPath, 'skill.md')
        if (!existsSync(skillMd)) continue

        try {
          const content = readFileSync(skillMd, 'utf-8')
          const skill = this.parseSkillMd(entry, content, source)
          if (skill) {
            skill.path = skillPath
            skill.source = source
            this.skills.push(skill)
          }
        } catch (err) {
          console.error(`Failed to load skill from ${skillPath}:`, err)
        }
      }
    } catch (err) {
      console.error(`Failed to read skills directory ${dir}:`, err)
    }
  }

  /**
   * Parse skill.md content into a Skill object.
   */
  private parseSkillMd(dirName: string, content: string, source: string): LoadedSkill | null {
    const lines = content.split('\n')
    let name = dirName
    let description = ''
    const readWhen: string[] = []
    let allowedTools: string[] = []
    let execute: ((input: string, ctx: SkillContext) => Promise<string>) | undefined

    let section = 'header'
    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed === '---') {
        // Skip YAML frontmatter
        continue
      }

      if (trimmed.startsWith('## ')) {
        const header = trimmed.slice(3).toLowerCase()
        if (header.includes('description')) section = 'description'
        else if (header.includes('trigger') || header.includes('keyword')) section = 'trigger'
        else if (header.includes('allowed')) section = 'allowed'
        else if (header.includes('action') || header.includes('code')) section = 'code'
        else section = 'header'
        continue
      }

      if (trimmed.startsWith('# ')) {
        name = trimmed.slice(2).trim()
        continue
      }

      if (section === 'description' && trimmed) {
        description = trimmed
      } else if (section === 'trigger' && trimmed) {
        readWhen.push(trimmed.toLowerCase().replace(/^[-*]\s*/, ''))
      } else if (section === 'allowed' && trimmed) {
        allowedTools.push(trimmed.replace(/^[-*]\s*/, ''))
      }
    }

    if (!name || !description) return null

    return {
      name,
      description,
      read_when: readWhen.length ? readWhen : ['*'],
      allowed_tools: allowedTools.length ? allowedTools : ['*'],
      execute: execute || this.defaultExecute,
      source,
    }
  }

  /**
   * Default execute — respond with skill description.
   */
  private async defaultExecute(input: string, ctx: SkillContext): Promise<string> {
    const skill = this.findSkill(input)
    if (!skill) return `Skill not found`
    return skill.description
  }

  /**
   * Find a skill by matching input against read_when keywords.
   */
  findSkill(input: string): LoadedSkill | undefined {
    if (!this.loaded) this.loadSkills()
    if (!this.skills.length) return undefined

    const lower = input.toLowerCase()

    for (const skill of this.skills) {
      for (const keyword of skill.read_when) {
        if (keyword === '*') return skill
        if (lower.includes(keyword.toLowerCase())) return skill
      }
    }

    return undefined
  }

  /**
   * Run a skill by name.
   */
  async runSkill(name: string, input: string, context: SkillContext): Promise<string> {
    if (!this.loaded) this.loadSkills()

    const skill = this.skills.find(s => s.name === name || s.name.toLowerCase() === name.toLowerCase())
    if (!skill) return `Skill not found: ${name}`

    try {
      return await skill.execute(input, context)
    } catch (err) {
      return `Skill error: ${err}`
    }
  }

  /**
   * Get all loaded skills (reload if needed).
   */
  getAllSkills(): LoadedSkill[] {
    if (!this.loaded) return this.loadSkills()
    return this.skills
  }

  /**
   * Reload skills from disk.
   */
  reload() {
    this.loaded = false
    this.skills = []
    return this.loadSkills()
  }
}

// Export singleton
export const skillLoader = new SkillLoader()