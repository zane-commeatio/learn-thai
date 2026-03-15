# Decisions

Last verified against code: 2026-03-14

This file records a few implementation decisions that are important for understanding the current codebase.

## 2026-03 - Current docs were reset from scratch

- Archived the older numbered planning documents under `docs/initial-plan/`
- Replaced them with implementation-only docs

Why:

- the old documents mixed vision, historical plans, and outdated architecture assumptions
- contributors needed a smaller factual set for the current system

## 2026-03 - Next.js admin app is the primary web surface

- The current user-facing implementation in this repo is an internal admin app under `app/admin/`
- Creator and learner product surfaces are not part of the active Next.js implementation

Why:

- this matches the code that is actually wired, protected, and used by the Node worker flow

## 2026-03 - Node/BullMQ is the active processing runtime

- The real end-to-end processing path uses `src/worker-node/`
- Cloudflare worker code remains in the repo but is not the fully wired processing runtime

Why:

- the Node worker injects concrete stage adapters for audio, ASR, translation, and finalize
- the Cloudflare queue path does not currently provide the same concrete adapter wiring

## 2026-03 - Pipeline uses five active stages

- `audio -> asr -> segment -> translate -> finalize`

Why:

- this is the current shared contract in code and database enums
- older `tokenize` and `gloss` concepts are not active stages in the current implementation

## 2026-03 - Successful jobs stop at `needs_review`

- Finalize does not publish learner content
- It produces generated and edited payload artifacts for review

Why:

- the admin workflow currently ends at review-ready output, not publishing

## 2026-03 - Storage is job-oriented, not version-oriented

- source media is stored once per clip
- derived artifacts are stored per job under `clips/{clipId}/jobs/{jobId}/...`

Why:

- the current system is built around processing jobs and review artifacts
- versioned learner publishing is not implemented yet
