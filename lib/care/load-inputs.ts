import "server-only";

import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import {
  actionLogs,
  crops,
  currentLocations,
  gardens,
  plantings,
} from "@/lib/db/schema";
import { localDateString } from "@/lib/garden/local-date";
import { readWeatherCache, refreshWeatherCache } from "@/lib/weather";

import type { EvaluateCareListInput } from "./evaluate";
import type { CareLogEvent, CarePlantingInput } from "./watering";

export type CareMatchingSnapshot = EvaluateCareListInput & {
  weatherFetchId: string | null;
};

const CARE_LOG_ACTIONS = [
  "watered",
  "fertilized",
  "pruned",
  "treated",
  "observed",
] as const;

export async function loadCareMatchingSnapshot(
  asOf: Date = new Date(),
): Promise<CareMatchingSnapshot | null> {
  const database = getDatabase();
  const [garden] = await database
    .select({
      id: gardens.id,
      timezone: gardens.timezone,
    })
    .from(gardens)
    .limit(1);

  if (!garden) {
    return null;
  }

  const today = localDateString(asOf, garden.timezone);
  const weather = await loadWeather(asOf);
  const plantingRows = await database
    .select({
      plantingId: plantings.id,
      plantedOn: plantings.plantedOn,
      locationId: currentLocations.id,
      locationName: currentLocations.name,
      drynessFactor: currentLocations.drynessFactor,
      cropId: crops.id,
      cropName: crops.name,
      variety: crops.variety,
      wateringIntervalDays: crops.wateringIntervalDays,
      fertilizingIntervalDays: crops.fertilizingIntervalDays,
      pruning: crops.pruning,
      frostSensitive: crops.frostSensitive,
      sunPreference: crops.sunPreference,
      timeEstimates: crops.timeEstimates,
      locationSunExposure: currentLocations.sunExposure,
    })
    .from(plantings)
    .innerJoin(currentLocations, eq(plantings.locationId, currentLocations.id))
    .innerJoin(crops, eq(plantings.cropId, crops.id))
    .where(
      and(isNull(plantings.removedOn), eq(plantings.status, "growing")),
    );

  const matchedPlantings: CarePlantingInput[] = plantingRows.flatMap((row) => {
    if (!row.locationId || !row.locationName || row.drynessFactor == null) {
      return [];
    }
    if (!row.locationSunExposure) {
      return [];
    }
    return [
      {
        plantingId: row.plantingId,
        locationId: row.locationId,
        locationName: row.locationName,
        drynessFactor: Number(row.drynessFactor),
        cropId: row.cropId,
        cropName: row.cropName,
        variety: row.variety,
        wateringIntervalDays: row.wateringIntervalDays,
        fertilizingIntervalDays: row.fertilizingIntervalDays,
        pruning: row.pruning,
        frostSensitive: row.frostSensitive,
        sunPreference: row.sunPreference,
        locationSunExposure: row.locationSunExposure,
        estimatedMinutes: minutesFor(row.timeEstimates, "watered"),
        fertilizeMinutes: minutesFor(row.timeEstimates, "fertilized"),
        pruneMinutes: minutesFor(row.timeEstimates, "pruned"),
        frostMinutes:
          minutesFor(row.timeEstimates, "treated") ??
          minutesFor(row.timeEstimates, "observed"),
        plantedOn: row.plantedOn,
      },
    ];
  });

  const locationIds = [
    ...new Set(matchedPlantings.map((row) => row.locationId)),
  ];
  const plantingIds = matchedPlantings.map((row) => row.plantingId);
  const log = await loadCareLog(
    database,
    locationIds,
    plantingIds,
    garden.timezone,
  );

  return {
    today,
    timeZone: garden.timezone,
    plantings: matchedPlantings,
    weatherDays: weather.days.map((day) => ({
      date: day.date,
      precipitationMm: day.precipitationMm,
      et0Mm: day.et0Mm,
      temperatureMinC: day.temperatureMinC,
    })),
    log,
    weatherFetchId: weather.days[0]?.weatherFetchId ?? null,
  };
}

async function loadWeather(asOf: Date) {
  const cached = await readWeatherCache({ now: asOf });
  if (!cached.isStale) {
    return cached;
  }
  return refreshWeatherCache({ now: asOf });
}

async function loadCareLog(
  database: ReturnType<typeof getDatabase>,
  locationIds: string[],
  plantingIds: string[],
  timeZone: string,
): Promise<CareLogEvent[]> {
  if (locationIds.length === 0 && plantingIds.length === 0) {
    return [];
  }

  const subject =
    locationIds.length > 0 && plantingIds.length > 0
      ? or(
          inArray(actionLogs.locationId, locationIds),
          inArray(actionLogs.plantingId, plantingIds),
        )
      : locationIds.length > 0
        ? inArray(actionLogs.locationId, locationIds)
        : inArray(actionLogs.plantingId, plantingIds);

  const rows = await database
    .select({
      plantingId: actionLogs.plantingId,
      locationId: actionLogs.locationId,
      actionType: actionLogs.actionType,
      occurredAt: actionLogs.occurredAt,
    })
    .from(actionLogs)
    .where(and(inArray(actionLogs.actionType, [...CARE_LOG_ACTIONS]), subject));

  return rows.map((row) => ({
    plantingId: row.plantingId,
    locationId: row.locationId,
    actionType: row.actionType,
    occurredOn: localDateString(row.occurredAt, timeZone),
  }));
}

function minutesFor(
  estimates: Record<string, number | undefined> | null,
  action: string,
): number | null {
  const minutes = estimates?.[action];
  return typeof minutes === "number" && minutes > 0 ? minutes : null;
}
