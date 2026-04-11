/**
 * Calc Command — Quick math evaluator with unit conversions.
 */

import { registerCommand } from '../commands/index.js'

const conversions: Record<string, [number, string]> = {
  'kg in lb': [2.20462, 'lb'],
  'lb in kg': [0.453592, 'kg'],
  'km in miles': [0.621371, 'miles'],
  'miles in km': [1.60934, 'km'],
  'c in f': [1, '°F'],
  'f in c': [1, '°C'],
  'hectares in acres': [2.47105, 'acres'],
  'acres in hectares': [0.404686, 'ha'],
  'm in feet': [3.28084, 'feet'],
  'feet in m': [0.3048, 'm'],
  'litres in gallons': [0.264172, 'gallons'],
  'gallons in litres': [3.78541, 'L'],
  'kg in tonnes': [0.001, 'tonnes'],
  'tonnes in kg': [1000, 'kg'],
}

function convertUnits(expr: string): { value: number; unit: string } | null {
  const lower = expr.toLowerCase().trim()
  for (const [pattern, [factor, unit]] of Object.entries(conversions)) {
    if (lower.includes(pattern)) {
      const numMatch = expr.match(/[\d.]+/)
      if (!numMatch) return null
      const num = parseFloat(numMatch[0])
      let result = num * factor

      // Special handling for °F and °C
      if (pattern === 'c in f') {
        result = num * 9 / 5 + 32
        return { value: Math.round(result * 100) / 100, unit }
      }
      if (pattern === 'f in c') {
        result = (num - 32) * 5 / 9
        return { value: Math.round(result * 100) / 100, unit }
      }

      return { value: Math.round(result * 100) / 100, unit }
    }
  }
  return null
}

function calc(expr: string): string {
  const conv = convertUnits(expr)
  if (conv) {
    const numMatch = expr.match(/[\d.]+/)
    const num = parseFloat(numMatch![0])
    return `${num} → ${conv.value} ${conv.unit}`
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expr})`)()
    if (typeof result === 'number') {
      const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(6).replace(/\.?0+$/, '')
      return `${formatted}`
    }
    return `${result}`
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

registerCommand({
  name: 'calc',
  description: 'Evaluate math. Usage: /calc <expr>  e.g. /calc 150 * 0.85',
  aliases: ['math'],
  execute: async (args) => {
    if (!args.length) {
      return `Usage: /calc <expression>
Examples:
  /calc 150 * 0.85
  /calc (10**6) / 60
  /calc 10 kg in lb
  /calc 100 km in miles
  /calc 25 c in f`
    }

    const expr = args.join(' ')
    const result = calc(expr)
    return result.startsWith('Error') ? result : `${expr} = ${result}`
  },
})
