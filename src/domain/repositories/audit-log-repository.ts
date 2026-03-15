export type AuditLogAction =
  | "upload"
  | "edit"
  | "publish"
  | "rollback"
  | "delete"
  | "retry"
  | "legal_delist"
  | "legal_reinstate"
  | "legal_hold"
  | "legal_remove";

export type AuditLogTargetType =
  | "clip"
  | "clip_version"
  | "segment"
  | "token"
  | "group"
  | "meaning"
  | "gloss"
  | "job";

export type AuditLogRecord = {
  id: string;
  actorId: string | null;
  action: AuditLogAction;
  targetType: AuditLogTargetType;
  targetId: string;
  metadata: unknown | null;
  createdAt: Date;
};

export type AppendAuditLogInput = {
  id: string;
  actorId?: string | null;
  action: AuditLogAction;
  targetType: AuditLogTargetType;
  targetId: string;
  metadata?: unknown | null;
};

export interface AuditLogRepository {
  append(input: AppendAuditLogInput): Promise<AuditLogRecord>;
}
