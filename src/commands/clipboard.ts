/**
 * Clipboard Command — Read/write system clipboard.
 */

import { execSync } from 'child_process'
import { registerCommand } from '../commands/index.js'

function readClipboard(): string {
  try {
    if (process.platform === 'darwin') {
      return execSync('pbpaste', { encoding: 'utf-8' }).trim()
    } else {
      return execSync('xclip -selection clipboard -o', { encoding: 'utf-8' }).trim()
    }
  } catch {
    throw new Error('Clipboard unavailable or empty')
  }
}

function writeClipboard(text: string): void {
  if (process.platform === 'darwin') {
    execSync(`echo -n "${text.replace(/"/g, '\\"')}" | pbcopy`)
  } else {
    execSync(`echo -n "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard -i`)
  }
}

registerCommand({
  name: 'clipboard',
  description: 'Read or write clipboard. Usage: /clipboard [text]',
  aliases: ['cb', 'copy'],
  execute: async (args) => {
    if (args.length === 0) {
      try {
        const content = readClipboard()
        const preview = content.length > 300 ? content.slice(0, 300) + '...' : content
        return `📋 Clipboard:\n${preview || '(empty)'}`
      } catch (e) {
        return `📋 Clipboard unavailable or empty`
      }
    }

    const text = args.join(' ')
    try {
      writeClipboard(text)
      return `✅ Copied ${text.length} chars to clipboard`
    } catch (e) {
      return `❌ Failed to write to clipboard`
    }
  },
})
