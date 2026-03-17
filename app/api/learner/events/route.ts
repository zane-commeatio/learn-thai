import { getDb } from "../../../../lib/db";
import { invalidRequest, processingFailed } from "../../../../src/contracts/api-error";
import { LearnerAnalyticsEventSchema } from "../../../../src/contracts/learner-analytics";
import { recordLearnerEvent } from "../../../../src/learner/services/record-learner-event";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = LearnerAnalyticsEventSchema.safeParse(body);

  if (!parsed.success) {
    return invalidRequest(
      "Learner analytics payload is invalid.",
      parsed.error.flatten(),
    );
  }

  try {
    await recordLearnerEvent({ db: getDb() }, parsed.data);
  } catch (error) {
    return processingFailed(
      error instanceof Error ? error.message : "Failed to record learner event",
    );
  }

  return Response.json({ ok: true }, { status: 202 });
}
