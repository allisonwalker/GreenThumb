import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  client ??= postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  return drizzle(client);
}
