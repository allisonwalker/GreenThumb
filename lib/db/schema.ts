import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  pgView,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { CropPruning, CropTimeEstimates } from "@/lib/crops/types";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const sunExposureEnum = pgEnum("sun_exposure", [
  "full_sun",
  "part_sun",
  "part_shade",
  "full_shade",
]);

export const locationKindEnum = pgEnum("location_kind", [
  "bed_section",
  "pot",
]);

export const sunExposureSourceEnum = pgEnum("sun_exposure_source", [
  "derived",
  "override",
]);

export const plantingMethodEnum = pgEnum("planting_method", [
  "seed",
  "transplant",
]);

export const plantingStatusEnum = pgEnum("planting_status", [
  "planned",
  "growing",
  "harvested",
  "removed",
  "failed",
]);

export const actionTypeEnum = pgEnum("action_type", [
  "watered",
  "fertilized",
  "pruned",
  "harvested",
  "planted",
  "observed",
  "treated",
]);

export const cropSourceEnum = pgEnum("crop_source", [
  "generated",
  "edited",
  "stub",
]);

export const weatherDayKindEnum = pgEnum("weather_day_kind", [
  "observed",
  "forecast",
]);

export const agentRunKindEnum = pgEnum("agent_run_kind", [
  "scheduled_checkin",
  "ask",
  "script",
  "test",
  "time_budget",
  "crop_draft",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "running",
  "succeeded",
  "failed",
  "timed_out",
  "budget_exceeded",
]);

export const conversationKindEnum = pgEnum("conversation_kind", [
  "ask",
  "time_budget",
]);

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const recommendationUrgencyEnum = pgEnum("recommendation_urgency", [
  "now",
  "today",
  "this_week",
  "monitor",
]);

export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "open",
  "done",
  "dismissed",
  "superseded",
  "expired",
]);

export const careRunTriggerEnum = pgEnum("care_run_trigger", [
  "scheduled",
  "manual",
  "after_write",
  "simulated",
]);

export const careRunStatusEnum = pgEnum("care_run_status", [
  "running",
  "succeeded",
  "failed",
]);

export type RecommendationEvidenceFact = {
  source: string;
  figure: string;
};

export type RecommendationEvidence = {
  facts: RecommendationEvidenceFact[];
};

export type AgentToolTraceEntry = {
  iteration: number;
  toolCallId: string;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
};

export const appMetadata = pgTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const appUsers = pgTable("app_user", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const gardens = pgTable(
  "garden",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    singletonKey: boolean("singleton_key").default(true).notNull(),
    name: text("name").default("Jory Journal Garden").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }).notNull(),
    longitude: numeric("longitude", { precision: 9, scale: 6 }).notNull(),
    timezone: text("timezone").notNull(),
    hardinessZone: text("hardiness_zone").notNull(),
    averageLastFrostOn: date("average_last_frost_on"),
    averageFirstFrostOn: date("average_first_frost_on"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("garden_singleton_idx").on(table.singletonKey),
    check("garden_singleton_true", sql`${table.singletonKey} = true`),
    check(
      "garden_latitude_range",
      sql`${table.latitude} between -90 and 90`,
    ),
    check(
      "garden_longitude_range",
      sql`${table.longitude} between -180 and 180`,
    ),
  ],
);

export const beds = pgTable(
  "bed",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    name: text("name").default("Raised Bed").notNull(),
    lengthFt: numeric("length_ft", { precision: 6, scale: 2 }).notNull(),
    widthFt: numeric("width_ft", { precision: 6, scale: 2 }).notNull(),
    soilType: text("soil_type").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bed_garden_name_idx").on(table.gardenId, table.name),
    check("bed_positive_dimensions", sql`${table.lengthFt} > 0 and ${table.widthFt} > 0`),
  ],
);

export const sunZones = pgTable(
  "sun_zone",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bedId: uuid("bed_id")
      .notNull()
      .references(() => beds.id, { onDelete: "cascade" }),
    startFt: numeric("start_ft", { precision: 6, scale: 2 }).notNull(),
    endFt: numeric("end_ft", { precision: 6, scale: 2 }).notNull(),
    sunExposure: sunExposureEnum("sun_exposure").notNull(),
    ...timestamps,
  },
  (table) => [
    index("sun_zone_bed_idx").on(table.bedId),
    check(
      "sun_zone_valid_interval",
      sql`${table.startFt} >= 0 and ${table.endFt} > ${table.startFt}`,
    ),
  ],
);

export const seasons = pgTable(
  "season",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    isCurrent: boolean("is_current").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("season_garden_name_idx").on(table.gardenId, table.name),
    uniqueIndex("season_one_current_per_garden_idx")
      .on(table.gardenId)
      .where(sql`${table.isCurrent} = true`),
    check("season_valid_dates", sql`${table.endsOn} >= ${table.startsOn}`),
  ],
);

