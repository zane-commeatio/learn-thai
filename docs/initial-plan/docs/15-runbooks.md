# 15-runbooks

## ops-dashboard

## reprocess-a-clip

Purpose:
- Recover a clip when processing output is missing, stale, or low quality.

Trigger conditions:
- transcript/segments/translations are invalid after processing
- processing job failed or ended in `manual_intervention`
- reviewer requests a clean pipeline rerun

Inputs required:
- `clip_id`
- target clip version context (if published history exists)
- reason for reprocess

Procedure:
1. Confirm clip is not under active legal hold.
2. Capture current state snapshot (`processing_jobs`, latest editor payload hash, visibility state).
3. Trigger manual retry (`POST /api/creator/clips/{clipId}/retry-processing`).
4. Monitor stage progression: `audio -> asr -> segment -> translate -> finalize`.
5. If job fails again, attach failure metadata and escalate to ASR or data incident runbook.
6. If successful, verify editor payload loads and required layers render.
7. Record action in `audit_log` with reason and actor.

Exit criteria:
- Clip reaches `needs_review` with usable payload.
- No data corruption in prior published versions.
- Audit trail is complete.

## fix-bad-timing

Purpose:
- Correct visible karaoke timing drift without changing clip meaning.

Trigger conditions:
- QA flags drift/stutter/overlap
- creator/reviewer reports inaccurate highlight timing
- post-publish monitoring detects timing complaints

Procedure:
1. Reproduce issue on current published version and editor preview.
2. Inspect timing granularity:
   - keep word-level where reliable
   - fallback to segment-level where word timing is unstable
3. In portal timing editor:
   - adjust start/end timing blocks
   - ensure timings stay within segment bounds
   - remove overlaps and verify smooth progression
4. Preview full clip playback (normal and slowdown behavior).
5. Publish corrected version (or rollback if urgent and correction is not ready).
6. Verify mobile feed serves updated version and cache propagation completes.
7. Log fix details and root cause notes.

Exit criteria:
- Highlight timing is visually stable on supported devices.
- No overlap/invalid timing constraints remain.
- New version or rollback state is reflected in API/feed.

## rollback-a-publish

Purpose:
- Restore a known-good published clip state after a bad release.

Trigger conditions:
- incorrect meaning/timing shipped
- legal/compliance issue requiring immediate revert
- payload regression detected in production

Procedure:
1. Identify affected `clip_id` and current published version.
2. Select target prior published version and document rationale.
3. Execute rollback (`POST /api/creator/clips/{clipId}/rollback`).
4. Confirm new current version points to rollback payload as expected.
5. Validate:
   - feed includes correct version
   - clip lookup endpoints return expected payload
   - legal visibility state is preserved (no accidental reinstatement)
6. Communicate incident outcome and next corrective action.
7. Record rollback metadata in `audit_log`.

Exit criteria:
- Learner-facing payload is reverted to known-good behavior.
- Rollback is traceable to actor, reason, and version references.
- Follow-up action owner is assigned.

## handle-takedown

Purpose:
- Execute legal delist and case handling quickly with full auditability.

Trigger conditions:
- external legal notice received
- internal legal/compliance escalation
- platform policy enforcement request

Initial triage:
1. Create `takedown_case` with severity (`critical` | `high` | `standard`).
2. Validate required claim fields or mark `needs_info`.
3. Assign incident owner and record UTC start timestamp.

Immediate actions:
1. Set clip `visibility_state=delisted_legal`.
2. Remove affected entries from active feed projection.
3. Verify mobile API returns legal-safe error code for clip lookups.
4. Quarantine R2 access for delivery objects when required.

SLA targets:
- `critical`: delist within 4 hours
- `high`: delist within 24 hours
- `standard`: first response within 72 hours

Counter-notice flow:
1. Record counter-notice event with evidence refs.
2. Move case to `counter_notice_review`.
3. Legal/compliance owner decides reinstate vs retain delist.
4. If reinstated, set `visibility_state=visible` and append audit event.

Completion checklist:
- case status updated (`closed` or active review state)
- all lifecycle events present in `takedown_events`
- all admin actions present in `audit_log`
- claimant communication status recorded
- post-incident notes added if SLA breached

## handle-asr-outage

Purpose:
- Maintain service stability when ASR provider reliability degrades.

Trigger conditions:
- ASR request failures/timeouts exceed alert thresholds
- provider outage notice
- queue backlog growth caused by ASR stage stalls

Immediate response:
1. Declare incident severity (`SEV-1` or `SEV-2` based on impact).
2. Pause or throttle new processing enqueues.
3. Preserve failing job artifacts for retry (audio + error payload).
4. Notify internal stakeholders with ETA unknown/known status.

Stabilization:
1. Route creator UI to clear degraded-state messaging.
2. Keep existing published content delivery unaffected.
3. Track backlog size, oldest job age, and failure rate.

Recovery:
1. Resume controlled retries when provider is healthy.
2. Drain backlog in priority order (oldest first unless legal urgency overrides).
3. Verify end-to-end success sample (upload -> processing -> needs_review).
4. Close incident with postmortem action items.

Exit criteria:
- ASR success/error rates return within SLO target range.
- Processing backlog returns to operational threshold.
- Incident timeline and corrective actions are documented.

## debug-mobile-playback

Purpose:
- Diagnose and resolve learner-facing playback failures on mobile quickly.

Common symptoms:
- clip does not start
- endless buffering
- audio/video out of sync
- slowdown gesture glitches
- subtitle timing appears correct in portal but wrong on device

Inputs required:
- app version
- platform + OS version
- device model
- `clip_id` and `clip_version`
- network type (wifi/cellular/offline)
- timestamp of failure (UTC)

Triage procedure:
1. Reproduce on same platform/version using the target `clip_id`.
2. Check clip delivery health:
   - `GET /api/mobile/feed` includes expected clip version
   - `GET /api/mobile/clip/{clipId}` returns valid payload
3. Validate media URLs in payload (playback URL, slow audio URL if present).
4. Confirm `visibility_state` is not legal-delisted.
5. Inspect client logs for media/player errors and cache hits/misses.
6. Compare behavior with:
   - cached media disabled
   - fresh install/session
   - stable network baseline

Root-cause buckets:
- `payload_mismatch`: clip payload/version inconsistency
- `media_unavailable`: R2/CDN object missing or inaccessible
- `client_state`: feed/player state machine bug
- `cache_stale`: stale clip/media cache not invalidated
- `device_codec`: platform-specific decode/runtime issue

Resolution actions:
1. If payload mismatch:
   - republish/rollback clip version as needed
   - invalidate feed/payload cache
2. If media unavailable:
   - restore object availability
   - verify edge cache refresh
3. If client state bug:
   - patch player/feed state transition logic
   - add regression test for failing path
4. If cache stale:
   - force payload/media refresh by version key
5. If device codec issue:
   - transcode affected media variant and republish

Verification checklist:
- clip starts within expected startup budget
- no A/V desync after 2 full plays
- slowdown enter/exit is stable
- subtitle highlight timing remains aligned
- behavior validated on both iOS and Android reference devices

Exit criteria:
- issue reproducibly fixed in staging and confirmed in production.
- incident note includes root cause, mitigation, and prevention action.
