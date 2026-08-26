import { NextResponse } from "next/server";

import { pingDatabase } from "@/lib/db/client";
import { createHealthPayload, getCommitSha } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pingDatabase();

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
