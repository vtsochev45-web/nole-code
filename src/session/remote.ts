// Nole Code - Remote Sessions
// WebSocket-based session sharing
// Adapted from Nole Code's remote session architecture

import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, homedir } from 'path'

export interface RemoteSession {
  id: string
  ws: WebSocket
  isOwner: boolean
  sessionId: string
  ready: boolean
}

interface RemoteMessage {
  type: 'session' | 'message' | 'tool_call' | 'tool_result' | 'error' | 'ready'
  sessionId?: string
  content?: string
  data?: unknown
}

// Remote session manager
class RemoteSessionManager {
  private sessions = new Map<string, RemoteSession>()
  private wss: WebSocketServer | null = null
  private _port = 0

  // FIX: Get port from env with fallback to default
  private getDefaultPort(): number {
    const envPort = parseInt(process.env.NOLE_REMOTE_PORT || '', 10)
    return isNaN(envPort) ? 18790 : envPort
  }

  getPort(): number {
    return this._port || this.getDefaultPort()
  }

  // Start the WebSocket server
  async start(port?: number): Promise<void> {
    if (this.wss) return

    this._port = port || this.getDefaultPort()
    this.wss = new WebSocketServer({ port: this._port })

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws)
    })

    console.log(`Remote sessions listening on ws://localhost:${port}`)
  }

  private handleConnection(ws: WebSocket): void {
    let sessionId: string | null = null
    let isOwner = false

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as RemoteMessage

        switch (msg.type) {
          case 'session':
            // Client wants to join/create a session
            sessionId = msg.sessionId || randomUUID()
            isOwner = !msg.sessionId

            const remote: RemoteSession = {
              id: sessionId,
              ws,
              isOwner,
              sessionId: sessionId,
              ready: false,
            }
            this.sessions.set(sessionId, remote)

            // Load session data if resuming
            if (!isOwner && msg.sessionId) {
              const sessionData = this.loadRemoteSession(msg.sessionId)
              if (sessionData) {
                ws.send(JSON.stringify({
                  type: 'session',
                  sessionId: msg.sessionId,
                  data: sessionData,
                }))
              }
            }

            ws.send(JSON.stringify({
              type: 'ready',
              sessionId,
              isOwner,
            }))
            break

          case 'message':
            // Broadcast message to all participants
            this.broadcast(sessionId!, {
              type: 'message',
              sessionId,
              content: msg.content,
            })
            break

          case 'tool_call':
            // Forward tool call
            this.broadcast(sessionId!, {
              type: 'tool_call',
              sessionId,
              data: msg.data,
            })
            break

          case 'tool_result':
            // Broadcast tool result
            this.broadcast(sessionId!, {
              type: 'tool_result',
              sessionId,
              data: msg.data,
            })
            break
        }
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'error',
          content: String(err),
        }))
      }
    })

    ws.on('close', () => {
      if (sessionId) {
        const remote = this.sessions.get(sessionId)
        if (remote) {
          // Notify others
          this.broadcast(sessionId, {
            type: 'error',
            content: 'Participant disconnected',
          })
          this.sessions.delete(sessionId)
        }
      }
    })

    ws.on('error', (err) => {
      console.error('WebSocket error:', err)
    })
  }

  private broadcast(sessionId: string, msg: RemoteMessage): void {
    const remote = this.sessions.get(sessionId)
    if (!remote) return

    const data = JSON.stringify(msg)
    for (const [id, participant] of this.sessions) {
      if (id !== sessionId) {
        participant.ws.send(data)
      }
    }
  }

  private loadRemoteSession(sessionId: string): unknown | null {
    try {
      const file = join(homedir(), '.nole-code', 'remote', `${sessionId}.json`)
      if (existsSync(file)) {
        return JSON.parse(readFileSync(file, 'utf-8'))
      }
    } catch {}
    return null
  }

  saveRemoteSession(sessionId: string, data: unknown): void {
    try {
      const dir = join(homedir(), '.nole-code', 'remote')
      mkdirSync(dir, { recursive: true })
      const file = join(dir, `${sessionId}.json`)
      writeFileSync(file, JSON.stringify(data, null, 2))
    } catch {}
  }

  stop(): void {
    if (this.wss) {
      this.wss.close()
      this.wss = null
    }
  }

  getPort(): number {
    return this.port
  }

  getSessionCount(): number {
    return this.sessions.size
  }
}

export const remoteSessions = new RemoteSessionManager()

// URL generator for sharing sessions
export function getShareUrl(sessionId: string): string {
  const host = process.env.NOLE_HOST || 'localhost'
  const port = remoteSessions.getPort()
  return `nole-code://connect/${sessionId}`
}
