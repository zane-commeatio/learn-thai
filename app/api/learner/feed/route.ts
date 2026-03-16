import { NextResponse } from "next/server";
import type { LearnerFeedResponse } from "../../../learn/learner-feed-types";

export async function GET() {
  const response: LearnerFeedResponse = {
    items: [],
    nextCursor: null,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
