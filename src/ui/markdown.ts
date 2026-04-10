/**
 * Lightweight terminal markdown renderer
 * Handles: bold, italic, code, code blocks, headers, links, lists
 */

const ESC = '\x1b['
const RESET = `${ESC}0m`
const BOLD = `${ESC}1m`
const DIM = `${ESC}2m`
const ITALIC = `${ESC}3m`
const UNDERLINE = `${ESC}4m`
const CYAN = `${ESC}36m`
const GREEN = `${ESC}32m`
const YELLOW = `${ESC}33m`
const GRAY = `${ESC}90m`
const BLUE = `${ESC}34m`
const MAGENTA = `${ESC}35m`

export function renderMarkdown(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ''

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = line.trim().slice(3).trim()
        output.push(`${DIM}┌─${codeBlockLang ? ` ${codeBlockLang} ` : ''}${'─'.repeat(Math.max(0, 60 - codeBlockLang.length))}${RESET}`)
      } else {
        inCodeBlock = false
        codeBlockLang = ''
        output.push(`${DIM}└${'─'.repeat(62)}${RESET}`)
      }
      continue
    }

    // Inside code block — show dimmed with border
    if (inCodeBlock) {
      output.push(`${DIM}│${RESET} ${GREEN}${line}${RESET}`)
      continue
    }

    // Headers
    if (line.startsWith('### ')) {
      output.push(`${BOLD}${CYAN}   ${line.slice(4)}${RESET}`)
      continue
    }
    if (line.startsWith('## ')) {
      output.push(`${BOLD}${CYAN}  ${line.slice(3)}${RESET}`)
      continue
    }
    if (line.startsWith('# ')) {
      output.push(`${BOLD}${CYAN}${line.slice(2)}${RESET}`)
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      output.push(`${DIM}${'─'.repeat(60)}${RESET}`)
      continue
    }

    // Inline formatting
    line = renderInline(line)
    output.push(line)
  }

  // Close unclosed code block
  if (inCodeBlock) {
    output.push(`${DIM}└${'─'.repeat(62)}${RESET}`)
  }

  return output.join('\n')
}

function renderInline(text: string): string {
  // Bold + italic: ***text***
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, `${BOLD}${ITALIC}$1${RESET}`)
  // Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`)
  // Italic: *text* (but not inside URLs or paths)
  text = text.replace(/(?<![/\w])\*([^*\n]+?)\*(?![/\w])/g, `${ITALIC}$1${RESET}`)
  // Inline code: `text`
  text = text.replace(/`([^`\n]+?)`/g, `${GREEN}$1${RESET}`)
  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `${UNDERLINE}$1${RESET} ${DIM}($2)${RESET}`)
  // Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, `${DIM}$1${RESET}`)

  return text
}

/**
 * Streaming markdown renderer — processes chunks and renders complete lines
 * as they arrive. Returns a flush function for the final partial line.
 */
export function createStreamingMarkdown(): {
  write: (chunk: string) => void
  flush: () => void
} {
  let buffer = ''
  let inCodeBlock = false

  return {
    write(chunk: string) {
      buffer += chunk

      // Process complete lines
      while (buffer.includes('\n')) {
        const idx = buffer.indexOf('\n')
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)

        // Code block toggle
        if (line.trimStart().startsWith('```')) {
          if (!inCodeBlock) {
            inCodeBlock = true
            const lang = line.trim().slice(3).trim()
            process.stdout.write(`${DIM}┌─${lang ? ` ${lang} ` : ''}${'─'.repeat(Math.max(0, 60 - (lang?.length || 0)))}${RESET}\n`)
          } else {
            inCodeBlock = false
            process.stdout.write(`${DIM}└${'─'.repeat(62)}${RESET}\n`)
          }
          continue
        }

        if (inCodeBlock) {
          process.stdout.write(`${DIM}│${RESET} ${GREEN}${line}${RESET}\n`)
          continue
        }

        // Headers
        if (line.startsWith('### ')) {
          process.stdout.write(`${BOLD}${CYAN}   ${line.slice(4)}${RESET}\n`)
          continue
        }
        if (line.startsWith('## ')) {
          process.stdout.write(`${BOLD}${CYAN}  ${line.slice(3)}${RESET}\n`)
          continue
        }
        if (line.startsWith('# ')) {
          process.stdout.write(`${BOLD}${CYAN}${line.slice(2)}${RESET}\n`)
          continue
        }

        // HR
        if (/^[-*_]{3,}\s*$/.test(line)) {
          process.stdout.write(`${DIM}${'─'.repeat(60)}${RESET}\n`)
          continue
        }

        process.stdout.write(renderInline(line) + '\n')
      }
    },

    flush() {
      // Render any remaining partial line
      if (buffer) {
        if (inCodeBlock) {
          process.stdout.write(`${DIM}│${RESET} ${GREEN}${buffer}${RESET}`)
        } else {
          process.stdout.write(renderInline(buffer))
        }
        buffer = ''
      }
      if (inCodeBlock) {
        process.stdout.write(`\n${DIM}└${'─'.repeat(62)}${RESET}\n`)
      }
    },
  }
}
