# Testing

Last verified against code: 2026-03-14

## Test runner

- framework: Vitest
- environment: Node
- config: `vitest.config.ts`

Coverage reporting is currently disabled.

## Commands

```bash
npm test
npm run test:integration
npm run typecheck
npm run lint
```

## What is covered today

### Contracts

- pipeline stage and state-machine rules
- API error envelope helpers

### Worker unit tests

- creator/mobile Cloudflare route handlers
- processing runner stage progression and failure behavior
- translation stage adapter behavior
- finalize stage adapter payload generation

### Admin unit tests

- dashboard data shaping via `listClips`
- clip detail stage view-model behavior, including finalize preview URLs and retry state handling

### Integration tests

- Drizzle repositories against a real test database
- creator route flows against the test database
- processing runner lock and idempotency behavior

## Current testing shape

The strongest automated coverage is around backend contracts and pipeline behavior.

There are still no frontend component tests or browser end-to-end tests for the Next.js admin UI.

## Requirements for integration tests

- `TEST_DATABASE_URL` must be set
- the test database schema must be migrated

`npm run db:migrate:test` exists to apply migrations to the test database.

## Known gaps

- no rendered UI tests for dashboard or clip detail pages
- no tests for the client-side finalize video subtitle widget playback behavior
- no deployment smoke tests in this repo
- no coverage reporting threshold
