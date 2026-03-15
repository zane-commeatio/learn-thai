# 03-admin-refactor-plan

Ranked refactor plan for the current Next.js admin surface and processing support code.

Scoring uses:

- Impact: how much maintainability, clarity, or runtime behavior improves
- Effort: relative implementation cost
- Risk: chance of regressions during refactor

## Ranked Plan

### 1. Extract shared admin presentation helpers and status components

- Impact: High
- Effort: Low
- Risk: Low

This is the easiest high-impact refactor. The admin dashboard and clip detail page repeat the same state/stage styling, retryability checks, failure formatting, and status rendering logic.

Current duplication:

- Stage badge classes duplicated in `app/admin/dashboard-client.tsx` and `app/admin/clips/[clipId]/page.tsx`
- State badge classes duplicated in `app/admin/dashboard-client.tsx` and `app/admin/clips/[clipId]/page.tsx`
- Retryable-state checks duplicated in `app/admin/dashboard-client.tsx` and `app/admin/clips/[clipId]/page.tsx`
- Failure tooltip/message parsing duplicated in `app/admin/dashboard-client.tsx` and `app/admin/clips/[clipId]/page.tsx`
- Failed-state badge markup duplicated in tables and detail views

Recommended files:

- `app/admin/components/job-state-badge.tsx`
- `app/admin/components/job-stage-badge.tsx`
- `app/admin/components/job-failure-badge.tsx`
- `app/admin/lib/job-presenters.ts`

Expected outcome:

- Smaller page files
- Consistent badge behavior and copy-to-clipboard failure UX
- Single place to update state/stage visuals and labels

## UI components to create

### `JobStageBadge`

- Path: `app/admin/components/job-stage-badge.tsx`
- Purpose: renders the colored stage pill for `audio`, `asr`, `segment`, `tokenize`, `gloss`, `finalize`
- Currently duplicated in:
  - `app/admin/dashboard-client.tsx`
  - `app/admin/clips/[clipId]/page.tsx`

### `JobStateBadge`

- Path: `app/admin/components/job-state-badge.tsx`
- Purpose: renders the colored state/progress pill for `processing`, `needs_review`, `failed`, `manual_intervention`, `completed`, `queued`
- Currently duplicated in:
  - `app/admin/dashboard-client.tsx`
  - `app/admin/clips/[clipId]/page.tsx`

### `JobFailureBadge`

- Path: `app/admin/components/job-failure-badge.tsx`
- Purpose: renders failed state with tooltip and optional copy-to-clipboard behavior for `errorPayload`
- Currently duplicated in:
  - Running jobs table in `app/admin/dashboard-client.tsx`
  - Recent jobs table in `app/admin/dashboard-client.tsx`
  - Current status section in `app/admin/clips/[clipId]/page.tsx`
  - Job history table in `app/admin/clips/[clipId]/page.tsx`

### `JobsTable`

- Path: `app/admin/components/jobs-table.tsx`
- Purpose: shared table shell for job rows with configurable action column and failure rendering
- Currently duplicated in:
  - Running jobs section in `app/admin/dashboard-client.tsx`
  - Recent jobs section in `app/admin/dashboard-client.tsx`
  - Job history section in `app/admin/clips/[clipId]/page.tsx`

### `ClipJobsSummary`

- Path: `app/admin/components/clip-jobs-summary.tsx`
- Purpose: compact combined state/stage summary for a clip's latest job
- Currently duplicated in:
  - All clips table in `app/admin/dashboard-client.tsx`
  - Current status strip in `app/admin/clips/[clipId]/page.tsx`

### `ArtifactDownloadButton`

- Path: `app/admin/components/artifact-download-button.tsx`
- Purpose: renders enabled/disabled download action with consistent copy and styles
- Currently duplicated in:
  - ASR action block in `app/admin/clips/[clipId]/page.tsx`
  - Segment action block in `app/admin/clips/[clipId]/page.tsx`
  - Tokenize action block in `app/admin/clips/[clipId]/page.tsx`

