-- IF NOT EXISTS because this value was also added out of band, so a plain
-- ADD VALUE fails and stops every later migration from applying.
ALTER TYPE "public"."agent_run_kind" ADD VALUE IF NOT EXISTS 'time_budget';--> statement-breakpoint
