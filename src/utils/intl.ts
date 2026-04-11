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

export function getGraphemeSegmenter(): (str: string) => string[] {
  return (str: string) => {
    if (!str) return []
    return str.split('')
  }
}