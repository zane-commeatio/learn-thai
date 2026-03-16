# Immutable Publish And Rollback Task Tree

Last verified against code: 2026-03-15

## Why this exists

Issue `THE-22` asks for the concrete implementation breakdown for immutable publish and rollback.

The repo already has:

- review-ready finalize payloads
- audit action enums for `publish` and `rollback`
- roadmap intent for immutable learner versions

It does not yet have:

- a published version table
- an active published pointer
- publish or rollback APIs
- a learner-safe published payload contract

This note defines the smallest viable technical surface to add those pieces without coupling learner delivery to job artifacts.

## Baseline constraints

Verified in code today:

- `clips` is the stable clip identity
- `processing_jobs` stores operational job state and artifact refs
- finalize payloads are written to `clips/{clipId}/jobs/{jobId}/generated-payload.json` and `edited-payload.json`
- the admin UI only reads the latest job history
- learner APIs do not exist yet

Practical consequence:

- publish cannot reuse `processing_jobs` as the learner store because jobs are mutable operational history, not immutable product state

## Publish model decision

Use a three-layer model:

1. `clip_editor_states` as the mutable editorial working copy
2. `clip_versions` as immutable learner-facing history
3. `clips.current_version_id` as the active published pointer

This keeps responsibilities clean:

- editor state can change
- published versions cannot change
- the current version can change only by pointer movement inside an explicit publish or rollback transaction

## Published payload decision

Publishing should not expose the raw editor payload unchanged.

Define a separate `PublishedClipPayload` contract with:

- stable `clipId`
- explicit `clipVersion`
- clip-level media paths for playback and thumbnail
- segment rows with Thai text, timing, and English meaning
- no job ids
- no job-scoped artifact paths in the public identity layer

For MVP, the transform can preserve most editor fields, but it must enforce:

- explicit version metadata
- removal of workflow-only fields that exist only for review/editing

## Data model slice

### `clip_versions`

Add a new table with:

- `id`
- `clip_id`
- `version_number`
- `editor_state_id`
- `payload_json`
- `status`
- `published_at`
- `published_by`
- `rollback_of_version_id` nullable
- `superseded_by_version_id` nullable
- `created_at`

Recommended statuses:

- `published`
- `superseded`

`rolled_back` is not needed as a long-lived state if rollback always creates a fresh published version row. The rollback event should be recorded in audit history and `rollback_of_version_id`, not by mutating older rows into a third runtime state.

### `clips.current_version_id`

Add `current_version_id` on `clips`.

Why this is the smallest viable choice:

- constant-time lookup for future learner APIs
- no extra publication table yet
- rollback becomes a pointer update plus immutable insert

### Constraints

Add these constraints:

- unique `(clip_id, version_number)`
- FK from `clips.current_version_id` to `clip_versions.id`
- FK from `clip_versions.clip_id` to `clips.id`
- FK from `clip_versions.editor_state_id` to `clip_editor_states.id`

## Transaction rules

### Publish transaction

Publish should run in one database transaction:

1. lock the clip row
2. load editor state
3. validate publish readiness
4. derive `next_version_number`
5. insert a new `clip_versions` row with immutable payload
6. mark the previous current version as `superseded` if one exists
7. update `clips.current_version_id`
8. append `audit_log` action `publish` targeting the new version row

If any step fails, no version should become current.

### Rollback transaction

Rollback should also run in one transaction:

1. lock the clip row
2. load the target historical version
3. verify it belongs to the clip
4. derive `next_version_number`
5. insert a new `clip_versions` row by copying the target payload
6. set `rollback_of_version_id` to the chosen historical version
7. mark the previously current version as `superseded`
8. update `clips.current_version_id`
9. append `audit_log` action `rollback` targeting the new version row

This preserves a simple invariant:

- every user-visible publish state change creates a new immutable version row

That is easier to reason about than repointing the pointer directly at an old row while trying to infer when rollback happened.

## Version numbering rules

