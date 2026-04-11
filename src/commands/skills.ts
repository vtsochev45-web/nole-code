/**
 * Skills Commands — CLI commands for skill management.
 */

import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { getCommand, registerCommand, type CommandContext } from '../commands/index.js'
import { skillLoader, type LoadedSkill } from '../skills/index.js'

const SKILLS_DIR = join(homedir(), '.nole-code', 'skills')

registerCommand({
  name: 'skills',
  description: 'Manage skills. Usage: /skills [list|run|install] [args]',
  aliases: ['skill'],
  execute: async (args: string[], ctx: CommandContext): Promise<string> => {
    const subcommand = args[0] || 'list'

    if (subcommand === 'list') {
      skillLoader.loadSkills()
      const skills = skillLoader.getAllSkills()

      if (!skills.length) {
        return 'No skills found. Use /skill install to add skills.'
      }

      const lines = ['🛠 Available Skills:\n']
      for (const skill of skills) {
        const src = skill.source === 'builtin' ? 'built-in' : skill.source
        lines.push(`  ${skill.name} — ${skill.description} [${src}]`)
        if (skill.read_when.length && skill.read_when[0] !== '*') {
          lines.push(`    triggers: ${skill.read_when.join(', ')}`)
        }
      }
      return lines.join('\n')
    }

    if (subcommand === 'run') {
      const skillName = args[1]
      const input = args.slice(2).join(' ')

      if (!skillName) {
        return 'Usage: /skill run <name> <input>'
      }

      const result = await skillLoader.runSkill(skillName, input, {
        cwd: ctx.cwd,
        model: 'default',
        tools: {} as any,
      })

      return result
    }

    if (subcommand === 'install') {
      const url = args[1]
      if (!url) {
        return 'Usage: /skill install <url>  (not implemented - create ~/.nole-code/skills/<name>/skill.md manually)'
      }
      return 'Skill install from URL not yet implemented'
    }

    return `Unknown /skill command: ${subcommand}. Use: list, run, install`
  },
})

registerCommand({
  name: 'skill',
  description: 'Run or list skills. Use /skill run <name> <input>',
  aliases: [],
  execute: async (args: string[], ctx: CommandContext): Promise<string> => {
    // Delegate to /skills command
    const cmd = getCommand('skills')
    if (!cmd) return 'Skills command not found'
    return cmd.execute(args, ctx)
  },
})

// Also export for convenience
export { skillLoader }

/**
 * Register skills commands with the command registry.
 */
export function registerSkillCommands(registerCmd: typeof registerCommand) {
  registerCmd({
    name: 'skills',
    description: 'Manage skills. Usage: /skills [list|run|install] [args]',
    aliases: ['skill'],
    execute: async (args: string[], ctx: CommandContext): Promise<string> => {
      const subcommand = args[0] || 'list'

      if (subcommand === 'list') {
        skillLoader.loadSkills()
        const skills = skillLoader.getAllSkills()

        if (!skills.length) {
          return 'No skills found. Use /skill install to add skills.'
        }

        const lines = ['🛠 Available Skills:\n']
        for (const skill of skills) {
          const src = skill.source === 'builtin' ? 'built-in' : skill.source
          lines.push('  ' + skill.name + ' — ' + skill.description + ' [' + src + ']')
          if (skill.read_when.length && skill.read_when[0] !== '*') {
            lines.push('    triggers: ' + skill.read_when.join(', '))
          }
        }
        return lines.join('\n')
      }

      if (subcommand === 'run') {
        const skillName = args[1]
        const input = args.slice(2).join(' ')

        if (!skillName) {
          return 'Usage: /skill run <name> <input>'
        }

        const result = await skillLoader.runSkill(skillName, input, {
          cwd: ctx.cwd,
          model: 'default',
          tools: {} as any,
        })

        return result
      }

      if (subcommand === 'install') {
        const url = args[1]
        if (!url) {
          return 'Usage: /skill install <url>  (not implemented)'
        }
        return 'Skill install from URL not yet implemented'
      }

      return 'Unknown /skills command: ' + subcommand + '. Use: list, run, install'
    },
  })

  registerCmd({
    name: 'skill',
    description: 'Run or list skills. Use /skill run <name> <input>',
    aliases: [],
    execute: async (args: string[], ctx: CommandContext): Promise<string> => {
      const cmd = getCommand('skills')
      if (!cmd) return 'Skills command not found'
      return cmd.execute(args, ctx)
    },
  })
}