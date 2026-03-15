# Roadmap

Last verified against code: 2026-03-15

## Purpose

This document connects the current implementation in `docs/` with the archived product intent in `docs/initial-plan/`.

It answers three questions:

- what this repository actually does today
- which archived ideas still look directionally correct
- what the next delivery steps should be to reach a learner-facing product without pretending unfinished systems already exist

## What exists today

The live codebase is an internal content operations system, not a learner app.

What is implemented:

- admin-only Next.js UI for login, upload, job monitoring, and clip review
- Node/BullMQ processing worker that runs `audio -> asr -> segment -> translate -> finalize`
- review-ready editor payload artifacts generated at the end of processing
- Postgres, Redis, and S3-compatible storage for clip/job state and artifacts

What is not implemented:

- learner-facing mobile or web product
- publish flow that creates immutable learner clip versions
- creator/editor workflow in the Next.js app
- public learner APIs or feed delivery

The current repo should therefore be treated as a strong ingestion and processing base with a thin operations UI on top.

## Archived ideas that still hold up

These themes from `docs/initial-plan/` still fit the repo and should guide future work:

- the product thesis: short real Thai clips for beginners, optimized for comprehension and trust
- progressive reveal: meaning first, then transcript, then deeper language detail
- human-reviewed output before learner delivery
- a mobile-first learner experience built around a feed of short clips
- deterministic clip data and versioned publish artifacts before public delivery

These ideas match the current processing pipeline well because `finalize` already produces a review-oriented payload that can become the basis for a publish contract.

## Archived ideas that are stale or mismatched

These parts of the archived plan should not be treated as current constraints:

- Cloudflare-only architecture as a hard requirement
- assumption that creator portal, learner app, and publish flow already exist in this repo
- broad data model plans for tokens, glosses, lexicon, and feed objects before a publish baseline exists
- growth, legal, and distribution documents as immediate build priorities for this codebase

The current system is Next.js plus a separate Node worker. Any roadmap that assumes a full Cloudflare edge platform would force an unnecessary rewrite before product validation.

## Recommended delivery sequence

### Phase 1: finish the internal content baseline

Goal: make the current admin pipeline reliable enough to produce reviewable clips consistently.

Priority work:

- harden worker operations, retries, and failure visibility
- close backend and UI testing gaps around upload, review, and finalize preview
- define the minimum review checklist for a clip to be publishable

Exit condition:

- operators can upload clips, inspect outputs, retry failures, and trust the review artifacts

### Phase 2: add editor and publish primitives

Goal: turn `edited-payload.json` from a terminal artifact into a publishable source of truth.

Priority work:

- add manual editing flows for transcript, timings, translation, and thumbnail fields
- persist manual edits in an application-owned store instead of artifact files alone
- introduce immutable learner clip versions and a publish action
- record publish and rollback actions explicitly in audit history

Exit condition:

- one reviewed clip can be promoted to a stable published version without rerunning the full pipeline

### Phase 3: define learner delivery contracts

Goal: create the smallest backend surface that a learner client can consume.

Priority work:

- define a published clip payload separate from the editor payload
- add read APIs for feed listing and clip detail playback data
- decide what remains out of scope for v1, especially word-level gloss and deeper reading layers
- keep learner payloads versioned and decoupled from job-oriented artifact paths

Exit condition:

- a client can fetch a feed of published clips and render one clip without touching admin/job internals

### Phase 4: ship the learner MVP

Goal: deliver the narrowest product that proves the archived thesis with current infrastructure.

Recommended MVP:

- mobile-first feed of published short clips
- default meaning view
- optional Thai transcript reveal
- replay and slow-audio interaction
- basic analytics for watch, replay, and reveal behavior

Deliberately defer:

- accounts and learner progress systems
- flashcards, saving, streaks, and gamification
- creator marketplace or multi-role workflow expansion

Exit condition:

- real learners can consume reviewed clips and validate whether the product thesis resonates

## Feature triage for historical ideas

Build soon:

- publishable clip versions
- editor write-back and review workflow
- learner feed contract
- mobile-first playback experience

Defer until after learner validation:

- tap-to-gloss and richer lexical layers
- creator self-serve portal
- legal/takedown product surfaces beyond minimum operations support
- web learner experience beyond what is needed for testing or internal preview

Discard unless the codebase direction changes:

- Cloudflare-only runtime requirement
- assumptions that every domain doc must be implemented before shipping the learner baseline

## Working rule

For this repository, the next milestone is not "build the whole original vision."

It is:

1. make reviewed clips operationally trustworthy
2. publish immutable learner-ready versions
3. deliver a minimal learner feed and player

Anything outside that path should be treated as optional until the learner MVP proves demand.