Use per-clip monotonically increasing integer versions.

Rules:

- first publish is version `1`
- every publish increments by `1`
- every rollback also increments by `1`
- historical numbers are never reused

Example:

- publish draft A -> version 1
- publish draft B -> version 2
- rollback to version 1 content -> new version 3 with payload copied from version 1

This keeps audit trails and cache keys straightforward.

## Audit rules

The existing `audit_log` table is enough for MVP if publish and rollback metadata are explicit.

### Publish audit metadata

Record at least:

- `clipId`
- `clipVersionId`
- `versionNumber`
- `editorStateId`
- `previousVersionId`

### Rollback audit metadata

Record at least:

- `clipId`
- `clipVersionId`
- `versionNumber`
- `rolledBackFromCurrentVersionId`
- `rollbackOfVersionId`

Target type should be `clip_version` for both actions.

## API task tree

### 1. Publish read model support

Add repository helpers to:

- fetch current published version by clip id
- fetch version history by clip id
- create next version rows atomically

This work should land before route handlers.

### 2. `POST /api/admin/clips/[clipId]/publish`

Behavior:

- require admin auth
- require an approved editor state
- derive and store the immutable published payload
- return the new current version summary

Validation should fail if:

- no editor state exists
- review status is not publishable
- required transcript, translation, or thumbnail fields are missing

### 3. `POST /api/admin/clips/[clipId]/rollback`

Behavior:

- require admin auth
- accept a target `versionId`
- create a new current version by copying the target payload
- return the new current version summary and prior current version summary

### 4. `GET /api/admin/clips/[clipId]/versions`

Behavior:

- return ordered version history for admin inspection
- mark the current version explicitly
- include rollback lineage metadata

This route is enough for the first admin version-history panel.

## UI task tree

### 1. Version history panel

Extend the clip detail page with a version history section that shows:

- version number
- publish timestamp
- current vs superseded state
- rollback lineage if present

### 2. Publish action

Add a publish button that:

- is disabled until the editor state is approved
- shows a confirmation step
- refreshes the clip page after success

### 3. Rollback action

Add rollback controls in the version history panel that:

- allow choosing a prior version
- require confirmation
- refresh the version list after success

Do not allow direct editing of historical published rows in the UI.

## Separation from learner delivery

This issue should define the version store that learner APIs will later read, but it should not implement the learner feed itself.

What this issue must establish:

- immutable version rows
- active current pointer
- published payload contract

What a later learner API issue can build on:

- `GET /api/learner/feed`
- `GET /api/learner/clips/[clipId]`

Those routes should read only from `clip_versions` and `clips.current_version_id`, never from `processing_jobs`.

## Migration strategy

### Migration 1: add versioning schema

Create:

- `clip_versions`
- required enums and indexes
- `clips.current_version_id`

Exit condition:

- the schema migrates on top of the current three-table database cleanly

### Migration 2: no historical publish backfill

Do not create fake published versions for old review artifacts.

Why:

- the repo has never had a real publish action
- backfilling would invent historical facts that did not happen
- first real publish should create version `1`

## Recommended implementation order

1. Add `clip_versions` schema and repository methods.
2. Add the published payload contract and transform from editor state.
3. Add publish transaction service and admin route.
4. Add version history read route.
5. Add rollback transaction service and admin route.
6. Add admin version-history and action UI.

## Child issue cut

If this is split into implementation tasks, use this breakdown:

1. Add `clip_versions` schema, constraints, and current-version pointer.
2. Add published payload contract and transform logic.
3. Add publish repository/service transaction and audit logging.
4. Add rollback repository/service transaction and audit logging.
5. Add admin version history API and UI.

## Non-goals

Do not expand this slice into:

- feed ranking or playlist logic
- learner playback UI
- token/gloss payload enrichment
- legal delist workflow changes
- background publish jobs

The publish and rollback path should stay synchronous and narrow until one reviewed clip can be versioned end to end.
