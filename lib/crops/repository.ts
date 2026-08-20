import "server-only";

import { asc, count, eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { crops, plantings } from "@/lib/db/schema";

import { DuplicateCropError } from "./identity";
import { catalogSlug, normalizeVariety } from "./slug";
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
  variety: string | null;
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
    variety: row.variety,
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

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code: unknown }).code === "23505"
    ) {
      return true;
    }
    if (typeof current !== "object" || current === null || !("cause" in current)) {
      return false;
    }
    current = (current as { cause: unknown }).cause;
  }
  return false;
}

async function getCropBySlug(slug: string): Promise<CropRecord | null> {
  const database = getDatabase();
  const [row] = await database
    .select()
    .from(crops)
    .where(eq(crops.slug, slug))
    .limit(1);
  return row ? toCropRecord(row) : null;
}

export async function listCropRecords(): Promise<CropListItem[]> {
  const database = getDatabase();
  const rows = await database
    .select({
      id: crops.id,
      name: crops.name,
      variety: crops.variety,
      slug: crops.slug,
      source: crops.source,
      wateringIntervalDays: crops.wateringIntervalDays,
      plantingCount: count(plantings.id),
    })
    .from(crops)
    .leftJoin(plantings, eq(plantings.cropId, crops.id))
    .groupBy(crops.id)
    .orderBy(asc(crops.name), asc(crops.variety));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    variety: row.variety,
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

export async function resolveCrop(
  name: string,
  variety: string | null,
): Promise<CropRecord | null> {
  const slug = catalogSlug(name, normalizeVariety(variety));
  return getCropBySlug(slug);
}

export async function createStubCropRecord(
  name: string,
  variety: string | null,
): Promise<CropRecord> {
  const displayName = name.trim();
  const normalizedVariety = normalizeVariety(variety);
  const slug = catalogSlug(displayName, normalizedVariety);

  const existing = await getCropBySlug(slug);
  if (existing) {
    throw new DuplicateCropError(existing);
  }

  const database = getDatabase();
  try {
    const [inserted] = await database
      .insert(crops)
      .values({
        name: displayName,
        variety: normalizedVariety,
        slug,
        source: "stub",
      })
      .returning();

    if (!inserted) {
      throw new Error("The crop row could not be created.");
    }

    return toCropRecord(inserted);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const collided = await getCropBySlug(slug);
      if (collided) {
        throw new DuplicateCropError(collided);
      }
    }
    throw error;
  }
}

export async function resolveCropForPlanting(
  name: string,
  variety: string | null,
): Promise<CropRecord> {
  const existing = await resolveCrop(name, variety);
  if (existing) {
    return existing;
  }

  try {
    return await createStubCropRecord(name, variety);
  } catch (error) {
    if (error instanceof DuplicateCropError) {
      const raced = await resolveCrop(name, variety);
      if (raced) {
        return raced;
      }
    }
    throw error;
  }
}

export async function saveCropRecord(input: CropEditInput) {
  const variety = normalizeVariety(input.variety);
  const slug = catalogSlug(input.name, variety);
  const owner = await getCropBySlug(slug);
  if (owner && owner.id !== input.id) {
    throw new DuplicateCropError(owner);
  }

  const database = getDatabase();
  try {
    await database.transaction(async (tx) => {
      const updated = await tx
        .update(crops)
        .set({
          name: input.name,
          variety,
          slug,
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

      await tx
        .update(plantings)
        .set({
          cropName: input.name,
          variety,
        })
        .where(eq(plantings.cropId, input.id));
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const collided = await getCropBySlug(slug);
      if (collided && collided.id !== input.id) {
        throw new DuplicateCropError(collided);
      }
    }
    throw error;
  }
}
