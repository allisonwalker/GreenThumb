import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { DuplicateCropError } from "@/lib/crops/identity";
import {
  createStubCropRecord,
  resolveCrop,
} from "@/lib/crops/repository";
import type { CropRecord } from "@/lib/crops/types";
import { getDatabase } from "@/lib/db/client";
import {
  currentLocations,
  gardens,
  locations,
  plantings,
} from "@/lib/db/schema";
import { daysBetween, localDateString } from "@/lib/garden/local-date";

import type {
  AddPlantingInput,
  RemovePlantingInput,
} from "./planting-validation";

export type LocationKind = "bed_section" | "pot";

export type CurrentLocationSummary = {
  id: string;
  name: string;
  kind: LocationKind;
  detail: string;
};

export type PlantingRecord = {
  id: string;
  cropId: string;
  cropName: string;
  variety: string | null;
  method: "seed" | "transplant";
  plantedOn: string;
  removedOn: string | null;
  status: string;
  daysSincePlanted: number;
};

export type LocationPlantingsPage = {
  location: {
    id: string;
    name: string;
    kind: LocationKind;
    detail: string;
    isCurrent: boolean;
  };
  timezone: string;
  todayLocal: string;
  currentPlantings: PlantingRecord[];
  pastPlantings: PlantingRecord[];
};

function locationDetail(row: {
  kind: LocationKind;
  startFt: string | null;
  endFt: string | null;
  sunExposure: string;
  volumeGal: string | null;
}): string {
  if (row.kind === "bed_section") {
    return `${Number(row.startFt)}–${Number(row.endFt)} ft · ${row.sunExposure.replaceAll("_", " ")}`;
  }
  const gallons = row.volumeGal ? `${Number(row.volumeGal)} gal` : "pot";
  return `${gallons} · ${row.sunExposure.replaceAll("_", " ")}`;
}

function toPlantingRecord(
  row: {
    id: string;
    cropId: string;
    cropName: string;
    variety: string | null;
    method: "seed" | "transplant";
    plantedOn: string;
    removedOn: string | null;
    status: string;
  },
  todayLocal: string,
): PlantingRecord {
  return {
    id: row.id,
    cropId: row.cropId,
    cropName: row.cropName,
    variety: row.variety,
    method: row.method,
    plantedOn: row.plantedOn,
    removedOn: row.removedOn,
    status: row.status,
    daysSincePlanted: daysBetween(row.plantedOn, todayLocal),
  };
}

export async function listCurrentLocations(): Promise<CurrentLocationSummary[]> {
  const database = getDatabase();
  const rows = await database
    .select({
      id: currentLocations.id,
      name: currentLocations.name,
      kind: currentLocations.kind,
      startFt: currentLocations.startFt,
      endFt: currentLocations.endFt,
      sunExposure: currentLocations.sunExposure,
      volumeGal: currentLocations.volumeGal,
    })
    .from(currentLocations)
    .orderBy(asc(currentLocations.kind), asc(currentLocations.name));

  return rows
    .filter(
      (row): row is typeof row & {
        id: string;
        name: string;
        kind: LocationKind;
        sunExposure: string;
      } => Boolean(row.id && row.name && row.kind && row.sunExposure),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      detail: locationDetail(row),
    }));
}

export async function getLocationPlantingsPage(
  locationId: string,
  now: Date = new Date(),
): Promise<LocationPlantingsPage | null> {
  const database = getDatabase();

  const [location] = await database
    .select({
      id: locations.id,
      name: locations.name,
      kind: locations.kind,
      startFt: locations.startFt,
      endFt: locations.endFt,
      sunExposure: locations.sunExposure,
      volumeGal: locations.volumeGal,
      retiredAt: locations.retiredAt,
      gardenId: locations.gardenId,
    })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1);

  if (!location) {
    return null;
  }

  const [garden] = await database
    .select({ timezone: gardens.timezone })
    .from(gardens)
    .where(eq(gardens.id, location.gardenId))
    .limit(1);

  if (!garden) {
    return null;
  }

  const [currentRow] = await database
    .select({ id: currentLocations.id })
    .from(currentLocations)
    .where(eq(currentLocations.id, locationId))
    .limit(1);

  const todayLocal = localDateString(now, garden.timezone);
  const rows = await database
    .select({
      id: plantings.id,
      cropId: plantings.cropId,
      cropName: plantings.cropName,
      variety: plantings.variety,
      method: plantings.method,
      plantedOn: plantings.plantedOn,
      removedOn: plantings.removedOn,
      status: plantings.status,
    })
    .from(plantings)
    .where(eq(plantings.locationId, locationId))
    .orderBy(desc(plantings.plantedOn), asc(plantings.cropName));

  const records = rows.map((row) => toPlantingRecord(row, todayLocal));

  return {
    location: {
      id: location.id,
      name: location.name,
      kind: location.kind,
      detail: locationDetail(location),
      isCurrent: Boolean(currentRow) && location.retiredAt === null,
    },
    timezone: garden.timezone,
    todayLocal,
    currentPlantings: records.filter((row) => row.removedOn === null),
    pastPlantings: records.filter((row) => row.removedOn !== null),
  };
}

export async function addPlantingRecord(input: AddPlantingInput) {
  const database = getDatabase();

  const [current] = await database
    .select({ id: currentLocations.id })
    .from(currentLocations)
    .where(eq(currentLocations.id, input.locationId))
    .limit(1);

  if (!current) {
    throw new Error(
      "Plantings can only be added to a current pot or bed section.",
    );
  }

  const { crop, created: cropWasCreated } = await resolveOrCreateCropForPlanting(
    input.cropName,
    input.variety,
  );

  if (!crop?.id) {
    throw new Error(
      "Could not resolve or create a catalog crop for this planting.",
    );
  }

  await database.insert(plantings).values({
    locationId: input.locationId,
    cropId: crop.id,
    cropName: crop.name,
    variety: crop.variety,
    method: input.method,
    plantedOn: input.plantedOn,
    status: "growing",
  });

  return { crop, created: cropWasCreated };
}

async function resolveOrCreateCropForPlanting(
  name: string,
  variety: string | null,
): Promise<{ crop: CropRecord; created: boolean }> {
  const existing = await resolveCrop(name, variety);
  if (existing?.id) {
    return { crop: existing, created: false };
  }

  try {
    const cropRecord = await createStubCropRecord(name, variety);
    if (!cropRecord?.id) {
      throw new Error("The crop row could not be created.");
    }
    return { crop: cropRecord, created: true };
  } catch (error) {
    if (error instanceof DuplicateCropError) {
      const raced = await resolveCrop(name, variety);
      if (raced?.id) {
        return { crop: raced, created: false };
      }
    }
    throw error;
  }
}

export async function removePlantingRecord(input: RemovePlantingInput) {
  const database = getDatabase();

  const [existing] = await database
    .select({
      id: plantings.id,
      plantedOn: plantings.plantedOn,
      removedOn: plantings.removedOn,
      locationId: plantings.locationId,
    })
    .from(plantings)
    .where(
      and(
        eq(plantings.id, input.plantingId),
        eq(plantings.locationId, input.locationId),
        isNull(plantings.removedOn),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error("Active planting not found.");
  }

  if (input.removedOn < existing.plantedOn) {
    throw new Error("Removal date must be on or after the planted date.");
  }

  const updated = await database
    .update(plantings)
    .set({
      removedOn: input.removedOn,
      status: "removed",
      updatedAt: new Date(),
    })
    .where(eq(plantings.id, existing.id))
    .returning({ id: plantings.id });

  if (updated.length === 0) {
    throw new Error("Active planting not found.");
  }
}
