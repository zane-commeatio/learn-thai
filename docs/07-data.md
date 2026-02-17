# 07-data

This document defines the data model and storage layout for the Learn Thai system.
It assumes:
- Neon Postgres as the source of truth
- Cloudflare R2 for media and artifacts
- Cloudflare-only runtime for serving

---

## neon-schema

The schema is designed for **versioned, immutable clip publishing** and editorial review.

### Core tables

- `users`
  - `id` — primary key
  - `email` — login identifier
  - `role` — enum: `admin`, `creator`, `reviewer`
  - `created_at` — account creation timestamp

- `clips`
  - `id` — stable identity across versions
  - `owner_id` — FK → `users.id` (ownership and edit access)
  - `rights_status` — enum: `unknown`, `cleared`, `restricted`, `takedown`
  - `rights_confidence` — enum: `high`, `medium`, `low`
  - `visibility_state` — enum: `visible`, `delisted_legal`, `quarantined`, `removed`
  - `source_type` — enum: `original`, `licensed`, `public_domain`, `user_submitted`
  - `created_at` — clip record creation timestamp
  - `updated_at` — last metadata edit timestamp
  - `current_version` — latest published version number

- `clip_versions`
  - `id` — primary key
  - `clip_id` — FK → `clips.id`
  - `version` — integer, increments on publish
  - `published_at` — timestamp when version was published
  - `status` — enum: `draft`, `published`, `archived`
  - `payload_hash` — hash of canonical clip payload

- `processing_jobs`
  - `id` — primary key
  - `clip_id` — FK → `clips.id`
  - `state` — enum: `uploaded`, `processing`, `needs_review`, `failed`, `manual_intervention`
  - `stage` — enum: `audio`, `asr`, `segment`, `tokenize`, `gloss`, `finalize`
  - `error_payload` — JSON error blob for debugging
  - `created_at` — job creation timestamp
  - `updated_at` — job update timestamp

- `transcript_segments`
  - `id` — primary key
  - `clip_version_id` — FK → `clip_versions.id`
  - `segment_index` — ordering within clip
  - `text` — Thai segment text
  - `start_ms` — segment start time in ms
  - `end_ms` — segment end time in ms

- `tokens`
  - `id` — primary key
  - `clip_version_id` — FK → `clip_versions.id`
  - `token_index` — ordering within clip
  - `token_text` — Thai token text
  - `stable_token_id` — deterministic ID derived from `(clipVersion + token_index)`

- `word_groups`
  - `id` — primary key
  - `clip_version_id` — FK → `clip_versions.id`
  - `group_index` — ordering within clip
  - `token_ids` — array of token IDs included in the group

- `lexicon_entries`
  - `id` — primary key
  - `clip_version_id` — FK → `clip_versions.id`
  - `token_id` — FK → `tokens.id`
  - `gloss` — short user-visible gloss

- `meanings`
  - `id` — primary key
  - `clip_version_id` — FK → `clip_versions.id`
  - `locale` — BCP-47 language tag for meaning
  - `text` — meaning text for layer 0
  - `variant` — enum: `natural`, `literal`

- `feed_items`
  - `id` — primary key
  - `date` — feed date (YYYY-MM-DD)
  - `position` — ordering within the day
  - `difficulty` — integer 1–5
  - `clip_version_id` — FK → `clip_versions.id`

- `clip_rights_evidence`
  - `id` — primary key
  - `clip_id` — FK → `clips.id`
  - `source_link` — provenance link or external reference
  - `uploader_attestation` — uploader rights declaration
  - `attribution_text` — required attribution text
  - `evidence_status` — enum: `pending`, `verified`, `rejected`
  - `reviewed_by` — FK → `users.id` (nullable)
  - `reviewed_at` — timestamp (nullable)

