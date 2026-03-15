# Local Development

Last verified against code: 2026-03-14

## Prerequisites

- Node.js 20+
- npm 10+
- Docker and Docker Compose

## Install

```bash
npm ci
cp .env.example .env.local
```

## Main local workflow

```bash
npm run dev
```

This command:

- starts local Postgres, Redis, MinIO, and MinIO bucket init
- waits for the database
- runs migrations
- starts the Next.js app on port `3105`
- starts the Node worker in watch mode

## Useful commands

```bash
npm run dev:app
npm run dev:worker
npm run dev:stack
npm run dev:stack:down
npm run runtime:check
npm run build
npm run start
npm run start:worker
npm run lint
npm run typecheck
npm test
npm run test:integration
```

## Local service ports

- Postgres: `127.0.0.1:55432`
- Redis: `127.0.0.1:56379`
- MinIO API: `127.0.0.1:59000`
- MinIO console: `127.0.0.1:59001`
- Next.js app: `127.0.0.1:3105`

## Core environment variables

### Database

- `DATABASE_URL`
- `TEST_DATABASE_URL`

### Admin auth

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

### Queue

- `REDIS_URL`
- `PROCESSING_QUEUE_NAME`
- `PROCESSING_WORKER_CONCURRENCY`

### Storage

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `S3_FORCE_PATH_STYLE`

### ASR

- `WHISPER_MODEL_NAME`
- `WHISPER_AUTO_DOWNLOAD`
- `WHISPER_WORD_TIMESTAMPS`

### Translation

- `OPENROUTER_API_KEY`
- `OPENROUTER_TRANSLATION_MODEL`

## Local URLs

- Login page: `http://127.0.0.1:3105/login`
- Admin dashboard: `http://127.0.0.1:3105/admin`

## Local readiness check

Run this before debugging startup problems:

```bash
npm run runtime:check
```

This verifies the local baseline that the active runtime expects:

- app and worker share the same `DATABASE_URL`, `REDIS_URL`, and S3 bucket settings
- admin auth vars are present for the web process
- `ffmpeg` is available on PATH for the worker
- Whisper assets are already present, or `WHISPER_AUTO_DOWNLOAD=true` allows on-demand install

If `OPENROUTER_API_KEY` is missing, the check warns instead of failing. Local startup still works, but jobs will fail once they reach the `translate` stage.

## Common issues

- Missing `SESSION_SECRET`, `ADMIN_EMAIL`, or `ADMIN_PASSWORD` blocks login
- Missing `ffmpeg` blocks worker startup or audio stage execution
- Missing `OPENROUTER_API_KEY` only breaks jobs once they reach `translate`
- Missing `TEST_DATABASE_URL` blocks integration test migrations
