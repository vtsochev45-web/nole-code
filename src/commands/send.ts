// Nole Code - /send command: Send notification to Telegram/Discord

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

function getEnv(key: string): string | undefined {
  // Try process.env first
  if (process.env[key]) return process.env[key]
  // Try reading from ~/.nole/env
  try {
    const { readFileSync, existsSync } = require('fs')
    const envPath = require('os').homedir() + '/.nole/env'
    if (existsSync(envPath)) {
      const envContent = require('fs').readFileSync(envPath, 'utf-8')
      const match = envContent.match(new RegExp(`${key}=(.+)`))
      if (match) return match[1].trim()
    }
  } catch {}
  return undefined
}

async function sendTelegram(text: string, token: string, chatId: string): Promise<string> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const result = await response.json() as Record<string, unknown>
    if (result.ok) return '✅ Sent to Telegram'
    return `Telegram error: ${result.description || 'unknown'}`
  } catch (e: any) {
    return `Telegram error: ${e.message}`
  }
}

async function sendDiscord(text: string, webhookUrl: string): Promise<string> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
    if (response.ok) return '✅ Sent to Discord'
    return `Discord error: ${response.status}`
  } catch (e: any) {
    return `Discord error: ${e.message}`
  }
}

export function registerSendCommand(registerCmd: (cmd: import('./index.js').Command) => void) {
  registerCmd({
    name: 'send',
    description: 'Send notification to Telegram or Discord',
    execute: async (args) => {
      if (args.length === 0) {
        return 'Usage: /send <message>\nSends a notification to configured Telegram/Discord.'
      }

      const message = args.join(' ')
      const telegramToken = getEnv('TELEGRAM_BOT_TOKEN')
      const telegramChatId = getEnv('TELEGRAM_CHAT_ID')
      const discordWebhook = getEnv('DISCORD_WEBHOOK_URL')

      if (telegramToken && telegramChatId) {
        return await sendTelegram(message, telegramToken, telegramChatId)
      }

      if (discordWebhook) {
        return await sendDiscord(message, discordWebhook)
      }

      return 'Telegram/Discord not configured.\nSet TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID or DISCORD_WEBHOOK_URL in ~/.nole/env'
    },
  })
}