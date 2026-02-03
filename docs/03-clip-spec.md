# 03 — Clip Spec

This document defines the **canonical clip contract** consumed by the mobile app.  
Every clip must conform to this spec before it can be published.

The clip is the **atomic unit of learning**.  
If the clip is wrong, everything downstream breaks.

---

## What a clip represents

A clip is a **short video segment of real spoken Thai** that has been:

- transcribed
- time-aligned
- tokenized
- given a human-verified meaning
- optionally annotated at word and character level
- frozen as a deterministic, versioned object

The mobile app never infers meaning.  
It only **renders what the clip provides**.

---

## Design principles for the clip format

- Deterministic: same input → same output
- Versioned: edits create new versions, never mutate published ones
- Self-contained: app needs no extra calls to render a clip
- Progressive: supports layered reveal
- Language-agnostic at the meaning layer
- Thai-specific at the transcript layer

---

## Clip lifecycle states (conceptual)

1. Uploaded
2. Transcribed
3. Aligned
4. Tokenized
5. Prefilled (gloss)
6. Human-edited
7. Published

Only **Published** clips are served to the app.

---

## Canonical clip object

The final published object includes:

- identity & version
- feed placement
- source & rights
- media assets
- meanings (multi-language)
- Thai transcript with timing
- word groups
- lexicon (tap-a-word)
- optional reading lens

Anything not needed by the app is excluded.

---

## Media assets

Media assets are explicit in the clip payload.

Fields:
- `media.video.sourceUrl` — raw upload (for audit/admin, not for playback)
- `media.video.playbackUrl` — canonical normalized MP4 (required)
- `media.video.posterUrl` — single poster frame (optional but recommended)
- `media.audio.audioUrl` — extracted WAV/PCM for processing (internal)

Rules:
- The app uses `media.video.playbackUrl` only.
- `media.video.sourceUrl` is never used for learner playback.
- Paths and storage layout are defined in `docs/07-data.md`.

### Constraints
- `media.video.playbackUrl` must be H.264 + AAC at 720x1280.
- `media.video.posterUrl` is derived from the normalized video.

---

## Identity and versioning

- `id` is stable across versions
- `clipVersion` increments on each publish
- Older versions are immutable
- Rollbacks select a previous version, never rewrite history

This guarantees:
- deterministic client behavior
- safe caching
- reproducible bugs

---

## Feed metadata

Feed metadata exists only to:
- place the clip in the daily stream
- control difficulty ramp
- group clips internally

It must never encode user progress.

Rules:
- difficulty is coarse (1–5)
- order is explicit
- tags are internal, not instructional

---

## Meanings (Layer 0)

Meanings are what the user sees first.

Rules:
- Written by a human
- Short and natural
- Capture intent, not literal grammar
- May be ambiguous if speech is ambiguous

Support multiple languages via an array.

Allowed:
- multiple variants (natural vs literal)
- fallback to first entry if locale not found

Forbidden:
- auto-generated meanings without review
- word-by-word translations

---

## Thai transcript (Layer 1)

The Thai transcript reflects **what was actually said**, not what would be written formally.

Rules:
- Preserve colloquial forms
- Preserve particles
- Preserve repetitions and fillers if meaningful
- Do not “correct” grammar

Segments:
- Are the primary display unit
- Must align with natural pauses
- Are human-adjustable

---

## Karaoke timing

Each segment includes karaoke timing.

Two allowed granularities:

### Segment-level
- One timing block per segment
- Used when word alignment is unreliable

### Word-level
- Multiple timing blocks per segment
- Each block maps to one or more token IDs
- Preferred when reliable

Rules:
- Timing must never drift visibly
- Slight anticipation is acceptable
- Visual clarity beats precision

---

## Tokenization (Layer 2)

Tokenization exists to support:
- word grouping
- tap-a-word gloss
- optional reading lens

Rules:
- Dictionary-based
- Deterministic
- Stable token IDs within a clip version
- Particles may be glued to neighboring tokens

Tokenization is a UX tool, not a linguistic claim.

---

## Word groups

Word groups are what the user visually taps.

Rules:
- Represent spoken chunks
- May contain multiple tokens
- Must feel natural when highlighted
- Must not overwhelm the screen

Groups are editable by humans.

---

## Lexicon (Layer 3)

The lexicon powers tap-a-word.

Rules:
- Short gloss only
- Human-adjusted
- No encyclopedic explanations
- Romanization optional and hidden by default

Each token has exactly one primary gloss.

If meaning varies by context, prefer:
- the meaning used *in this clip*

---

## Reading lens (optional, Layer 4)

The reading lens exists for power users.

Rules:
- Per-token only
- Never shown automatically
- Shows structure, not instruction
- No long text explanations

If this feature is not shipped, the entire section is omitted from the clip.

---

## Localization strategy

- Meanings support multiple languages
- Thai transcript is always Thai
- Lexicon gloss language matches meaning language
- The app selects the best language match at runtime

The clip does not perform language negotiation logic.

---

## Quality requirements (must-pass)

A clip is publishable only if:

- Meaning is correct
- Transcript matches audio
- Timing feels natural
- Tokens are tappable without overlap
- No visual clutter at default layer
- Rights are cleared or attribution is correct

If any of these fail, the clip is not published.

---

## Explicit non-goals

The clip does not:

- track user progress
- encode pedagogy
- include exercises
- include scores
- include hints or tips

The clip is content, not curriculum.

---

## Contract stability

Once the mobile app consumes this spec:

- fields are only added, never removed
- breaking changes require version bump
- deprecated fields must be supported for at least one app version

This document is the source of truth for that contract.

Any deviation is a bug.