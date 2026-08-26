import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { retryPing } from "@/lib/db/ping";

let client: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  // One connection per serverless isolate. A larger pool plus a waking
  // (or misconfigured) Supabase instance is how OTP verify appears to hang.
  client ??= postgres(databaseUrl, {
    // Concurrent RSC loads and Promise.all queries queue forever if this is 1.
    max: 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 4,
  });

  return drizzle(client);
}

export async function pingDatabase() {
  const database = getDatabase();
  await retryPing(async () => {
    await database.execute(sql`select 1`);
  });
}
