// /rules command - View and manage permission rules
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const RULES_FILE = join(homedir(), '.nole-code', 'permissions.json')

interface PermissionRule {
  pattern: string
  action: string
  reason?: string
}

function loadRules(): PermissionRule[] {
  if (!existsSync(RULES_FILE)) return []
  try {
    return JSON.parse(readFileSync(RULES_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveRules(rules: PermissionRule[]) {
  writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8')
}

function displayRules(rules: PermissionRule[], title = 'Permission Rules'): string {
  if (rules.length === 0) return `${title}:\n  (no rules — all operations allowed by default)`
  const lines = [`${title}:\n`]
  for (const rule of rules) {
    const actionColor = rule.action === 'allow' ? '✅' : rule.action === 'deny' ? '🚫' : '⚠️'
    lines.push(`  ${actionColor} ${rule.pattern}`)
    if (rule.reason) lines.push(`     → ${rule.reason}`)
  }
  return lines.join('\n')
}

export function registerRulesCommand(registerCommand: (cmd: any) => void) {
  registerCommand({
    name: 'rules',
    description: 'View, add, or remove permission rules (/rules [list|add|remove|clear])',
    aliases: ['permissions', 'perms'],
    execute: async (args: string[]) => {
      const [action, ...rest] = args

      if (!action || action === 'list') {
        return displayRules(loadRules())
      }

      if (action === 'add') {
        // /rules add <pattern> <action> [reason]
        const [pattern, act, ...reasonParts] = rest
        if (!pattern || !act) {
          return 'Usage: /rules add <pattern> <allow|deny|ask> [reason]\n\nExamples:\n  /rules add Bash(sudo *) deny "Privilege escalation blocked"\n  /rules add Write(*) ask "File creation requires confirmation"'
        }
        if (!['allow', 'deny', 'ask'].includes(act)) {
          return `Invalid action: ${act}. Use: allow, deny, ask`
        }
        const rules = loadRules()
        rules.push({ pattern, action: act, reason: reasonParts.join(' ') || undefined })
        saveRules(rules)
        return `✅ Added rule: ${pattern} → ${act}`
      }

      if (action === 'remove') {
        const pattern = rest.join(' ')
        if (!pattern) return 'Usage: /rules remove <pattern>'
        const rules = loadRules()
        const before = rules.length
        const filtered = rules.filter(r => r.pattern !== pattern)
        if (filtered.length === before) return `Rule not found: ${pattern}`
        saveRules(filtered)
        return `✅ Removed rule: ${pattern}`
      }

      if (action === 'clear') {
        saveRules([])
        return '✅ Cleared all custom rules'
      }

      return `Unknown action: ${action}\n\nUsage:\n  /rules list\n  /rules add <pattern> <allow|deny|ask> [reason]\n  /rules remove <pattern>\n  /rules clear`
    },
  })
}