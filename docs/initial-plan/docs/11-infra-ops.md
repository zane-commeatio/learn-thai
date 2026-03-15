# 11-infra-ops

## environments-and-config

This section defines runtime environments and config ownership.

### Environments
- `local`: developer machine, emulators/mocks allowed.
- `staging`: production-like stack for integration and release validation.
- `production`: live traffic for mobile and creator/admin APIs.

### Core runtime topology
- Cloudflare Workers: API + orchestration.
- Cloudflare Queues: async processing jobs.
- Cloudflare R2: media/artifact storage.
- Neon Postgres: system of record.
- External processing provider: OpenAI Whisper API.
- Translation runtime: OpenRouter structured outputs for whole-clip translation, with the previous local Transformers.js backend kept in code for rollback.
- Analytics: self-hosted PostHog.

### Config policy
- Environment-specific config is injected at deploy time.
- No hardcoded env values in code.
- Config changes require changelog entry and deploy note.
- Feature flags are environment-scoped and default-safe (`off` in production until validated).

### Required config classes
- Service endpoints (Neon, PostHog, Whisper).
- Auth configuration (Firebase project IDs, token verification settings).
- Queue and concurrency limits.
- Cache TTL controls for public payload/media responses.
- Rate-limit thresholds for mobile and creator APIs.

## secrets-and-key-management

### Secret sources
- Cloudflare secrets (`wrangler secret`) for Worker runtime.
- CI secret store for build/deploy tokens.
- Local `.env` only for local development; never committed.

### Secret classes
- Database credentials (Neon).
- API keys (OpenAI Whisper, PostHog ingestion key if required).
- Auth secrets/keys (Firebase service credentials as needed).
- Deploy credentials (Cloudflare API token, store credentials for release pipeline).

### Rules
- Least-privilege tokens only.
- Separate credentials per environment.
- Rotation schedule: quarterly baseline, immediate on incident.
- Rotation runbook must validate old/new overlap and rollback path.
- Never log secret values or include them in error payloads.

## ci-cd

### Pipeline stages
1. `lint + typecheck`
2. `unit tests`
3. `build artifacts`
4. `deploy staging`
5. `smoke tests`
6. `manual approval`
7. `deploy production`
8. `post-deploy checks`

### Deployment rules
- Main branch deploys to staging automatically.
- Production requires explicit approval.
- No direct manual edits in production environment.
- Every deploy is traceable to commit SHA and actor.

### Smoke checks (minimum)
- `/api/mobile/health`
- one feed request
- one creator-authenticated endpoint
- queue enqueue/dequeue sanity
- R2 read for a known test object

### Rollback
- Workers: redeploy previous artifact by SHA.
- Config rollback: revert env config and redeploy.
- Data rollback: use app-level rollback paths (clip version rollback), not DB rewrites.

## monitoring-alerting

### Golden signals
- Availability: Worker success rate, endpoint uptime.
- Latency: p50/p95 by endpoint.
- Errors: 4xx/5xx rate, queue job failure rate.
- Saturation: queue depth, processing lag, Worker CPU duration, DB connection pressure.

### Service monitors
- Mobile API read endpoints.
- Creator/admin write endpoints.
- Processing pipeline stages (ASR, segment, translate, finalize).
- Neon health and query latency.
- R2 read/write error rates.
- Whisper provider error/timeout rates.
- PostHog ingestion health.
- Legal operations endpoints (`/api/admin/legal/*`).
- Takedown SLA compliance (time-to-delist, time-to-first-response).

### Alerts
- `P1`: API outage, publish blocked, queue backlog above threshold.
- `P2`: elevated latency/error budgets trending to breach.
- `P3`: non-critical degradation, noisy downstream dependency.
- `P1-Legal`: takedown SLA breach on critical case.
- `P2-Legal`: repeated legal endpoint failures or delist propagation delays.

### Alert routing
- Pager/critical channel for P1.
- Team channel for P2/P3.
- Every alert has owner, ack time, and resolution status.
- `P1-Legal` routes to on-call + legal/compliance owner.

