import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { processingJobs } from "../../../../../infra/db/schema";
import { getDb } from "../../../../../lib/db";

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(processingJobs)
    .where(and(eq(processingJobs.state, "processing")))
    .orderBy(desc(processingJobs.updatedAt))
    .limit(200);

  return NextResponse.json({ jobs: rows });
}
