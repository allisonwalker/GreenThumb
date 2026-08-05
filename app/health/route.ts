import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db/client";
import { createHealthPayload, getCommitSha } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = getDatabase();
    await database.execute(sql`select 1`);

    return NextResponse.json(createHealthPayload(getCommitSha()));
  } catch {
    console.error("Health check failed; database unavailable.");

    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        commitSha: getCommitSha(),
      },
      { status: 503 },
    );
  }
}
