export type AdminClipLatestJob = {
  id: string;
  clipId: string;
  state: string;
  stage: string;
  updatedAt: Date;
};

export type AdminClipListItem = {
  id: string;
  title: string;
  ownerId: string;
  sourceType: string;
  rightsStatus: string;
  createdAt: Date;
  updatedAt: Date;
  latestJob: AdminClipLatestJob | null;
};

export type ListClipsResult = {
  clips: AdminClipListItem[];
};
