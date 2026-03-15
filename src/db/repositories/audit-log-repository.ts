import { auditLog } from "../../../infra/db/schema";
import type { Database } from "../client";
import type {
  AppendAuditLogInput,
  AuditLogRecord,
  AuditLogRepository,
} from "../../domain/repositories/audit-log-repository";

function mapAuditLogRow(row: typeof auditLog.$inferSelect): AuditLogRecord {
  return {
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}

export class DrizzleAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Database) {}

  async append(input: AppendAuditLogInput): Promise<AuditLogRecord> {
    const [inserted] = await this.db.insert(auditLog).values(input).returning();
    return mapAuditLogRow(inserted);
  }
}
