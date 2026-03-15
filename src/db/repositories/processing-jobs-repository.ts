import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { processingJobs } from "../../../infra/db/schema";
import type { Database } from "../client";
import type {
  AdvanceToNextStageInput,
  ClaimProcessingJobInput,
  CreateProcessingJobInput,
  MarkProcessingJobFailedInput,
  ProcessingJobRecord,
  ProcessingJobsRepository,
  ReleaseProcessingJobClaimInput,
  SaveProcessingJobArtifactsInput,
  UpdateProcessingJobInput,
} from "../../domain/repositories/processing-jobs-repository";
import { getNextStage } from "../../contracts/state-machine";

function mapProcessingJobRow(
  row: typeof processingJobs.$inferSelect,
): ProcessingJobRecord {
  return {
    id: row.id,
    clipId: row.clipId,
    state: row.state,
    stage: row.stage,
    artifactRefs: row.artifactRefs ?? null,
    errorPayload: row.errorPayload ?? null,
    lockToken: row.lockToken ?? null,
    lockExpiresAt: row.lockExpiresAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleProcessingJobsRepository implements ProcessingJobsRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateProcessingJobInput): Promise<ProcessingJobRecord> {
    const [inserted] = await this.db.insert(processingJobs).values(input).returning();
    return mapProcessingJobRow(inserted);
  }

  async getById(id: string): Promise<ProcessingJobRecord | null> {
    const [row] = await this.db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, id))
      .limit(1);

    return row ? mapProcessingJobRow(row) : null;
  }

  async getLatestByClipId(clipId: string): Promise<ProcessingJobRecord | null> {
    const [row] = await this.db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.clipId, clipId))
      .orderBy(desc(processingJobs.updatedAt), desc(processingJobs.createdAt))
      .limit(1);

    return row ? mapProcessingJobRow(row) : null;
  }

  async getActiveByClipId(clipId: string): Promise<ProcessingJobRecord | null> {
    const [row] = await this.db
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.clipId, clipId),
          eq(processingJobs.state, "processing"),
        ),
      )
      .orderBy(desc(processingJobs.updatedAt), desc(processingJobs.createdAt))
      .limit(1);

    return row ? mapProcessingJobRow(row) : null;
  }

  async updateStatusStageError(
    input: UpdateProcessingJobInput,
  ): Promise<ProcessingJobRecord | null> {
    const [updated] = await this.db
      .update(processingJobs)
      .set({
        state: input.state,
        stage: input.stage,
        errorPayload: input.errorPayload,
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, input.id))
      .returning();

    return updated ? mapProcessingJobRow(updated) : null;
  }

  async claimForProcessing(input: ClaimProcessingJobInput): Promise<ProcessingJobRecord | null> {
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);

    const [claimed] = await this.db
      .update(processingJobs)
      .set({
        lockToken: input.lockToken,
        lockExpiresAt: leaseExpiresAt,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(processingJobs.id, input.id),
          eq(processingJobs.state, "processing"),
          eq(processingJobs.stage, input.expectedStage),
          or(
            isNull(processingJobs.lockToken),
            isNull(processingJobs.lockExpiresAt),
            lt(processingJobs.lockExpiresAt, input.now),
          ),
        ),
      )
      .returning();

    return claimed ? mapProcessingJobRow(claimed) : null;
  }

  async releaseClaim(input: ReleaseProcessingJobClaimInput): Promise<void> {
    await this.db
      .update(processingJobs)
      .set({
        lockToken: null,
        lockExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processingJobs.id, input.id),
          eq(processingJobs.lockToken, input.lockToken),
        ),
      );
  }

  async saveArtifacts(
    input: SaveProcessingJobArtifactsInput,
  ): Promise<ProcessingJobRecord | null> {
    const [updated] = await this.db
      .update(processingJobs)
      .set({
        artifactRefs: input.artifactRefs,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processingJobs.id, input.id),
          eq(processingJobs.lockToken, input.lockToken),
        ),
      )
      .returning();

    return updated ? mapProcessingJobRow(updated) : null;
  }

  async advanceToNextStage(
    input: AdvanceToNextStageInput,
  ): Promise<ProcessingJobRecord | null> {
    const nextStage = getNextStage(input.currentStage);
    if (!nextStage) {
      return null;
    }

    const [updated] = await this.db
      .update(processingJobs)
      .set({
        stage: nextStage,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processingJobs.id, input.id),
          eq(processingJobs.lockToken, input.lockToken),
          eq(processingJobs.stage, input.currentStage),
        ),
      )
      .returning();

    return updated ? mapProcessingJobRow(updated) : null;
  }

  async markFailed(input: MarkProcessingJobFailedInput): Promise<ProcessingJobRecord | null> {
    const [updated] = await this.db
      .update(processingJobs)
      .set({
        state: "failed",
        errorPayload: input.errorPayload,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processingJobs.id, input.id),
          eq(processingJobs.lockToken, input.lockToken),
        ),
      )
      .returning();

    return updated ? mapProcessingJobRow(updated) : null;
  }
}
