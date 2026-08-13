import "server-only";

import { asc, count, eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { crops, plantings } from "@/lib/db/schema";

import { cropSlug } from "./slug";
import type {
  CropListItem,
  CropPruning,
  CropRecord,
  CropSource,
  CropTimeEstimates,
} from "./types";
import type { CropEditInput } from "./validation";

function asInteger(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function asPruning(value: CropPruning | null): CropPruning | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (value.needed === false) {
    return { needed: false };
  }
  if (value.needed === true) {
    return {
      needed: true,
      intervalDays: asInteger(value.intervalDays),
      notes: value.notes ?? null,
    };
  }
  return null;
}

function toCropRecord(row: {
  id: string;
  name: string;
  slug: string;
  wateringIntervalDays: number | null;
  fertilizingIntervalDays: number | null;
  pruning: CropPruning | null;
  frostSensitive: boolean | null;
  sunPreference: "full_sun" | "part_sun" | "part_shade" | "full_shade" | null;
  plantWindowStart: string | null;
  plantWindowEnd: string | null;
  daysToHarvestMin: number | null;
  daysToHarvestMax: number | null;
  timeEstimates: CropTimeEstimates | null;
  source: CropSource;
  generatedByProvider: string | null;
  generatedByModel: string | null;
  notes: string | null;
}): CropRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    wateringIntervalDays: asInteger(row.wateringIntervalDays),
    fertilizingIntervalDays: asInteger(row.fertilizingIntervalDays),
    pruning: asPruning(row.pruning),
    frostSensitive: row.frostSensitive,
    sunPreference: row.sunPreference,
    plantWindowStart: row.plantWindowStart,
    plantWindowEnd: row.plantWindowEnd,
    daysToHarvestMin: asInteger(row.daysToHarvestMin),
    daysToHarvestMax: asInteger(row.daysToHarvestMax),
    timeEstimates: row.timeEstimates,
    source: row.source,
    generatedByProvider: row.generatedByProvider,
    generatedByModel: row.generatedByModel,
    notes: row.notes,
  };
}

export async function listCropRecords(): Promise<CropListItem[]> {
  const database = getDatabase();
  const rows = await database
    .select({
      id: crops.id,
      name: crops.name,
      slug: crops.slug,
      source: crops.source,
      wateringIntervalDays: crops.wateringIntervalDays,
      plantingCount: count(plantings.id),
    })
    .from(crops)
    .leftJoin(plantings, eq(plantings.cropId, crops.id))
    .groupBy(crops.id)
    .orderBy(asc(crops.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    source: row.source,
    wateringIntervalDays: asInteger(row.wateringIntervalDays),
    plantingCount: Number(row.plantingCount),
  }));
}

export async function getCropRecord(id: string): Promise<CropRecord | null> {
  const database = getDatabase();
  const [row] = await database
    .select()
    .from(crops)
    .where(eq(crops.id, id))
    .limit(1);

  return row ? toCropRecord(row) : null;
}

export async function resolveOrCreateStubCrop(name: string) {
  const database = getDatabase();
  const slug = cropSlug(name);
  const displayName = name.trim();

  const [existing] = await database
    .select()
    .from(crops)
    .where(eq(crops.slug, slug))
    .limit(1);

  if (existing) {
    return toCropRecord(existing);
  }

  await database
    .insert(crops)
    .values({
      name: displayName,
      slug,
      source: "stub",
    })
    .onConflictDoNothing();

  const [resolved] = await database
    .select()
    .from(crops)
    .where(eq(crops.slug, slug))
    .limit(1);

  if (!resolved) {
    throw new Error("The crop row could not be created.");
  }

  return toCropRecord(resolved);
}

export async function saveCropRecord(input: CropEditInput) {
  const database = getDatabase();
  const updated = await database
    .update(crops)
    .set({
      name: input.name,
      wateringIntervalDays: input.wateringIntervalDays,
      fertilizingIntervalDays: input.fertilizingIntervalDays,
      pruning: input.pruning,
      frostSensitive: input.frostSensitive,
      sunPreference: input.sunPreference,
      plantWindowStart: input.plantWindowStart,
      plantWindowEnd: input.plantWindowEnd,
      daysToHarvestMin: input.daysToHarvestMin,
      daysToHarvestMax: input.daysToHarvestMax,
      timeEstimates: input.timeEstimates,
      notes: input.notes,
      source: "edited",
      updatedAt: new Date(),
    })
    .where(eq(crops.id, input.id))
    .returning({ id: crops.id });

  if (updated.length === 0) {
    throw new Error("Crop not found.");
  }
}
