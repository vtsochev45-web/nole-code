// Buddy Commands - Slash commands for buddy control

import { getCompanion, reloadCompanion, validSprites, validMoods, Companion } from './index.js'
import { CommandContext } from '../commands/index.js'

export function registerBuddyCommands(registerCmd: (cmd: {
  name: string
  description: string
  aliases?: string[]
  execute: (args: string[], ctx: CommandContext) => Promise<string>
}) => void) {
  const companion = getCompanion()

  registerCmd({
    name: 'buddy',
    description: 'Show or control your buddy companion',
    aliases: ['buddy'],
    execute: async (args: string[], _ctx: CommandContext): Promise<string> => {
      const subcommand = args[0]

      // /buddy - show current buddy status
      if (!subcommand || subcommand === 'show') {
        const comp = getCompanion()
        
        if (!comp.isEnabled) {
          return `🐾 Buddy is disabled. Set BUDDY=name in .env to enable.`
        }
        
        return `🐾 ${comp.name} (${comp.mood})
${comp.spriteArt}`
      }

      // /buddy set <name> - change buddy name
      if (subcommand === 'set') {
        const newName = args.slice(1).join(' ')
        if (!newName) {
          return 'Usage: /buddy set <name>'
        }
        const comp = getCompanion()
        comp.setName(newName)
        return `✨ Buddy renamed to "${newName}"`
      }

      // /buddy sprite <sprite> - change sprite
      if (subcommand === 'sprite') {
        const newSprite = args[1]
        if (!newSprite) {
          return `Available sprites: ${validSprites.join(', ')}`
        }
        if (!validSprites.includes(newSprite as any)) {
          return `Invalid sprite. Choose from: ${validSprites.join(', ')}`
        }
        const comp = getCompanion()
        comp.setSprite(newSprite as any)
        return `🎨 Sprite changed to ${newSprite}
${comp.spriteArt}`
      }

      // /buddy mood <mood> - change mood
      if (subcommand === 'mood') {
        const newMood = args[1]
        if (!newMood) {
          return `Available moods: ${validMoods.join(', ')}`
        }
        if (!validMoods.includes(newMood as any)) {
          return `Invalid mood. Choose from: ${validMoods.join(', ')}`
        }
        const comp = getCompanion()
        comp.setMood(newMood as any)
        return `🎭 Mood set to ${newMood}`
      }

      // /buddy off - disable buddy
      if (subcommand === 'off') {
        const comp = getCompanion()
        comp.setName('')
        return '👋 Buddy disabled.'
      }

      // /buddy reload - reload from .env
      if (subcommand === 'reload') {
        reloadCompanion()
        const comp = getCompanion()
        if (!comp.isEnabled) {
          return '🔄 Reloaded. Buddy is disabled (no BUDDY=name in .env)'
        }
        return `🔄 Reloaded! ${comp.name} is back!`
      }

      return `Usage:
  /buddy           - Show buddy
  /buddy set <name> - Rename buddy
  /buddy sprite <type> - Change sprite (${validSprites.join(', ')})
  /buddy mood <mood> - Change mood (${validMoods.join(', ')})
  /buddy off       - Disable buddy
  /buddy reload    - Reload from .env`
    },
  })
}