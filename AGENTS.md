# AGENTS.md

This file is for coding agents working in `learn-thai`.
It summarizes the current repo layout, commands, and coding conventions inferred from the codebase.

## Rule files checked

- Existing `AGENTS.md`: none was present before this file.
- Cursor rules in `.cursor/rules/`: none found.
- `.cursorrules`: not present.
- Copilot rules in `.github/copilot-instructions.md`: not present.

## Repository layout

- `app/`: Next.js routes, pages, and server actions/handlers.
- `lib/`: shared app-side utilities such as auth, DB, queue, and storage helpers.
- `src/contracts/`: shared contracts, schemas, validation helpers, state-machine logic.
- `src/admin/services/`: admin service layer and view-model shaping.
- `src/db/`: DB client and repository implementations.
- `src/domain/`: repository and queue interfaces.
- `src/worker/`: worker routes, pipeline stages, and job runner logic.
- `src/worker-node/`: Node-specific worker runtime adapters and entrypoint.
- `infra/db/schema/`: Drizzle schema source of truth.
- `infra/db/migrations/`: generated SQL migrations.
- `tests/`: Vitest suites split across `contracts`, `admin`, `worker`, and `integration`.
- `docs/`: operational and engineering documentation; update when behavior changes.

## Core commands

- Install dependencies: `npm ci`
- Create local env: `cp .env.example .env.local`
- Start full local stack: `npm run dev`
- Start only Docker services: `npm run dev:stack`
- Stop Docker services: `npm run dev:stack:down`
- Start only the web app: `npm run dev:app`
- Start only the worker watcher: `npm run dev:worker`
- Build production app: `npm run build`
- Start production web app: `npm run start`
- Start production worker: `npm run start:worker`
- Local runtime check: `npm run runtime:check`
- Deploy runtime check: `npm run runtime:check:deploy`

## Lint, typecheck, and tests

- Lint entire repo: `npm run lint`
- Typecheck entire repo: `npm run typecheck`
- Run all tests: `npm test`
- Run integration tests only: `npm run test:integration`
- Check migration integrity: `npm run check:migrations`

## Single-test commands

- Run one test file: `npm test -- tests/contracts/api-error.test.ts`
- Run one integration test file: `npm test -- tests/integration/db/repositories.test.ts`
- Run tests matching a name: `npm test -- -t "api error envelope"`
- Run one file with a name filter: `npm test -- tests/worker/processing-job-runner.test.ts -t "processes duplicate delivery only once"`
- If npm arg passing is awkward, call Vitest directly: `npx vitest run tests/admin/list-clips.test.ts`

## Migration safety

- Drizzle schema files are the source of truth for DB structure.
- Generate migrations from schema changes; do not hand-write SQL migrations.
- Do not hand-edit generated migration SQL.
- Keep schema changes and generated migrations in the same change.
- Useful DB commands: `npm run db:generate`, `npm run db:migrate`, `npm run db:migrate:test`, `npm run db:studio`

## Testing expectations

- Vitest runs in a Node environment from `vitest.config.ts`.
- Tests live under `tests/**/*.test.ts`.
- Integration tests require `TEST_DATABASE_URL` and migrated schema.
- Strongest coverage today is backend contracts, worker stages, repository integration, and admin view models.
- Frontend component tests and browser E2E tests are still missing.

## Formatting and general style

- Use TypeScript everywhere; the repo is `strict` and `noEmit`.
- Use ES modules, double-quoted strings, and semicolons.
- Follow existing 2-space indentation and multiline trailing-comma style.
- Prefer small explicit functions, early returns, and numeric separators like `30_000`.
- Match local wrapping style instead of aggressively reflowing nearby code.

## Imports

- Use `import type` for type-only imports.
- Common pattern: external packages first, then internal modules, then sibling modules.
- No dedicated import sorter is enforced; follow nearby file conventions.
- Prefer the existing relative import style; inline `type` specifiers are common.

## Types and schemas

- Prefer `type` aliases over `interface` unless interface behavior is clearly useful.
- Export dependency bags as `...Dependencies` types for services and route handlers.
- Infer request/response types from Zod schemas with `z.infer<typeof Schema>`.
- Use Zod for request validation and shared contract definitions.
- Keep shared contracts explicit in `src/contracts/`.
- Prefer narrow unions and `satisfies` where they preserve useful literals.

## Naming conventions

- `camelCase`: variables, functions, parameters, and normal object keys.
- `PascalCase`: classes, React components, exported types, and schema constants.
- `SCREAMING_SNAKE_CASE`: module-level constants such as defaults and TTLs.
- Suffix schemas with `Schema`.
- Use `handle...` for route handlers and `...Dependencies` for dependency bags.
- Prefix helpers with `parse...`, `read...`, `require...`, or `get...` when that matches behavior.

## Error handling

- Fail explicitly; do not hide defects behind silent fallbacks.
- Validate external input immediately at route or boundary layers.
- Convert validation failures into the standard API envelope.
- The shared error shape is `code`, `message`, and optional `details`.
- Keep error codes stable and domain-specific.
- Narrow `unknown` before reading fields; return `null` for expected absence and throw for impossible state.
- Use helper classes such as `InvalidRequestError` when callers need structured handling.

## Route, service, and repository design

- Keep route handlers thin: parse request, validate input, call service/repository, shape response.
- Put business logic in service modules or worker pipeline modules, not in route files.
- Keep data access in repository modules.
- Use dependency injection so tests can supply fakes and in-memory implementations.
- Prefer deterministic stage handling and explicit branches over dynamic dispatch.

## React and Next.js patterns

- Preserve the existing App Router structure.
- Add `"use client"` only when a component truly needs client behavior.
- Keep providers small, avoid fetch logic in presentational components, and follow the existing React Query setup.

## Worker and pipeline patterns

- Pipeline stages are explicit: `audio -> asr -> segment -> translate -> finalize`.
- Validate required artifact paths before running a later stage adapter.
- Preserve claim/release semantics and idempotency in job-processing code.
- Keep audit logging explicit; manual retries should remain bounded and predictable.

## Testing style

- Use `describe`, `it`, and `expect` from Vitest.
- Keep test names behavior-focused and specific.
- For unit tests, inject in-memory repositories or fake stage adapters rather than real infra.
- For bug fixes, add a regression test; for feature work, cover happy path and failure/validation paths.

## Agent workflow guidance

- Read the nearest relevant files before editing and follow their local patterns.
- Prefer targeted changes over broad refactors.
- Update `docs/` when API, runtime, migration, or workflow behavior changes.
- Do not introduce a new formatter or import-sorting tool unless explicitly requested.
- Do not add comments for obvious code; reserve comments for non-obvious constraints.
- If changing contracts or schemas, verify related tests and docs in the same change.

When in doubt, prefer explicit contracts, thin routes, repository-backed data access, and tests that exercise changed behavior directly.
