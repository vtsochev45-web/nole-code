// /alias command - Command aliases
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const ALIAS_FILE = join(homedir(), '.nole-code', 'aliases.json')

function ensureAliasDir() {
  const dir = join(homedir(), '.nole-code')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function loadAliases(): Record<string, string> {
  ensureAliasDir()
  if (!existsSync(ALIAS_FILE)) return {}
  try {
    return JSON.parse(readFileSync(ALIAS_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveAliases(aliases: Record<string, string>) {
  ensureAliasDir()
  writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2), 'utf-8')
}

export function registerAliasCommand(registerCommand: (cmd: any) => void) {
  registerCommand({
    name: 'alias',
    description: 'Manage command aliases: list, add, or delete',
    execute: async (args: string[]) => {
      if (args.length === 0) {
        // List all aliases
        const aliases = loadAliases()
        if (Object.keys(aliases).length === 0) {
          return 'No aliases defined.\n\nUsage: /alias <name> <cmd>  — create alias\n       /alias <name>          — show alias value\n       /alias <name> --delete — delete alias'
        }
        const lines = ['Aliases:']
        for (const [name, cmd] of Object.entries(aliases)) {
          lines.push(`  /${name} → /${cmd}`)
        }
        return lines.join('\n')
      }

      // Check for --delete flag
      if (args[args.length - 1] === '--delete') {
        const name = args[0]
        const aliases = loadAliases()
        if (!aliases[name]) {
          return `Alias /${name} not found`
        }
        delete aliases[name]
        saveAliases(aliases)
        return `Deleted alias /${name}`
      }

      // Single argument: show alias value
      if (args.length === 1) {
        const aliases = loadAliases()
        const name = args[0]
        if (!aliases[name]) {
          return `Alias /${name} not found`
        }
        return `/${name} → /${aliases[name]}`
      }

      // Two+ arguments: create alias
      const name = args[0]
      const cmd = args.slice(1).join(' ')
      
      // Validate: name should be alphanumeric
      if (!/^[a-zA-Z0-9]+$/.test(name)) {
        return 'Alias name must be alphanumeric (no spaces or special chars)'
      }
      
      const aliases = loadAliases()
      aliases[name] = cmd
      saveAliases(aliases)
      return `Created alias /${name} → /${cmd}`
    },
  })
}