# Worker Runtime

Last verified against code: 2026-03-14

## Active runtime

The active processing runtime is the Node worker in `src/worker-node/index.ts`.

It uses:

- BullMQ `Worker`
- Redis connection from `REDIS_URL`
- Postgres repositories via Drizzle
- concrete stage adapters from `src/worker-node/`

## Startup

The worker process:

- loads `.env.local` and `.env`
- requires `DATABASE_URL`
- reads `PROCESSING_WORKER_CONCURRENCY` with a default of `2`
- creates repositories and stage adapters once at startup
- subscribes to the queue returned by `getProcessingQueueName()`

## Queue message shape

Every queued message contains:

- `jobId`
- `clipId`
- `expectedStage`

The shared type lives in `src/domain/queues/processing-jobs-queue.ts`.

## Processing loop

For each dequeued BullMQ job, the worker:

- starts from `expectedStage`
- runs the shared processing runner
- reloads the DB row
- if the row advanced to a new stage and is still `processing`, loops again in-process
- stops after completion, failure, or a maximum of 8 stage hops

This means a single BullMQ dequeue can progress one job through multiple stages without re-enqueuing between each stage.

## Concrete stage adapters

The Node worker wires in these adapters:

- `NodeAudioNormalizationStageAdapter`
- `NodeAsrTranscriptionStageAdapter`
- `NodeSegmentShapingStageAdapter`
- `NodeTranslationStageAdapter`
- `NodeFinalizeStageAdapter`

## External runtime dependencies

- `ffmpeg` for normalization and audio extraction
- local Whisper model files for ASR
- `OPENROUTER_API_KEY` when the translate stage runs with the default backend
- Redis for queue transport
- Postgres for job state and audit log persistence
- S3-compatible object storage for source media and artifacts

## Cloudflare worker code status

The repository still contains Cloudflare worker code in `src/worker/`.

It currently provides:

- basic HTTP routing
- creator route handlers
- mobile health route
- queue consumption wiring

However, the shared processing runner only performs real stage work when concrete stage adapters are injected. The Node worker does this. The Cloudflare queue path does not currently inject those concrete adapters.

Practical meaning: the Cloudflare worker code is partial and should not be treated as the full active pipeline runtime.

## Logging

- the Node worker logs `worker_started`, `job_completed`, and `job_failed` events to stdout/stderr as JSON
- the translation adapter also emits structured translation events and errors to logs
