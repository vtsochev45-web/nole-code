/**
 * Internationalization utilities.
 */

export function firstGrapheme(str: string): string {
  if (!str) return ''
  return str[0]!
}

export function lastGrapheme(str: string): string {
  if (!str) return ''
  return str[str.length - 1]!
}

export function getGraphemeSegmenter(): { segment(str: string): Array<{ segment: string; index: number }> } {
  return {
    segment(str: string): Array<{ segment: string; index: number }> {
      if (!str) return []
      return str.split('').map((segment, index) => ({ segment, index }))
    },
  }
}