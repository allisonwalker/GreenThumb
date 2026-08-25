-- Crop-draft agent runs (ALL-71) plus optional user attribution for spend caps (ALL-15).
ALTER TYPE "public"."agent_run_kind" ADD VALUE IF NOT EXISTS 'crop_draft';--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_run_user_id_app_user_id_fk'
  ) THEN
    ALTER TABLE "agent_run"
      ADD CONSTRAINT "agent_run_user_id_app_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_user_kind_started_idx"
  ON "agent_run" USING btree ("user_id","kind","started_at");
