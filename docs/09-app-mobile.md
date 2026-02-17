# 09-app-mobile

## expo-app-architecture

This section describes how the Expo mobile app is structured, how data flows, and where core responsibilities live.
The goal is to keep the app fast, predictable, and easy to evolve while staying aligned with the backend API and content pipeline.

### Architectural layers (top to bottom)
- **UI layer**: Screens + reusable components for feed, player, and editor-adjacent views. UI is driven by state and props only (no data fetching inside components).
- **State layer**: Lightweight client state for session, feed cache, playback state, and offline status. Prefer a single state container per domain (e.g., `feedStore`, `playerStore`) to avoid ad-hoc local state in screens.
- **Data layer**: API client + cache for `/api/mobile/*` plus persistence for offline use. Data layer owns retry/backoff, cache invalidation, and version-aware clip payloads.
- **Media layer**: Video/audio playback, subtitle rendering, and slow-down implementation. This layer encapsulates player configuration and performance-sensitive logic.

### Module layout (suggested)
- `app/`
- `screens/` (Feed, Player, Settings, Debug)
- `components/` (Player, SubtitleLine, CTA, Loading)
- `src/`
- `state/` (feedStore, playerStore, authStore)
- `data/` (apiClient, clipCache, feedCache)
- `media/` (playerController, subtitleRenderer, slowdown)
- `utils/` (logging, time, ids, platform)
- `assets/` (icons, fonts, static audio cues)

### Data flow
1. App boot loads local cache, then fetches `GET /api/mobile/feed?date=...`.
2. Feed payload is normalized into `feedStore` and persisted for offline use.
3. Player reads from `feedStore` + clip payload cache; if clip is missing, fetch `GET /api/mobile/clip/{clipId}`.
4. Playback state updates are local-only; analytics events are emitted from the media layer.

### API usage
- Mobile API is read-only; all app content is derived from `/api/mobile/*`.
- Clip payloads are treated as immutable once fetched (cache keyed by `clipId + clipVersion`).
- CDN caching is assumed; client cache should respect `clipVersion` changes on feed refresh.

### Offline strategy (summary)
- Persist most recent feed payload and last N clip payloads.
- On cold start without network, use cached feed and cached clips; hide unavailable clips gracefully.
- Offline behavior is safe because payloads are immutable and versioned.

### Key constraints
- Expo managed workflow, no native modules required for MVP.
- App should remain functional without sign-in.
- Network cost minimized through aggressive caching and prefetch.

## player-and-feed

This section describes the core learner experience: the feed, player behavior, and how the app handles transitions and prefetch.

### Feed behavior
- The feed is **not date-scoped**. It merges:
- locally stored clips (from previous days)
- newly fetched clips for the current day
- The merged list is sorted **most recent days first**.
- If the user scrolls past today’s clips, they can continue into clips saved from previous days.

### Feed rendering
- The feed is a **virtualized list with snap scrolling**, so each clip occupies a full screen.
- Each list item owns a **dedicated player instance** with **its own local state**.
- This isolates playback state per clip and prevents cross-item interference.

### Player responsibilities
- Owns playback lifecycle: load, play, pause, seek, end.
- Applies playback preferences (slowdown, auto-replay, subtitles on/off).
- Emits analytics events at key moments (play, pause, completion, replay).

### Prefetch strategy (client-side)
- The client **prefetches media only** (video/audio), since the **payloads already come from the feed endpoint**.
- A small buffer (next 1–2 clips) is sufficient; avoid aggressive prefetch to limit bandwidth.
- If prefetch fails, the player should fall back to on-demand media fetch.

### Transition model
- Swiping to the next clip should be instant if media prefetch succeeded.
- If the next clip media is not ready, show a lightweight loading state (not a full-screen spinner).
- When returning to a previous clip, reuse cached media if available.

### Error handling
- If a clip fails to load, display a short error state with retry.
- Feed fetch failures should show cached feed if available, otherwise an offline placeholder.

### Performance constraints
- Avoid re-rendering the whole feed on playback state updates.
- Player should reuse a stable view tree; only swap media sources when clip changes.

## Contextual Study Lens

This section defines the **progressive study layers** the learner can reveal while watching a clip.  
Layers are opt-in, reversible, and must never compete with higher layers in the visual hierarchy.

