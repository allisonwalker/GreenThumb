/**
 * Every table the application owns in the `public` schema.
 *
 * Listed explicitly, and shared by `lib/db/rls.integration.test.ts` and
 * `scripts/verify-rls.ts`, so the RLS checks fail loudly against an unmigrated
 * database instead of passing on zero tables. Adding a table here is the moment
 * to give it deny-by-default RLS in its own migration.
 */
export const PUBLIC_TABLE_NAMES = [
  "action_log",
  "agent_run",
  "app_metadata",
  "app_user",
  "bed",
  "care_run",
  "conversation",
  "crop",
  "garden",
  "garden_note",
  "location",
  "message",
  "planting",
  "recommendation",
  "season",
  "sun_zone",
  "weather_day",
  "weather_fetch",
] as const;

/** Views are not RLS-able themselves; they inherit it via `security_invoker`. */
export const PUBLIC_VIEW_NAMES = ["current_location"] as const;