- `takedown_cases`
  - `id` — primary key
  - `clip_id` — FK → `clips.id`
  - `status` — enum: `received`, `needs_info`, `delisted`, `counter_notice_review`, `reinstated`, `closed`
  - `severity` — enum: `critical`, `high`, `standard`
  - `claimant_ref` — contact/reference pointer
  - `opened_at` — case creation timestamp
  - `closed_at` — timestamp (nullable)

- `takedown_events`
  - `id` — primary key
  - `case_id` — FK → `takedown_cases.id`
  - `actor_id` — FK → `users.id` (nullable for external intake)
  - `action` — enum: `intake`, `request_info`, `delist`, `legal_hold`, `counter_notice`, `reinstate`, `remove`, `close`
  - `reason` — text
  - `metadata` — JSON payload
  - `created_at` — event timestamp

- `audit_log`
  - `id` — primary key
  - `actor_id` — FK → `users.id`
  - `action` — enum: `upload`, `edit`, `publish`, `rollback`, `delete`, `retry`, `legal_delist`, `legal_reinstate`, `legal_hold`, `legal_remove`
  - `target_type` — enum: `clip`, `clip_version`, `segment`, `token`, `group`, `meaning`, `gloss`, `job`
  - `target_id` — target entity id
  - `metadata` — JSON payload describing the change
  - `created_at` — action timestamp

### Relationships

- `clips` 1 → many `clip_versions`
- `clip_versions` 1 → many `transcript_segments`
- `clip_versions` 1 → many `tokens`
- `clip_versions` 1 → many `word_groups`
- `clip_versions` 1 → many `meanings`
- `clip_versions` 1 → many `lexicon_entries`
- `feed_items` → `clip_versions`
- `processing_jobs` → `clips`
- `clip_rights_evidence` → `clips`
- `takedown_cases` → `clips`
- `takedown_events` → `takedown_cases`

---

## object-storage-layout-r2

Canonical layout by clip id + version:

- `clips/{clipId}/v{n}/source.mp4`
- `clips/{clipId}/v{n}/normalized.mp4`
- `clips/{clipId}/v{n}/poster.jpg`
- `clips/{clipId}/v{n}/audio.wav`
- `clips/{clipId}/v{n}/payload.json`
- `clips/{clipId}/v{n}/asr.json`

Rules:
- Objects are **immutable per version**.
- New publish creates a new version path.
- No overwrites of prior versions.

Delivery:
- Playback objects are public in R2 and cached at the edge with long TTLs.
- No Worker proxy is used for video delivery.

Clip payload media fields are defined in `docs/03-clip-spec.md`.

---

## indexing-and-query-patterns

### Core queries

- Daily feed fetch:
  - `feed_items(date, position)` + `clips.visibility_state`
- Clip by id + version:
  - `clips(id)`
  - `clip_versions(clip_id, version)`
- Latest published version:
  - `clip_versions(clip_id, published_at desc)`
- Review queue:
  - `processing_jobs(state, updated_at)`
- Creator’s clips:
  - `clips(owner_id, updated_at)`
- Audit queries:
  - `audit_log(target_type, target_id, created_at)`
- Takedown queue:
  - `takedown_cases(status, severity, opened_at)`
- Rights evidence review:
  - `clip_rights_evidence(clip_id, evidence_status, reviewed_at)`

Indexes should be created to match these access patterns.

---

## data-retention-and-deletion

MVP policy:
- Keep all data by default.
- Takedown delist removes clip from feed and sets `visibility_state=delisted_legal`.
- Historical versions remain for audit.
- R2 objects are quarantined by default for takedown cases and retained under legal hold.
- Permanent object deletion is performed only after legal determination.

---

## versioning-model

- `clipVersion` increments on publish.
- Older versions are immutable.
- Rollback republishes an older version as a new version.
- Token IDs are deterministic: hash of `(clipVersion + token_index)`.

---

## lexicon-storage

Gloss prefill uses **LEXiTRON**.

Storage:
- LEXiTRON data file is checked into the repo.
- Loaded at build/deploy time for Worker tokenization.

Attribution:
- Required attribution and license notices must be included in docs/portal.
