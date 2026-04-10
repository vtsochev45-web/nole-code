# Nole Code

AI coding assistant for your terminal. 31 tools, multi-provider, agentic tool loop.

```bash
npm i -g nole-code
nole
```

## What it does

You type a task. Nole reads your code, writes files, runs commands, searches the web, and keeps going until it's done. Like Claude Code, but powered by MiniMax (free) with automatic fallback to OpenRouter or OpenAI.

```
❯ refactor the auth middleware to use JWT

⠹ Thinking... (2s)

I'll read the current auth code, then refactor it.

⠋ Read src/middleware/auth.ts
⠙ Edit src/middleware/auth.ts
  - const session = sessions.get(token)
  + const payload = jwt.verify(token, SECRET)
⠹ Bash npm install jsonwebtoken @types/jsonwebtoken
⠸ RunTests npm test

Refactored auth.ts from session-based to JWT. Installed jsonwebtoken.
All 12 tests pass.

3.2s · ~2400 tokens (2%) · 4 turns
```

## Setup

```bash
# Option 1: npm (global)
npm i -g nole-code

# Option 2: from source
git clone https://github.com/vtsochev45-web/nole-code.git
cd nole-code && npm install && npm run build
```

Set your API key:

```bash
export MINIMAX_API_KEY=your_key    # Primary (free at minimaxi.com)
export OPENROUTER_API_KEY=sk-or-   # Fallback (optional)
export OPENAI_API_KEY=sk-          # Fallback (optional)
```

## Tools (31)

| Category | Tools |
|----------|-------|
| **Files** | Read, Write, Edit, MultiEdit, Glob, Grep, LS, Tree, Rename, Delete, Diff, FindReplace |
| **Shell** | Bash, Spawn, RunTests |
| **Git** | GitStatus, GitDiff, GitCommit |
| **Web** | WebSearch, WebFetch, HttpRequest |
| **Tasks** | TodoWrite, TaskCreate, TaskList, TaskUpdate, TaskGet, TaskStop |
| **Agents** | Agent, TeamCreate, SendMessage |
| **Other** | NotebookEdit, Sleep, Exit |

## Commands

| Command | What it does |
|---------|-------------|
| `/context` | Session stats — tokens, git branch, model, costs |
| `/settings` | View/change model, temperature, maxTokens |
| `/model <name>` | Switch LLM model mid-session |
| `/undo` | Roll back last turn |
| `/compact` | Compress context to save tokens |
| `/fork` | Branch off current session |
| `/new` | Start fresh session |
| `/plan` | Step-by-step approval mode |
| `/commit <msg>` | Git add + commit |
| `/diff` | Git diff |
| `/status` | Git status |
| `/log` | Recent commits |
| `/doctor` | Health check |
| `/help` | All commands |
| `! <cmd>` | Run shell command inline |

## Key features

**Auto-resume** — Reopens your last session for the same directory.

**Ctrl+C** — Cancels the current LLM call, not the whole process. Double-press to exit.

**Multi-provider fallback** — If MiniMax is overloaded (529), automatically retries then falls back to OpenRouter (Gemini Flash) or OpenAI.

**Colored diffs** — Edit tool shows red/green diff of what changed.

**Line numbers** — Read tool shows `cat -n` style line numbers.

**Markdown rendering** — Bold, code blocks, headers rendered in terminal.

**Tab completion** — `/commands` and file paths.

**Animated spinner** — Shows thinking progress with elapsed time.

**MCP support** — Connect Model Context Protocol servers (stdio, SSE, HTTP).

**Security** — Bash command filtering, path validation (blocks /etc/shadow, .ssh/), interactive permission prompts.

**Session memory** — Extracts key facts from conversations, loads context on resume.

**61 tests** — Tools, sessions, commands, security, MCP parsing.

## Configuration

### Settings (`~/.nole-code/settings.json`)
```json
{
  "model": "MiniMax-M2.7",
  "temperature": 0.7,
  "maxTokens": 4096,
  "toolPermissions": "all"
}
```

### Project context (`NOLE.md`)
Create in your project root — loaded into every conversation:
```markdown
# My Project
## Tech Stack
- TypeScript, Express, PostgreSQL
## Commands
npm run dev
npm test
```

### MCP servers (`~/.nole-code/mcp.json`)
```json
[
  {
    "name": "filesystem",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
  }
]
```

## Architecture

```
src/
  index.ts           — REPL + agentic loop
  api/llm.ts         — Multi-provider LLM client (MiniMax/OpenRouter/OpenAI)
  tools/registry.ts  — 31 tool definitions + executor
  tools/web.ts       — Web search (DDG HTML) + fetch
  agents/spawner.ts  — Sub-agent process spawning
  agents/team.ts     — Multi-agent coordination
  session/manager.ts — Session persistence/fork/compact
  commands/          — Slash commands
  permissions/       — Security rules engine
  mcp/client.ts      — MCP protocol client (stdio/SSE/HTTP)
  ui/markdown.ts     — Terminal markdown renderer
  ui/output/         — Spinner, streaming, styles
tests/               — 61 tests (bun test)
```

## License

MIT
