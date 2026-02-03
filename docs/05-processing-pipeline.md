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
- Worker-side tokenization + gloss prefill
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
4. **Tokenization** (deterministic JS tokenizer)
5. **Gloss prefill** from local LEXiTRON data
6. **Finalize processing** → mark clip as **Needs Review**

### Outputs
- `transcript` segments with timestamps
- `tokens` and `wordGroups`
- `lexicon` entries (prefilled glosses)
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

## tokenization-and-gloss-prefill

### Tokenization
- deterministic JS tokenizer in a Worker
- outputs stable token IDs and word groups
- designed for UX, not linguistic purity

### Gloss prefill
- use **LEXiTRON** data stored locally in the repo
- map Thai tokens to short glosses
- glosses are **prefill only** and must be reviewed

Rules:
- one primary gloss per token
- no automatic publish without review

---

## id-stability-and-determinism

Token IDs must be stable within a clip version:

- ID = deterministic hash of `(clipVersion + token_index)`
- reruns with identical inputs yield identical IDs
- publishing creates a new immutable version

This preserves:
- reproducible rendering
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

### Tokenization failure
- job → **Needs Manual Intervention**
- transcript preserved for manual edits

### Retry policy
- manual retry only, triggered from portal

---

## lexicon-attribution

Gloss prefills use **LEXiTRON** data.

We must include required attribution and license notices in:
- internal docs
- any UI where gloss data is surfaced (if required by license)

No other lexicon data is copied into the repo without explicit license review.
