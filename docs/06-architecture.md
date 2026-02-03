# 06-architecture

This document defines the system architecture for the Learn Thai product. It is **Cloudflare-only for runtime**, with a creator portal and processing pipeline that feed the mobile app.

---

## system-overview

High-level system shape:
- **Creator Portal** (web) for upload, editing, review, publish
- **Processing Pipeline** (Workers + Queues) for ASR, tokenization, gloss prefill
- **Storage**: R2 for media assets, Neon Postgres for source of truth
- **Delivery**: Workers for API + edge delivery to mobile app
- **Media delivery**: Public R2 object storage with aggressive edge caching

Core principle:
- The mobile app never computes meaning or tokens. It only renders the published clip payload.

---

## service-boundaries

### Creator Portal
- Authenticated editorial tool
- Uploads media directly to R2
- Triggers processing jobs
- Edits transcripts, timings, tokens, meanings, glosses
- Publishes immutable clip versions

### Processing Pipeline
- Worker + Queue jobs
- ASR via OpenAI Whisper API
- Deterministic tokenization + gloss prefill
- No auto-retry
- Outputs review-ready data to Postgres

### Public API (Mobile)
- Read-only clip feed
- Returns canonical clip payloads
- No user accounts required for learners

---

## cloudflare-only-stack

Cloudflare components:
- **Workers**: API + job orchestration
- **Queues**: processing jobs
- **R2**: raw uploads + canonical media storage

Non-Cloudflare components:
- **Neon Postgres**: source of truth for clip data
- **OpenAI Whisper API**: ASR provider

Constraint:
- Serving runtime must remain Cloudflare-only. External APIs are allowed for processing.

---

## data-flow-diagrams

### Ingestion → Processing → Review → Publish
1. Creator creates clip record
2. Direct upload to R2
3. Upload completion triggers queue job
4. Worker calls Whisper API
5. Tokenization + gloss prefill
6. Clip marked Needs Review
7. Human edits and publish

### Delivery to Mobile
1. Mobile requests daily feed
2. Worker returns published clip payload
3. App renders layers without additional calls

---

## security-model

Threat boundaries:
- Untrusted user uploads
- External ASR provider
- Admin/creator access

Controls:
- Signed upload URLs
- Auth on portal + publish actions
- Audit log for all edits
- No learner write access

---

## performance-and-caching

- Published clip payloads are cacheable at the edge
- Immutable versions enable long TTLs
- Video delivery uses public R2 + CDN caching (long TTL)
- Only metadata and payload requests go through Workers
- Mobile app should prefetch next clip

---

## scalability-plan

- Low volume initially (<100 clips/day)
- Queues scale horizontally for bursty uploads
- Concurrency caps protect budget
- If volume grows, consider batch processing or dedicated compute

---

## tech-debt-and-future-migrations

Likely future upgrades:
- Replace JS tokenizer with higher-quality NLP service
- Add optional forced alignment if Whisper timestamps are insufficient
- Introduce reviewer role and moderation queue
- Expand to additional languages
