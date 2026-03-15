# Data Model

Last verified against code: 2026-03-14

## Database

The current database schema is defined in `infra/db/schema/`.

There are three active tables exported from `infra/db/schema/index.ts`:

- `clips`
- `processing_jobs`
- `audit_log`

## `clips`

Purpose: stable record for an uploaded clip.

Columns:

- `id`
- `title`
- `owner_id`
- `source_type`
- `rights_status`
- `created_at`
- `updated_at`

Enums:

- `source_type`: `original`, `licensed`, `public_domain`, `user_submitted`
- `rights_status`: `unknown`, `cleared`, `restricted`, `takedown`

Current admin uploads hard-code:

- `owner_id = "admin"`
- `source_type = "original"`
- `rights_status = "cleared"`

## `processing_jobs`

Purpose: track a single pass through the processing pipeline.

Columns:

- `id`
- `clip_id`
- `state`
- `stage`
- `artifact_refs`
- `error_payload`
- `lock_token`
- `lock_expires_at`
- `created_at`
- `updated_at`

Enums:

- `state`: `uploaded`, `processing`, `needs_review`, `failed`, `manual_intervention`
- `stage`: `audio`, `asr`, `segment`, `translate`, `finalize`

`artifact_refs` is JSONB and stores accumulated stage outputs.

## `audit_log`

Purpose: append-only event log for operational actions.

Columns:

- `id`
- `actor_id`
- `action`
- `target_type`
- `target_id`
- `metadata`
- `created_at`

The action and target enums are broader than the currently implemented flows, but the table is active for upload, retry, and processing events.

## Artifact refs shape

The parsed `artifact_refs` shape currently includes:

- `normalizedVideoPath`
- `posterImagePath`
- `audioWavPath`
- `asr`
  - `asrJsonPath`
  - `transcriptPreview`
  - `segmentCount`
  - `wordCount`
  - `language`
- `segment`
  - `segmentJsonPath`
  - `segmentCount`
  - `preview`
- `translate`
  - `translationJsonPath`
  - `translationCount`
  - `preview`
- `finalize`
  - `generatedPayloadPath`
  - `editedPayloadPath`
  - `segmentCount`
  - `translationCount`
  - `thumbnailPath`

## Editor payload shape

The finalize stage writes editor payloads shaped like this:

- clip metadata
- media paths for normalized video, WAV, and poster
- thumbnail path and source
- `segments[]`
  - `index`
  - `text`
  - `startMs`
  - `endMs`
  - `translation.englishText`
  - `translation.source`
- review metadata

This contract is defined in `src/contracts/editor-payload.ts`.

## Object storage layout

Current storage uses one source object per clip and per-job derived artifacts.

Source object:

- `clips/{clipId}/source`

Per-job artifact objects:

- `clips/{clipId}/jobs/{jobId}/normalized.mp4`
- `clips/{clipId}/jobs/{jobId}/poster.jpg`
- `clips/{clipId}/jobs/{jobId}/audio.wav`
- `clips/{clipId}/jobs/{jobId}/asr.json`
- `clips/{clipId}/jobs/{jobId}/segments.json`
- `clips/{clipId}/jobs/{jobId}/translations.json`
- `clips/{clipId}/jobs/{jobId}/generated-payload.json`
- `clips/{clipId}/jobs/{jobId}/edited-payload.json`

## Not implemented

- published clip versions
- learner payload table set
- legal/takedown tables
- token, gloss, lexicon, or feed item tables
