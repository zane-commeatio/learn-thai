import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { learnerEvents } from "../../../../infra/db/schema";
import { getDb } from "../../../../lib/db";
import { LearnerAnalyticsEventSchema } from "../../../../src/contracts/learner-analytics";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = LearnerAnalyticsEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "invalid_learner_event",
        message: "Learner analytics payload is invalid.",
      },
      { status: 400 },
    );
  }

  const db = getDb();

  await db.insert(learnerEvents).values({
    id: randomUUID(),
    sessionId: parsed.data.sessionId,
    name: parsed.data.name,
    clipId: parsed.data.clipId ?? null,
    clipVersion: parsed.data.clipVersion ?? null,
    feedPosition: parsed.data.feedPosition ?? null,
    playbackMs: parsed.data.playbackMs ?? null,
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
