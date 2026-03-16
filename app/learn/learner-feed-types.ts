export type LearnerFeedSegment = {
  index: number;
  text: string;
  startMs: number;
  endMs: number;
  englishText: string | null;
};

export type LearnerFeedItem = {
  clipId: string;
  clipVersion: number;
  title: string;
  summary: string;
  meaning?: string | null;
  thumbnailUrl: string;
  videoUrl: string;
  durationMs: number | null;
  segments?: LearnerFeedSegment[];
};

export type LearnerFeedResponse = {
  items: LearnerFeedItem[];
  nextCursor: string | null;
};
