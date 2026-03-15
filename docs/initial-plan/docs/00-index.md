# 00 — Index

This document is the entry point and map for the entire project documentation.  
It explains what this product is, how the documentation is structured, and how to use it correctly while building and operating the system.

---

## What this product is

A mobile-first language learning app focused on **beginners**, built around **real spoken content**, not lessons.

The user does not study vocabulary, grammar, or scenarios.

They:
- watch short real-world clips
- understand meaning first
- progressively reveal Thai text, words, and details only when curious
- build intuition through exposure, not memorization

The product optimizes for:
- low friction
- curiosity-driven use
- addictive “just one more clip” behavior
- trust in correctness (human-verified meaning)

This is not a course.  
This is not a game.  
This is not a flashcard system.

---

## Core constraints (non-negotiable)

These constraints apply to **all** technical and product decisions:

- One-screen experience (video-first)
- No mandatory accounts for learners (MVP)
- No saving, no lists, no streaks
- No explicit testing or grading
- Progressive reveal only (nothing forced)
- Real human speech only
- Human-verified meanings
- Cloudflare-only runtime (Workers, Queues, R2)
- Neon Postgres as source of truth
- Deterministic, versioned clip data

Any feature or architectural decision that violates these constraints is rejected by default.

---

## How this documentation is organized

The documentation is split into **17 canonical documents**, each covering a major domain.

Each document:
- is a single file
- contains multiple sections (subheadings)
- is intended to be read top-to-bottom
- is versioned and reviewed like code

There are **no folders** and **no fragmented specs**.  
Cross-references are done via section names, not duplicated content.

---

## How to use these docs correctly

### Before writing code
All sections marked **[MUST before code]** must be written and agreed on.

These documents define:
- contracts
- irreversible decisions
- cost and failure boundaries
- UX invariants

Skipping them will cause rewrites.

### While coding
These docs act as:
- source of truth
- reviewer checklist
- scope guard

If code contradicts a doc, the code is wrong unless the doc is explicitly updated.

### After launch
Docs evolve, but:
- decisions are appended, not erased
- changes are logged in the decision log
- backward compatibility is documented

---

## High-level document map

1. Product  
   Why the app exists, who it’s for, and what success means.

2. UX / UI  
   The interaction model, gestures, overlays, and visual rules.

3. Clip Spec  
   The canonical data contract consumed by the mobile app.

4. Creator Portal  
   How content enters the system and is edited by humans.

5. Processing Pipeline  
   Upload → transcription → segmentation → English translation → review → publish.

6. Architecture  
   Service boundaries, Cloudflare-only design, data flows.

7. Data  
   Neon schema, R2 layout, versioning, retention.

8. API  
   Contracts between mobile, web, and backend.

9. Mobile App  
   Expo architecture, player, audio handling, state machine.

10. Web  
    Creator portal frontend and edge delivery.

11. Infra & Ops  
    Environments, secrets, CI/CD, cost controls.

12. Distribution & Growth  
    App store, launch, content sourcing.

13. Legal  
    Rights, privacy, takedowns.

14. Testing  
    Strategy and quality gates.

15. Runbooks  
    How to fix things when they break.

16. Appendix  
    Glossary, decisions, risks.

17. Engineering Guidelines  
    Coding standards, patterns, and delivery rules.

---

## Decision discipline

Every irreversible decision must be recorded in:
- **Decision log**
- With date, context, and alternatives considered

This prevents architectural drift and hindsight rewrites.

---

## Reading order for new contributors

1. 00 — Index  
2. 01 — Product (vision, scope, journeys)  
3. 02 — UX / UI (core loop + gestures)  
4. 03 — Clip Spec  
5. 05 — Processing Pipeline  
6. 06 — Architecture  
7. 17 — Engineering Guidelines

Only then should someone touch code.

---

## Final note

This project will fail or succeed on **UX correctness and content trust**, not feature count.

The documentation exists to protect those two things.

If something feels simpler to code but worse for the experience, the experience wins.
