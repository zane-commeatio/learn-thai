# Editable Clip Write-Back Task Tree

Last verified against code: 2026-03-15

## Why this exists

Issue `THE-21` asks for the concrete implementation tree behind Phase 2 in `docs/11-roadmap.md`:

- make the review payload editable without rerunning the worker pipeline
- move editable state out of job-scoped artifact files
- break the work into schema, API, UI, and migration slices that can ship incrementally

This note is the execution artifact for that scope.

## Baseline constraints from the repo

Verified in code today:

- `infra/db/schema/` only defines `clips`, `processing_jobs`, and `audit_log`
- finalize writes `generated-payload.json` and `edited-payload.json` into `clips/{clipId}/jobs/{jobId}/...`
- `src/contracts/editor-payload.ts` already captures the editable fields we care about for MVP
- `app/admin/clips/[clipId]/page.tsx` renders a read-only review page from the latest job
- `audit_log` already supports `edit`, `publish`, and `rollback` actions, plus `clip_version` targets

This means the missing piece is not payload generation. The missing piece is application-owned write-back and publish state.

## Source-of-truth decision

Manual edits should live in Postgres, not in `edited-payload.json`.

Use this split:

- `processing_jobs.artifact_refs.finalize.editedPayloadPath` remains a generated review artifact for debugging and provenance
- a new `clip_editor_states` table becomes the mutable clip-level editorial working copy
- a new `clip_versions` table becomes the immutable learner-facing history

Why:

- job artifact paths are tied to `jobId` and are replaced by reruns
- mutable product state should not depend on object storage overwrite semantics
- learner delivery needs immutable version rows that do not depend on admin job history

## MVP fields in scope

The first editable surface should cover exactly the fields already present in `EditorPayload` and called out in the roadmap:

- transcript segment text: `segments[].text`
- segment timing: `segments[].startMs`, `segments[].endMs`
- English translation: `segments[].translation.englishText`
- thumbnail selection or replacement: `thumbnail.imagePath`
- review readiness metadata: `review.status`, `review.hasManualChanges`

Keep these out of scope for this slice:

- tokenization
- glosses or meanings beyond segment-level English
- learner feed curation
- multi-role creator permissions

## Write-back flow

The write-back path should be clip-scoped, not job-scoped.

1. Admin opens `/admin/clips/[clipId]`.
2. The page loads the latest `clip_editor_states` row for that clip.
3. If no editor row exists, bootstrap it from the newest finalize artifact and persist it immediately.
4. UI edits patch individual fields against the editor-state row.
5. Each successful write updates `updated_at`, `updated_by`, `review_status`, and `has_manual_changes`.
6. Each successful write appends an `audit_log` row with action `edit`.
7. Publish reads only from `clip_editor_states`, validates readiness, writes a new immutable `clip_versions` row, then updates the active published pointer.

Rerunning the processing pipeline should never overwrite manual changes automatically. The operator should explicitly choose whether to reseed from a newer finalize payload.

## Proposed data model slices

### Slice A: mutable editor state

Add `clip_editor_states` with one active row per clip.

Suggested columns:

- `id`
- `clip_id` unique FK to `clips.id`
- `source_job_id` FK to `processing_jobs.id`
- `payload_json` JSONB
- `review_status` enum: `generated`, `editing`, `approved`
- `has_manual_changes` boolean
- `last_seeded_from_job_id`
- `updated_by`
- `created_at`
- `updated_at`

Rules:

- `payload_json` stores the full current editor payload
- `source_job_id` records where the initial draft came from
- `last_seeded_from_job_id` makes reseed behavior explicit when future jobs finish

### Slice B: immutable published versions

Add `clip_versions`.

Suggested columns:

- `id`
- `clip_id` FK to `clips.id`
- `version_number`
- `editor_state_id` FK to `clip_editor_states.id`
- `payload_json` JSONB
- `status` enum: `published`, `superseded`, `rolled_back`
- `published_at`
- `published_by`
- `superseded_by_version_id` nullable FK to `clip_versions.id`

Rules:

- `(clip_id, version_number)` must be unique
- `payload_json` is immutable after insert
- learner reads use only this table

### Slice C: active publication pointer

Add `clips.current_version_id` referencing `clip_versions.id`.

This is the smallest current-version lookup surface because:

- `clips` is already the stable parent identity
- admin and future learner APIs will almost always start from `clipId`
- this avoids a fourth table until the product needs richer publication state

## API task tree

### 1. Editor-state read

Add `GET /api/admin/clips/[clipId]/editor-state`.

Behavior:

- require admin auth
- load `clips` row
- return current editor state if present
- otherwise load the latest finalize artifact from the newest reviewable job, persist a new `clip_editor_states` row, then return it
- fail with a clear `409` or `422` if the clip has no finalize artifact to seed from

### 2. Editor-state patch

Add `PATCH /api/admin/clips/[clipId]/editor-state`.

