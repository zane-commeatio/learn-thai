import type { ClipReviewStatus, EditorPayload } from "../../contracts/editor-payload";

export type ClipEditorStateRecord = {
  clipId: string;
  sourceJobId: string;
  payload: EditorPayload;
  reviewStatus: ClipReviewStatus;
  hasManualChanges: boolean;
  lastReseededAt: Date;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SaveClipEditorStateInput = {
  clipId: string;
  sourceJobId: string;
  payload: EditorPayload;
  reviewStatus: ClipReviewStatus;
  hasManualChanges: boolean;
  lastReseededAt: Date;
  updatedBy?: string | null;
};

export interface ClipEditorStatesRepository {
  getByClipId(clipId: string): Promise<ClipEditorStateRecord | null>;
  save(input: SaveClipEditorStateInput): Promise<ClipEditorStateRecord>;
}
