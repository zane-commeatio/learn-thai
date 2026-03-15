# 16-appendix

## glossary

- `rights_confidence`: legal certainty level for clip provenance (`high`, `medium`, `low`).
- `visibility_state`: legal distribution state of a clip (`visible`, `delisted_legal`, `quarantined`, `removed`).
- `legal_hold`: preservation state preventing deletion while legal case is open.
- `takedown_case`: tracked legal dispute lifecycle object for a clip.

## decision-log

- `2026-02-17` — Adopted reactive takedown-first rights policy for MVP.
  - Context: accelerate content throughput while preserving legal response controls.
  - Tradeoff: higher exposure to notice-based removals, mitigated by strict delist SLAs.
- `2026-02-17` — Set age baseline to 13+ self-attestation and deny under-13 access in MVP.
  - Context: avoid child-directed compliance scope in initial release.
  - Tradeoff: reduced audience breadth in exchange for feasible MVP legal posture.
- `2026-02-17` — Confirmed minimal anonymous telemetry model.
  - Context: maintain product analytics while avoiding PII collection.
  - Tradeoff: reduced user-level attribution fidelity.
- `2026-02-17` — Deferred formal DPA to enterprise-contract path only.
  - Context: MVP is consumer-focused without default enterprise obligations.
  - Tradeoff: enterprise sales path requires additional legal packaging.

## risk-register

- Risk: Increased takedown volume due to reactive rights policy.
  - Mitigation: case severity triage + delist SLAs + legal endpoint monitoring.
- Risk: Wrongful delist harms learner experience.
  - Mitigation: audited reinstatement process and counter-notice workflow.
- Risk: PII leakage through malformed analytics payloads.
  - Mitigation: schema allowlist + ingestion-time no-PII validator.
- Risk: Underage access attempts.
  - Mitigation: 13+ gating and under-13 deny path.
- Risk: Incomplete rights evidence used for external distribution.
  - Mitigation: distribution restrictions tied to rights confidence.

## vendor-notes

- OpenAI Whisper API: transcription provider; no uploader rights validation capability.
- LEXiTRON: lexicon prefill source; attribution/license obligations must be preserved.
- PostHog (self-hosted): analytics store under no-PII schema constraints.

## links-and-resources

- `/Users/zane/dev/learn-thai/docs/13-legal.md`
- `/Users/zane/dev/learn-thai/docs/07-data.md`
- `/Users/zane/dev/learn-thai/docs/08-api.md`
- `/Users/zane/dev/learn-thai/docs/15-runbooks.md`
