-- ALL-70: crop identity is name + optional variety, unique via composite slug.
-- Same migration splits mixed-variety plantings that currently share one crop_id.
ALTER TABLE "crop" ADD COLUMN "variety" text;--> statement-breakpoint
ALTER TABLE "crop" ADD CONSTRAINT "crop_variety_null_or_nonblank" CHECK ("crop"."variety" is null or length(trim("crop"."variety")) > 0);--> statement-breakpoint
DO $all70$
BEGIN
  CREATE TEMP TABLE crop_variety_group ON COMMIT DROP AS
  WITH labeled AS (
    SELECT
      planting.id AS planting_id,
      planting.crop_id,
      planting.variety,
      planting.created_at,
      CASE
        WHEN planting.variety IS NULL OR length(trim(planting.variety)) = 0 THEN 'none'
        ELSE COALESCE(
          NULLIF(
            trim(both '-' from regexp_replace(lower(trim(planting.variety)), '[^a-z0-9]+', '-', 'g')),
            ''
          ),
          'none'
        )
      END AS variety_key
    FROM planting
  )
  SELECT
    crop_id,
    variety_key,
    (array_agg(variety ORDER BY created_at)
      FILTER (WHERE variety IS NOT NULL AND length(trim(variety)) > 0))[1] AS sample_variety,
    array_agg(planting_id ORDER BY created_at) AS planting_ids
  FROM labeled
  GROUP BY crop_id, variety_key;

  CREATE TEMP TABLE crop_variety_stats ON COMMIT DROP AS
  SELECT
    crop_id,
    COUNT(*)::integer AS key_count,
    BOOL_OR(variety_key = 'none') AS has_unnamed,
    MIN(variety_key) FILTER (WHERE variety_key <> 'none') AS first_named_key
  FROM crop_variety_group
  GROUP BY crop_id;

  WITH to_insert AS (
    SELECT
      crop.id AS from_crop_id,
      groups.variety_key,
      groups.sample_variety,
      groups.planting_ids,
      crop.name,
      crop.watering_interval_days,
      crop.fertilizing_interval_days,
      crop.pruning,
      crop.frost_sensitive,
      crop.sun_preference,
      crop.plant_window_start,
      crop.plant_window_end,
      crop.days_to_harvest_min,
      crop.days_to_harvest_max,
      crop.time_estimates,
      crop.source,
      crop.generated_by_provider,
      crop.generated_by_model,
      crop.notes,
      trim(both '-' from regexp_replace(lower(trim(crop.name)), '[^a-z0-9]+', '-', 'g'))
        || '--' || groups.variety_key AS new_slug
    FROM crop_variety_group AS groups
    JOIN crop ON crop.id = groups.crop_id
    JOIN crop_variety_stats AS stats ON stats.crop_id = groups.crop_id
    WHERE groups.variety_key <> 'none'
      AND groups.sample_variety IS NOT NULL
      AND stats.key_count > 1
      AND (stats.has_unnamed OR groups.variety_key <> stats.first_named_key)
  ),
  inserted AS (
    INSERT INTO crop (
      name,
      variety,
      slug,
      watering_interval_days,
      fertilizing_interval_days,
      pruning,
      frost_sensitive,
      sun_preference,
      plant_window_start,
      plant_window_end,
      days_to_harvest_min,
      days_to_harvest_max,
      time_estimates,
      source,
      generated_by_provider,
      generated_by_model,
      notes
    )
    SELECT
      name,
      sample_variety,
      new_slug,
      watering_interval_days,
      fertilizing_interval_days,
      pruning,
      frost_sensitive,
      sun_preference,
      plant_window_start,
      plant_window_end,
      days_to_harvest_min,
      days_to_harvest_max,
      time_estimates,
      source,
      generated_by_provider,
      generated_by_model,
      notes
    FROM to_insert
    RETURNING id, slug
  )
  UPDATE planting
  SET crop_id = inserted.id
  FROM to_insert
  JOIN inserted ON inserted.slug = to_insert.new_slug
  WHERE planting.id = ANY (to_insert.planting_ids);

  UPDATE crop
  SET
    variety = groups.sample_variety,
    slug = trim(both '-' from regexp_replace(lower(trim(crop.name)), '[^a-z0-9]+', '-', 'g'))
      || '--' || groups.variety_key,
    updated_at = now()
  FROM crop_variety_group AS groups
  JOIN crop_variety_stats AS stats ON stats.crop_id = groups.crop_id
  WHERE crop.id = groups.crop_id
    AND groups.variety_key <> 'none'
    AND groups.sample_variety IS NOT NULL
    AND (
      stats.key_count = 1
      OR (NOT stats.has_unnamed AND groups.variety_key = stats.first_named_key)
    );
END
$all70$;