export const locations = pgTable(
  "location",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    kind: locationKindEnum("kind").notNull(),
    name: text("name").notNull(),
    bedId: uuid("bed_id").references(() => beds.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id").references(() => seasons.id, {
      onDelete: "restrict",
    }),
    startFt: numeric("start_ft", { precision: 6, scale: 2 }),
    endFt: numeric("end_ft", { precision: 6, scale: 2 }),
    sunExposure: text("sun_exposure").notNull(),
    sunExposureSource: sunExposureSourceEnum("sun_exposure_source").notNull(),
    sunExposureMix: jsonb("sun_exposure_mix")
      .$type<Record<string, { feet: number; fraction: number }>>(),
    volumeGal: numeric("volume_gal", { precision: 7, scale: 2 }),
    material: text("material"),
    soilType: text("soil_type"),
    drynessFactor: numeric("dryness_factor", {
      precision: 5,
      scale: 2,
    })
      .default("1")
      .notNull(),
    notes: text("notes"),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("location_garden_kind_idx").on(table.gardenId, table.kind),
    index("location_bed_interval_idx").on(
      table.bedId,
      table.startFt,
      table.endFt,
    ),
    check("location_positive_dryness", sql`${table.drynessFactor} > 0`),
    check(
      "location_kind_fields",
      sql`(
        ${table.kind} = 'bed_section'
        and ${table.bedId} is not null
        and ${table.seasonId} is not null
        and ${table.startFt} is not null
        and ${table.endFt} > ${table.startFt}
        and ${table.volumeGal} is null
        and ${table.material} is null
        and ${table.soilType} is null
        and ${table.sunExposureMix} is not null
      ) or (
        ${table.kind} = 'pot'
        and ${table.bedId} is null
        and ${table.seasonId} is null
        and ${table.startFt} is null
        and ${table.endFt} is null
        and ${table.volumeGal} > 0
        and ${table.material} is not null
        and ${table.soilType} is not null
        and ${table.sunExposureSource} = 'override'
      )`,
    ),
  ],
);

export const crops = pgTable(
  "crop",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    variety: text("variety"),
    slug: text("slug").notNull(),
    wateringIntervalDays: integer("watering_interval_days"),
    fertilizingIntervalDays: integer("fertilizing_interval_days"),
    pruning: jsonb("pruning").$type<CropPruning>(),
    frostSensitive: boolean("frost_sensitive"),
    sunPreference: sunExposureEnum("sun_preference"),
    plantWindowStart: text("plant_window_start"),
    plantWindowEnd: text("plant_window_end"),
    daysToHarvestMin: integer("days_to_harvest_min"),
    daysToHarvestMax: integer("days_to_harvest_max"),
    timeEstimates: jsonb("time_estimates").$type<CropTimeEstimates>(),
    source: cropSourceEnum("source").notNull(),
    generatedByProvider: text("generated_by_provider"),
    generatedByModel: text("generated_by_model"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("crop_slug_idx").on(table.slug),
    check("crop_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check(
      "crop_variety_null_or_nonblank",
      sql`${table.variety} is null or length(trim(${table.variety})) > 0`,
    ),
    check("crop_slug_not_blank", sql`length(trim(${table.slug})) > 0`),
    check(
      "crop_watering_interval_positive",
      sql`${table.wateringIntervalDays} is null or ${table.wateringIntervalDays} > 0`,
    ),
    check(
      "crop_fertilizing_interval_positive",
      sql`${table.fertilizingIntervalDays} is null or ${table.fertilizingIntervalDays} > 0`,
    ),
    check(
      "crop_harvest_days_positive",
      sql`(
        (${table.daysToHarvestMin} is null or ${table.daysToHarvestMin} > 0)
        and (${table.daysToHarvestMax} is null or ${table.daysToHarvestMax} > 0)
        and (
          ${table.daysToHarvestMin} is null
          or ${table.daysToHarvestMax} is null
          or ${table.daysToHarvestMax} >= ${table.daysToHarvestMin}
        )
      )`,
    ),
    check(
      "crop_plant_window_format",
      sql`(
        ${table.plantWindowStart} is null
        or ${table.plantWindowStart} ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      ) and (
        ${table.plantWindowEnd} is null
        or ${table.plantWindowEnd} ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      )`,
    ),
    check(
      "crop_pruning_object",
      sql`${table.pruning} is null
        or jsonb_typeof(${table.pruning}) = 'object'`,
    ),
    check(
      "crop_time_estimates_object",
      sql`${table.timeEstimates} is null
        or jsonb_typeof(${table.timeEstimates}) = 'object'`,
    ),
  ],
);

