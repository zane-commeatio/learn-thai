# Operations

Last verified against code: 2026-03-14

## Deployment shape

The intended deployment shape is simple:

- one Next.js web process
- one separate worker process
- shared Postgres
- shared Redis
- shared S3-compatible storage

The web and worker must point at the same database, queue, and bucket.

## Production commands

Web:

```bash
npm run build
npm run start
```

Worker:

```bash
npm run start:worker
```

Before starting either process, run:

```bash
npm run runtime:check:deploy
```

## Container image

The Dockerfile:

- installs `ffmpeg`
- installs dependencies with `npm ci`
- pre-downloads and builds the Whisper model runtime
- runs `npm run build`

The image exposes port `3105`, which matches `npm run start`.

## Deployment readiness checklist

Treat deployment as ready only when all of the following are true:

- one web process runs `npm run start`
- one separate worker process runs `npm run start:worker`
- both processes point at the same `DATABASE_URL`, `REDIS_URL`, `PROCESSING_QUEUE_NAME`, and S3 bucket config
- the bucket named by `S3_BUCKET` already exists
- `ffmpeg` is available in the worker runtime
- Whisper assets for `WHISPER_MODEL_NAME` are already baked in, or `WHISPER_AUTO_DOWNLOAD=true` is intentionally enabled
- `OPENROUTER_API_KEY` is set, because the active translate stage uses OpenRouter
- the service/router/container maps traffic to port `3105`

## Required backing services

- Postgres for application state
- Redis for BullMQ queue transport
- S3-compatible object storage for source media and artifacts

## Storage assumptions

- path-style S3 access is expected and enabled by default
- the configured bucket must already exist outside of local docker-compose
- both web and worker need read and write access to the same bucket

## Worker runtime assumptions

- `ffmpeg` must be available at runtime
- Whisper model files must be available locally or auto-download must be enabled
- `OPENROUTER_API_KEY` must be set because the active translation backend is OpenRouter

## App runtime assumptions

- request bodies up to `100mb` are allowed for server actions by `next.config.mjs`
- admin routes depend on `SESSION_SECRET` and static admin credentials from env

## Basic troubleshooting

### Upload succeeds but processing does not move

Check:

- worker process is running
- Redis is reachable
- the queue name matches between app and worker

### Job fails at `audio`

Check:

- source object exists in storage
- `ffmpeg` is installed and runnable

### Job fails at `asr`

Check:

- WAV artifact exists
- Whisper model is installed

### Job fails at `translate`

Check:

- `OPENROUTER_API_KEY` is set
- outbound API access is available

### Artifact routes return 404

Check:

- the job row has the expected `artifact_refs`
- the object exists in the configured bucket

## Not implemented

- full production observability stack
- automated deployment pipeline in this repo
- staged publish/release workflow for learner content
