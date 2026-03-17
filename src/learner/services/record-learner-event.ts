import { randomUUID } from "node:crypto";
import { learnerEvents } from "../../../infra/db/schema";
import type { Database } from "../../db/client";
import type { LearnerAnalyticsEvent } from "../../contracts/learner-analytics";

export type RecordLearnerEventDependencies = {
  db: Database;
};

export async function recordLearnerEvent(
  dependencies: RecordLearnerEventDependencies,
  event: LearnerAnalyticsEvent,
): Promise<void> {
  await dependencies.db.insert(learnerEvents).values({
    id: randomUUID(),
    sessionId: event.sessionId,
    name: event.name,
    clipId: event.clipId ?? null,
    clipVersion: event.clipVersion ?? null,
    feedPosition: event.feedPosition ?? null,
    playbackMs: event.playbackMs ?? null,
  });
}