export const plantings = pgTable(
  "planting",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    cropId: uuid("crop_id")
      .notNull()
      .references(() => crops.id, { onDelete: "restrict" }),
    cropName: text("crop_name").notNull(),
    variety: text("variety"),
    method: plantingMethodEnum("method").notNull(),
    plantedOn: date("planted_on").notNull(),
    removedOn: date("removed_on"),
    status: plantingStatusEnum("status").default("growing").notNull(),
    harvestWindowStart: date("harvest_window_start"),
    harvestWindowEnd: date("harvest_window_end"),
    harvestConfidence: numeric("harvest_confidence", {
      precision: 4,
      scale: 3,
    }),
    harvestRationale: text("harvest_rationale"),
    harvestEstimatingModel: text("harvest_estimating_model"),
    ...timestamps,
  },
  (table) => [
    index("planting_location_idx").on(table.locationId),
    index("planting_crop_idx").on(table.cropId),
    check(
      "planting_valid_dates",
      sql`${table.removedOn} is null or ${table.removedOn} >= ${table.plantedOn}`,
    ),
    check(
      "planting_harvest_confidence_range",
      sql`${table.harvestConfidence} is null or ${table.harvestConfidence} between 0 and 1`,
    ),
  ],
);

export const actionLogs = pgTable(
  "action_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "restrict",
    }),
    plantingId: uuid("planting_id").references(() => plantings.id, {
      onDelete: "restrict",
    }),
    userId: uuid("user_id").notNull(),
    actionType: actionTypeEnum("action_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    detail: text("detail"),
    voidsId: uuid("voids_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("action_log_location_occurred_idx").on(
      table.locationId,
      table.occurredAt,
    ),
    uniqueIndex("action_log_voids_id_idx").on(table.voidsId),
    foreignKey({
      columns: [table.voidsId],
      foreignColumns: [table.id],
      name: "action_log_voids_id_action_log_id_fk",
    }),
    check(
      "action_log_has_subject",
      sql`${table.locationId} is not null or ${table.plantingId} is not null`,
    ),
  ],
);

export const gardenNotes = pgTable(
  "garden_note",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    note: text("note").notNull(),
    ...timestamps,
  },
  (table) => [
    index("garden_note_garden_created_idx").on(
      table.gardenId,
      table.createdAt,
    ),
    check("garden_note_not_blank", sql`length(trim(${table.note})) > 0`),
  ],
);

export const weatherFetches = pgTable(
  "weather_fetch",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    requestUrl: text("request_url").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    rawResponse: jsonb("raw_response").$type<unknown>(),
    success: boolean("success").notNull(),
    error: text("error"),
  },
  (table) => [
    index("weather_fetch_garden_fetched_idx").on(
      table.gardenId,
      table.fetchedAt,
    ),
    check(
      "weather_fetch_result",
      sql`(${table.success} and ${table.rawResponse} is not null and ${table.error} is null)
        or (not ${table.success} and ${table.error} is not null)`,
    ),
  ],
);

export const weatherDays = pgTable(
  "weather_day",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gardenId: uuid("garden_id")
      .notNull()
      .references(() => gardens.id, { onDelete: "cascade" }),
    weatherFetchId: uuid("weather_fetch_id")
      .notNull()
      .references(() => weatherFetches.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    kind: weatherDayKindEnum("kind").notNull(),
    precipitationMm: numeric("precipitation_mm", {
      precision: 8,
      scale: 3,
    }).notNull(),
    temperatureMinC: numeric("temperature_min_c", {
      precision: 6,
      scale: 2,
    }).notNull(),
    temperatureMaxC: numeric("temperature_max_c", {
      precision: 6,
      scale: 2,
    }).notNull(),
    et0Mm: numeric("et0_mm", { precision: 8, scale: 3 }).notNull(),
    windSpeedMaxKph: numeric("wind_speed_max_kph", {
      precision: 7,
      scale: 2,
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("weather_day_garden_date_kind_idx").on(
      table.gardenId,
      table.date,
      table.kind,
    ),
    index("weather_day_garden_date_idx").on(table.gardenId, table.date),
    check(
      "weather_day_temperature_order",
      sql`${table.temperatureMaxC} >= ${table.temperatureMinC}`,
    ),
    check(
      "weather_day_nonnegative_measurements",
      sql`${table.precipitationMm} >= 0 and ${table.et0Mm} >= 0 and ${table.windSpeedMaxKph} >= 0`,
    ),
  ],
);

export const agentRuns = pgTable(
  "agent_run",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: agentRunKindEnum("kind").notNull(),
    trigger: text("trigger").notNull(),
    status: agentRunStatusEnum("status").default("running").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    userId: uuid("user_id").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    inputTokens: numeric("input_tokens", { precision: 12, scale: 0 })
      .default("0")
      .notNull(),
    outputTokens: numeric("output_tokens", { precision: 12, scale: 0 })
      .default("0")
      .notNull(),
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 12,
      scale: 6,
    })
      .default("0")
      .notNull(),
    toolCalls: jsonb("tool_calls")
      .$type<AgentToolTraceEntry[]>()
      .default([])
      .notNull(),
    weatherFetchId: uuid("weather_fetch_id").references(
      () => weatherFetches.id,
      { onDelete: "set null" },
    ),
    simulatedWeather: jsonb("simulated_weather").$type<unknown>(),
    finalText: text("final_text"),
    error: text("error"),
    stopReason: text("stop_reason"),
    ...timestamps,
  },
  (table) => [
    index("agent_run_started_idx").on(table.startedAt),
    index("agent_run_provider_started_idx").on(table.provider, table.startedAt),
    index("agent_run_user_kind_started_idx").on(
      table.userId,
      table.kind,
      table.startedAt,
    ),
    check(
      "agent_run_nonnegative_tokens",
      sql`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0 and ${table.estimatedCostUsd} >= 0`,
    ),
  ],
);

