# Changelog

All notable changes to Nole Code are documented in this file.

## [1.20.0] — 2026-04-19

Security, correctness, and reliability release driven by an end-to-end code audit.
No breaking API changes for interactive users; non-interactive/agent mode continues
to auto-allow as before.

### Security

- **Default-deny for unknown bash commands.** `checkCommandSecurity` previously
  returned `allowed: true` for any command not explicitly listed — now returns
  `allowed: false, requiresConfirmation: true`, and the executor prompts the
  user (or auto-allows in non-TTY mode, unchanged). (`src/permissions/bash-security.ts`)
- **Removed destructive ops from the auto-allow list.** `rm`, `mv`, `cp`, `ln`,
  and `npm install` (lifecycle scripts can execute arbitrary code) now route
  through the permission layer instead of running silently. (`src/permissions/bash-security.ts`)
- **Shell-injection fix in `GrepTool` and `GlobTool`.** LLM-supplied patterns
  and paths were interpolated inside double quotes, so `$(…)` and backtick
  escapes executed. Switched to single-quoted arguments with proper `'\"'\"'`
  escaping, matching the already-correct `Grep` tool. (`src/tools/registry.ts`)
- **SSRF guard on `WebFetch` / `HttpRequest` / `webFetch`.** New `checkUrlSafety`
  helper blocks loopback, RFC1918, link-local (incl. AWS/GCP metadata
  `169.254.169.254`), CGNAT, `metadata.google.internal`, and non-http(s)
  schemes before `fetch` is called. (`src/utils/url-safety.ts` new, `src/tools/registry.ts`, `src/tools/web.ts`)
- **Heredoc and here-string execution patterns detected.** `bash <<EOF … EOF`,
  `python3 <<< '…'`, `exec <<`, `source <<` now classified as `critical` risk —
  the existing `bash -c` / `python -c` patterns missed these multi-line
  variants. (`src/permissions/bash-security.ts`)
- **Security feature flags enabled by default.** `PERMISSION_RULES`,
  `COMMAND_ANALYSIS`, `PATH_VALIDATION`, `DESTRUCTIVE_CONFIRM` now ON out of the
  box. Previously the rules engine silently no-op'd unless the user set
  `NOLE_FEATURES`. New `NOLE_FEATURES_DISABLE` env var for explicit opt-out.
  (`src/feature-flags/index.ts`)

### Correctness

- **Permission timeout type bug.** `PermissionResult` is typed
  `'allow' | 'deny' | 'ask'`, but the manager resolved `false` on timeout and
  on `clearPendingRequests`. Consumers comparing `!== 'allow'` treated these as
  deny-by-accident. Now resolves `'deny'` explicitly; `respond()` converts its
  boolean arg to `'allow' | 'deny'`. (`src/permissions/manager.ts`)
- **Read-only mode operator-precedence bug.** The compound `&&`/`||` expression
  bound tighter than intended, so `Edit`/`Write` were never caught by readonly.
  Rewritten with explicit parentheses; removed `Bash` from the read-only tool
  list (it belongs in the bash-subcommand branch) and added `LS`.
  (`src/permissions/rules-engine.ts`)
- **XML tool-call ID collisions.** Parsed XML `<invoke>` blocks used
  `xml_${Date.now()}_${calls.length}` — two parses in the same millisecond
  collided, which dropped matching `tool_result`s as orphans. Now uses
  `crypto.randomUUID()`. (`src/api/llm.ts`)
- **`chatStream` no longer swallows fatal API errors.** The outer `try/catch`
  retried every failure via non-streaming `chat()`, including `401` auth and
  invalid-model errors — the real cause was lost. Now rethrows fatal 4xx
  (excluding 408/429). (`src/api/llm.ts`)
- **`tool_call_id` guaranteed non-undefined in executor.** When the LLM
  returned a tool call without an id, the session pushed `tool_call_id:
  undefined`, and the next turn's `tool_result` matched nothing, causing a 400
  on the next request. Now generates a stable id up front.
  (`src/loop/executor.ts`)
- **MCP `isError` no longer triggered by substring `"error"`.** Trusting the
  MCP server's authoritative `isError` flag instead of inspecting content text
  — outputs like `"0 errors found"` were being classified as failures.
  (`src/mcp/client.ts`)

### Reliability

- **Per-request fetch timeout with `AbortController`.** `fetchWithRetry`
  previously had no timeout — a hung socket could freeze the agent indefinitely.
  Default 180s, tunable via `NOLE_FETCH_TIMEOUT_MS`. Retries on
  timeout/network errors with the same backoff as the existing 5xx retry.
  (`src/api/llm.ts`)
- **`parseApiError` keeps more context on unparseable responses.** Was
  truncating to 200 chars without indicator; now preserves up to 500 chars and
  marks truncation explicitly. (`src/api/llm.ts`)

### Small pre-existing fixes rolled up

- `src/analytics/index.ts` — fix wrong-module import (`homedir` is from `node:os`, not `node:path`).
- `src/commands/pipe.ts` — replaced `execAsync` with `spawn` for proper stdin piping of last output.
- `src/commands/debug.ts` — added type annotation for `response.json()` array.
- `src/commands/index.ts` — `.then(m => m.registerCommand)` was a no-op (just returned the function, never called it). Switched clipboard/calc/changelog to self-register on import.
- `src/index.ts` — system-prompt refresh on session resume; stale prompt was persisted across reloads.
- `src/loop/checkpoint.ts` — `shouldContinue` now handles `paused` and `waiting` states.
- `src/services/compact/index.ts` — sanitize tool pairs after assembly (not before), so compaction can't leave orphans at the boundary.

### Known follow-ups (not in this release)

- **Checkpoint watcher polling.** `src/loop/agent.ts` polls the checkpoint
  file every 500ms. Writes are already atomic (tmp + rename) and the watcher
  is idempotent per-step, so there's no corruption risk, but sub-500ms state
  flips can be missed. Acceptable for current step granularity; revisit if we
  add very fast steps.
- **GitHub PAT in the `origin` remote URL.** Credential is embedded in the
  git remote. Recommend rotating to an ssh remote or a credential helper.
