/**
 * Changelog Command — Generate a changelog from git commits.
 */

import { execSync } from 'child_process'
import { registerCommand } from '../commands/index.js'

function getLastTag(): string | null {
  try {
    return execSync('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

function generateChangelog(): string {
  const lastTag = getLastTag()
  const tagRange = lastTag ? `${lastTag}..HEAD` : '-50'

  let log: string
  try {
    log = execSync(`git log --oneline ${tagRange} 2>/dev/null`, { encoding: 'utf-8' }).trim()
  } catch {
    return 'No git commits found'
  }

  if (!log) return 'No commits since last tag'

  const lines = log.split('\n').filter(Boolean)
  const groups: Record<string, string[]> = {
    Features: [],
    Bugfixes: [],
    Refactors: [],
    Docs: [],
    Other: [],
  }

  for (const line of lines) {
    const match = line.match(/^([a-f0-9]+)\s+(.+)$/)
    if (!match) continue
    const [, hash, msg] = match
    const lower = msg.toLowerCase()

    if (lower.startsWith('feat') || lower.startsWith('add') || lower.startsWith('improve')) {
      groups['Features'].push(`- ${msg} (\`${hash.slice(0, 7)}\`)`)
    } else if (lower.startsWith('fix')) {
      groups['Bugfixes'].push(`- ${msg} (\`${hash.slice(0, 7)}\`)`)
    } else if (lower.startsWith('refactor') || lower.startsWith('perf')) {
      groups['Refactors'].push(`- ${msg} (\`${hash.slice(0, 7)}\`)`)
    } else if (lower.startsWith('docs') || lower.startsWith('readme') || lower.startsWith('changelog')) {
      groups['Docs'].push(`- ${msg} (\`${hash.slice(0, 7)}\`)`)
    } else {
      groups['Other'].push(`- ${msg} (\`${hash.slice(0, 7)}\`)`)
    }
  }

  const parts: string[] = []
  if (lastTag) parts.push(`## ${lastTag} (unreleased)\n`)
  else parts.push('## Current\n')

  for (const [section, items] of Object.entries(groups)) {
    if (items.length === 0) continue
    parts.push(`### ${section}\n${items.join('\n')}\n`)
  }

  return parts.join('\n')
}

registerCommand({
  name: 'changelog',
  description: 'Generate changelog from git commits',
  aliases: ['chg'],
  execute: async () => {
    return generateChangelog()
  },
})