### Layer 0 — Meaning (default)
Goal: immediate understanding with zero effort.  
- Show the **meaning caption** in the user’s language.  
- No Thai text, no hints, no UI chrome.  
- This is the default state on clip load.

### Layer 1 — Thai transcript (karaoke)
Triggered by: **tap the meaning caption**  
- Thai text fades in over video.  
- **Karaoke highlight** follows audio timing (segment/word timing from clip payload).  
- No layout shift or panel; video remains the anchor.

### Layer 2 — Word groups
Triggered by: **tap Thai text**  
- Soft highlight boxes appear around word groups.  
- Groups reflect spoken Thai and natural chunks.  
- This layer helps *seeing* the structure, not memorizing.

### Layer 3 — Tap-a-word gloss
Triggered by: **tap a word group**  
- Inline micro‑gloss appears near the word.  
- Short meaning only; no long explanations.  
- Optional quick audio replay for that word.

### Layer 4 — Reading lens (optional, hidden)
Triggered by: **explicit gesture or toggle on a tapped word**  
- Character‑level breakdown for that word only.  
- Shows Thai‑specific structure (consonant class, vowel length, tone).  
- Never shown automatically and never applied to the full sentence.

### Interaction principles
- Progressive: each layer adds detail without removing context.  
- Instant: reveal/hide must feel immediate (<150ms).  
- Reversible: user can zoom back out at any time.  
- Default is always Layer 0 (Meaning only).

## player-slowdown-implementation

This section defines how the press‑and‑hold slowdown behaves and the constraints the implementation must satisfy.

### Gesture + behavior
- **Trigger**: long‑press anywhere on the player.
- **Behavior**: while pressed, playback is slowed; on release, playback returns to normal immediately.
- **No toggle**: this is a momentary action, not a mode switch.
- **No position reset**: playback continues from the current timestamp.

### UX constraints (must-pass)
- **Instant response**: slowdown must feel <100ms.
- **Pitch‑preserving**: slow audio must not drop pitch.
- **No visible stutter**: transitions in/out must be smooth.

### Playback strategy
- Slowdown applies to both **video and audio** to keep A/V sync.
- Audio slowdown must be **time‑stretched** (pitch‑preserving).
- If true pitch‑preserving is unavailable, **prefer a precomputed slow audio track** over pitch‑shifted playback.

### Expo implementation strategy
- Use `expo-av` for playback and control `playbackRate` for video speed.
- For pitch‑preserving audio, use a **precomputed slow audio track** (`0.75x`) generated during the processing pipeline and referenced in the clip payload.
- On long‑press: switch audio source to `slowAudioUrl` and set video `playbackRate=0.75`.
- On release: switch back to `playbackUrl` audio and `playbackRate=1.0`.
- Keep a **short crossfade** between audio sources to avoid clicks/pops.

### Recommended defaults
- Slowdown rate: **0.75x**.
- Transition ramp: **short fade in/out** to avoid pops.

### Failure handling
- If slowdown fails, **fallback to normal speed** (never block playback).
- If slow audio asset is missing, disable slowdown for that clip and show a subtle hint only if needed.

## state-machine

This section defines the minimal state machines that drive a single clip item in the feed.  
Playback state and overlay state are **orthogonal**: they can change independently.

### Playback state (per clip item)
States:
- `idle` (clip not yet prepared)
- `loading` (media loading or prefetch in progress)
- `ready` (media ready, not yet playing)
- `playing`
- `paused`
- `buffering` (temporary stall during playback)
- `ended`
- `error`

Transitions:
- `idle -> loading` on item mount or when the clip becomes visible.
- `loading -> ready` when media is ready.
- `ready -> playing` on autoplay or user tap.
- `playing -> paused` on user pause or app background.
- `playing -> buffering` on network stall.
- `buffering -> playing` when playback resumes.
- `playing -> ended` on clip completion.
- `any -> error` on load/playback failure.
- `error -> loading` on user retry.

Rules:
- No blocking network calls during interaction.
- Errors should never block meaning display or basic playback.

### Overlay state (study layers)
States:
- `layer0_meaning`
- `layer1_transcript`
- `layer2_word_groups`
- `layer3_gloss`
- `layer4_reading_lens`

