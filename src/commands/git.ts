// Nole Code - /git command: Git wrapper

import { exec } from 'child_process'
import { promisify } from 'util'
import { cwd } from 'process'

const execAsync = promisify(exec)

async function git(args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`git ${args.join(' ')}`, { cwd: cwd() })
    return stdout + stderr
  } catch (e: any) {
    return e.message || String(e)
  }
}

export function registerGitCommand(registerCmd: (cmd: import('./index.js').Command) => void) {
  registerCmd({
    name: 'git',
    description: 'Git wrapper: commit, push, pull, branch, stash, log, diff',
    execute: async (args) => {
      if (args.length === 0) {
        return `Usage: /git <subcommand> [args...]
Subcommands:
  /git commit <msg>     - Git add -A && commit with message
  /git push           - Git push
  /git pull           - Git pull
  /git branch         - List branches (current marked with *)
  /git branch create <name> - Create new branch
  /git worktree list  - List worktrees
  /git worktree create <branch> <path> - Add worktree
  /git stash         - Git stash
  /git stash pop    - Git stash pop
  /git log [-n N]   - Git log --oneline (default 10)
  /git diff [file]  - Git diff [file]`

      }

      const subcmd = args[0]
      const rest = args.slice(1)

      switch (subcmd) {
        case 'commit': {
          const msg = rest.join(' ')
          if (!msg) return 'Usage: /git commit <message>'
          const addRes = await git(['add', '-A'])
          if (addRes.includes('fatal')) return addRes
          const commitRes = await git(['commit', '-m', msg])
          return commitRes || `Committed: ${msg}`
        }

        case 'push':
          return git(['push'])

        case 'pull':
          return git(['pull'])

        case 'branch': {
          if (rest[0] === 'create' && rest[1]) {
            return git(['checkout', '-b', rest[1]])
          }
          return git(['branch', '-a'])
        }

        case 'worktree': {
          if (rest[0] === 'list') {
            return git(['worktree', 'list'])
          }
          if (rest[0] === 'create' && rest[1] && rest[2]) {
            return git(['worktree', 'add', rest[2], rest[1]])
          }
          return 'Usage: /git worktree list | create <branch> <path>'
        }

        case 'stash': {
          if (rest[0] === 'pop') {
            return git(['stash', 'pop'])
          }
          return git(['stash'])
        }

        case 'log': {
          const n = rest[0]?.match(/-n\s*(\d+)/)?.[1] || '10'
          return git(['log', `--oneline`, `-n${n}`])
        }

        case 'diff': {
          const file = rest[0] || ''
          return git(['diff', file])
        }

        default:
          return `Unknown subcommand: ${subcmd}\nUse /git for usage.`
      }
    },
  })
}