export const conversations = pgTable(
  "conversation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    kind: conversationKindEnum("kind").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("conversation_user_kind_idx").on(table.userId, table.kind),
    index("conversation_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const messages = pgTable(
  "message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("message_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    check("message_content_not_blank", sql`length(trim(${table.content})) > 0`),
    check(
      "message_agent_run_assistant_only",
      sql`${table.role} = 'assistant' or ${table.agentRunId} is null`,
    ),
  ],
);

export const careRuns = pgTable(
  "care_run",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trigger: careRunTriggerEnum("trigger").notNull(),
    status: careRunStatusEnum("status").default("running").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    weatherFetchId: uuid("weather_fetch_id").references(
      () => weatherFetches.id,
      { onDelete: "set null" },
    ),
    simulatedWeather: jsonb("simulated_weather").$type<unknown>(),
    taskCount: integer("task_count").default(0).notNull(),
    error: text("error"),
    ...timestamps,
  },
  (table) => [
    index("care_run_started_idx").on(table.startedAt),
    check("care_run_nonnegative_task_count", sql`${table.taskCount} >= 0`),
  ],
);

export const recommendations = pgTable(
  "recommendation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    careRunId: uuid("care_run_id").references(() => careRuns.id, {
      onDelete: "restrict",
    }),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, {
      onDelete: "restrict",
    }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
    plantingId: uuid("planting_id").references(() => plantings.id, {
      onDelete: "restrict",
    }),
    cropId: uuid("crop_id").references(() => crops.id, {
      onDelete: "restrict",
    }),
    actionType: actionTypeEnum("action_type").notNull(),
    urgency: recommendationUrgencyEnum("urgency").notNull(),
    headline: text("headline").notNull(),
    rationale: text("rationale").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    evidence: jsonb("evidence").$type<RecommendationEvidence>().notNull(),
    estimatedMinutes: integer("estimated_minutes"),
    status: recommendationStatusEnum("status").default("open").notNull(),
    dueBy: timestamp("due_by", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by"),
    resolvedActionLogId: uuid("resolved_action_log_id").references(
      () => actionLogs.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("recommendation_status_idx").on(table.status),
    index("recommendation_location_status_idx").on(
      table.locationId,
      table.status,
    ),
    index("recommendation_care_run_idx").on(table.careRunId),
    check(
      "recommendation_has_run",
      sql`${table.careRunId} is not null or ${table.agentRunId} is not null`,
    ),
    check(
      "recommendation_confidence_range",
      sql`${table.confidence} is null or ${table.confidence} between 0 and 1`,
    ),
    check(
      "recommendation_estimated_minutes_range",
      sql`${table.estimatedMinutes} is null or ${table.estimatedMinutes} between 1 and 480`,
    ),
    check("recommendation_headline_not_blank", sql`length(trim(${table.headline})) > 0`),
  ],
);

export const currentLocations = pgView("current_location", {
  id: uuid("id"),
  gardenId: uuid("garden_id"),
  kind: locationKindEnum("kind"),
  name: text("name"),
  bedId: uuid("bed_id"),
  seasonId: uuid("season_id"),
  startFt: numeric("start_ft", { precision: 6, scale: 2 }),
  endFt: numeric("end_ft", { precision: 6, scale: 2 }),
  sunExposure: text("sun_exposure"),
  sunExposureSource: sunExposureSourceEnum("sun_exposure_source"),
  sunExposureMix: jsonb("sun_exposure_mix"),
  volumeGal: numeric("volume_gal", { precision: 7, scale: 2 }),
  material: text("material"),
  soilType: text("soil_type"),
  drynessFactor: numeric("dryness_factor", { precision: 5, scale: 2 }),
  notes: text("notes"),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
}).existing();
