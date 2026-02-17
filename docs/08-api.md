# 08-api

This document defines the API surface for the learner app and creator portal.
It is REST JSON, Cloudflare-hosted, and optimized for low cost.

---

## api-overview

Principles:
- Mobile API is **public read-only**.
- Creator API is authenticated via **Firebase Auth**.
- All published clip payloads are cacheable.
- Writes are limited to creator/admin roles.

Base paths:
- Mobile: `/api/mobile/*`
- Creator: `/api/creator/*`
- Admin: `/api/admin/*`

---

## mobile-api

### 1. Daily feed
`GET /api/mobile/feed?date=YYYY-MM-DD`

Returns ordered clips for the day.
Only clips with `visibility_state=visible` are returned.

Response:
- `date`
- `items[]` (ordered)
  - `clipId`
  - `clipVersion`
  - `payload` (canonical clip object)

### 2. Clip by id (latest)
`GET /api/mobile/clip/{clipId}`

Returns the latest published version.
If clip is delisted/held, returns legal-safe error envelope.

Response:
- `clipId`
- `clipVersion`
- `payload`

### 3. Clip by id + version
`GET /api/mobile/clip/{clipId}/v/{version}`

Returns a specific published version if legally available.

### 4. Health/version
`GET /api/mobile/health`

Response:
- `status`
- `apiVersion`

---

## creator-api

All creator endpoints require Firebase Auth.

### 1. Create clip record
`POST /api/creator/clips`

Request:
- `title` (optional)
- `source_type`
- `rights_status`

Response:
- `clipId`
- `uploadUrl` (optional if requested)

### 2. Request upload URL
`POST /api/creator/clips/{clipId}/upload-url`

Response:
- `uploadUrl`
- `expiresAt`

### 3. Confirm upload complete
`POST /api/creator/clips/{clipId}/upload-complete`

Triggers processing job.

### 4. Processing status
`GET /api/creator/clips/{clipId}/processing`

Response:
- `state`
- `stage`
- `error` (nullable)

### 5. Load editor payload
`GET /api/creator/clips/{clipId}/editor`

Returns the latest editable payload (may be pre-publish).

### 6. Update transcript + timings
`PUT /api/creator/clips/{clipId}/transcript`

Request:
- `segments[]`
  - `segmentIndex`
  - `text`
  - `startMs`
  - `endMs`

### 7. Update word groups
`PUT /api/creator/clips/{clipId}/word-groups`

Request:
- `groups[]`
  - `groupIndex`
  - `tokenIds[]`

### 8. Update meanings
`PUT /api/creator/clips/{clipId}/meanings`

Request:
- `meanings[]`
  - `locale`
  - `text`
  - `variant`

### 9. Update glosses
`PUT /api/creator/clips/{clipId}/glosses`

Request:
- `glosses[]`
  - `tokenId`
  - `gloss`

### 10. Preview payload (published version)
`GET /api/creator/clips/{clipId}/preview/v/{version}`

Returns the rendered learner payload for review.
Draft preview is available via `GET /api/creator/clips/{clipId}/editor`.

### 11. Publish
`POST /api/creator/clips/{clipId}/publish`

Creates a new immutable `clipVersion`.

### 12. Rollback
`POST /api/creator/clips/{clipId}/rollback`

Request:
- `version` (target published version)

### 13. Archive
`POST /api/creator/clips/{clipId}/archive`

Admin only.

### 14. List clips
`GET /api/creator/clips?ownerId=&status=&rightsStatus=`

### 15. Review queue
`GET /api/creator/review-queue?state=needs_review|failed`

### 16. Audit log
`GET /api/creator/clips/{clipId}/audit`

### 17. Manual retry
`POST /api/creator/clips/{clipId}/retry-processing`

### 18. Update rights evidence
`PUT /api/creator/clips/{clipId}/rights-evidence`

Request:
- `sourceLink`
- `uploaderAttestation`
- `attributionText`
- `rightsConfidence` (`high` | `medium` | `low`)

### 19. Get legal status
`GET /api/creator/clips/{clipId}/legal-status`

Response:
- `rightsStatus`
- `rightsConfidence`
- `visibilityState`
- `openTakedownCase` (nullable)

---

## admin-api

### 1. Open takedown case
`POST /api/admin/clips/{clipId}/takedown`

Request:
- `severity` (`critical` | `high` | `standard`)
- `reason`
- `claimRef`

Behavior:
- sets clip `visibilityState=delisted_legal`
- creates takedown case and initial event

### 2. Reinstate clip
`POST /api/admin/clips/{clipId}/reinstate`

Request:
- `reason`
- `caseId`

Behavior:
- if approved, sets clip `visibilityState=visible`
- appends reinstatement event + audit log

### 3. List legal takedown cases
`GET /api/admin/legal/takedowns?status=&severity=`

Returns paginated takedown case list with clip refs.

### 4. Add legal event
`POST /api/admin/legal/takedowns/{caseId}/events`

Request:
- `action`
- `reason`
- `metadata` (optional)

---

## webhooks-and-callbacks

Optional internal events:
- `upload-complete` → enqueue processing job
- `processing-complete` → notify creator UI

No external third-party webhooks are required in MVP.

---

## auth-and-sessions

Creator portal auth:
- Firebase Auth for identity
- Worker verifies Firebase ID token
- Role is resolved from `users` table

Mobile API:
- Public read-only
- Protected by rate limits only
- May return legal restriction codes for delisted or held content.

---

## rate-limits

Mobile:
- IP-based limits to prevent scraping
- Aggressive cache for feed + clip payloads

Creator:
- Per-user limits for write actions
- Publish and retry are explicitly throttled

---

## error-codes

Standard JSON error envelope:
- `code`
- `message`
- `details` (optional)

Core error codes:
- `unauthorized`
- `forbidden`
- `not_found`
- `invalid_request`
- `conflict`
- `rate_limited`
- `processing_failed`
- `validation_failed`
- `content_restricted`
- `takedown_pending`
- `legal_hold`
