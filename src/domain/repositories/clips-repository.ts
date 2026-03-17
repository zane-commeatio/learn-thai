import type { ClipRightsStatus, ClipSourceType } from "../../contracts/pipeline";

export type ClipRecord = {
  id: string;
  title: string;
  ownerId: string;
  sourceType: ClipSourceType;
  rightsStatus: ClipRightsStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateClipInput = {
  id: string;
  title: string;
  ownerId: string;
  sourceType: ClipSourceType;
  rightsStatus: ClipRightsStatus;
};

export interface ClipsRepository {
  create(input: CreateClipInput): Promise<ClipRecord>;
  getById(id: string): Promise<ClipRecord | null>;
  deleteById(id: string): Promise<void>;
}
