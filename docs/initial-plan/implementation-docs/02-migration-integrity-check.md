# 02-migration-integrity-check

This document specifies the `pnpm check:migrations` guard.

## Goal

Fail CI when generated migration SQL changes without corresponding Drizzle schema changes.

## Rule

If any file under `infra/db/migrations/` changes in a commit/PR, then at least one file under `infra/db/schema/` must also change.

## Scope

- Run in CI on pull requests and push builds.
- Run locally as part of `pnpm check:migrations`.
- Compare against git diff base (merge-base for PRs, previous commit for local fallback).

## Paths

- Schema source of truth: `infra/db/schema/**`
- Generated migrations: `infra/db/migrations/**`

## Allowed/Disallowed Cases

### Allowed
1. Schema changed, migration changed.
2. Schema changed, migration unchanged (warning allowed; not an integrity failure).
3. Neither schema nor migration changed.

### Disallowed
1. Migration changed, schema unchanged.

## Script Behavior

### Command
- `pnpm check:migrations`

### Exit codes
- `0`: pass
- `1`: integrity violation
- `2`: script/runtime/config error

### Output format
- On pass: one concise success line.
- On fail:
  - print rule violated
  - list changed migration files
  - print actionable fix:
    - update schema and regenerate migrations with Drizzle

## Diff Resolution Strategy

### Inputs
- `MIGRATION_CHECK_BASE` (optional env var)
- `MIGRATION_CHECK_HEAD` (optional env var, default `HEAD`)

### Base selection algorithm
1. If `MIGRATION_CHECK_BASE` is provided, use it.
2. Else, try `git merge-base HEAD origin/main`.
3. Else, fallback to `HEAD~1`.

### Changed file detection
- Use: `git diff --name-only <base>...<head>` when base is merge-base style.
- Normalize path separators to `/`.

## Decision Logic

1. Compute changed files set.
2. `migrationChanged = any(path startsWith infra/db/migrations/)`
3. `schemaChanged = any(path startsWith infra/db/schema/)`
4. If `migrationChanged && !schemaChanged`: fail with exit code 1.
5. Otherwise pass.

## Edge Cases

1. New repo with no `origin/main`:
- fallback path (`HEAD~1`) must be used.

2. Migration file deletions/renames:
- count as migration changes.

3. Schema folder rename:
- script should treat renamed files as changed paths if they still resolve under `infra/db/schema/`.

4. Empty diff:
- pass.

## CI Integration

### Required job step
- Add `pnpm check:migrations` before test jobs.

### Suggested order
1. install deps
2. `pnpm check:migrations`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm test`

### PR template note (recommended)
- If migrations changed, confirm schema change is included in same PR.

## Package Scripts (planned)

In root `package.json`:

```json
{
  "scripts": {
    "check:migrations": "node ./infra/scripts/check-migrations-integrity.mjs"
  }
}
```

## Reference Implementation Notes

- Prefer Node script for portability (macOS/Linux CI).
- Avoid shell-specific features.
- Keep script dependency-free (Node stdlib + git CLI).
