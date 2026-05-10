// Coordinated stdin handover between the main REPL readline and one-off
// raw-mode prompts (permissions, confirmations). Without this, two readers
// race for stdin: the main `rl` swallows partial keystrokes and the prompt
// either misses input or buffers extra characters back into the REPL.

import type { Interface as ReadlineInterface } from 'readline'

let mainRl: ReadlineInterface | null = null

export function setMainReadline(rl: ReadlineInterface): void {
  mainRl = rl
}

/**
 * Run `fn` with exclusive ownership of stdin. The main REPL's readline is
 * paused for the duration so its keypress listeners don't intercept input.
 */
export async function withStdinLock<T>(fn: () => Promise<T>): Promise<T> {
  const wasRaw = process.stdin.isTTY ? Boolean((process.stdin as { isRaw?: boolean }).isRaw) : false
  if (mainRl) mainRl.pause()
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.resume()
  try {
    return await fn()
  } finally {
    if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw)
    if (mainRl) mainRl.resume()
    else process.stdin.pause()
  }
}

/**
 * Read a single keypress from stdin, with a timeout. Returns null on timeout
 * or '\x03' (Ctrl+C) on cancel. Caller must already hold the stdin lock.
 */
export function readOneKey(timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false

    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      clearTimeout(timer)
    }

    const onData = (buf: Buffer) => {
      if (settled) return
      settled = true
      cleanup()
      // Take only the first byte/char so paste-bursts don't smuggle
      // multiple "answers" into one prompt.
      resolve(buf.toString().slice(0, 1))
    }

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      resolve(null)
    }, timeoutMs)

    process.stdin.on('data', onData)
  })
}
