/**
 * Cursor class for text navigation.
 * Provides cursor position calculations for vim motions.
 */

export class Cursor {
  constructor(
    public readonly text: string,
    public readonly offset: number,
  ) {}

  equals(other: Cursor): boolean {
    return this.offset === other.offset
  }

  getPosition(): { line: number; col: number } {
    const lines = this.text.slice(0, this.offset).split('\n')
    return {
      line: lines.length - 1,
      col: (lines[lines.length - 1]?.length ?? 0),
    }
  }

  // Movement methods
  left(): Cursor {
    return new Cursor(this.text, Math.max(0, this.offset - 1))
  }

  right(): Cursor {
    return new Cursor(this.text, Math.min(this.text.length, this.offset + 1))
  }

  down(): Cursor {
    return this.moveDown(false)
  }

  downLogicalLine(): Cursor {
    return this.moveDown(true)
  }

  up(): Cursor {
    return this.moveUp(false)
  }

  upLogicalLine(): Cursor {
    return this.moveUp(true)
  }

  private moveDown(logical: boolean): Cursor {
    const lines = this.text.split('\n')
    const { line } = this.getPosition()
    if (line >= lines.length - 1) return this
    const newOffset = this.text.indexOf('\n', this.offset) + 1
    return new Cursor(this.text, newOffset > 0 ? newOffset : this.offset)
  }

  private moveUp(logical: boolean): Cursor {
    const { line } = this.getPosition()
    if (line <= 0) return this
    const prevNewline = this.text.lastIndexOf('\n', this.offset - 1)
    if (prevNewline === -1) return new Cursor(this.text, 0)
    const newOffset = this.text.lastIndexOf('\n', prevNewline - 1) + 1
    return new Cursor(this.text, Math.max(0, newOffset))
  }

  // Word motions
  nextVimWord(): Cursor {
    const match = this.text.slice(this.offset).match(/(\s*)(\S+)/)
    if (!match) return this
    const skip = match[1].length
    return new Cursor(this.text, this.offset + skip + match[2].length)
  }

  prevVimWord(): Cursor {
    const match = this.text.slice(0, this.offset).match(/(\S+)(\s*)$/)
    if (!match) return this
    const ws = match[2].length
    return new Cursor(this.text, this.offset - ws - match[1].length)
  }

  endOfVimWord(): Cursor {
    const match = this.text.slice(this.offset).match(/(\S+)(\s*)/)
    if (!match) return this
    return new Cursor(this.text, this.offset + match[1].length)
  }

  nextWORD(): Cursor {
    return this.nextVimWord() // Simplified
  }

  prevWORD(): Cursor {
    return this.prevVimWord() // Simplified
  }

  endOfWORD(): Cursor {
    return this.endOfVimWord() // Simplified
  }

  // Line positions
  startOfLogicalLine(): Cursor {
    const lastNewline = this.text.lastIndexOf('\n', this.offset - 1)
    return new Cursor(this.text, lastNewline + 1)
  }

  firstNonBlankInLogicalLine(): Cursor {
    const lineStart = this.startOfLogicalLine().offset
    const match = this.text.slice(lineStart).match(/\S/)
    if (!match) return this
    return new Cursor(this.text, lineStart + (match.index ?? 0))
  }

  endOfLogicalLine(): Cursor {
    const nextNewline = this.text.indexOf('\n', this.offset)
    return new Cursor(
      this.text,
      nextNewline === -1 ? this.text.length : nextNewline,
    )
  }

  startOfFirstLine(): Cursor {
    return new Cursor(this.text, 0)
  }

  startOfLastLine(): Cursor {
    const lastNewline = this.text.lastIndexOf('\n')
    return new Cursor(this.text, lastNewline + 1)
  }

  isAtEnd(): boolean {
    return this.offset >= this.text.length
  }

  findCharacter(
    char: string,
    findType: string,
    _count: number,
  ): number | null {
    const dir = findType === 'f' || findType === 't' ? 1 : -1
    const searchText = dir > 0 ? this.text.slice(this.offset + 1) : this.text.slice(0, this.offset).reverse()
    const idx = dir > 0 ? searchText.indexOf(char) : searchText.indexOf(char)
    return idx === -1 ? null : this.offset + (dir > 0 ? idx + 1 : -idx)
  }
}