### `StageCard`

- Path: `app/admin/components/stage-card.tsx`
- Purpose: common layout wrapper for each pipeline stage card with stage badge, progress badge, description, check line, body, and actions
- Currently duplicated in:
  - Repeated stage card layout inside the `STAGES.map(...)` block in `app/admin/clips/[clipId]/page.tsx`

### `AsrStageWidget`

- Path: `app/admin/components/asr-stage-widget.tsx`
- Purpose: renders transcript preview and ASR stats
- Currently duplicated in:
  - Inline ASR stage block in `app/admin/clips/[clipId]/page.tsx`

### `SegmentStageWidget`

- Path: `app/admin/components/segment-stage-widget.tsx`
- Purpose: renders segment preview list and counts
- Currently duplicated in:
  - Inline segment stage block in `app/admin/clips/[clipId]/page.tsx`

### `TokenizeStageWidget`

- Path: `app/admin/components/tokenize-stage-widget.tsx`
- Purpose: renders token preview chips and counts
- Currently duplicated in:
  - Inline tokenize stage block in `app/admin/clips/[clipId]/page.tsx`

## Admin helper signatures

Recommended file: `app/admin/lib/job-presenters.ts`

```ts
export function getJobStageClassName(stage: string): string;
```

Returns the Tailwind class string for a job stage badge; used by `JobStageBadge`.

```ts
export function getJobStateClassName(state: string): string;
```

Returns the Tailwind class string for a job state or stage-progress badge; used by `JobStateBadge`.

```ts
export function isRetryableJobState(state: string): boolean;
```

Returns `true` for states that should expose retry actions; used by dashboard tables and clip detail actions.

```ts
export function getJobFailureTooltip(errorPayload: unknown): string;
```

Builds a short `code: message` string for hover tooltips; used by failure badges.

```ts
export function getJobFailureMessage(errorPayload: unknown): string;
```

Extracts a user-facing message from `errorPayload`; used in clip detail status text.

```ts
export function serializeJobFailurePayload(errorPayload: unknown): string;
```

Safely stringifies `errorPayload` for clipboard copy actions; used by failure badges in tables.

```ts
export function formatJobUpdatedAt(value: string | Date): string;
```

Formats API or DB timestamps for tables and status headers; used anywhere a job timestamp is shown.

```ts
export function formatDurationMs(ms: number | null): string;
```

Formats millisecond timings like `startMs` and `endMs`; used by segment preview widgets.

```ts
export function getStageProgress(
  stage: PipelineStage,
  latestJob?: { stage: string; state: string } | null,
): StageProgress;
```

Computes how a stage should appear in the clip detail timeline; used by `StageCard` and the clip detail page.

## 2. Introduce typed artifact reference parsing and accessors

- Impact: High
- Effort: Low
- Risk: Low

Artifact data is currently stored as loosely typed JSON and then parsed ad hoc in UI and route handlers.

Current pain points:

- `parseClipArtifactRefs(...)` in `app/admin/clips/[clipId]/page.tsx` is large and page-specific
- Artifact routes repeat the same "load job -> inspect artifactRefs -> derive path -> fetch object" pattern
- `artifactRefs` remains `unknown` through repository types, which encourages repetitive runtime guards

Recommended files:

- `src/contracts/artifacts.ts`
- `app/admin/lib/artifact-refs.ts`
- optional shared route helper in `app/api/admin/jobs/[jobId]/artifacts/_lib.ts`

Expected outcome:

- One canonical artifact shape
- Shorter route handlers
- Simpler clip detail page
- Easier rollout of `gloss` and `finalize`

## 3. Split the clip detail page into loader + view-model + section components

- Impact: High
- Effort: Medium
- Risk: Low

`app/admin/clips/[clipId]/page.tsx` currently combines data loading, parsing, progress derivation, formatting, stage card rendering, and history rendering.

Recommended files:

