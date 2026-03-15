import { eq } from "drizzle-orm";
import { clips } from "../../../infra/db/schema";
import type { Database } from "../client";
import type {
  ClipRecord,
  ClipsRepository,
  CreateClipInput,
} from "../../domain/repositories/clips-repository";

function mapClipRow(row: typeof clips.$inferSelect): ClipRecord {
  return {
    id: row.id,
    title: row.title,
    ownerId: row.ownerId,
    sourceType: row.sourceType,
    rightsStatus: row.rightsStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleClipsRepository implements ClipsRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateClipInput): Promise<ClipRecord> {
    const [inserted] = await this.db.insert(clips).values(input).returning();
    return mapClipRow(inserted);
  }

  async getById(id: string): Promise<ClipRecord | null> {
    const [row] = await this.db.select().from(clips).where(eq(clips.id, id)).limit(1);
    return row ? mapClipRow(row) : null;
  }
}
