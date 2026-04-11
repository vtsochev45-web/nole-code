/**
 * String utilities.
 */

export function countCharInString(str: string, char: string): number {
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) count++
  }
  return count
}

export function reverse(str: string): string {
  return str.split('').reverse().join('')
}