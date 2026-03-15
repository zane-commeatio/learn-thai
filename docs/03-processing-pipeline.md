# Processing Pipeline

Last verified against code: 2026-03-14

## Pipeline summary

The active processing pipeline is a linear five-stage workflow:

`audio -> asr -> segment -> translate -> finalize`

The shared stage order is defined in `src/contracts/pipeline.ts` and `src/contracts/state-machine.ts`.

## Job states

Current processing job states:

- `uploaded`
- `processing`
- `needs_review`
- `failed`
- `manual_intervention`

In the current admin upload flow, newly created jobs start directly in `processing` at stage `audio`.

The terminal success state is currently `needs_review`.

## Runner behavior

The shared runner in `src/worker/runner/processing-job-runner.ts` does the following:

- claims a job row for the expected stage using `lock_token` and `lock_expires_at`
- executes the stage adapter
- persists new artifact refs into `artifact_refs`
- writes audit log events for start, success, failure, and stage change
- advances to the next stage when successful
- marks the job `needs_review` after `finalize`
- marks the job `failed` with a stage-specific error code if any stage throws
- releases the claim lock in a `finally` block

There are no automatic retry attempts at the queue level. BullMQ jobs are enqueued with `attempts: 1`.

## Stage details

### `audio`

Input:

- source object at `clips/{clipId}/source`

Work:

- transcode source media to normalized MP4
- extract one poster frame
- extract mono 16 kHz WAV audio

Output objects:

- `normalized.mp4`
- `poster.jpg`
- `audio.wav`

### `asr`

Input:

- WAV artifact from `audio`

Work:

- runs local Whisper through `nodejs-whisper`
- requests word timestamps when enabled by env
- normalizes the ASR output into a JSON artifact

Output object:

- `asr.json`

Artifact metadata includes transcript preview, segment count, word count, and language.

### `segment`

Input:

- `asr.json`

Work:

- extracts usable ASR segments
- shapes them into segment-level timing and text records

Output object:

- `segments.json`

### `translate`

Input:

- `segments.json`

Work:

- translates Thai segments into English
- currently uses OpenRouter structured output by default
- keeps a legacy local translation backend in code as a fallback option for future rollback

Output object:

- `translations.json`

### `finalize`

Inputs:

- `segments.json`
- `translations.json`
- normalized media paths from earlier stages

Work:

- joins segment and translation data
- builds a generated editor payload
- builds an edited payload copy with review status set to `edited`

Output objects:

- `generated-payload.json`
- `edited-payload.json`

## Artifact refs

The job row stores accumulated artifact refs in a nested JSON structure:

- top-level normalized media paths
- `asr` metadata
- `segment` metadata and preview rows
- `translate` metadata and preview rows
- `finalize` payload paths and counts

The canonical parser for this shape lives in `src/contracts/artifacts.ts`.

## Error handling

Each stage adapter throws typed errors where possible.

The runner converts stage failures into a persisted `error_payload` with:

- `code`
- `message`

Default fallback error codes are:

- `audio_stage_failed`
- `asr_stage_failed`
- `segment_stage_failed`
- `translate_stage_failed`
- `finalize_stage_failed`

## Not implemented

- automatic queue retries
- publish or learner delivery after finalize
- editor write-back flow that updates the edited payload from the admin UI
