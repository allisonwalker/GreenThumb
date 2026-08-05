import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to apply migrations");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });
  const database = drizzle(client);

  try {
    await migrate(database, {
      migrationsFolder: "./lib/db/migrations",
    });
    console.log("Database migrations applied successfully.");
  } finally {
    await client.end();
  }
}

void main().catch(() => {
  console.error(
    "Database migration failed. Check DATABASE_URL and database access.",
  );
  process.exitCode = 1;
});
