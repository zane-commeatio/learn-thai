# 04-admin-services-plan

Phase 4 moves admin API business logic out of Next.js route handlers and into shared application services.

The goal is not to add abstraction for its own sake. The goal is to make the admin backend easier to test, easier to change, and more consistent with the worker side of the codebase, which already has cleaner orchestration boundaries.

## Why this phase matters

The current admin routes are workable, but several of them mix too many responsibilities in one place.

For example:

- `app/api/admin/clips/upload/route.ts` parses form data, validates inputs, uploads media, creates DB records, and enqueues work
- `app/api/admin/jobs/[jobId]/retry/route.ts` loads the source job, checks state rules, checks for conflicting active jobs, creates a new job, enqueues work, and writes an audit log
- `app/api/admin/clips/route.ts` performs query orchestration and result shaping directly in the route
- `app/api/admin/jobs/[jobId]/route.ts` is small now, but still couples request handling and data access

That creates a few problems:

- route handlers become the only place business rules exist
- logic is harder to unit test without constructing HTTP requests
- similar patterns get repeated in future routes
- the admin side drifts away from the cleaner repository-orchestration style already used in `src/worker/*`

Phase 4 fixes that by making routes thin transport adapters and moving business behavior into services under `src/admin/services/*`.

## Target architecture

After this phase, each admin route should mostly do four things:

1. Read request input (`params`, `formData`, etc.)
2. Call a service with plain values
3. Convert the result into `NextResponse`
4. Map typed service errors to HTTP status codes

The service should do the real work:

- validation
- repository orchestration
- queue calls
- storage calls
- audit logging
- result shaping for consumers

This creates a cleaner separation:

- routes know HTTP
- services know application behavior
- repositories/adapters know infrastructure

## Recommended file layout

Core service files:

- `src/admin/services/upload-clip.ts`
- `src/admin/services/retry-job.ts`
- `src/admin/services/list-clips.ts`
- `src/admin/services/get-job.ts`

Optional second wave:

- `src/admin/services/list-running-jobs.ts`
- `src/admin/services/list-recent-jobs.ts`

Shared service support:

- `src/admin/services/errors.ts`
- `src/admin/services/types.ts`

If the number of admin use cases grows, it may also be worth adding:

- `src/admin/services/dependencies.ts`

That file could hold shared dependency types for repositories, queue adapters, and storage adapters.

## Service design approach

### Recommendation: start with functions, not classes

Use plain async functions with injected dependencies.

That keeps the code lightweight and avoids introducing class ceremony before the admin layer is large enough to need it.

Example shape:

```ts
type UploadClipDeps = {
  clipsRepository: ClipsRepository;
  processingJobsRepository: ProcessingJobsRepository;
  putObject: typeof putObject;
  enqueueProcessingJob: typeof enqueueProcessingJob;
  createId?: () => string;
};

export async function uploadClip(
  deps: UploadClipDeps,
  input: UploadClipInput,
): Promise<UploadClipResult> {
  // business logic here
}
```

This style fits the current codebase well because:

- it is easy to test with fakes and spies
- it mirrors the dependency-driven worker orchestration style
- it keeps service boundaries explicit

## Shared admin service error model

One of the biggest improvements in this phase is to stop returning HTTP responses from business logic.

Instead, services should return data or throw typed domain/application errors.

Suggested error codes:

- `invalid_request`
- `not_found`
- `invalid_state`
- `conflict`
- `processing_failed`

Suggested helper:

```ts
export class AdminServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
```

Why this matters:

- services stay framework-agnostic
- route handlers become simpler and more uniform
- tests can assert business failures directly without checking `NextResponse`

## Phase 4 service plan

### 1. Extract `upload-clip`

Target route:

- `app/api/admin/clips/upload/route.ts`

Current responsibilities in the route:

- parse form data
- validate title and file presence
- generate `clipId` and `jobId`
- derive source object key
- upload the source file to storage
- create the clip record
- create the initial processing job
- enqueue the audio stage job
- format the response payload

Recommended service:

- `src/admin/services/upload-clip.ts`

Suggested input:

```ts
export type UploadClipInput = {
  title: string;
  fileName: string;
  fileType: string;
  fileBytes: Buffer;
};
```

Suggested result:

```ts
export type UploadClipResult = {
  clipId: string;
  jobId: string;
  message: string;
};
```

Suggested dependencies:

- `clipsRepository`
- `processingJobsRepository`
- `putObject`
- `enqueueProcessingJob`
- `createId`

Why this extraction is high value:

- it removes the largest amount of orchestration logic from a route
- it creates a clean unit-test seam for the most important admin write path
- it makes future upload improvements easier, especially when streaming upload logic is introduced later

Important note:

Keep `request.formData()` and `file instanceof File` checks in the route if that simplifies web-specific handling. The service should receive normalized values, not browser/request objects.

### 2. Extract `retry-job`

Target route:

- `app/api/admin/jobs/[jobId]/retry/route.ts`

Current responsibilities in the route:

- load the source job
- validate retryable state
- ensure no active job already exists for the clip
- create a replacement processing job
- enqueue audio stage processing
- append audit log entry
- format retry response payload

Recommended service:

- `src/admin/services/retry-job.ts`

Suggested input:

```ts
export type RetryJobInput = {
  jobId: string;
  actorId: string;
};
```

Suggested result:

