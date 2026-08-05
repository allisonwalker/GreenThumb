import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A deliberately trivial table proving that checked-in Drizzle migrations can
 * reach the hosted database. ALL-19 replaces this setup-only schema with the
 * real garden model.
 */
export const appMetadata = pgTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
