# 05-processing-pipeline

This document defines the **Cloudflare-only processing pipeline** that turns an uploaded clip into a review-ready artifact.

The pipeline is optimized for:
- **low cost**
- deterministic outputs
- human-verified correctness
- simple operations

It assumes:
- Cloudflare Workers + Queues for orchestration
- OpenAI Whisper API for ASR with word timestamps
- segment-level English translation after segmentation
- **no automatic retries**

---

## end-to-end-pipeline

### Inputs
- R2 upload completion event OR explicit “upload complete” action from the portal
- Clip metadata (owner, rights status, source)

### Steps (serialized)
1. **Audio extraction** from uploaded video
2. **ASR** via OpenAI Whisper API with word timestamps enabled
3. **Segment shaping** (build transcript segments)
4. **Segment translation** (Thai to natural English)
5. **Finalize processing** → mark clip as **Needs Review**

### Outputs
- `transcript` segments with timestamps
- segment-level English translations
- `poster` frame asset (stored in R2)
- job state metadata and audit log entries

---

## job-state-machine

Aligned to the Creator Portal states:

- **Uploaded** → raw media exists, processing not started
- **Processing** → job in progress
- **Needs Review** → processing complete, ready for human edits
- **Ready to Publish** → all manual edits complete
- **Published** → versioned clip available to learners

Failure states:
- **Processing Failed** → system error; requires manual retry
- **Needs Manual Intervention** → partial output exists but cannot proceed

Rules:
- All transitions are explicit and logged.
- No silent failures.
- Failed jobs do not auto-retry.

---

## queue-topology

One queue: `processing-jobs`

Each job is a serialized pipeline for a single clip.

Backpressure rules:
- hard daily cap on processed clips
- queue concurrency limited to keep API spend predictable
- jobs are paused if budget threshold is exceeded

---

## asr-provider-integration

Provider: **OpenAI Whisper API**.

Requirements:
- request word-level timestamps
- store the raw ASR output for auditing
- hard cap on input duration (≤ 30s)

If Whisper fails:
- mark job as **Processing Failed**
- preserve any extracted audio artifacts for retry

---

## forced-alignment

No separate forced alignment step.

Alignment strategy:
- use Whisper word timestamps when present
- if missing or unreliable, fallback to segment-level timing

The goal is **stable, believable timing**, not perfect linguistics.

---

## audio-extraction-and-normalization

Inputs:
- common upload formats (mov/mp4/mkv)

Normalization:
- transcode to H.264 + AAC at 720x1280 (canonical playback)
- generate `poster.jpg` from the normalized video
- extract WAV/PCM for ASR
- write all outputs to R2 paths defined in `docs/07-data.md`

Rationale:
- consistent playback formats
- stable inputs for deterministic ASR

---

## segment-translation

### Segment translation
- translate each Thai segment into natural English
- preserve the segment index so reviewers can compare line-by-line
- optimize for readability and intent, not word-for-word glossing

Rules:
- translations remain review artifacts, not publish-without-review output
- translation failures must preserve transcript segments for manual recovery

---

## artifact-stability

Segment translation artifacts must remain index-aligned with the segment list:

- each translation record references the source `segment_index`
- reruns with identical segments should preserve segment ordering
- publishing creates a new immutable version

This preserves:
- reviewer trust
- safe caching
- auditability

---

## observability-and-auditing

Every job step logs:
- timestamps
- input/output hashes
- provider response summaries
- error payloads if failed

Logs are append-only and visible in the creator portal.

---

## cost-model-and-rate-limits

Cost drivers:
- Whisper API minutes
- queue execution time

Controls:
- hard daily clip cap
- hard max duration (≤ 30s)
- no auto-retries
- manual retry only

This keeps cost predictable and low.

---

## failure-modes-and-recovery

### ASR failure
- job → **Processing Failed**
- error logged with provider response

### Translation failure
- job → **Processing Failed**
- transcript segments preserved for manual recovery

### Retry policy
- manual retry only, triggered from portal

---

## translation-provider

Segment translation uses OpenRouter structured outputs in the worker for whole-clip Thai -> English translation.

Requirements:
- the worker sends the full ordered segment list in one request and validates exact segment coverage
- `OPENROUTER_API_KEY` is required when the `translate` stage runs
- `OPENROUTER_TRANSLATION_MODEL` selects the active OpenRouter model
- provider output is review-only and must not bypass QA
