# Publish-Ready Review Checklist

Last verified against code: 2026-03-15

## Why this exists

Phase 1 in [docs/11-roadmap.md](../11-roadmap.md) says operators must be able to trust review artifacts before publish work starts.

Today the repo stops at `needs_review`. It does not persist reviewer sign-off, manual edits, or immutable published versions. That means "publish-ready" currently means two narrower things:

- the system generated a complete review packet that operators can inspect without rediscovery
- a human reviewer can use that packet to decide whether the clip is safe to carry into future publish work

This document defines that baseline and maps it to what the current code actually enforces.

## Minimum checklist

These are the minimum checks a clip must pass before engineering should treat it as a trustworthy publish candidate.

| Checklist item | Why it matters | Current enforcement | Current gap |
| --- | --- | --- | --- |
| Rights status is `cleared` | The current schema only has one active rights gate on `clips.rights_status` | Upload defaults admin clips to `cleared`; the new admin checklist surfaces non-cleared clips immediately | No rights confidence, attribution record, or legal hold workflow in the active app |
| Normalized video, poster, and WAV exist | Review is not trustworthy if operators cannot inspect the exact derived media | `audio` writes all three artifacts and the clip detail page shows them | No explicit persisted checklist completion or media integrity audit beyond artifact presence |
| Transcript artifact exists with preview data | Review requires a readable Thai transcript and basic metadata | `asr` writes `asr.json`; artifact refs expose transcript preview, segment count, word count, and language | No saved reviewer confirmation that transcript matches audio |
| Segment timing artifact exists | Subtitle and playback review depend on timed segments | `segment` writes `segments.json`; artifact refs expose count and preview rows | No validation that every segment timing feels natural, only that timing data exists |
| Translation artifact exists | Operators need English lines to review meaning and subtitle output | `translate` writes `translations.json`; artifact refs expose count and preview rows | No stored approval that each translation is faithful and natural |
| Generated and edited finalize payloads exist and the job is in `needs_review` | This is the current handoff point into manual QA | `finalize` writes `generated-payload.json` and `edited-payload.json`; the runner marks the job `needs_review` | No persisted reviewer decision, no manual edit write-back, no publish readiness record |

## Human review that still cannot be automated

Even when every system check passes, an operator still has to do these checks manually:

1. Listen to the clip and confirm the Thai transcript matches the spoken audio.
2. Scrub the preview and confirm subtitle timing and segment boundaries feel natural.
3. Read each English line for faithfulness and natural phrasing.
4. Check thumbnail and subtitle presentation for obvious visual issues.

The current admin UI can help with these checks, but it cannot record the outcome.

## Where the baseline now lives

The baseline is now surfaced directly on the clip detail page:

- a `Publish-Ready Review Checklist` panel summarizes pass/fail system checks
- failed items are derived from clip metadata and latest job artifact refs
- the panel also lists the required human checks and the known publish gaps

This is intentionally narrow. It makes ambiguity visible without pretending publish enforcement already exists.

## Code and workflow changes still needed

The next steps are straightforward and should stay in Phase 2 scope:

1. Persist review decisions and checklist completion in application-owned state.
2. Add manual edit write-back for transcript, timing, translation, and thumbnail fields.
3. Block publish on explicit review approval instead of inferring readiness from artifact presence.
4. Expand rights tracking beyond a coarse `cleared` flag before external distribution.
