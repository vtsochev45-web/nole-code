// `nole auth status` / `nole auth import <provider>` — CLI subcommand for the
// OAuth credential bridge. Ported from nole-code-v2/src/commands/auth.ts.
// v1 has no codex_responses client, so `codex`/`openai` are rejected with a
// clear message rather than silently accepted.
import {
  configureOAuthProvider,
  DEFAULT_OAUTH_SOURCE_PATHS,
  getOAuthStatus,
  type OAuthProvider,
} from '../auth/oauth-bridge.js'

interface AuthCliIO {
  log?: (line: string) => void
  nowMs?: number
}

const ALIASES: Record<string, OAuthProvider> = {
  minimax: 'minimax',
  claude: 'anthropic',
  anthropic: 'anthropic',
}

const UNSUPPORTED = new Set(['codex', 'openai', 'openai-codex'])

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

function usage(): string {
  return [
    'Usage:',
    '  nole auth status',
    '  nole auth import <minimax|claude> [--source <path>]',
    '',
    'Nole stores only source metadata. Access and refresh tokens remain in the owning CLI store.',
  ].join('\n')
}

export async function runAuthCli(args: string[], io: AuthCliIO = {}): Promise<number> {
  const log = io.log || console.log
  const command = args[0] || 'status'
  const authPath = flagValue(args, '--auth-path')
  const common = { ...(authPath ? { authPath } : {}), ...(io.nowMs === undefined ? {} : { nowMs: io.nowMs }) }

  if (command === 'status') {
    try {
      const status = getOAuthStatus(common)
      log('Nole OAuth bridges:')
      for (const provider of ['minimax', 'anthropic'] as OAuthProvider[]) {
        const entry = status[provider]
        const state = !entry.configured ? 'not configured' : entry.valid ? 'valid' : 'invalid or expired'
        const expiry = entry.expiresAt ? `, expires ${new Date(entry.expiresAt).toISOString()}` : ''
        log(`  ${provider}: ${state}${expiry}`)
      }
      return 0
    } catch (error) {
      log(`OAuth status failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      return 1
    }
  }

  if (command === 'import') {
    const requested = args[1] || ''
    if (UNSUPPORTED.has(requested)) {
      log(`Unsupported OAuth provider: ${requested}. Nole Code v1 has no codex/OpenAI OAuth client — supported: minimax, claude.`)
      return 1
    }
    const provider = ALIASES[requested]
    if (!provider) {
      log('Unsupported OAuth provider. Supported: minimax, claude.')
      return 1
    }
    const sourcePath = flagValue(args, '--source') || DEFAULT_OAUTH_SOURCE_PATHS[provider]
    const profile = flagValue(args, '--profile')
    try {
      configureOAuthProvider(provider, {
        ...common,
        sourcePath,
        ...(profile ? { profile } : {}),
      })
      log(`${provider} OAuth bridge configured from ${sourcePath}.`)
      log('No access or refresh token was copied into Nole.')
      return 0
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      log(`Could not configure ${provider}: ${message}`)
      return 1
    }
  }

  log(usage())
  return command === 'help' || command === '--help' || command === '-h' ? 0 : 1
}
