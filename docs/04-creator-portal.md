# 04 — Creator Portal

This document defines the creator-facing system used to ingest, process, review, and publish clips.  
The creator portal exists to **protect content quality and trust**, not to scale UGC indiscriminately.

The portal is not a social product.  
It is an editorial tool.

---

## Purpose of the creator portal

The creator portal enables:

- controlled content ingestion
- human verification of meaning
- correction of machine output
- deterministic publishing
- legal and attribution compliance

Every clip served to learners must pass through this system.

---

## Roles and permissions

### Roles

- **Admin**
  - full access
  - can publish, rollback, delete
  - can manage creators
- **Creator**
  - can upload clips
  - can edit content they own
  - cannot publish without review (MVP configurable)
- **Reviewer** (optional, later)
  - can edit transcripts, meanings, glosses
  - cannot upload or delete clips

MVP can start with **Admin + Creator only**.

---

## Content ownership

Each clip has a single owner (creator or admin).

Ownership controls:
- edit access
- attribution
- responsibility for rights

Ownership does **not** imply publication rights.

---

## Upload flow

1. Creator creates a new clip record
2. System issues a direct upload URL (R2)
3. Creator uploads a video (≤ 30s)
4. Creator confirms upload completion

At this point:
- the clip is **not visible** to learners
- processing starts automatically

Uploads must not pass through the application server.

---

## Processing pipeline integration

Once upload completes, the system automatically:

1. Queues a processing job
2. Runs speech-to-text
3. Runs forced alignment
4. Tokenizes Thai
5. Prefills glosses
6. Marks clip as **Ready for Review**

The creator portal reflects job state in near real time.

---

## Processing states

A clip moves through the following states:

- Uploaded
- Processing
- Needs Review
- Ready to Publish
- Published
- Archived

State transitions are explicit and logged.

Failures move the clip to:
- Processing Failed
- Needs Manual Intervention

No silent failures.

---

## Editor UI (core of the portal)

The editor is a **single-screen tool** mirroring the learner experience.

### Editor layout

- Video player (same aspect as mobile)
- Timeline with segments
- Transcript editor
- Word group editor
- Meaning editor
- Gloss editor
- Preview toggle (learner view)

Editors must see **exactly** what learners will see.

---

## Transcript editing

Editors can:

- split segments
- merge segments
- edit Thai text
- adjust segment start/end times

Rules:
- changes update dependent layers (tokenization, groups)
- destructive changes trigger re-tokenization
- all edits are reversible before publish

---

## Karaoke timing editing

Editors can:

- adjust word-level timing blocks
- fallback to segment-level timing if needed
- visually scrub and preview highlights

Rules:
- timing must stay within segment bounds
- overlaps are disallowed
- timing edits are previewable instantly

---

## Word groups editing

Editors can:

- regroup tokens
- glue or separate particles
- rename group display text (Thai only)

Rules:
- groups must map to existing tokens
- token order is preserved
- groups cannot span segments

---

## Meaning editing

Editors must provide at least one meaning.

Rules:
- meaning is short
- meaning reflects intent, not grammar
- tone (formal/informal) must be respected
- ambiguity is allowed if present in speech

Multiple languages may be added.

Machine-generated meanings are not allowed to publish without review.

---

## Gloss editing (tap-a-word)

Editors can:

- edit short gloss text
- remove incorrect glosses
- add minimal clarification if needed

Rules:
- one primary gloss per token
- gloss must fit in a single line
- no teaching paragraphs

If a word is not glossable meaningfully, it may be left blank.

---

## Preview and validation

Before publish, editors must preview:

- meaning-only view
- Thai transcript reveal
- word group overlay
- tap-a-word gloss
- karaoke timing

Validation checks block publishing if:

- meaning is missing
- transcript is empty
- timings are invalid
- rights status is unclear

---

## Publishing

Publishing creates:

- a new immutable clip version
- feed placement metadata
- cacheable payload for mobile

Publishing is atomic.

Once published:
- the version cannot be edited
- rollback creates a new version referencing an older one

---

## Rollbacks

Rollback means:

- selecting a previous published version
- republishing it as the current version

No historical data is deleted.

---

## Attribution and rights

Each clip must declare:

- source type
- creator identity
- attribution requirements
- rights status

The portal must surface this clearly.

Clips with unclear rights must not publish.

---

## Audit log

Every action is logged:

- uploads
- edits
- state transitions
- publishes
- rollbacks

Logs are append-only.

This is required for:
- debugging
- trust
- legal compliance

---

## Failure handling

If processing fails:

- the error is visible in the portal
- partial results are preserved
- the clip can be retried or edited manually

The portal must never hide failure states.

---

## Explicit non-goals

The creator portal is not:

- a content marketplace
- a social network
- a monetization platform
- an analytics dashboard
- a learner-facing product

It exists solely to protect content quality.

---

## Success criteria

The portal is successful if:

- creators can publish without technical help
- reviewers trust what they see
- learners never encounter incorrect meaning
- bad clips are stopped before publication

If publishing becomes fast but sloppy, the portal has failed.