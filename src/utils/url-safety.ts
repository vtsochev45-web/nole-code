// URL safety — SSRF guard for WebFetch / HttpRequest / webFetch.
// Blocks loopback, link-local (incl. AWS metadata 169.254.169.254), RFC1918,
// and non-http(s) schemes. Resolve-then-check would be stronger; this is the
// cheap form that catches the common LLM-prompted internal-scan case.

import { isIP } from 'net'

export interface UrlCheck {
  safe: boolean
  reason?: string
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  if (a === 10) return true                           // 10.0.0.0/8
  if (a === 127) return true                          // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true             // 169.254.0.0/16 link-local (AWS/GCP metadata)
  if (a === 172 && b >= 16 && b <= 31) return true    // 172.16.0.0/12
  if (a === 192 && b === 168) return true             // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true   // 100.64.0.0/10 CGNAT
  if (a === 0) return true                             // 0.0.0.0/8
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fe80:')) return true   // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true  // unique local fc00::/7
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice(7)
    if (isIP(v4) === 4) return isPrivateIPv4(v4)
  }
  return false
}

export function checkUrlSafety(raw: string): UrlCheck {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return { safe: false, reason: 'malformed URL' }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { safe: false, reason: `scheme ${u.protocol} not allowed (http/https only)` }
  }
  const host = u.hostname
  if (!host) return { safe: false, reason: 'empty host' }
  const lower = host.toLowerCase()
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local')) {
    return { safe: false, reason: `host ${host} blocked (loopback)` }
  }
  const fam = isIP(host)
  if (fam === 4 && isPrivateIPv4(host)) return { safe: false, reason: `IPv4 ${host} is private/loopback` }
  if (fam === 6 && isPrivateIPv6(host)) return { safe: false, reason: `IPv6 ${host} is private/loopback` }
  // Known metadata endpoints by hostname (covers GCP's metadata.google.internal)
  if (lower === 'metadata.google.internal' || lower === 'metadata') {
    return { safe: false, reason: `host ${host} is a cloud metadata endpoint` }
  }
  return { safe: true }
}

export function assertUrlSafe(raw: string): void {
  const r = checkUrlSafety(raw)
  if (!r.safe) throw new Error(`Blocked URL: ${r.reason}`)
}
