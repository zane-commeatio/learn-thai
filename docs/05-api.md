# API

Last verified against code: 2026-03-14

## Scope

This document lists the APIs that are implemented in this repository today.

There are two separate API surfaces in code:

- active Next.js admin routes under `app/api/admin/`
- parallel Cloudflare worker routes under `src/worker/`

The admin routes are the primary active web API for the current implementation.

## Response conventions

- Admin JSON reads usually return `200`
- accepted background work returns `202`
- service errors use a JSON body with `code` and `message`
- unauthenticated admin API access returns `401`

## Admin auth routes

### `POST /api/admin/login`

- Accepts form data: `email`, `password`
- On success redirects to `/admin`
- Sets the `admin_session` cookie
- On invalid credentials redirects to `/login?error=invalid_credentials`

### `POST /api/admin/logout`

- Clears the `admin_session` cookie
- Redirects to `/login`

## Admin data routes

### `GET /api/admin/clips`

Returns up to 200 clips ordered by `updated_at desc` with the latest job attached when present.

### `GET /api/admin/jobs/running`

Returns up to 200 jobs where `state = processing`, ordered by `updated_at desc`.

### `GET /api/admin/jobs/recent`

Returns the 20 most recent jobs ordered by `updated_at desc`.

### `GET /api/admin/jobs/[jobId]`

Returns one job record by id.

## Admin mutation routes

### `POST /api/admin/clips/upload`

Accepts multipart form data:

- `title`
- `file`

Behavior:

- validates title and file presence
- stores the source object in S3/MinIO
- creates a clip row
- creates a processing job at `audio`
- enqueues the BullMQ processing message
- returns `202`

### `POST /api/admin/jobs/[jobId]/retry`

Behavior:

- loads the source job
- ensures the job is `failed` or `manual_intervention`
- ensures there is no active processing job for the clip
- creates a new processing job at `audio`
- enqueues a new BullMQ message
- appends an audit log entry
- returns `202`

## Admin artifact routes

All artifact routes load the path from `processing_jobs.artifact_refs`, fetch the object from storage, and stream it back with an appropriate content type.

### Audio

- `GET /api/admin/jobs/[jobId]/artifacts/audio/poster`
- `GET /api/admin/jobs/[jobId]/artifacts/audio/normalized`
- `GET /api/admin/jobs/[jobId]/artifacts/audio/wav`

### Intermediate JSON artifacts

- `GET /api/admin/jobs/[jobId]/artifacts/asr`
- `GET /api/admin/jobs/[jobId]/artifacts/segment`
- `GET /api/admin/jobs/[jobId]/artifacts/translate`

### Finalize payload artifacts

- `GET /api/admin/jobs/[jobId]/artifacts/finalize/generated`
- `GET /api/admin/jobs/[jobId]/artifacts/finalize/edited`

## Cloudflare worker routes in code

The repository also contains a separate worker app with these routes:

- `GET /api/mobile/health`
- `POST /api/creator/clips`
- `POST /api/creator/clips/{clipId}/upload-complete`

These routes exist in `src/worker/app.ts`. They are not part of the primary Next.js admin runtime.

## Not implemented

- published learner feed APIs
- creator editing APIs in the Next.js app
- legal admin APIs
- public clip playback APIs for end users
