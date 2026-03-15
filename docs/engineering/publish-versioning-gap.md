# Publish, Versioning, and Creator Editing Gap

Last verified against code: 2026-03-15

## Why this exists

The current pipeline ends at review artifacts. `finalize` produces `generated-payload.json` and `edited-payload.json`, and the admin UI can preview or download them, but nothing in the repo can persist manual edits, create immutable learner-facing versions, or publish a stable clip contract.

This note defines the minimum architecture needed to move from the current review-ready system to a real publishable clip system.

## Current baseline

Verified in code today:

- the database only has `clips`, `processing_jobs`, and `audit_log`
- `processing_jobs.artifact_refs.finalize` stores paths to job-scoped payload files
- `src/contracts/editor-payload.ts` defines the review payload shape used by finalize output
- `src/worker-node/finalize-stage-adapter.ts` writes both finalize payloads to `clips/{clipId}/jobs/{jobId}/...`
- the admin clip detail page only reads the latest job and its artifact refs
- there is no Next.js route or worker route that saves editor changes or publishes a clip

Practical consequence:

- the latest job artifact is acting like a source of truth, but it is mutable-by-replacement, job-scoped, and not suitable as the learner contract

## What is missing

### Immutable learner versions

The repo has audit enum values for `publish`, `rollback`, and target type `clip_version`, but there is no `clip_versions` table or equivalent store. That means:

- no immutable version id for a learner clip
- no stable pointer to the currently published version
- no rollback target
- no way to keep learner delivery decoupled from processing job ids and artifact paths

### Creator editing surface

The current admin UI is review-only. It can inspect subtitles and payload downloads, but it cannot write back:

- transcript text
- segment timing
- English translation
- thumbnail selection or replacement
- review notes or publish readiness state

### Application-owned publish state

The current `edited-payload.json` is stored beside other job artifacts. That is insufficient for published content because:

- reruns create new job paths
- job artifacts are operational outputs, not product state
- learner reads would have to depend on admin/job internals

## Minimum target model

Use the smallest additional model surface that separates editorial working state from learner delivery.

### 1. Keep `clips` as the stable asset identity

`clips.id` should remain the durable parent record for source ownership, rights status, and clip-level metadata.

### 2. Add an editable working copy table

Add one application-owned record per clip for the latest editor state. Suggested shape:

- `clip_editor_states`
- `clip_id`
- `source_job_id`
- `payload_json`
- `review_status` such as `generated`, `editing`, `approved`
- `has_manual_changes`
- `updated_by`
- `created_at`
- `updated_at`

This replaces job artifact files as the writable source of editorial truth.

### 3. Add an immutable published version table

Add a separate versioned record for learner delivery. Suggested shape:

- `clip_versions`
- `id`
- `clip_id`
- `version_number`
- `editor_state_id` or embedded published payload
- `payload_json`
- `status` such as `published`, `superseded`, `rolled_back`
- `published_at`
- `published_by`

Rules:

- every publish creates a new row
- published rows are immutable
- learner APIs only read from this table
- rollback is implemented by promoting an older version into the current pointer, not by mutating its payload

### 4. Add a current published pointer

Use either:

- `clips.current_version_id`, or
- a small `clip_publications` table keyed by `clip_id`

The goal is constant-time lookup of the active learner version without scanning job history.

## Relationship to the current finalize payload

The current `EditorPayload` is a good starting point for the editing contract, but it should not become the learner contract unchanged.

Use it this way:

- finalize still generates the initial editor payload from pipeline outputs
- that payload is copied into `clip_editor_states.payload_json`
- human edits modify the editor-state payload in the database
- publishing transforms the editor payload into a separate published payload and writes a new `clip_versions` row

Minimum contract split:

- `EditorPayload`: editable, operational, review-oriented
- `PublishedClipPayload`: immutable, learner-oriented, API-safe

The publish transform can initially be very small. For MVP it can preserve most existing fields while enforcing two changes:

- remove job-scoped storage semantics from the public contract
- include explicit version metadata for learner reads

## Minimum creator editing surface

The smallest useful editing capability in this repo is:

- update segment Thai text
- update `startMs` and `endMs`
- update `translation.englishText`
- update thumbnail path or selected image
- mark review status ready for publish

That can ship as a Next.js admin form backed by clip-level edit APIs. It does not require a multi-role creator portal yet.

Minimum write APIs:

- `GET /api/admin/clips/[clipId]/editor-state`
- `PATCH /api/admin/clips/[clipId]/editor-state`
- `POST /api/admin/clips/[clipId]/publish`
- `POST /api/admin/clips/[clipId]/rollback`

Behavior:

- `GET` returns the latest editor state, bootstrapping from the most recent finalize payload if no row exists yet
- `PATCH` updates the application-owned editor state and appends an `edit` audit log
- `POST publish` validates publish readiness, creates a new immutable version, updates the current published pointer, and appends a `publish` audit log against `clip_version`
- `POST rollback` switches the current published pointer to an older version and appends a `rollback` audit log

## Delivery order

Build this in the smallest sequence that preserves reversibility.

### Step 1: persist editor state

- add `clip_editor_states`
- seed it from the latest finalize payload when a clip enters review or on first editor load
- keep existing artifact downloads for debugging

Exit condition:

- manual edits survive page reloads and do not depend on overwriting `edited-payload.json`

### Step 2: add publish versions

- add `clip_versions`
- add the current published pointer
- publish from editor state into immutable learner versions

Exit condition:

- one clip can be published twice and retain both historical versions

### Step 3: add learner read APIs

- expose feed and clip detail reads from published versions only
- do not read from `processing_jobs` or job artifact paths in learner routes

Exit condition:

- a learner client can fetch one published clip without touching admin internals

## Non-goals for this milestone

Do not expand scope yet into:

- token or gloss authoring
- creator self-serve roles and permissions
- marketplace workflows
- legal/takedown product surfaces beyond keeping `rights_status` on `clips`
- a broad mobile schema before one published clip can round-trip end to end

## Decision summary

The minimum viable path is:

1. treat finalize output as a generated draft, not the final source of truth
2. persist clip-level editor state in the application database
3. publish immutable learner clip versions from that editor state
4. make learner APIs read only from published versions

That is the smallest technical surface that closes the current gap without rebuilding the whole original architecture first.
