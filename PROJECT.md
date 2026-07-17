# nole-code

**Status:** active (maintained v1)
**Owner intent:** Nole v1 CLI — maintained on `master` while v2 is in sprint.
**Last reviewed:** 2026-07-17

## Run
```bash
npm run build
npm run dev
npm test
npm run typecheck
# also: ./run.sh, ./install.sh
```

## Depends on
- Self-contained (no file: deps). Remote vtsochev45-web/nole-code; branch of record `master`.

## Depended on by
- Nothing at a path level. Lineage ancestor of nole-code-v2 / mythos / master-nole.
- Moves to `projects/nole/` with the family post-sprint (Stage 6).

## Gotchas
- Nole runs on free models by design (`claude -p` for reasoning) — never wire paid-model defaults into her runtime.
- `~/projects/video-scratch/` contains this project's old build artefacts and is not part of the repo.
- Local `*.bak-pre-secfix-*` and `dist.bak-pre-oauth-*` rollback snapshots are preserved but ignored; they are not source of truth.
