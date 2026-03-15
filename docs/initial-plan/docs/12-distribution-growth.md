# 12-distribution-growth

## distribution-principles

Growth must come from product clarity, not growth hacks.

- The clip experience is the engine.
- Distribution should amplify existing retention behavior.
- No tactics that increase short-term installs while harming trust or session quality.
- Human-reviewed content quality is a distribution asset, not only an educational one.

## target-audience-and-positioning

### Primary audience
- Beginner to intermediate Thai learners who consume short-form video.
- Users frustrated by textbook-first methods and low-context flashcard workflows.

### Positioning
- "Understand real Thai from real clips."
- Consumption-first UX: watch first, reveal only when curious.
- Mobile-native flow with low friction and fast replay/slow-audio interactions.

## channel-strategy

### Organic channels (priority)
- TikTok/IG Reels/YouTube Shorts cutdowns from published clips.
- SEO pages around Thai listening pain points and phrase-level intent.
- Creator/influencer collabs in Thai-learning communities.

### Community channels
- Reddit, Discord, language-learning forums.
- Focus on proof-of-value clips and user stories, not feature dumps.

### Paid channels (controlled)
- Limited paid tests only after core retention and replay metrics are healthy.
- Paid spend is scaling fuel, not product validation.

## content-distribution-system

### Source of truth
- Published clip versions in the creator pipeline are reused for distribution.
- Distribution artifacts (short previews, captions, thumbnails) are generated from approved content only.

### Editorial loop
1. Select high-performing clips from mobile analytics.
2. Generate channel-specific variants.
3. Publish on a weekly cadence.
4. Measure watch-through and inbound install/visit quality.
5. Feed insights back into creator priorities.

### Guardrails
- Rights-uncertain content may be published in MVP, but must be rapidly delistable.
- Keep attribution and licensing compliance for every external post.
- External distribution for low-confidence rights content is blocked.

## growth-metrics-framework

### North-star supporting metrics
- New users reaching first meaningful interaction (`slow_audio_start` or `layer_reveal`) in session 1.
- Replay rate and clips watched per session for acquired cohorts.
- Day-2 and Day-7 retention by acquisition channel.

### Funnel metrics
1. Impression/view (external channel)
2. Click-through to app store or landing
3. Install
4. First session start
5. First clip completion
6. First replay or slow-audio usage
7. Return session

### Anti-metrics
- Vanity installs without activation.
- Campaign volume that degrades retention or content quality.

### Technical implementation
- Source of truth is self-hosted PostHog events from mobile (`session_start`, `clip_end`, `clip_replay`, `slow_audio_start`, `layer_reveal`).
- Events must include `device_id` (anonymous stable ID) and `session_id`.
- Events also include `clip_id`, `clip_version`, `platform`, `locale`, and `acquisition_channel` when available.
- A daily aggregation job computes:
- activation rate (first meaningful interaction in session 1)
- replay rate by cohort
- clips watched per session
- D2/D7 retention by channel
- Retention cohorts are computed by `device_id`, not `session_id`.
- `device_id` is resettable by the user (privacy control) and is never derived from PII.
- Dashboards read from pre-aggregated tables to keep query latency stable.

## experiments-and-iteration

### Experiment policy
- One primary hypothesis per experiment.
- Predefine success criteria and minimum sample window.
- Do not run overlapping experiments that confound interpretation on the same funnel stage.

### Example experiment types
- Hook style in short-form clips.
- CTA wording to store/landing.
- Thumbnail/poster variant tests.
- Channel-specific posting time windows.

### Decision rules
- Promote only experiments with clear retention-neutral or retention-positive outcomes.
- Sunset experiments that increase acquisition but reduce activation quality.

## creator-led-growth

Creator portal should directly support distribution.

- Track which clip traits correlate with replay and reveal behaviors.
- Expose internal "distribution candidate" tags for high-performing clips.
- Add lightweight workflow to export channel-ready assets from published clips.
- Close the loop between creator edits and downstream audience response.

### Technical implementation
- Attach `clip_id` and `clip_version` to all in-app engagement events.
- Nightly job joins engagement aggregates with clip metadata from Neon:
- transcript/segment length
- topic tags
- difficulty
- creator/editor IDs
- Output a per-clip performance table and a per-creator summary table.
- Creator portal reads these tables to show:
- top-performing clips
- distribution-candidate suggestions
- creator-level trend deltas over time.

## attribution-and-measurement-ops

- Use privacy-respecting attribution where possible.
- Keep channel/source metadata consistent across landing/store links.
- Tie acquisition cohorts to in-app behavior without collecting PII.
- Maintain a single growth dashboard with shared definitions.

### Technical implementation
- Generate canonical UTM links per campaign (`utm_source`, `utm_medium`, `utm_campaign`, optional `utm_content`).
- On first app open, capture attribution payload into local storage and bind it to a generated anonymous `device_id`.
- Include normalized attribution fields on all session and clip events sent to PostHog.
- Maintain an attribution mapping table with last-touch and first-touch channel fields.
- Build cohort views that join attribution fields with activation/retention aggregates.
- Enforce a "no PII" schema validator in the event pipeline before ingestion.

## risks-and-mitigations

- Rights/compliance risk: enforce rights confidence tagging, legal monitoring, and rapid takedown delist.
- Quality drift risk: require human review and publish gates.
- Channel dependency risk: diversify channels; avoid single-platform reliance.
- Metric gaming risk: prioritize activation and retention over top-of-funnel volume.

## rollout-plan-mvp

1. Establish baseline metrics from existing organic traffic.
2. Launch one organic short-form content loop.
3. Add SEO landing pages for top intent clusters.
4. Run small paid validation tests only after baseline activation is stable.
5. Review channel mix monthly and rebalance by retained cohort quality.
## app-store-play-store

## landing-page

## creator-acquisition

## content-sourcing-playbook (to do)

## launch-plan

## referral-and-sharing

## community-and-support

## brand-and-messaging
