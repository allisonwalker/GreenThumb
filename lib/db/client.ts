import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  client ??= postgres(databaseUrl, {
    max: 4,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client);
}
