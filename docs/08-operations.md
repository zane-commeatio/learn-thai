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

## Container image

The Dockerfile:

- installs `ffmpeg`
- installs dependencies with `npm ci`
- pre-downloads and builds the Whisper model runtime
- runs `npm run build`

The image exposes port `3000`, but the package scripts run Next on `3105`. Keep that mismatch in mind when wiring runtime commands and container ports.

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
- `OPENROUTER_API_KEY` must be set if the default translation backend is used

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
