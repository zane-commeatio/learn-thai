# Overview

Last verified against code: 2026-03-14

## What this repository currently is

Learn Thai is currently an internal admin system for uploading short clips and processing them into review-ready artifacts.

The active implementation has two main runtimes:

- a Next.js App Router web app for admin login, dashboard, upload, and clip review
- a Node.js background worker that runs the processing pipeline through BullMQ

## Main components

- Web app: Next.js in `app/`
- Admin APIs: Next.js route handlers in `app/api/admin/`
- Worker runtime: BullMQ worker in `src/worker-node/`
- Shared pipeline logic: `src/worker/runner/processing-job-runner.ts`
- Database: Postgres via Drizzle schema in `infra/db/schema/`
- Queue: Redis + BullMQ via `lib/queue.ts`
- Object storage: S3-compatible storage via `lib/storage.ts`

## What is implemented

- admin login with a signed cookie session
- admin dashboard with clip upload and job monitoring
- clip detail page with per-stage previews and artifact downloads
- manual retry for failed or manual-intervention jobs
- five-stage processing pipeline: `audio`, `asr`, `segment`, `translate`, `finalize`
- finalized clip preview that shows live Thai and English subtitle lines under the video

## What is not implemented

- learner-facing mobile or web playback product
- publish workflow and immutable learner clip versions
- creator-facing editing portal in the Next.js app
- legal/takedown workflows in the current app

## Status of Cloudflare worker code

The repository still contains Cloudflare worker code in `src/worker/`, including a small mobile health endpoint and creator-oriented routes.

That code is not the primary active runtime for the full pipeline. The fully implemented processing path today is the Node/BullMQ worker in `src/worker-node/`.
