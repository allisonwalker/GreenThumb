CREATE TYPE "public"."crop_source" AS ENUM('generated', 'edited', 'stub');--> statement-breakpoint
CREATE TABLE "crop" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"watering_interval_days" integer,
	"fertilizing_interval_days" integer,
	"pruning" jsonb,
	"frost_sensitive" boolean,
	"sun_preference" "sun_exposure",
	"plant_window_start" text,
	"plant_window_end" text,
	"days_to_harvest_min" integer,
	"days_to_harvest_max" integer,
	"time_estimates" jsonb,
	"source" "crop_source" NOT NULL,
	"generated_by_provider" text,
	"generated_by_model" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crop_name_not_blank" CHECK (length(trim("crop"."name")) > 0),
	CONSTRAINT "crop_slug_not_blank" CHECK (length(trim("crop"."slug")) > 0),
	CONSTRAINT "crop_watering_interval_positive" CHECK ("crop"."watering_interval_days" is null or "crop"."watering_interval_days" > 0),
	CONSTRAINT "crop_fertilizing_interval_positive" CHECK ("crop"."fertilizing_interval_days" is null or "crop"."fertilizing_interval_days" > 0),
	CONSTRAINT "crop_harvest_days_positive" CHECK ((
        ("crop"."days_to_harvest_min" is null or "crop"."days_to_harvest_min" > 0)
        and ("crop"."days_to_harvest_max" is null or "crop"."days_to_harvest_max" > 0)
        and (
          "crop"."days_to_harvest_min" is null
          or "crop"."days_to_harvest_max" is null
          or "crop"."days_to_harvest_max" >= "crop"."days_to_harvest_min"
        )
      )),
	CONSTRAINT "crop_plant_window_format" CHECK ((
        "crop"."plant_window_start" is null
        or "crop"."plant_window_start" ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      ) and (
        "crop"."plant_window_end" is null
        or "crop"."plant_window_end" ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      )),
	CONSTRAINT "crop_pruning_object" CHECK ("crop"."pruning" is null
        or jsonb_typeof("crop"."pruning") = 'object'),
	CONSTRAINT "crop_time_estimates_object" CHECK ("crop"."time_estimates" is null
        or jsonb_typeof("crop"."time_estimates") = 'object')
);
--> statement-breakpoint
ALTER TABLE "planting" ADD COLUMN "crop_id" uuid;--> statement-breakpoint
INSERT INTO "crop" ("name", "slug", "source")
SELECT DISTINCT ON (slug)
  trim("crop_name") AS "name",
  trim(both '-' from regexp_replace(lower(trim("crop_name")), '[^a-z0-9]+', '-', 'g')) AS slug,
  'stub'::"crop_source"
FROM "planting"
WHERE length(trim("crop_name")) > 0
  AND length(trim(both '-' from regexp_replace(lower(trim("crop_name")), '[^a-z0-9]+', '-', 'g'))) > 0
ORDER BY slug, "created_at";--> statement-breakpoint
UPDATE "planting"
SET "crop_id" = "crop"."id"
FROM "crop"
WHERE "crop"."slug" = trim(both '-' from regexp_replace(lower(trim("planting"."crop_name")), '[^a-z0-9]+', '-', 'g'));--> statement-breakpoint
ALTER TABLE "planting" ALTER COLUMN "crop_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "crop_slug_idx" ON "crop" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "planting" ADD CONSTRAINT "planting_crop_id_crop_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crop"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planting_crop_idx" ON "planting" USING btree ("crop_id");