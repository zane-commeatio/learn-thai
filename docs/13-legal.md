# 13-legal

This document defines internal legal-operational policy for MVP.
It is not public policy copy; it is implementation guidance for product, engineering, and ops.

Baseline:
- global-neutral language
- 13+ self-attestation access model
- reactive takedown-first rights posture
- minimal anonymous telemetry (no PII)

---

## privacy-policy

### Policy scope
- Applies to learner mobile usage, creator/admin portal usage, backend processing, and analytics.
- Applies to staging and production environments.

### Allowed data classes (MVP)
- Anonymous identifiers:
  - `device_id` (random, resettable, not derived from PII)
  - `session_id` (per app launch/session scope)
- Product analytics events:
  - session lifecycle
  - clip interaction events
  - layer reveal events
  - error/reliability events
- Operational metadata:
  - request IDs
  - endpoint/job identifiers
  - clip IDs and versions where needed for debugging

### Prohibited data classes (MVP)
- Direct PII:
  - name
  - email
  - phone number
  - postal address
- Sensitive or persistent tracking identifiers:
  - exact geo coordinates
  - ad network IDs
  - biometric identifiers
  - government ID values
- Freeform payload fields that could contain user contact details.

### Retention windows
- Analytics events: 180 days hot retention; aggregated, de-identified metrics can be retained longer.
- Operational logs: 30 days hot retention.
- Audit logs for legal/content actions: 24 months minimum.
- If legal hold is active, retention supersedes deletion schedules for affected artifacts.

### User rights operations (MVP)
- Identifier reset:
  - app exposes reset action for anonymous identity (`device_id` regeneration)
  - reset severs future linkage; historical aggregate metrics are not retroactively recomputed
- Deletion request intake:
  - intake via support/legal channel
  - acknowledge within 72 hours
  - resolve within 30 calendar days unless legal hold applies
- Export scope:
  - for anonymous learners, export is limited to events associated with provided identifier evidence
  - exports exclude internal security-sensitive metadata

### Age baseline and underage handling
- Service baseline is 13+ with self-attestation.
- If user declares age under 13, service access is denied in MVP.
- No child-directed mode is provided in MVP.

### Analytics and attribution guardrails
- Event schemas must be allowlist-based.
- Ingestion enforces a no-PII validator before storage.
- Attribution fields are limited to campaign metadata (UTM-like source/medium/campaign/content).

References:
- `/Users/zane/dev/learn-thai/docs/09-app-mobile.md` (analytics + privacy constraints)
- `/Users/zane/dev/learn-thai/docs/12-distribution-growth.md` (attribution + no-PII enforcement)

## terms-of-service

### Eligibility and access
- Learner use requires 13+ self-attestation.
- Creator/admin access requires authenticated identity and assigned role.
- Learners may use the app without mandatory account creation.

### Service boundary
- Service is an educational aid for language exposure.
- Service does not grant certification, test scoring, or formal proficiency guarantees.

### Acceptable use
- No abuse of APIs, scraping beyond rate limits, or interference with service integrity.
- No upload of malicious content, unlawful content, or content violating third-party rights.
- No attempts to bypass role controls or audit trails.

### IP ownership and license boundaries
- Uploaders retain ownership of original materials unless separately contracted.
- Uploaders grant platform rights necessary to host, process, display, and distribute clip derivatives.
- Derived metadata/payload artifacts are platform-operated outputs for product delivery and auditing.
- Users may not claim exclusive ownership over platform-generated structural metadata.

### Service modification and availability
- Service features and availability may change without guaranteed continuity for all capabilities.
- Maintenance windows, safety restrictions, or legal removals may affect access.

### Enforcement ladder
1. Warning and remediation request.
2. Clip-level restriction or delist.
3. Creator account suspension.
4. Account termination and permanent block.

All enforcement actions must be auditable.

### Disputes and contact placeholders
- Disputes are handled under future published legal terms; jurisdiction venue is intentionally unset in this internal spec.
- Legal contact channels must be published before public launch.

## content-licensing

### Allowed source types
- `original`
- `licensed`
- `public_domain`
- `user_submitted`

### Required ingest metadata
- source type
- source link or provenance reference
- uploader attestation that they have rights or authority
- attribution text (if required)
- rights confidence enum

### Rights posture (MVP)
- Reactive-only takedown-first:
  - clip may publish before full rights verification is complete
  - clip must remain immediately delistable and reversible
- Rights uncertainty is tracked, not silently ignored.

### Rights confidence model
- `high`: documented provenance and explicit rights evidence.
- `medium`: plausible provenance with incomplete supporting records.
- `low`: minimal evidence; high legal risk.

Distribution rules:
- `high`: eligible for all approved channels.
- `medium`: eligible for in-app distribution; external distribution requires admin acknowledgment.
- `low`: in-app limited exposure only; external distribution blocked pending evidence uplift.

### Attribution matrix (minimum policy)
- `original`: creator attribution required.
- `licensed`: creator attribution + license reference required.
- `public_domain`: attribution required where jurisdiction or source terms request it.
- `user_submitted`: submitter attribution + rights attestation required.

### Lexicon licensing obligations
- LEXiTRON usage must retain required attribution and license notices.
- No additional third-party lexicon ingestion without explicit license review and logged approval.

### Auditability
- Any publish with `medium` or `low` rights confidence must include a review note and actor ID.
- Rights evidence changes after publish must be logged with timestamp and reason.

## dmca-and-takedowns

### Intake channels
- Dedicated legal/support contact channel.
- In-product/admin intake form for internal escalation.

### Required notice fields
- claimant identity and contact info
- clear identification of disputed content (clip ID, URL, or equivalent)
- claim basis and statement of rights
- sworn/good-faith declaration as required by applicable policy

Incomplete notices are triaged but flagged as `needs_info`.

### Triage and SLA targets
- `critical` (clear infringement with active distribution): delist within 4 hours.
- `high` (credible claim with sufficient detail): delist within 24 hours.
- `standard` (incomplete/uncertain): initial response within 72 hours.

### Delist and review policy
- Delist first for credible claims; review follows.
- Delisted clips are removed from feed distribution and clip lookup responses.
- Internal editors/admins retain controlled visibility for case handling.

### Counter-notice and reinstatement
- Counter-notice accepted via legal channel with evidence.
- Case enters `counter_notice_review` with legal hold.
- Reinstatement requires documented decision and admin approval.
- Reinstated clips return as current or republished version with audit trail.

### Repeat infringer policy
- Track substantiated claims by creator/uploader.
- Escalation ladder:
  1. warning
  2. temporary publishing suspension
  3. permanent removal from creator program

### Artifact handling rules
- Feed behavior:
  - remove affected clips from active feed sets
- API behavior:
  - return legal-safe response (`content_restricted`, `takedown_pending`, or `legal_hold`)
- R2 object handling:
  - default: quarantine access
  - permanent deletion only when required by legal determination
  - legal hold preserves required evidence artifacts

### Case and event logging
Each takedown lifecycle event must log:
- case ID
- actor
- action
- timestamp
- reason and evidence reference
- current status

## data-processing-addendum

### MVP position
- DPA is not offered by default in MVP.
- DPA can be provided only for enterprise agreements with explicit legal approval.

### Future DPA minimum structure
- controller/processor role mapping
- subprocessors and transfer disclosures
- security controls and incident response commitments
- SCC/transfer-mechanism placeholder where applicable
- breach notification timing and contact protocol
- data subject request handling flow

### Contract artifact location
- Future enterprise DPA templates should live under:
  - `/Users/zane/dev/learn-thai/docs/contracts/dpa/` (planned)
