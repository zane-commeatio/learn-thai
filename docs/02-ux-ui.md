# 02 — UX / UI

This document defines the interaction model, visual rules, and behavioral constraints of the app.  
UX correctness is the primary success factor of the product. Feature completeness is secondary.

If a UX decision conflicts with technical convenience, UX wins.

---

## Core UX thesis

The app must feel like **watching content**, not using a learning tool.

The user should never think:
“I’m studying.”

They should think:
“I’m just watching one more.”

Learning happens as a side effect of curiosity.

---

## Core loop

1. App opens directly into a clip
2. User understands the meaning immediately
3. Curiosity triggers interaction (replay, slow audio, reveal)
4. Understanding increases slightly
5. User swipes to the next clip

No explicit completion.
No “lesson finished” state.
No obligation loop.

---

## One-screen rule

All learning happens on a **single screen**.

No navigation during consumption:
- no tabs
- no modals
- no page transitions
- no “study mode”

Overlays may appear and disappear, but the video remains the anchor.

If an interaction causes a route change, it is almost certainly wrong.

---

## Visual hierarchy (in order of importance)

1. Video (full screen)
2. Audio
3. Meaning caption
4. Thai transcript
5. Word groups
6. Word gloss
7. Reading lens (if enabled)

Lower layers must never compete visually with higher layers.

---

## Default state (Layer 0)

What the user sees by default:

- Full-screen vertical video
- Audio autoplay with subtle fade-in
- Meaning caption in the user’s language

No Thai text.
No buttons.
No hints.

This removes fear immediately.

---

## Progressive reveal model

All learning is opt-in and reversible.

### Layer 1 — Thai transcript
Triggered by:
- tapping the meaning caption

Behavior:
- Thai text fades in over the video
- Karaoke highlight follows audio
- No layout shift
- No panel

The user can toggle this freely.

---

### Layer 2 — Word groups
Triggered by:
- tapping Thai text

Behavior:
- Soft highlight boxes appear around word groups
- Groups reflect spoken Thai, not textbook tokenization
- Particles may be glued to preceding words

This layer exists to help *seeing*, not memorizing.

---

### Layer 3 — Tap-a-word gloss
Triggered by:
- tapping a word group

Behavior:
- Inline micro-gloss appears near the word
- Shows short meaning only
- Optional audio replay for that word
- No save, no star, no history

When the finger lifts or the user taps away, it disappears.

---

### Layer 4 — Reading lens (optional, hidden)
Triggered by:
- explicit gesture or toggle on a tapped word

Behavior:
- Character-level breakdown for that word only
- Shows consonant class, vowel length, tone outcome
- Never shown automatically
- Never shown for entire sentences

This is a power feature, not a teaching path.

---

## Gestures (muscle-memory driven)

Primary gestures:

- Swipe up → next clip
- Swipe down → previous clip
- Long-press anywhere → slow audio (momentary)
- Tap caption → toggle Thai transcript
- Tap Thai → toggle word groups
- Tap word → show gloss
- Swipe right on sentence → speaking strip
- Two-finger tap → clean listening mode (hide overlays)

No gesture should feel ambiguous.
No gesture should conflict with scrolling behavior.

---

## Audio interaction (critical)

Audio is the product.

Rules:

- Autoplay on clip start
- 200–300ms silent start, then fade-in
- Slow audio must be instant (<100ms perceived)
- Pitch-preserving slowdown only
- Slowdown is momentary (press-and-see), not a toggle

If slow audio feels laggy, the UX fails.

---

## Speaking strip (if enabled)

Triggered by:
- swiping right on a sentence

Behavior:
- Bottom strip slides up (30–40% height)
- Native sentence loops on one side
- Hold-to-record on the other
- Immediate A/B playback

Feedback:
- Relative, non-judgmental
- No scores
- No correctness labels
- No persistence

The goal is comfort, not evaluation.

---

## No saving, no ownership

The user does not “collect” anything.

Reasons:
- Saving creates cognitive debt
- Lists create guilt
- Ownership breaks flow

Dopamine comes from:
- recognition
- repetition
- clarity

Not from progress tracking.

---

## Feed behavior

- Clips are short (10–30s)
- Everyone sees the same daily feed
- Difficulty ramps invisibly
- No infinite scroll

When the feed ends:
- The app stops
- The user is not punished
- Replay is optional

This protects against burnout.

---

## Onboarding philosophy

No tutorials.
No tooltips.
No walkthrough screens.

Onboarding is implicit.

Allowed hints:
- One-line, contextual, dismissible
- Triggered only after user behavior suggests confusion
- Never stacked

Example:
“Hold to slow it down.”

---

## Visual style rules

- Dark, calm background
- High-contrast subtitles
- Large, readable text
- Minimal icons
- Subtle animations (150–220ms)
- Everything feels temporary and lightweight

No mascots.
No bright gamified UI.
No classroom aesthetics.

This is a media app, not an education app.

---

## Latency budgets

- Replay: instant
- Slow audio: instant
- Subtitle reveal: <100ms
- Gloss reveal: <150ms
- No blocking network calls during interaction

If latency exceeds perception thresholds, the interaction should be redesigned.

---

## Error philosophy

Errors should be:
- rare
- quiet
- non-blocking

If something fails:
- The video still plays
- Meaning still shows
- Deeper layers may be unavailable

The core experience must survive partial failure.

---

## UX anti-patterns (explicitly forbidden)

- Progress bars
- XP / points
- Streaks
- “Correct / incorrect” feedback
- Mandatory exercises
- Popups during playback
- Multi-step flows
- Mode switches (“study mode”)

If any of these appear, the product has drifted.

---

## UX success test

The UX is correct if:

- A new user understands how to interact without explanation
- The user replays clips voluntarily
- The user uses slow audio instinctively
- The user forgets they are “learning”

If a user ever thinks:
“I should be doing more”

The UX has failed.