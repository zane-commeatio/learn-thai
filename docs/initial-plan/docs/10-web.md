# 10-web

## portal-app-architecture

This section defines the architecture of the internal web app used by creators and admins.  
There is no consumer web experience for learners.

### Scope
- Creator and admin interfaces only.
- Authentication is required for all routes.
- Mobile remains the only learner consumption surface.

### Architecture layers
- **Routing layer**: protected route groups for creator and admin areas.
- **UI layer**: page shells, forms, tables, and editor components.
- **State layer**: local UI state plus server state for clip lifecycle and processing.
- **Data layer**: typed API hooks for `/api/creator/*` and `/api/admin/*`.

### Data flow
1. User signs in and role is resolved.
2. Route guards enforce access by role.
3. Pages fetch data via typed API hooks.
4. Mutations update server state and invalidate relevant queries.

### Frontend constraints
- Keep editing workflows deterministic and step-based.
- Prefer optimistic UI only for low-risk actions.
- High-impact actions (publish, rollback, archive) require explicit confirmation.

## creator-portal-frontend

This section defines creator-facing screens and workflows.

### Core screens
- Clip list with filters (`status`, `rightsStatus`, owner).
- Clip creation + upload flow.
- Processing status screen.
- Editor screen (transcript, word groups, meanings, glosses).
- Published preview by version.
- Audit/history view.

### Workflow
1. Create clip record.
2. Upload source media and confirm completion.
3. Wait for processing.
4. Edit guided sections in order.
5. Preview published versions.
6. Publish new version when ready.

### UX rules
- Guided flow with explicit save per step.
- Clear status badges for pipeline state.
- Non-blocking errors where possible, actionable retry where needed.

### API mapping
- `POST /api/creator/clips`
- `POST /api/creator/clips/{clipId}/upload-url`
- `POST /api/creator/clips/{clipId}/upload-complete`
- `GET /api/creator/clips/{clipId}/processing`
- `GET /api/creator/clips/{clipId}/editor`
- `PUT /api/creator/clips/{clipId}/transcript`
- `PUT /api/creator/clips/{clipId}/word-groups`
- `PUT /api/creator/clips/{clipId}/meanings`
- `PUT /api/creator/clips/{clipId}/glosses`
- `GET /api/creator/clips/{clipId}/preview/v/{version}`
- `POST /api/creator/clips/{clipId}/publish`
- `POST /api/creator/clips/{clipId}/rollback`

## edge-caching-and-cdn

This section defines cache behavior for portal assets and public mobile content assets.

### What is cached
- Static portal assets (JS/CSS/images/fonts) at edge.
- Public mobile content assets (clip payload/media) with long TTL.
- Role-protected creator/admin API responses are generally not publicly cached.

### Cache policy
- Use versioned static asset filenames for immutable caching.
- Cache clip payload/media by `clipId + clipVersion`.
- Invalidate by publishing a new version, not by mutating old artifacts.

### Safety rules
- Never cache authenticated responses in shared public cache.
- Respect role and auth headers for creator/admin endpoints.
- Keep cache keys explicit for public content endpoints.

### Goals
- Fast portal load times.
- Low origin load for static and public content.
- Deterministic behavior for versioned clip assets.

## admin-tools

This section defines admin-only operational surfaces and controls.

### Capabilities
- Review queue (`needs_review`, `failed`).
- Clip audit log visibility.
- Retry processing for failed jobs.
- Rollback to published version.
- Archive clips when needed.

### Guardrails
- Admin role required for destructive/high-impact actions.
- Confirmation required for rollback/archive.
- Audit trail for all admin actions.

### Operational UX
- Prioritize failure recovery speed.
- Show clear error causes and retry guidance.
- Keep actions reversible when possible (except hard archive policies).