- `app/admin/clips/[clipId]/page.tsx` as thin loader/composer
- `app/admin/clips/[clipId]/clip-detail-view-model.ts`
- `app/admin/components/clip-header.tsx`
- `app/admin/components/clip-current-status.tsx`
- `app/admin/components/pipeline-stages-panel.tsx`
- `app/admin/components/job-history-table.tsx`

Expected outcome:

- Safer edits to stage rollout UI
- Easier test coverage around parsing and progress rules
- More reusable stage widgets as more pipeline stages ship

## 4. Move admin route business logic into shared services

- Impact: Medium-High
- Effort: Medium
- Risk: Medium

The app-side route handlers still contain business logic directly, unlike the worker side which is more structured.

Current routes to target first:

- `app/api/admin/clips/upload/route.ts`
- `app/api/admin/jobs/[jobId]/retry/route.ts`
- `app/api/admin/clips/route.ts`
- `app/api/admin/jobs/[jobId]/route.ts`

Recommended files:

- `src/admin/services/upload-clip.ts`
- `src/admin/services/retry-job.ts`
- `src/admin/services/list-clips.ts`
- `src/admin/services/get-job.ts`

Expected outcome:

- Thinner routes
- Better testability without full Next.js request objects
- Consistent app-side architecture with the worker domain style

## 5. Reduce dashboard polling and consolidate data fetching

- Impact: Medium
- Effort: Low-Medium
- Risk: Low

The dashboard polls three queries every 2.5 seconds regardless of whether anything is active.

Targets:

- `app/admin/dashboard-client.tsx`
- `app/api/admin/clips/route.ts`
- `app/api/admin/jobs/running/route.ts`
- `app/api/admin/jobs/recent/route.ts`

Recommended changes:

- Only poll while there are active jobs or a newly uploaded job is still moving
- Share a fetch helper for `fetch` + JSON parsing + error extraction
- Consider one combined dashboard endpoint if the client remains tightly coupled to these three resources

Expected outcome:

- Lower DB load
- Less client-side churn
- Simpler cache invalidation behavior

## 6. Stream uploads and artifact IO instead of buffering whole files

- Impact: Medium-High
- Effort: Medium
- Risk: Medium

This is the biggest efficiency-focused refactor.

Current issues:

- Upload route buffers the full file before S3 write in `app/api/admin/clips/upload/route.ts`
- Storage helper only exposes buffer-based object reads in `lib/storage.ts`
- Worker stages repeatedly buffer full media or JSON artifacts before use

Recommended changes:

- Add stream-oriented storage helpers
- Update upload route to stream request file data to object storage
- Update audio stage artifact persistence to upload file streams from temp paths instead of reading each file fully into memory

Expected outcome:

- Better memory behavior for larger media
- Better headroom for concurrent jobs

## 7. Unify DB access and connection lifecycle patterns

- Impact: Medium
- Effort: Medium
- Risk: Medium

The Next app caches DB access with `lib/db.ts`, but other code paths construct fresh pools through `createDb(...)`.

Targets:

- `src/db/client.ts`
- `lib/db.ts`
- `src/worker/app.ts`

Recommended changes:

- Introduce explicit pool lifecycle ownership
- Cache per-process DB clients consistently where appropriate
- Avoid silent creation of new pools in helper factories

Expected outcome:

- Clearer infra ownership
- Fewer hidden connection-management surprises

## Suggested implementation order

1. Shared admin presentation helpers and badges
2. Typed artifact refs and artifact route helpers
3. Split clip detail page into view-model and section components
4. Move upload/retry/list/get route logic into admin services
5. Reduce dashboard polling
6. Stream large file IO
7. Unify DB connection lifecycle

## Recommendation

If only one refactor is done now, start with item 1 plus item 2 together.

Those two changes are the best small-effort, big-impact package because they:

- shrink the largest page files
- remove the most obvious duplication
- create clean seams for future UI work
- make later service extraction much easier
