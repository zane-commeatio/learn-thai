import { NextResponse } from "next/server";
import { listClips } from "../../../../src/admin/services/list-clips";
import { getDb } from "../../../../lib/db";

export async function GET() {
  const result = await listClips({ db: getDb() });
  return NextResponse.json(result);
}
