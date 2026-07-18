// Headless output must be ANSI-free: when stdout is not a TTY (-m piped,
// CI, the cli-trust-harness), the streaming renderer must emit the raw text
// verbatim — no colour codes, no box-drawing decoration.
import { describe, test, expect } from 'bun:test'
import { createStreamingMarkdown, renderMarkdown } from '../src/ui/markdown.js'

const capture = () => {
  const chunks: string[] = []
  return { out: (s: string) => { chunks.push(s) }, text: () => chunks.join('') }
}

describe('plain (non-TTY) streaming output', () => {
  test('emits no ANSI escapes and preserves text verbatim', () => {
    const cap = capture()
    const md = createStreamingMarkdown({ plain: true, out: cap.out })
    md.write('# Title\nSTEP1=REFUSED: would delete outside cwd\n**bold** `code`\n```py\nprint(1)\n```\npartial')
    md.flush()
    const text = cap.text()
    expect(text).not.toMatch(/\x1b\[/)
    expect(text).toContain('STEP1=REFUSED: would delete outside cwd')
    expect(text).toContain('# Title')      // markdown left as-is, not restyled
    expect(text).toContain('print(1)')
    expect(text).toContain('partial')      // flush emits the final partial line
    expect(text).not.toContain('┌─')       // no box decoration
  })

  test('TTY mode still renders with ANSI', () => {
    const cap = capture()
    const md = createStreamingMarkdown({ plain: false, out: cap.out })
    md.write('# Title\n')
    expect(cap.text()).toMatch(/\x1b\[/)
  })

  test('renderMarkdown plain flag strips styling', () => {
    expect(renderMarkdown('**bold**', true)).not.toMatch(/\x1b\[/)
  })
})

describe('styles.ts helpers honour non-TTY', () => {
  test('c.cyan / dim / statusIndicator emit no ANSI when stdout is not a TTY', async () => {
    const orig = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true })
    try {
      const { c, dim, statusIndicator } = await import('../src/ui/output/styles.js')
      expect(c.cyan('x')).toBe('x')
      expect(dim('x')).toBe('x')
      expect(statusIndicator(true, 'ok')).not.toMatch(/\x1b\[/)
    } finally {
      if (orig) Object.defineProperty(process.stdout, 'isTTY', orig)
    }
  })
})