Transitions:
- `layer0 -> layer1` on tap meaning caption.
- `layer1 -> layer2` on tap Thai transcript.
- `layer2 -> layer3` on tap word group.
- `layer3 -> layer4` on explicit gesture or toggle.
- Any layer can return to a lower layer instantly.
- Gloss and reading lens are **ephemeral** and disappear on tap-away.

Rules:
- Overlay transitions must be <150ms.
- Lower layers must never visually compete with higher layers.

### Slowdown modifier (transient)
- `slowdown_active` is a **modifier** on `playing`, not a separate playback state.
- Trigger: long‑press start.
- End: long‑press release.
- Must not interrupt playback state or reset timestamp.

### Feed visibility integration
- Off‑screen items should revert to `idle` or `ready` to conserve resources.
- Only the focused item should be `playing`.
- Swiping to a new clip triggers:
- old item: `playing -> paused` (or `ready`)
- new item: `ready -> playing`

## offline-caching-strategy

Offline support is **invisible** to the user. It exists to preserve flow, not to create “saved content.”

### What is cached
- **Feed payloads** (ordered list + clip payloads) keyed by date + fetch time.
- **Clip payloads** keyed by `clipId + clipVersion` (immutable).
- **Media files** (video + optional slow audio) for a small rolling window.

### Cache policy
- **Payloads**: keep the most recent feed plus all locally referenced clip payloads.
- **Media**: keep only the most recent N clips (e.g., last 20–40 items), LRU eviction.
- **Invalidation**: if a clip appears with a newer `clipVersion`, replace payload and refresh media.

### Startup behavior
- On cold start, load cached feed and cached payloads immediately.
- Then fetch the latest feed in the background and merge (newest first).
- If offline, use cached feed and hide any clips whose media is missing.

### Storage implementation (Expo)
- Use `AsyncStorage` for feed + payload metadata.
- Use `expo-file-system` for media assets with a size cap.
- Maintain a small index file (JSON) for LRU tracking and clip → file path mapping.

### Failure handling
- Cache misses should never block playback; fall back to network.
- If storage is full, evict oldest media first.
- If a cached payload is corrupt, delete and refetch.

## analytics-events

Analytics are used to measure **engagement and UX health**, not learning outcomes.  
No user accounts are required; events are anonymous and session‑scoped.

Provider:
- **PostHog (self-hosted)** for event tracking and dashboards.

### Core principles
- **No progress tracking** (no streaks, no XP, no “mastery”).
- **Anonymous by default** (device/session IDs only).
- **Low overhead** (batch and send in background).

### Event taxonomy (MVP)

**Session**
- `session_start`
- `session_end`
- properties: `session_id`, `duration_ms`, `app_version`, `platform`, `locale`

**Feed**
- `feed_loaded`
- properties: `session_id`, `item_count`, `source` (`network` | `cache`)

**Clip exposure**
- `clip_impression` (clip became visible)
- `clip_play`
- `clip_pause`
- `clip_end`
- `clip_replay`
- properties: `clip_id`, `clip_version`, `position_ms`, `session_id`, `source` (`prefetch` | `network` | `cache`)

**Reveal / study layers**
- `layer_reveal`
- properties: `layer` (`meaning` | `transcript` | `word_groups` | `gloss` | `reading_lens`), `clip_id`, `clip_version`
- `layer_hide`
- same properties as above

**Slow audio**
- `slow_audio_start`
- `slow_audio_end`
- properties: `clip_id`, `clip_version`, `duration_ms`, `rate` (fixed `0.75`)

**Errors**
- `media_error`
- `feed_error`
- properties: `clip_id` (if applicable), `error_code`, `network_status`

### Metrics mapping (MVP)
- **Average session length** → `session_start` / `session_end`
- **Clips watched per session** → count of `clip_end` per `session_id`
- **Replay rate** → `clip_replay` / `clip_impression`
- **Use of slow-audio gesture** → `slow_audio_start` per session
- **Reveal rate** → `layer_reveal` frequency by layer

### Storage and delivery
- Buffer events locally and batch send every ~30–60 seconds.
- Drop non-critical events if the device is offline or storage is full.
- Never block playback or UI on analytics delivery.

### Privacy and constraints
- No PII, no contact info, no exact geo.
- Session IDs are rotated per app launch.
- Device IDs are random and resettable.

## release-process-ios-android
