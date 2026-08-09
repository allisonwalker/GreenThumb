CREATE TYPE "public"."agent_run_kind" AS ENUM('scheduled_checkin', 'ask', 'script', 'test');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'succeeded', 'failed', 'timed_out', 'budget_exceeded');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('open', 'done', 'dismissed', 'superseded', 'expired');--> statement-breakpoint
CREATE TYPE "public"."recommendation_urgency" AS ENUM('now', 'today', 'this_week', 'monitor');--> statement-breakpoint
CREATE TABLE "agent_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "agent_run_kind" NOT NULL,
	"trigger" text NOT NULL,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"input_tokens" numeric(12, 0) DEFAULT '0' NOT NULL,
	"output_tokens" numeric(12, 0) DEFAULT '0' NOT NULL,
	"estimated_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weather_fetch_id" uuid,
	"simulated_weather" jsonb,
	"final_text" text,
	"error" text,
	"stop_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_run_nonnegative_tokens" CHECK ("agent_run"."input_tokens" >= 0 and "agent_run"."output_tokens" >= 0 and "agent_run"."estimated_cost_usd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recommendation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_run_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"planting_id" uuid,
	"action_type" "action_type" NOT NULL,
	"urgency" "recommendation_urgency" NOT NULL,
	"headline" text NOT NULL,
	"rationale" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"evidence" jsonb NOT NULL,
	"status" "recommendation_status" DEFAULT 'open' NOT NULL,
	"due_by" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolved_action_log_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_confidence_range" CHECK ("recommendation"."confidence" between 0 and 1),
	CONSTRAINT "recommendation_headline_not_blank" CHECK (length(trim("recommendation"."headline")) > 0)
);
--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_weather_fetch_id_weather_fetch_id_fk" FOREIGN KEY ("weather_fetch_id") REFERENCES "public"."weather_fetch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_agent_run_id_agent_run_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_planting_id_planting_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."planting"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_resolved_action_log_id_action_log_id_fk" FOREIGN KEY ("resolved_action_log_id") REFERENCES "public"."action_log"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_started_idx" ON "agent_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "agent_run_provider_started_idx" ON "agent_run" USING btree ("provider","started_at");--> statement-breakpoint
CREATE INDEX "recommendation_status_idx" ON "recommendation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recommendation_location_status_idx" ON "recommendation" USING btree ("location_id","status");