## logging-and-tracing

### Logging standard
- Structured JSON logs only.
- Required fields: `timestamp`, `env`, `service`, `endpoint_or_job`, `request_id`, `clip_id` (if applicable), `severity`, `error_code`.
- No PII and no secret values in logs.
- Legal events must include: `legal_case_id` (if applicable), `legal_action`, and actor identity reference.

### Correlation
- Propagate `request_id` from edge request through queue job chain.
- Include `job_id` for pipeline logs.
- Include `clip_id` + `clipVersion` for content operations.
- Propagate `legal_case_id` across takedown and reinstatement lifecycle actions.

### Retention
- Keep hot logs for operational window (for example 14-30 days).
- Archive summarized operational metrics longer-term.
- Follow legal/security policy for retention and deletion.

### Tracing
- At minimum, trace Worker request spans and queue job spans.
- Capture external dependency timing (Neon, Whisper, R2).

## backups-and-dr

### Backup scope
- Neon Postgres: automated backups + point-in-time recovery.
- R2 media/artifacts: replication or periodic backup policy for critical objects.
- Config and infra definitions: version-controlled in repo/infra configs.

### DR targets
- Define RPO/RTO explicitly per system:
- Neon: low RPO, moderate RTO.
- R2 media: moderate RPO, moderate RTO.
- Worker deploy artifacts/config: low RTO.

### Recovery drills
- Quarterly restore drill from Neon backup to staging.
- Quarterly object recovery drill for sample clip assets.
- Validate app-level integrity after restore (feed, preview, publish paths).
- Validate legal delist state remains enforced after restore.

### Legal/takedown constraint
- DR process must still honor takedown requirements and rights status policies.
- Delisted clips must not reappear during failover/restore.

## incident-response

### Severity model
- `SEV-1`: major user impact or data/security risk.
- `SEV-2`: partial degradation with workaround.
- `SEV-3`: minor degradation.

### Incident flow
1. Detect and classify severity.
2. Assign incident commander.
3. Stabilize (mitigate blast radius first).
4. Diagnose root cause.
5. Recover service.
6. Publish incident summary.
7. Complete postmortem with action items.

### Communication
- Internal status updates at fixed cadence for SEV-1/2.
- External/user communication only when impact is user-visible.
- Keep timeline with UTC timestamps.
- For legal incidents, include claimant timeline and delist timestamps.

### Postmortem standard
- What happened.
- Impact and duration.
- Root cause.
- What worked/failed in response.
- Corrective actions with owners and due dates.

## slo-sla

### SLOs (internal targets)
- Mobile read API availability: `>= 99.9%`.
- Mobile feed p95 latency: target threshold defined per region.
- Creator publish success rate: `>= 99.5%`.
- Processing pipeline completion within target window for normal load.
- Queue backlog drain time within operational threshold.
- Critical takedown delist SLA: `<= 4h`.
- High-severity takedown delist SLA: `<= 24h`.

### Error budgets
- Track monthly error budget burn.
- Freeze non-critical changes when burn rate exceeds policy threshold.
- Prioritize reliability work over feature work during sustained burn.

### SLA (external commitment)
- If no formal customer SLA exists, document as “best effort.”
- If contractual SLAs are introduced later, map directly to measured SLOs and alerting.

## cost-tracking

### Cost centers
- Cloudflare Workers (invocations + CPU duration).
- Cloudflare Queues.
- Cloudflare R2 storage + egress.
- Neon compute/storage.
- Whisper API usage.
- PostHog self-hosting infra costs.

### Cost controls
- Concurrency caps for processing jobs.
- Aggressive cache for immutable payload/media.
- LRU media strategy on client to reduce repeated egress.
- Rate limits on public endpoints.
- Budget alerts by service and total monthly spend.

### Reporting cadence
- Weekly operational cost snapshot.
- Monthly cost review with trend vs traffic volume.
- Track unit economics:
- cost per processed clip
- cost per 1k mobile feed requests
- storage growth rate per month
