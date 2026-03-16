import { eq } from "drizzle-orm";
import { clipEditorStates } from "../../../infra/db/schema";
import type { Database } from "../client";
import type {
  ClipEditorStateRecord,
  ClipEditorStatesRepository,
  SaveClipEditorStateInput,
} from "../../domain/repositories/clip-editor-states-repository";

function mapClipEditorStateRow(row: typeof clipEditorStates.$inferSelect): ClipEditorStateRecord {
  return {
    clipId: row.clipId,
    sourceJobId: row.sourceJobId,
    payload: row.payload,
    reviewStatus: row.reviewStatus,
    hasManualChanges: row.hasManualChanges,
    lastReseededAt: row.lastReseededAt,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleClipEditorStatesRepository implements ClipEditorStatesRepository {
  constructor(private readonly db: Database) {}

  async getByClipId(clipId: string): Promise<ClipEditorStateRecord | null> {
    const [row] = await this.db
      .select()
      .from(clipEditorStates)
      .where(eq(clipEditorStates.clipId, clipId))
      .limit(1);

    return row ? mapClipEditorStateRow(row) : null;
  }

  async save(input: SaveClipEditorStateInput): Promise<ClipEditorStateRecord> {
    const [row] = await this.db
      .insert(clipEditorStates)
      .values(input)
      .onConflictDoUpdate({
        target: clipEditorStates.clipId,
        set: {
          sourceJobId: input.sourceJobId,
          payload: input.payload,
          reviewStatus: input.reviewStatus,
          hasManualChanges: input.hasManualChanges,
          lastReseededAt: input.lastReseededAt,
          updatedBy: input.updatedBy ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapClipEditorStateRow(row);
  }
}