Behavior:

- accept partial updates for transcript text, timings, translation text, thumbnail path, and review status
- validate the updated full payload against `EditorPayloadSchema` or a stricter editor-state schema derived from it
- update the single editor-state row in a transaction
- append an `audit_log` entry with enough metadata to describe which field set changed

Patch shape should stay intentionally small:

- segment updates by `index`
- thumbnail update by `imagePath`
- review update by status fields

### 3. Publish

Add `POST /api/admin/clips/[clipId]/publish`.

Behavior:

- require an editor state row
- validate publish readiness
- derive the next `version_number`
- transform editor payload into the initial learner-safe published payload
- insert `clip_versions`
- update `clips.current_version_id`
- mark any previous current version as `superseded`
- append `audit_log` with action `publish` and target type `clip_version`

### 4. Rollback

Add `POST /api/admin/clips/[clipId]/rollback`.

Behavior:

- accept a target historical version id
- verify that it belongs to the same clip
- create a new current publication decision without mutating the historical payload

Implementation choice:

- for MVP, rollback should create a new `clip_versions` row whose payload is copied from the chosen historical version
- then point `clips.current_version_id` at the new row

This keeps the invariant simple: every current publication event creates a new immutable version row.

## UI task tree

### 1. Editor-state query integration

Extend `app/admin/clips/[clipId]/page.tsx` so the clip detail screen can load editor-state data alongside job history.

Keep the existing review widgets intact. Add editing as a new panel rather than replacing the current artifact/review surfaces.

### 2. Transcript and timing editor

Add an admin component for segment rows with:

- Thai text input
- `startMs` input
- `endMs` input
- dirty state per row

Guardrails:

- preserve segment `index`
- reject negative timings
- reject `endMs < startMs` when both are present

### 3. Translation editor

Add inline editing for `translation.englishText`.

This can live in the same segment table as transcript edits so operators see Thai, timing, and English together.

### 4. Thumbnail editor

Add a narrow control for:

- keeping the generated poster
- setting a replacement `imagePath`

Do not build upload infrastructure in this slice unless object upload is already trivial. A path-based replacement is enough for the first task tree.

### 5. Review-state and publish controls

Add clip-level controls for:

- mark editing in progress
- mark approved for publish
- publish current draft
- rollback from version history

High-impact actions should require explicit confirmation.

## Migration task tree

### Migration 1: schema only

Add the new enums, tables, indexes, and `clips.current_version_id`.

Exit condition:

- migrations apply cleanly on an existing local database with current tables populated

### Migration 2: lazy bootstrap

Do not backfill every historical clip up front.

Instead:

- bootstrap `clip_editor_states` lazily on first editor load
- record `source_job_id` and `last_seeded_from_job_id` when seeding

Why:

- it keeps the first release reversible
- it avoids parsing storage artifacts in a wide migration
- many historical clips may never need editing

### Migration 3: optional backfill command

After the lazy path works, add an explicit script to pre-seed editor states for all clips currently in `needs_review` if operators want faster first loads.

This should be a standalone script, not a mandatory schema migration.

## Validation rules for publish

The first publish gate should be narrow and deterministic:

- clip rights status must be `cleared`
- editor state must exist
- `review_status` must be `approved`
- there must be at least one segment
- every segment must have non-empty Thai text
- every segment must have non-empty English translation
- thumbnail path must be present

Timing can remain nullable for MVP because current finalize output already allows null timing fields. If timing becomes mandatory later, tighten the contract in a separate slice.

## Recommended delivery sequence

### Step 1: editor-state persistence

- migrations for `clip_editor_states`
- repo/service layer for bootstrap + patch
- `GET/PATCH /editor-state`
- read/write admin UI for transcript, timing, translation, and thumbnail

Exit condition:

- edits survive reloads and reruns do not silently overwrite them

### Step 2: immutable publishing

- migrations for `clip_versions` and `clips.current_version_id`
- publish validation
- publish API
- version history panel

Exit condition:

- one clip can be published multiple times with stable history

### Step 3: rollback flow

- rollback API
- admin version selector and confirmation
- audit coverage for rollback events

Exit condition:

- operators can restore an earlier payload without mutating history

## Concrete issue tree

If this work is split into child implementation issues, use this cut:

1. Add `clip_editor_states` schema and repository support.
2. Add lazy bootstrap from finalize artifacts into editor state.
3. Add clip editor-state read and patch admin APIs.
4. Add admin segment editor UI for transcript, timing, and translation.
5. Add thumbnail and review-status editing UI.
6. Add `clip_versions` schema plus `clips.current_version_id`.
7. Add publish validation and publish API.
8. Add admin version history and rollback flow.

## Non-goals

Do not expand this task tree into:

- learner feed endpoints
- public playback APIs
- deeper linguistic layers
- automatic merge of new pipeline output into manually edited state

Those belong to later roadmap phases once clip-level editing and immutable publish are working.