```ts
export type RetryJobResult = {
  jobId: string;
  clipId: string;
  retriedFromJobId: string;
  message: string;
};
```

Suggested dependencies:

- `processingJobsRepository`
- `auditLogRepository`
- `enqueueProcessingJob`
- `createId`

Why this extraction is high value:

- the retry rules are pure application behavior and do not belong in a route
- conflict handling becomes much easier to test directly
- audit logging becomes part of the use case instead of being coupled to one HTTP entry point

Important note:

Hard-code `actorId: "admin"` in the route for now if that is the current policy. If session identities become richer later, the route can pass the authenticated admin id/email instead.

### 3. Extract `list-clips`

Target route:

- `app/api/admin/clips/route.ts`

Current responsibilities in the route:

- fetch recent clips
- fetch all related jobs for the clip ids
- compute latest job per clip in memory
- shape API rows with `latestJob`

Recommended service:

- `src/admin/services/list-clips.ts`

Suggested result shape:

Return the same API shape already consumed by `app/admin/dashboard-client.tsx` so the refactor stays low-risk.

Why this extraction matters:

- the logic is not large, but it is query orchestration logic, not transport logic
- latest-job mapping is a business/data-shaping concern worth centralizing
- if clip list requirements change later, the route will stay untouched

### 4. Extract `get-job`

Target route:

- `app/api/admin/jobs/[jobId]/route.ts`

Current responsibilities in the route:

- load a single job by id
- return not found or success payload

Recommended service:

- `src/admin/services/get-job.ts`

Why still extract a small route:

- it establishes the pattern cleanly
- it gives the dashboard polling path a reusable backend query
- it keeps route behavior consistent with the rest of the phase

This should be kept intentionally simple.

## Optional second wave services

These are lower priority because the routes are already very small, but they may still be worth extracting for consistency.

### `list-running-jobs`

Target route:

- `app/api/admin/jobs/running/route.ts`

Why optional:

- current query is simple
- extracting it mainly improves consistency and test symmetry

### `list-recent-jobs`

Target route:

- `app/api/admin/jobs/recent/route.ts`

Why optional:

- current query is also simple
- still useful if job list filtering/sorting expands later

## Routes that should stay as-is for now

### `app/api/admin/login/route.ts`

Do not prioritize this in phase 4.

Reason:

- it is tightly coupled to redirect and cookie behavior
- it is small
- most of its work is inherently HTTP-specific

If needed later, credential validation could move into a small auth service, but that is not the highest-value extraction now.

## Dependency wiring strategy

There are two reasonable ways to wire services.

### Option A: instantiate dependencies in each route

Each route creates repositories and passes them into the service.

Pros:

- smallest refactor
- very explicit
- easy to implement incrementally

Cons:

- some route-level dependency setup repetition remains

### Option B: create a small admin dependency factory

Example:

```ts
export function createAdminServiceDeps(db: ReturnType<typeof getDb>) {
  return {
    clipsRepository: new DrizzleClipsRepository(db),
    processingJobsRepository: new DrizzleProcessingJobsRepository(db),
    auditLogRepository: new DrizzleAuditLogRepository(db),
    enqueueProcessingJob,
    putObject,
    createId: () => crypto.randomUUID(),
  };
}
```

Pros:

- routes become even thinner
- dependency wiring stays consistent

Cons:

- adds one more abstraction layer

Recommendation:

Start with Option A for phase 4. If more admin services are added later, introduce a shared dependency factory then.

## Implementation order

Recommended sequence:

1. Add shared admin service error type(s)
2. Extract `upload-clip`
3. Extract `retry-job`
4. Extract `list-clips`
5. Extract `get-job`
6. Optionally extract `list-running-jobs`
7. Optionally extract `list-recent-jobs`

This order gets the most important and most complex write paths under service boundaries first.

## Testing plan

This phase becomes much more valuable if the new services get unit tests.

Recommended service-level coverage:

### `upload-clip`

- rejects short titles
- rejects missing/empty files
- uploads source object with expected key and content type
- creates clip and initial processing job
- enqueues audio stage
- returns expected response payload

### `retry-job`

- returns not found when source job is missing
- rejects non-retryable states
- rejects when an active job already exists
- creates replacement job at audio stage
- enqueues replacement job
- appends audit log entry

### `list-clips`

- returns clips without job query when there are no clips
- attaches latest job per clip correctly

### `get-job`

- returns not found for missing id
- returns job for existing id

Why tests matter here:

- once services exist, the most valuable tests are no longer route tests
- routes can stay lightly tested because they become simple translation layers

## Expected end state

When phase 4 is complete:

- route files should shrink substantially
- admin business rules will live in `src/admin/services/*`
- queue/storage/repository orchestration will be easy to reuse and easy to test
- the admin backend will be more consistent with the worker pipeline architecture

That consistency matters. Right now, the worker side is the most maintainable part of the codebase because orchestration and infrastructure are separated reasonably well. Phase 4 brings the admin side closer to that standard.

## Recommendation

If phase 4 is implemented in one pass, prioritize these files first:

1. `src/admin/services/upload-clip.ts`
2. `src/admin/services/retry-job.ts`
3. `src/admin/services/errors.ts`
4. `app/api/admin/clips/upload/route.ts`
5. `app/api/admin/jobs/[jobId]/retry/route.ts`

That subset delivers the biggest maintainability gain with the clearest architectural improvement.
