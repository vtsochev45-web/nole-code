// Nole Code - Server Authentication
// API key-based auth for the HTTP/WebSocket server

import { API_KEY } from '../utils/env.js'

export function authenticate(request: Request): boolean {
  // Skip auth for health check
  if (request.url.pathname === '/health') return true
  
  // Skip auth for WebSocket upgrade
  if (request.url.pathname === '/ws') return true
  
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return false
  
  // Expected format: "Bearer <api_key>"
  const expected = `Bearer ${API_KEY}`
  return authHeader === expected || authHeader === API_KEY
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