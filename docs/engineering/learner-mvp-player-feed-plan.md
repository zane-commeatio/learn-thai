# Learner MVP Player And Feed Plan

Last verified against code: 2026-03-16

## Why this exists

Issue `THE-24` asks for the implementation-ready breakdown for the narrow learner MVP in Phase 4 of `docs/11-roadmap.md`.

This note turns the roadmap into a concrete delivery plan for:

- a mobile-first feed
- a one-screen player
- meaning-first reveal
- transcript reveal
- replay and hold-to-slow interaction
- minimum analytics for thesis validation

It deliberately excludes accounts, progress, flashcards, and gamification.

## Product boundary

The MVP should prove one thing:

- learners will watch short reviewed Thai clips and voluntarily use a small set of comprehension interactions

The MVP should not try to prove:

- retention systems
- long-term study behavior
- lexical depth features
- creator workflow scale

## Experience definition

The first learner experience should follow these constraints from the archived UX docs:

- full-screen vertical clip player
- one-screen interaction model
- meaning visible by default
- Thai transcript as an optional reveal
- instant replay
- momentary slowdown on hold
- no navigation chrome during playback

The player should feel like watching content first, not opening a lesson.

## Feature slice

### Must ship

- mobile-first vertical feed of published clips
- autoplay clip playback
- default meaning caption
- tap to reveal Thai transcript
- replay from current clip
- hold-to-slow playback
- basic load, buffering, and error states
- anonymous analytics for watch and interaction events

### Can ship later without blocking MVP

- previous/next clip controls beyond feed swipe
- transcript karaoke highlight polish beyond segment-level timing
- offline support
- web-specific responsive refinements beyond functional mobile layout

### Explicitly out of scope

- sign-in
- learner profiles
- progress tracking
- saved clips
- flashcards
- streaks
- word gloss and reading lens
- comments or social features

## UI plan

### 1. Feed shell

Build a single learner route that renders a vertical feed of published clips.

Recommended active implementation path:

- Next.js web surface first in this repo

Suggested route:

- `/learn` or equivalent learner entry route

The initial UI should optimize for mobile viewport behavior while still loading on desktop for internal testing.

### 2. Clip card / player surface

Each visible feed item should own:

- video area
- meaning caption
- transcript overlay region
- replay affordance
- subtle loading/error states

Only the focused clip should actively play.

### 3. Meaning-first default state

On first render of a clip:

- show the meaning caption
- hide Thai transcript
- avoid extra labels, buttons, or instruction copy by default

### 4. Transcript reveal

Tap the meaning caption to toggle Thai transcript visibility.

For MVP:

- transcript can appear as a single overlay block or segmented lines
- segment-level timing is enough
- word groups and gloss interactions stay out of scope

### 5. Replay interaction

Provide one obvious replay control for the current clip.

Behavior:

- restart playback from clip start
- keep the current overlay mode
- emit a replay analytics event

### 6. Hold-to-slow interaction

Use a momentary press-and-hold behavior.

Behavior:

- on hold start, reduce playback speed
- on hold end, return immediately to normal speed
- if pitch-preserving slowdown is not reliable in the chosen runtime, fall back gracefully instead of blocking playback

## Data dependencies

This UI depends on the published read model defined in `docs/engineering/learner-read-api-task-tree.md`.

Required route inputs:

- feed list with current published clips
- clip detail payload with meaning, playback media, and transcript segments

Required payload fields:

- `clipId`
- `clipVersion`
- `meaning`
- `media.videoUrl`
- `media.thumbnailUrl`
- `segments[].text`
- `segments[].startMs`
- `segments[].endMs`
- `segments[].englishText`

Important dependency:

- the published payload still needs a dedicated clip-level `meaning` field before the learner MVP is fully implementable

## Analytics plan

Track only the minimum events needed to validate engagement and interaction usage.

### Event set

- `feed_loaded`
- `clip_impression`
- `clip_play_started`
- `clip_play_completed`
- `clip_replay`
- `transcript_revealed`
- `transcript_hidden`
- `slow_hold_started`
- `slow_hold_ended`
- `clip_load_failed`

### Event properties

Include:

- `clipId`
- `clipVersion`
- `feedPosition`
- `sessionId`
- `playbackMs` where relevant

Do not include:

- PII
- account identifiers
- inferred learning scores

## Delivery sequence

### Step 1: learner page shell

- add learner route
- render a static mobile-first page shell
- wire feed fetch, empty state, loading state, and error state

Exit condition:

- internal users can open the learner page and see a list of published clips

### Step 2: focused clip playback

- add active clip playback
- ensure only the focused clip plays
- add replay action

Exit condition:

- one clip plays reliably inside the feed and can be replayed

### Step 3: meaning and transcript interaction

- add meaning-first overlay
- add transcript reveal toggle
- keep transitions simple and fast

Exit condition:

- users can watch with meaning only, then reveal Thai transcript on demand

### Step 4: slowdown interaction

- add hold-to-slow behavior
- ship the most reliable runtime-compatible version first

Exit condition:

- slowdown works on supported environments and degrades safely elsewhere

### Step 5: analytics

- emit the minimum event set
- verify the events can answer basic thesis questions

Exit condition:

- the team can measure watch starts, completions, replay usage, transcript reveals, and slowdown usage

## Thesis questions this MVP should answer

The analytics and UI should be sufficient to answer:

- do users watch more than one clip in a session
- do users voluntarily reveal transcript
- do users replay clips
- do users use slowdown often enough to justify keeping it
- where do playback failures or buffering problems break the loop

## Engineering task tree

1. Add the learner route shell and mobile-first feed layout.
2. Connect the learner feed and clip detail APIs to the page.
3. Build the focused clip player component.
4. Add meaning overlay and transcript reveal interaction.
5. Add replay control.
6. Add hold-to-slow behavior.
7. Add learner analytics instrumentation.
8. Add loading, buffering, and error states plus route tests.

## Risks

### Missing meaning field

The published payload contract still lacks a dedicated meaning field in current planning. Without it, the learner feed risks using low-quality translation fallbacks.

### Slowdown implementation variance

Hold-to-slow may behave differently across runtimes. The first implementation should optimize for reliability over perfect media sophistication.

### Scope creep from deeper study layers

Transcript reveal is enough for MVP. Adding tap-to-gloss or reading-lens work now would dilute the test of the core loop.

## Recommended child issue cut

1. Build learner route shell and feed loading states.
2. Build focused clip player and replay control.
3. Add meaning and transcript reveal overlays.
4. Add hold-to-slow interaction.
5. Add anonymous learner analytics and validation dashboards.
