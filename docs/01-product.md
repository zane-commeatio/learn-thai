# 01 — Product

This document defines what the product is, who it is for, what problems it solves, and the boundaries that must not be crossed.  
All downstream decisions (UX, tech, content, ops) derive from this file.

---

## Vision and principles

The product exists to make **real spoken Thai feel understandable to beginners**.

Not by teaching rules.  
Not by drilling vocabulary.  
Not by simulating fake conversations.

But by exposing users to **real human speech**, with just enough structure to remove fear and create comprehension.

Core principles:

- Comprehension before correctness  
- Meaning before text  
- Curiosity before discipline  
- Recognition before memorization  
- Trust before scale  

If a feature improves “learning” but harms curiosity or trust, it is rejected.

---

## The problem we are solving

For beginners, Thai feels impossible because:

- The script is unfamiliar and intimidating
- Spoken Thai does not map cleanly to written Thai
- Tones make the language sound like noise
- Existing apps teach artificial, slow, sanitized Thai
- Learners cannot connect “what people say” to “what it means”

Most language apps optimize for:
- retention via streaks
- measurable progress
- structured curricula

Beginners actually need:
- reduced panic
- early comprehension
- repeated exposure to natural speech
- permission to not understand everything

This product removes the **first barrier**:  
the feeling that spoken Thai is incomprehensible.

---

## Target user

Primary user (MVP):

- Adult beginner (A0–A1)
- Living in or planning to live in Thailand
- Hears Thai daily but understands little
- Curious, not necessarily disciplined
- Not looking for a “course”

Secondary users (later):

- Casual learners
- Travelers
- Heritage learners
- Intermediate users who want immersion

Explicitly **not** targeting (MVP):

- Children
- Classroom students
- People who want structured lessons
- Users who want tests, scores, or certificates

---

## Jobs to be done

When I open the app, I want to:

- Feel less lost when I hear Thai
- Understand what someone just said without studying
- Recognize sounds I’ve heard before
- Build intuition without effort
- Stop being afraid of real Thai content

Success is emotional before it is measurable.

---

## Core promise

Every time you open the app, spoken Thai feels a little less foreign.

Not:
- “You learned X words”
- “You completed a lesson”
- “You advanced a level”

But:
- “I kind of get this now”

---

## Product shape (high-level)

- Mobile-first
- One-screen experience
- Short vertical clips (10–30s)
- Real Thai speakers
- Meaning-first display
- Progressive reveal (optional)
- No saving, no lists, no streaks

The feed is the curriculum.  
The moment is the unit of learning.

---

## What the product is NOT

This product is not:

- A Duolingo competitor
- A grammar course
- A flashcard system
- A spaced repetition app
- A test-prep tool
- A content scraper without human review

Any feature that pushes the app in those directions is out of scope.

---

## MVP scope

Included in MVP:

- Daily curated feed
- Meaning-only captions
- Thai transcript reveal
- Word grouping and tap-to-gloss
- Slow audio (press-and-hold)
- Optional speaking mimic strip
- Human-edited content
- No user accounts required

Explicitly excluded from MVP:

- Vocabulary saving
- Flashcards
- Progress dashboards
- Streaks
- Gamification
- Multiple languages beyond Thai (content language)
- Social features

---

## Success metrics (MVP)

Primary signals:

- Average session length
- Clips watched per session
- Replay rate
- Use of slow-audio gesture
- Reveal rate (meaning → Thai → words)

Secondary signals:

- Day-2 / Day-7 retention
- Qualitative feedback (“I understand more”)

We do not measure:
- words learned
- accuracy
- completion rates

---

## Content philosophy

Content must be:

- Real (not scripted for learners)
- Short and focused
- Emotionally understandable
- Human-verified for meaning
- Legally attributable

We optimize for:
- clarity of intent
- repeated patterns
- natural pacing

Not for:
- coverage
- exhaustiveness
- academic correctness

---

## Trust model

The app must never confidently show incorrect meaning.

Rules:

- Meaning captions are human-written
- Machine output is always reviewable
- Ambiguity is allowed
- Silence is better than wrong certainty

Once trust is lost, the product is dead.

---

## Long-term direction (non-binding)

If MVP works, possible expansions:

- Creator ecosystem
- Other tonal or script-heavy languages
- Advanced reading lens
- User-imported content
- Paid deep-dive features

None of these are required to validate the core.

---

## Product risks (acknowledged)

- Beginners may feel lost without structure
- No streaks may reduce habitual use
- Content quality bottleneck
- Harder to explain vs traditional apps

These are accepted risks.

This product trades mass clarity for **deep resonance** with the right users.

---

## Decision boundary

If a future proposal answers:
- “Will this make beginners feel less scared of real Thai?”

It is considered.

If not, it is out of scope.