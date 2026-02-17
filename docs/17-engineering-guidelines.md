# 17-engineering-guidelines

This document defines coding standards and implementation patterns for the Learn Thai codebase.
It is implementation-facing and must be followed unless a documented exception is approved.

---

## purpose-and-scope

This guide standardizes:
- code structure
- API behavior
- data access patterns
- logging and error handling
- testing and release hygiene

It applies to:
- Cloudflare Workers services
- queue processing workers
- creator/admin web app
- Expo mobile app

---

## core-engineering-rules

- Specs are source of truth: if code and docs conflict, update docs first or in the same change.
- Favor deterministic behavior over clever optimizations.
- Keep changes small, reviewable, and reversible.
- Prefer explicit contracts (types/schemas) over implicit behavior.
- No hidden side effects in UI render or API handlers.

---

## repository-and-module-patterns

### Backend (Workers/API)
- Separate by domain:
  - `mobile`
  - `creator`
  - `admin`
  - `processing`
- Route handlers should be thin:
  - validate input
  - call domain service
  - map domain result to API response
- Business logic belongs in service modules, not route files.
- Data access belongs in repository/query modules, not service modules.

### Mobile (Expo)
- Follow layer boundaries from `09-app-mobile`:
  - UI layer: no direct fetch calls
  - state layer: view/session state only
  - data layer: API + cache + retry policy
  - media layer: playback and slowdown control
- Keep feed item playback state isolated per item.
- Do not mix transient playback state into global app config state.

### Web (Creator/Admin)
- Route guards enforce role access at route boundary.
- Keep mutation side effects centralized (cache invalidation, audit refresh).
- High-impact actions (publish, rollback, takedown, reinstate) require explicit confirmation UI.

---

## api-and-contract-rules

- API responses must follow the documented schema in `08-api`.
- Every error must use the standard envelope:
  - `code`
  - `message`
  - `details` (optional)
- Use stable error codes; do not overload meanings.
- Backward compatibility rules:
  - additive fields are allowed
  - removing/renaming fields requires a documented versioning plan
- Respect legal visibility:
  - delisted/held clips must not appear in feed responses
  - clip lookup must return legal-safe error codes when restricted

---

## data-and-migration-rules

- Schema changes must be migration-based and reversible when practical.
- Never rewrite immutable published clip history.
- Use transactions for multi-table state transitions (publish, rollback, takedown lifecycle).
- Keep enums and state machine transitions aligned with docs (`07-data`, `05-processing-pipeline`).
- New indexes must map to documented query patterns.

---

## logging-observability-rules

- Structured JSON logs only.
- Required fields:
  - `timestamp`
  - `env`
  - `service`
  - `request_id` or `job_id`
  - `severity`
  - `error_code` (when applicable)
- Include `clip_id` and `clip_version` for clip-specific operations.
- Include `legal_case_id` for takedown/reinstatement flows.
- Never log secrets or prohibited PII.

---

## error-handling-and-retry-rules

- Fail explicitly with actionable errors; no silent fallbacks that hide defects.
- Processing pipeline has no automatic infinite retries.
- Manual retry endpoints/actions must be idempotent where possible.
- User-facing failures should degrade safely:
  - learner app: show lightweight fallback states
  - creator portal: show clear remediation steps

---

## security-and-privacy-rules

- Enforce role-based authorization server-side for creator/admin endpoints.
- Validate all external inputs (request body, query params, path params).
- Keep analytics/event schemas on allowlist; reject prohibited fields.
- Maintain 13+ self-attestation baseline behavior per legal policy.

---

## testing-and-quality-gates

- Minimum CI gates:
  1. `lint + typecheck`
  2. `unit tests`
  3. integration tests for changed domains
  4. smoke checks for staging deploy
- Required test coverage for each feature change:
  - happy path
  - validation failure path
  - permission/authorization path
  - regression case for bugfixes
- Legal-sensitive flows require integration tests:
  - takedown delist behavior
  - restricted clip API responses
  - audit/event log writes

---

## code-review-checklist

- Is behavior consistent with relevant docs?
- Are contracts/types explicit and validated?
- Are failures observable in logs and metrics?
- Are state transitions legal and auditable?
- Are cache invalidation and versioning handled safely?
- Are tests sufficient for changed risk areas?
- Is rollback path clear if this change fails in production?

---

## change-management-and-documentation

- Any irreversible decision must be added to `16-appendix` decision log.
- API/data contract changes must update docs in the same PR.
- If implementation intentionally deviates from spec, include:
  - reason
  - scope
  - migration plan
  - owner

---

## explicit-anti-patterns

- Data fetching directly inside presentational UI components.
- Hidden cross-domain writes in helper utilities.
- Unversioned breaking API response changes.
- Mutable edits to previously published clip versions.
- Logging raw exception payloads that may include sensitive data.
- Retrying failed processing in unbounded loops.
