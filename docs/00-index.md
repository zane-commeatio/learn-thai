# Current Docs

Last verified against code: 2026-03-14

This folder documents the current implementation in this repository.

Historical planning documents live in `docs/initial-plan/` and are not the source of truth for the running system.

## Source of truth order

1. Code in `app/`, `src/`, `lib/`, and `infra/`
2. Drizzle schema in `infra/db/schema/`
3. The docs in this folder
4. Archived material in `docs/initial-plan/`

## Document map

- `docs/01-overview.md` - high-level system summary
- `docs/02-admin-ui.md` - current admin flows and screens
- `docs/03-processing-pipeline.md` - processing stages, states, and artifacts
- `docs/04-data-model.md` - database schema and storage layout
- `docs/05-api.md` - implemented API surfaces
- `docs/06-worker-runtime.md` - Node worker runtime and queue behavior
- `docs/07-local-dev.md` - local setup and commands
- `docs/08-operations.md` - deployment shape and troubleshooting basics
- `docs/09-testing.md` - current test suite and gaps
- `docs/10-decisions.md` - short log of key implementation decisions
- `docs/11-roadmap.md` - grounded path from the current admin system to a learner product

## Writing rules

- Describe only what exists in the codebase today.
- Mark planned work explicitly as `Not implemented`.
- Prefer short factual sections over speculative design.
