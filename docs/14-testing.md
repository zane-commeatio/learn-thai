# 14-testing

## test-strategy

Testing in MVP prioritizes:
- correctness of learner-visible payloads
- legal and safety controls
- deterministic behavior for publish/delist flows

Quality gates:
- No release to production if legal delist behavior fails.
- No release if analytics pipeline accepts prohibited PII-like fields.
- No release if audit trail is missing for legal actions.

## unit-tests

- rights confidence enum transitions and validation
- visibility state transitions (`visible`, `delisted_legal`, `quarantined`, `removed`)
- legal error code mapping (`content_restricted`, `takedown_pending`, `legal_hold`)
- event schema validator rejects prohibited fields

## integration-tests

- publish clip with `rights_confidence=low` and verify it is visible + flagged
- open takedown case and verify feed exclusion + clip endpoint restriction
- submit counter-notice and verify state transition to review
- reinstate clip and verify feed/API visibility restoration
- verify audit log and takedown event records are written for each legal action

## e2e-tests

- creator uploads, edits, publishes, then admin delists via legal endpoint
- learner app receives feed without delisted clip
- direct learner clip lookup returns legal-safe envelope
- admin reinstates and learner feed includes clip again after refresh

## load-tests

- burst takedown events (admin/legal endpoints) and verify SLA monitor throughput
- feed regeneration under concurrent delists

## device-matrix

- iOS latest + previous major
- Android latest + previous major
- verify legal error UI fallback remains stable across both

## qa-checklists

1. Rights-reactive publishing:
   publish clip with incomplete rights evidence; confirm clip is visible and marked for legal monitoring.
2. Takedown SLA:
   submit valid claim; confirm delist within severity SLA window.
3. Counter-notice:
   submit counter-notice; confirm traceable review state and final decision.
4. Audit integrity:
   verify actor, timestamp, reason for each lifecycle action.
5. Privacy constraints:
   inject payload with prohibited PII field; confirm ingestion rejection.
6. Age policy:
   under-13 declaration path is blocked; 13+ declaration path proceeds.
7. Identifier reset and deletion/export:
   reset anonymous device ID and verify new identity issuance; validate deletion/export workflow against SLA targets.
