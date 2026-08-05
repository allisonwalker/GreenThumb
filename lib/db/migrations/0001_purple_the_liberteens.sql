CREATE TYPE "public"."action_type" AS ENUM('watered', 'fertilized', 'pruned', 'harvested', 'planted', 'observed', 'treated');--> statement-breakpoint
CREATE TYPE "public"."location_kind" AS ENUM('bed_section', 'pot');--> statement-breakpoint
CREATE TYPE "public"."planting_method" AS ENUM('seed', 'transplant');--> statement-breakpoint
CREATE TYPE "public"."planting_status" AS ENUM('planned', 'growing', 'harvested', 'removed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sun_exposure" AS ENUM('full_sun', 'part_sun', 'part_shade', 'full_shade');--> statement-breakpoint
CREATE TYPE "public"."sun_exposure_source" AS ENUM('derived', 'override');--> statement-breakpoint
CREATE TABLE "action_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid,
	"planting_id" uuid,
	"user_id" uuid NOT NULL,
	"action_type" "action_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_log_has_subject" CHECK ("action_log"."location_id" is not null or "action_log"."planting_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "bed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"name" text DEFAULT 'Raised Bed' NOT NULL,
	"length_ft" numeric(6, 2) NOT NULL,
	"width_ft" numeric(6, 2) NOT NULL,
	"soil_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bed_positive_dimensions" CHECK ("bed"."length_ft" > 0 and "bed"."width_ft" > 0)
);
--> statement-breakpoint
CREATE TABLE "garden_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garden_note_not_blank" CHECK (length(trim("garden_note"."note")) > 0)
);
--> statement-breakpoint
CREATE TABLE "garden" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton_key" boolean DEFAULT true NOT NULL,
	"name" text DEFAULT 'GreenThumb Garden' NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"timezone" text NOT NULL,
	"hardiness_zone" text NOT NULL,
	"average_last_frost_on" date,
	"average_first_frost_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garden_singleton_true" CHECK ("garden"."singleton_key" = true),
	CONSTRAINT "garden_latitude_range" CHECK ("garden"."latitude" between -90 and 90),
	CONSTRAINT "garden_longitude_range" CHECK ("garden"."longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"kind" "location_kind" NOT NULL,
	"name" text NOT NULL,
	"bed_id" uuid,
	"season_id" uuid,
	"start_ft" numeric(6, 2),
	"end_ft" numeric(6, 2),
	"sun_exposure" text NOT NULL,
	"sun_exposure_source" "sun_exposure_source" NOT NULL,
	"sun_exposure_mix" jsonb,
	"volume_gal" numeric(7, 2),
	"material" text,
	"soil_type" text,
	"dryness_factor" numeric(5, 2) DEFAULT '1' NOT NULL,
	"notes" text,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_positive_dryness" CHECK ("location"."dryness_factor" > 0),
	CONSTRAINT "location_kind_fields" CHECK ((
        "location"."kind" = 'bed_section'
        and "location"."bed_id" is not null
        and "location"."season_id" is not null
        and "location"."start_ft" is not null
        and "location"."end_ft" > "location"."start_ft"
        and "location"."volume_gal" is null
        and "location"."material" is null
        and "location"."soil_type" is null
        and "location"."sun_exposure_mix" is not null
      ) or (
        "location"."kind" = 'pot'
        and "location"."bed_id" is null
        and "location"."season_id" is null
        and "location"."start_ft" is null
        and "location"."end_ft" is null
        and "location"."volume_gal" > 0
        and "location"."material" is not null
        and "location"."soil_type" is not null
        and "location"."sun_exposure_source" = 'override'
      ))
);
--> statement-breakpoint
CREATE TABLE "planting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"crop_name" text NOT NULL,
	"variety" text,
	"method" "planting_method" NOT NULL,
	"planted_on" date NOT NULL,
	"removed_on" date,
	"status" "planting_status" DEFAULT 'growing' NOT NULL,
	"harvest_window_start" date,
	"harvest_window_end" date,
	"harvest_confidence" numeric(4, 3),
	"harvest_rationale" text,
	"harvest_estimating_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planting_valid_dates" CHECK ("planting"."removed_on" is null or "planting"."removed_on" >= "planting"."planted_on"),
	CONSTRAINT "planting_harvest_confidence_range" CHECK ("planting"."harvest_confidence" is null or "planting"."harvest_confidence" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "season" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_valid_dates" CHECK ("season"."ends_on" >= "season"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "sun_zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bed_id" uuid NOT NULL,
	"start_ft" numeric(6, 2) NOT NULL,
	"end_ft" numeric(6, 2) NOT NULL,
	"sun_exposure" "sun_exposure" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sun_zone_valid_interval" CHECK ("sun_zone"."start_ft" >= 0 and "sun_zone"."end_ft" > "sun_zone"."start_ft")
);
--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_planting_id_planting_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."planting"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bed" ADD CONSTRAINT "bed_garden_id_garden_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."garden"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_note" ADD CONSTRAINT "garden_note_garden_id_garden_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."garden"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_garden_id_garden_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."garden"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_bed_id_bed_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."bed"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_season_id_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planting" ADD CONSTRAINT "planting_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season" ADD CONSTRAINT "season_garden_id_garden_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."garden"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sun_zone" ADD CONSTRAINT "sun_zone_bed_id_bed_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."bed"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_log_location_occurred_idx" ON "action_log" USING btree ("location_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bed_garden_name_idx" ON "bed" USING btree ("garden_id","name");--> statement-breakpoint
CREATE INDEX "garden_note_garden_created_idx" ON "garden_note" USING btree ("garden_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "garden_singleton_idx" ON "garden" USING btree ("singleton_key");--> statement-breakpoint
CREATE INDEX "location_garden_kind_idx" ON "location" USING btree ("garden_id","kind");--> statement-breakpoint
CREATE INDEX "location_bed_interval_idx" ON "location" USING btree ("bed_id","start_ft","end_ft");--> statement-breakpoint
CREATE INDEX "planting_location_idx" ON "planting" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "season_garden_name_idx" ON "season" USING btree ("garden_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "season_one_current_per_garden_idx" ON "season" USING btree ("garden_id") WHERE "season"."is_current" = true;--> statement-breakpoint
CREATE INDEX "sun_zone_bed_idx" ON "sun_zone" USING btree ("bed_id");--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

ALTER TABLE "sun_zone"
ADD CONSTRAINT "sun_zone_no_overlap"
EXCLUDE USING gist (
  "bed_id" WITH =,
  numrange("start_ft", "end_ft", '[)') WITH &&
);--> statement-breakpoint

CREATE OR REPLACE FUNCTION calculate_section_sun_exposure(
  section_bed_id uuid,
  section_start_ft numeric,
  section_end_ft numeric
)
RETURNS TABLE(exposure text, mix jsonb)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  section_length numeric;
  covered_length numeric;
  dominant_exposure text;
  dominant_length numeric;
BEGIN
  section_length := section_end_ft - section_start_ft;

  IF section_start_ft < 0 OR section_length <= 0 THEN
    RAISE EXCEPTION 'Section boundaries must form a positive interval';
  END IF;

  WITH zone_overlap AS (
    SELECT
      sz.sun_exposure::text AS exposure_name,
      least(sz.end_ft, section_end_ft)
        - greatest(sz.start_ft, section_start_ft) AS overlap_ft
    FROM sun_zone sz
    WHERE sz.bed_id = section_bed_id
      AND sz.start_ft < section_end_ft
      AND sz.end_ft > section_start_ft
  ),
  exposure_totals AS (
    SELECT exposure_name, sum(overlap_ft) AS feet
    FROM zone_overlap
    WHERE overlap_ft > 0
    GROUP BY exposure_name
  )
  SELECT
    coalesce(sum(feet), 0),
    (
      SELECT exposure_name
      FROM exposure_totals
      ORDER BY feet DESC, exposure_name
      LIMIT 1
    ),
    coalesce(max(feet), 0),
    coalesce(
      jsonb_object_agg(
        exposure_name,
        jsonb_build_object(
          'feet', round(feet, 4),
          'fraction', round(feet / section_length, 4)
        )
      ),
      '{}'::jsonb
    )
  INTO covered_length, dominant_exposure, dominant_length, mix
  FROM exposure_totals;

  IF covered_length <> section_length THEN
    RAISE EXCEPTION 'Sun zones do not fully cover section % to %',
      section_start_ft,
      section_end_ft;
  END IF;

  IF dominant_length = section_length THEN
    exposure := dominant_exposure;
  ELSIF dominant_length / section_length >= (2.0 / 3.0) THEN
    exposure := 'mostly_' || dominant_exposure;
  ELSE
    exposure := 'mixed';
  END IF;

  RETURN NEXT;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_sun_zone_coverage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_bed_id uuid;
  previous_bed_id uuid;
  bed_length numeric;
  zone_count integer;
  first_start numeric;
  last_end numeric;
  covered_length numeric;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    affected_bed_id := NEW.bed_id;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    previous_bed_id := OLD.bed_id;
  END IF;

  FOR affected_bed_id IN
    SELECT DISTINCT candidate
    FROM unnest(ARRAY[affected_bed_id, previous_bed_id]) AS candidate
    WHERE candidate IS NOT NULL
  LOOP
    SELECT length_ft
    INTO bed_length
    FROM bed
    WHERE id = affected_bed_id;

    IF bed_length IS NULL THEN
      CONTINUE;
    END IF;

    SELECT
      count(*),
      min(start_ft),
      max(end_ft),
      coalesce(sum(end_ft - start_ft), 0)
    INTO zone_count, first_start, last_end, covered_length
    FROM sun_zone
    WHERE bed_id = affected_bed_id;

    IF zone_count = 0
      OR first_start <> 0
      OR last_end <> bed_length
      OR covered_length <> bed_length
    THEN
      RAISE EXCEPTION
        'Sun zones for bed % must cover 0 to % feet without gaps',
        affected_bed_id,
        bed_length;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE CONSTRAINT TRIGGER sun_zone_coverage_check
AFTER INSERT OR UPDATE OR DELETE ON sun_zone
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_sun_zone_coverage();--> statement-breakpoint

CREATE OR REPLACE FUNCTION set_derived_section_exposure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  result record;
BEGIN
  IF NEW.kind = 'bed_section'
    AND NEW.sun_exposure_source = 'derived'
  THEN
    SELECT *
    INTO result
    FROM calculate_section_sun_exposure(
      NEW.bed_id,
      NEW.start_ft,
      NEW.end_ft
    );

    NEW.sun_exposure := result.exposure;
    NEW.sun_exposure_mix := result.mix;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER location_derive_sun_exposure
BEFORE INSERT OR UPDATE OF
  kind,
  bed_id,
  start_ft,
  end_ft,
  sun_exposure_source
ON location
FOR EACH ROW
EXECUTE FUNCTION set_derived_section_exposure();--> statement-breakpoint

CREATE OR REPLACE FUNCTION refresh_sections_for_sun_zone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_bed_id uuid;
  previous_bed_id uuid;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    affected_bed_id := NEW.bed_id;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    previous_bed_id := OLD.bed_id;
  END IF;

  FOR affected_bed_id IN
    SELECT DISTINCT candidate
    FROM unnest(ARRAY[affected_bed_id, previous_bed_id]) AS candidate
    WHERE candidate IS NOT NULL
  LOOP
    WITH derived_values AS (
      SELECT
        section.id,
        derived.exposure,
        derived.mix
      FROM location AS section
      JOIN season AS section_season
        ON section_season.id = section.season_id
      CROSS JOIN LATERAL calculate_section_sun_exposure(
        section.bed_id,
        section.start_ft,
        section.end_ft
      ) AS derived
      WHERE section.bed_id = affected_bed_id
        AND section.kind = 'bed_section'
        AND section.sun_exposure_source = 'derived'
        AND section_season.is_current = true
    )
    UPDATE location AS location_to_refresh
    SET
      sun_exposure = derived.exposure,
      sun_exposure_mix = derived.mix,
      updated_at = now()
    FROM derived_values AS derived
    WHERE location_to_refresh.id = derived.id;
  END LOOP;

  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE CONSTRAINT TRIGGER sun_zone_refresh_sections
AFTER INSERT OR UPDATE OR DELETE ON sun_zone
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION refresh_sections_for_sun_zone();--> statement-breakpoint

CREATE VIEW current_location AS
SELECT location.*
FROM location
LEFT JOIN season ON season.id = location.season_id
WHERE location.retired_at IS NULL
  AND (
    location.kind = 'pot'
    OR (
      location.kind = 'bed_section'
      AND season.is_current = true
    )
  );