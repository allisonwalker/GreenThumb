-- Matching persists Today rows on care_run (ALL-20).
-- recommendation.agent_run_id is nullable; matching rows do not mint an LLM run.
CREATE TYPE "public"."care_run_trigger" AS ENUM('scheduled', 'manual', 'after_write', 'simulated');--> statement-breakpoint
CREATE TYPE "public"."care_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "care_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" "care_run_trigger" NOT NULL,
	"status" "care_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"weather_fetch_id" uuid,
	"simulated_weather" jsonb,
	"task_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_run_nonnegative_task_count" CHECK ("care_run"."task_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "care_run" ADD CONSTRAINT "care_run_weather_fetch_id_weather_fetch_id_fk" FOREIGN KEY ("weather_fetch_id") REFERENCES "public"."weather_fetch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_run_started_idx" ON "care_run" USING btree ("started_at");--> statement-breakpoint
ALTER TABLE "care_run" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recommendation" ALTER COLUMN "agent_run_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendation" ALTER COLUMN "confidence" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendation" ADD COLUMN "care_run_id" uuid;--> statement-breakpoint
ALTER TABLE "recommendation" ADD COLUMN "crop_id" uuid;--> statement-breakpoint
ALTER TABLE "recommendation" ADD COLUMN "estimated_minutes" integer;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_care_run_id_care_run_id_fk" FOREIGN KEY ("care_run_id") REFERENCES "public"."care_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_crop_id_crop_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crop"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recommendation_care_run_idx" ON "recommendation" USING btree ("care_run_id");--> statement-breakpoint
ALTER TABLE "recommendation" DROP CONSTRAINT "recommendation_confidence_range";--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_confidence_range" CHECK ("recommendation"."confidence" is null or "recommendation"."confidence" between 0 and 1);--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_has_run" CHECK ("recommendation"."care_run_id" is not null or "recommendation"."agent_run_id" is not null);--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_estimated_minutes_range" CHECK ("recommendation"."estimated_minutes" is null or "recommendation"."estimated_minutes" between 1 and 480);
