# Learner Read API Task Tree

Last verified against code: 2026-03-15

## Why this exists

Issue `THE-23` asks for the execution breakdown for learner delivery contracts in Phase 3 of `docs/11-roadmap.md`.

The repo needs the smallest API surface that lets a learner client:

- fetch a feed of published clips
- fetch one published clip for playback
- stay fully decoupled from admin pages, processing jobs, and job artifact paths

This note defines that surface.

## Baseline constraints

Verified in code today:

- there are no learner-facing read APIs
- the active app is an admin-only Next.js surface
- publish/versioning is not yet implemented
- all current clip data is still operational or review-oriented

This means the learner API contract must be defined against the future published version store, not against current `processing_jobs` rows.

## Read-model decision

Learner reads must come only from:

- `clips`
- `clips.current_version_id`
- `clip_versions`

Do not read learner responses from:

- `processing_jobs`
- `artifact_refs`
- finalize payload files in object storage
- admin view models

That boundary is required to keep learner delivery stable when the processing pipeline reruns or the admin editing workflow changes.

## Minimum learner payload decision

The first learner payload should be intentionally smaller than the archived full clip spec.

For v1, `PublishedClipPayload` should include only what the player/feed need immediately:

- stable clip identity
- explicit published version number
- playback video URL
- poster or thumbnail URL
- a short learner-facing meaning string
- ordered segment rows with Thai text, timing, and English text

For v1, omit:

- tokenization
- groups
- glosses
- lexicon
- reading lens
- learner progress
- personalization

Those can be added later without blocking the first feed and player.

## Proposed payloads

### Feed item payload

Use a thin list item for feed responses:

- `clipId`
- `clipVersion`
- `title`
- `summary`
- `thumbnailUrl`
- `videoUrl`
- `durationMs`

Optional, if useful for early ranking but not required:

- `difficulty`
- `publishedAt`

The feed should not inline the full transcript payload if the client can fetch clip detail on open.

### Clip detail payload

Use a self-contained playback payload:

- `clipId`
- `clipVersion`
- `title`
- `meaning`
- `media`
  - `videoUrl`
  - `thumbnailUrl`
- `segments[]`
  - `index`
  - `text`
  - `startMs`
  - `endMs`
  - `englishText`

This is enough to support:

- feed playback
- transcript reveal
- subtitle/timing sync
- basic replay interactions

## Meaning field decision

The current editor payload does not yet contain a dedicated learner-facing meaning field.

Until that exists, Phase 3 needs one explicit choice:

- either add a `meaning` field to editor and published payloads before learner API work starts
- or accept `segments[0].translation.englishText`-style fallbacks temporarily

Recommendation:

- add a clip-level `meaning` field before shipping learner reads

Why:

- segment translation is not the same as the learner-facing meaning
- the feed needs a short summary without forcing the client to infer it

## API surface

### 1. `GET /api/learner/feed`

Purpose:

- return a paginated list of currently published clips

Query params for MVP:

- `cursor` optional
- `limit` optional, capped server-side

Response shape:

- `items[]`
- `nextCursor`

Data source:

- clips with a non-null `current_version_id`
- joined to current published version rows

Ordering choice for MVP:

- newest published first

Do not add date-bucketed or personalized feed logic yet.

### 2. `GET /api/learner/clips/[clipId]`

Purpose:

- return the current published version for a clip

Behavior:

- resolve `clips.current_version_id`
- load that version payload
- return `404` if the clip has no published version

### 3. `GET /api/learner/clips/[clipId]/versions/[version]`

Purpose:

- return a specific published version when admin previews or client debugging need deterministic version lookup

Behavior:

- load by `(clip_id, version_number)`
- return `404` if missing

This route is optional for the first learner app, but it is useful for testing and version validation once publish exists.

### 4. `GET /api/learner/health`

Purpose:

- confirm the learner API surface is alive
- expose a simple API version string

This can be added alongside the first learner routes with negligible cost.

## Route placement decision

Use Next.js routes for the active implementation path:

- `app/api/learner/feed/route.ts`
- `app/api/learner/clips/[clipId]/route.ts`
- `app/api/learner/clips/[clipId]/versions/[version]/route.ts`
- `app/api/learner/health/route.ts`

Do not build these on the dormant Cloudflare worker surface first. The primary runtime in this repo is the Next.js app plus Node worker.

## Playback requirements

The learner detail payload must be enough for the player to render without extra admin lookups.

Required playback data:

- normalized playback URL
- thumbnail/poster URL
- segment ordering
- segment timing
- Thai transcript text
- learner-facing English meaning text

Strong recommendation:

- include `durationMs` in the published payload once the publish transform has a reliable source for it

That avoids forcing clients to inspect media metadata ad hoc.

## Versioning boundaries

Learner reads must be version-safe.

Rules:

- feed items identify the exact current `clipVersion`
- clip detail responses include `clipVersion`
- published payloads are immutable once created
- a new publish changes the current version by pointer update, not by mutating older payloads
- rollback creates a new current version number even when copying an older payload

Client implication:

- cache keys should be `clipId + clipVersion`
- the latest clip endpoint can change over time
- the versioned clip endpoint must stay stable

## Caching rules

Use simple caching boundaries from the start:

- `GET /api/learner/clips/[clipId]/versions/[version]` can be cached aggressively because the payload is immutable
- `GET /api/learner/clips/[clipId]` should have shorter caching because it follows the current pointer
- `GET /api/learner/feed` should also use shorter caching because publish events can change membership and order

Exact cache headers can be chosen during implementation, but the contract should preserve this difference.

## Error handling

Use a narrow public error surface:

- `404` when a clip or version is not published
- `400` for invalid route params
- `500` for unexpected failures

Do not leak admin-only or job-specific state in learner errors.

## Repository and service task tree

### 1. Published clip contract

Add a new contract file for:

- `PublishedClipPayload`
- `LearnerFeedItem`
- learner route response schemas

This contract should be separate from `EditorPayload`.

### 2. Published version repositories

Add read helpers to:

- fetch current published versions for feed listing
- fetch one current published version by clip id
- fetch one versioned payload by clip id and version number

### 3. Learner route handlers

Add the Next.js route handlers for feed, detail, versioned detail, and health.

### 4. Tests

Add route and contract tests for:

- no published clips
- one published clip
- missing clip
- missing version
- rollback-created version lookup

## Recommended implementation order

1. Add `PublishedClipPayload` and learner response contracts.
2. Add repository helpers on top of `clip_versions` and `clips.current_version_id`.
3. Add `GET /api/learner/clips/[clipId]`.
4. Add `GET /api/learner/feed`.
5. Add `GET /api/learner/clips/[clipId]/versions/[version]`.
6. Add `GET /api/learner/health`.

This order gives the team one stable clip read before solving list behavior.

## Child issue cut

If this work is split into smaller implementation tasks, use this breakdown:

1. Add published clip and learner response contracts.
2. Add repository read helpers for current and historical published versions.
3. Add learner clip detail route.
4. Add learner feed route.
5. Add versioned learner clip route and route tests.

## Explicit v1 exclusions

Keep these out of the first learner API slice:

- authentication
- learner accounts
- progress or watch history
- personalization or recommendations
- token/gloss/reading-lens payloads
- legal/takedown response envelopes beyond basic unpublished `404`
- creator/admin preview endpoints beyond versioned lookup

The first learner contract should prove only one thing:

- a client can render published clips without reading any admin or pipeline internals
