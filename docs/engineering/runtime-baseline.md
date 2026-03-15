# Runtime Baseline

Last verified against code: 2026-03-15

## Decision

The active runtime baseline is:

- one Next.js web process on port `3105`
- one separate Node worker process
- shared Postgres, Redis, and S3-compatible storage

The Docker image now exposes `3105` to match `npm run start`.

## Verification workflow

Use the repository readiness checks before local debugging or deployment:

```bash
npm run runtime:check
npm run runtime:check:deploy
```

`runtime:check` validates the local baseline and warns when `OPENROUTER_API_KEY` is missing.

`runtime:check:deploy` is stricter and fails if the deployable full pipeline is not ready, including a missing `OPENROUTER_API_KEY`.
