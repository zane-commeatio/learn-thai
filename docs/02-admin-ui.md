# Admin UI

Last verified against code: 2026-03-14

## Scope

The current web UI is admin-only.

Routes:

- `/login`
- `/admin`
- `/admin/clips/[clipId]`

All `/admin` pages and `/api/admin/*` routes are protected by middleware, except `POST /api/admin/login`.

## Login

- Admin credentials come from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Successful login sets the `admin_session` cookie.
- Sessions are signed JWTs with a 12-hour lifetime.

## Dashboard

The dashboard is the main operational screen.

It includes:

- upload form for a new media file and title
- running jobs panel
- all clips table
- recent jobs table
- logout action

Behavior:

- uploads use `XMLHttpRequest` so the UI can show upload progress
- running jobs and recent jobs poll every 2.5 seconds
- after upload or retry, the dashboard starts polling the specific job that was just created

## Upload flow

- The user enters a title and selects a media file.
- `POST /api/admin/clips/upload` stores the source object, creates a clip row, creates a processing job, and enqueues the `audio` stage.
- The current upload flow always creates clips with:
  - `ownerId = "admin"`
  - `sourceType = "original"`
  - `rightsStatus = "cleared"`

## Clip detail page

The clip detail page shows:

- clip header metadata
- current job status
- pipeline stages panel
- job history table

The stages panel uses a view model built from the latest job and its `artifact_refs`.

## Stage UI behavior

- `audio`: poster preview, normalized video, WAV audio, and linked playback controls
- `asr`: transcript preview plus counts for segments, words, and detected language
- `segment`: segment preview list with timing
- `translate`: translation preview list with Thai source and English translation
- `finalize`: clip video plus live subtitle panel driven by the edited payload

## Finalize preview

The finalize widget fetches the edited payload and renders:

- the normalized video
- the poster image if available
- a live subtitle block below the player

Subtitle behavior:

- it watches `video.currentTime`
- converts seconds to milliseconds
- finds the active segment from the edited payload
- shows both Thai text and English translation for the active segment
- clears the subtitle block when the current timestamp falls into a timing gap

## Retry behavior

- Retry is available only for jobs in `failed` or `manual_intervention` state.
- Retrying creates a new job and restarts from the `audio` stage.
- Retry actions are available from the dashboard and clip detail views.

## Not implemented

- in-browser editing of transcript, segments, or translations
- publish workflow
- creator-specific UI separate from admin
