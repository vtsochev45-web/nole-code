// Nole Code - Server Authentication
// API key-based auth for the HTTP/WebSocket server

import { API_KEY } from '../utils/env.js'

export function authenticate(request: Request): boolean {
  const pathname = new URL(request.url).pathname
  // Skip auth for health check
  if (pathname === '/health') return true

  // Skip auth for WebSocket upgrade
  if (pathname === '/ws') return true
  
  // Fail closed: with no API_KEY configured there is no valid credential, so
  // reject every authenticated request rather than letting an empty/"Bearer "
  // header authenticate. The server should refuse to start without a key
  // (see assertServerAuthConfigured), but defend here too.
  if (!API_KEY) return false

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return false

  // Expected format: "Bearer <api_key>"
  const expected = `Bearer ${API_KEY}`
  return authHeader === expected || authHeader === API_KEY
}

/**
 * Refuse to start the authenticated server when no API_KEY is configured.
 * Call this during server bootstrap. Throws if API_KEY is empty.
 */
export function assertServerAuthConfigured(): void {
  if (!API_KEY) {
    throw new Error(
      'Refusing to start server: API_KEY is not set. ' +
        'Set API_KEY in the environment (or .env) before enabling the HTTP/WebSocket server.',
    )
  }
}

export function requireAuth(request: Request): Response | null {
  if (!authenticate(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}