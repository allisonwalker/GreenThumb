import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
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

export const appMetadata = pgTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const gardens = pgTable(
  "garden",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    singletonKey: boolean("singleton_key").default(true).notNull(),
    name: text("name").default("GreenThumb Garden").notNull(),
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

export const plantings = pgTable(
  "planting",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict" }),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("action_log_location_occurred_idx").on(
      table.locationId,
      table.occurredAt,
    ),
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
