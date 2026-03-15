# Learn Thai

Next.js-based central platform for clip operations and processing orchestration.

MVP implementation includes:
- Admin login and protected dashboard
- Dashboard list of all clips
- Clip upload action that creates a job
- Running jobs panel for active processing
- BullMQ background workers for pipeline execution
- MinIO (S3-compatible) storage for source media and artifacts

## Tech Stack

- Web app: Next.js (App Router)
- Worker runtime: Node.js background worker process
- Queue: Redis + BullMQ
- Storage: MinIO (S3-compatible)
- Database: Postgres
- ORM/migrations: Drizzle ORM + drizzle-kit
- Language/tooling: TypeScript, ESLint, Vitest

## Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose

## Local Setup

1) Install dependencies

```bash
npm ci
```

2) Create local env

```bash
cp .env.example .env.local
```

3) Start everything (services + migrations + app + worker)

```bash
npm run dev
```

## Environment Variables

- `DATABASE_URL` (Postgres)
- `TEST_DATABASE_URL` (integration tests)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET` (admin login)
- `REDIS_URL`, `PROCESSING_QUEUE_NAME`, `PROCESSING_WORKER_CONCURRENCY` (queue/worker)
- `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE` (MinIO/S3)
- `WHISPER_MODEL_NAME`, `WHISPER_AUTO_DOWNLOAD`, `WHISPER_WORD_TIMESTAMPS` (local Whisper ASR)

See `.env.example` for local defaults.

Translation notes:
- The active translate path uses OpenRouter structured outputs for whole-clip Thai -> English translation.
- Set `OPENROUTER_API_KEY`; the worker only fails when the `translate` stage runs.
- `OPENROUTER_TRANSLATION_MODEL` defaults to `stepfun/step-3.5-flash:free` and can be swapped without changing the pipeline.
- The previous local `@huggingface/transformers` + `Xenova/nllb-200-distilled-600M` backend remains in code for rollback.

## Command Reference

### Platform

- `npm run dev`
  - Starts local Docker services, waits for DB, runs migrations, then starts app + worker
- `npm run dev:app`
  - Runs Next.js dev server
- `npm run dev:worker`
  - Runs worker in watch mode
- `npm run dev:stack`
  - Starts Postgres, Redis, and MinIO via Docker Compose
- `npm run dev:stack:down`
  - Stops local Docker services

### Production

- `npm run build`
  - Builds Next.js app
- `npm run start`
  - Starts Next.js app
- `npm run start:worker`
  - Starts worker process
- `npm run runtime:check`
  - Verifies the local runtime baseline before startup
- `npm run runtime:check:deploy`
  - Verifies deploy-time requirements, including the OpenRouter key

### Quality and tests

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:integration`

### Database and migrations

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:migrate:test`
- `npm run db:studio`
- `npm run check:migrations`

## Project Layout

```txt
app/                   # Next.js routes/pages + API endpoints
lib/                   # shared app/worker helpers (auth, db, queue, storage)
src/
  contracts/           # contracts and validation helpers
  db/                  # DB client + repositories
  domain/              # interfaces and queue types
  worker/              # processing runner + stage abstractions
  worker-node/         # BullMQ worker runtime
infra/
  db/
    schema/            # Drizzle schema source of truth
    migrations/        # generated SQL migrations
```

## MVP Admin Routes

- `GET /login`
- `POST /api/admin/login`
- `GET /admin`
- `POST /api/admin/clips/upload`
- `POST /api/admin/logout`

## Production Deployment (VPS)

- Run Next.js app and worker as separate processes.
- Run `npm run runtime:check:deploy` before startup.
- Point both to VPS Postgres, Redis, and MinIO.
- Keep MinIO path style enabled (`S3_FORCE_PATH_STYLE=true`).
- Worker startup auto-checks and attempts to install `ffmpeg` (`npm run worker:ensure-ffmpeg`).
- Ensure worker runtime has permission to install packages, or preinstall `ffmpeg` in the image/host.

## Deployment With Docker (Coolify)

- Build image from `Dockerfile` (CPU-only ASR, Whisper `small` model preloaded).
- Create two services from the same image:
  - web: command `npm run start`
  - worker: command `npm run start:worker`
- Route inbound web traffic to container port `3105`.
- Set shared env vars for both services (`DATABASE_URL`, `REDIS_URL`, S3 vars).
- Set ASR env vars at minimum:
  - `WHISPER_MODEL_NAME=small`
  - `WHISPER_AUTO_DOWNLOAD=false` (model already baked into image)
  - `WHISPER_WORD_TIMESTAMPS=true`
- Set `OPENROUTER_API_KEY`; the active translate stage uses OpenRouter.
- If you choose not to bake models into the image, set `WHISPER_AUTO_DOWNLOAD=true` for worker.
