import type { CropPruning } from "@/lib/crops/types";
import { addCalendarDays, daysBetween } from "@/lib/garden/local-date";

import { RECOMMENDATION_URGENCIES } from "./types";
import type { RecommendationUrgency } from "./types";

/** Typical daily ET₀ (mm). Converts catalog days and rain into the same unit. */
export const TYPICAL_ET0_MM_PER_DAY = 4;

export const MM_PER_INCH = 25.4;

/** Garden-local today and tomorrow. */
export const UPCOMING_RAIN_DAYS = 2;

/** Enough forecast rain to skip watering today. */
export const SKIP_RAIN_INCHES = 0.25;

/** Some rain, not enough to skip: still due, but not today. */
export const DOWNGRADE_RAIN_INCHES = 0.1;

const WEEK_DAYS = 7;

export type CareWeatherDay = {
  date: string;
  precipitationMm: number;
  et0Mm: number;
  temperatureMinC: number;
};

export type CareLogEvent = {
  plantingId: string | null;
  locationId: string | null;
  actionType: string;
  occurredOn: string;
};

export type CarePlantingInput = {
  plantingId: string;
  locationId: string;
  locationName: string;
  drynessFactor: number;
  cropId: string;
  cropName: string;
  variety: string | null;
  wateringIntervalDays: number | null;
  fertilizingIntervalDays: number | null;
  pruning: CropPruning | null;
  frostSensitive: boolean | null;
  estimatedMinutes: number | null;
  fertilizeMinutes: number | null;
  pruneMinutes: number | null;
  frostMinutes: number | null;
  sunPreference: "full_sun" | "part_sun" | "part_shade" | "full_shade" | null;
  locationSunExposure: string;
  plantedOn: string;
};

export type WateringNeed = {
  planting: CarePlantingInput;
  lastWateredOn: string;
  lastWateredSource: "action_log" | "planted_on";
  daysSince: number;
  upcomingRainMm: number;
  weekRainMm: number;
  et0Mm: number;
  netDays: number;
  urgency: RecommendationUrgency;
};

export function formatInchesFromMm(mm: number): string {
  const inches = mm / MM_PER_INCH;
  const hundredths = Math.round(inches * 100) / 100;
  const tenth = Math.round(hundredths * 10) / 10;
  const text =
    Math.abs(hundredths - tenth) < 0.001
      ? hundredths.toFixed(1)
      : hundredths.toFixed(2);
  return `${text}"`;
}

export function evaluateWateringPlanting(input: {
  today: string;
  planting: CarePlantingInput;
  weatherDays: CareWeatherDay[];
  log: CareLogEvent[];
}): WateringNeed | null {
  const interval = input.planting.wateringIntervalDays;
  if (interval == null || interval <= 0) {
    return null;
  }
  if (input.planting.drynessFactor <= 0) {
    return null;
  }
  if (daysBetween(input.planting.plantedOn, input.today) < 0) {
    return null;
  }

  const last = lastCareAction(input.planting, input.log, "watered");
  const daysSince = daysBetween(last.occurredOn, input.today);
  if (daysSince < 0) {
    return null;
  }

  const weatherByDate = weatherByDateMap(input.weatherDays);
  const sinceLast = datesAfter(last.occurredOn, input.today).map(
    (date) => weatherByDate.get(date),
  );
  const observedSinceLast = sinceLast.filter(
    (day): day is CareWeatherDay => day !== undefined,
  );
  const precipSinceMm = sum(observedSinceLast.map((day) => day.precipitationMm));
  const et0Mm = sum(observedSinceLast.map((day) => day.et0Mm));
  const et0Scale = et0ScaleFromWindow(observedSinceLast);
  const demandDays = daysSince * input.planting.drynessFactor * et0Scale;
  const creditDays = precipSinceMm / TYPICAL_ET0_MM_PER_DAY;
  const netDays = demandDays - creditDays;

  if (netDays + 1e-9 < interval) {
    return null;
  }

  const upcomingRainMm = sum(
    datesFrom(input.today, UPCOMING_RAIN_DAYS).map(
      (date) => weatherByDate.get(date)?.precipitationMm ?? 0,
    ),
  );
  const weekRainMm = sum(
    datesFrom(addCalendarDays(input.today, -(WEEK_DAYS - 1)), WEEK_DAYS).map(
      (date) => weatherByDate.get(date)?.precipitationMm ?? 0,
    ),
  );
  const upcomingInches = upcomingRainMm / MM_PER_INCH;
  const urgency = urgencyForRain(upcomingInches, netDays, interval);

  return {
    planting: input.planting,
    lastWateredOn: last.occurredOn,
    lastWateredSource: last.source,
    daysSince,
    upcomingRainMm,
    weekRainMm,
    et0Mm,
    netDays,
    urgency,
  };
}

export function preferWateringNeed(
  candidate: WateringNeed,
  current: WateringNeed | undefined,
): WateringNeed {
  if (!current) {
    return candidate;
  }
  const candidateRank = RECOMMENDATION_URGENCIES.indexOf(candidate.urgency);
  const currentRank = RECOMMENDATION_URGENCIES.indexOf(current.urgency);
  if (candidateRank !== currentRank) {
    return candidateRank < currentRank ? candidate : current;
  }
  return candidate.netDays > current.netDays ? candidate : current;
}

export function lastCareAction(
  planting: CarePlantingInput,
  log: CareLogEvent[],
  actionType: string,
): { occurredOn: string; source: "action_log" | "planted_on" } {
  let latest: string | null = null;
  for (const event of log) {
    if (event.actionType !== actionType) {
      continue;
    }
    const samePlanting = event.plantingId === planting.plantingId;
    const sameLocation = event.locationId === planting.locationId;
    if (!samePlanting && !sameLocation) {
      continue;
    }
    if (!latest || event.occurredOn > latest) {
      latest = event.occurredOn;
    }
  }
  if (latest) {
    return { occurredOn: latest, source: "action_log" };
  }
  return { occurredOn: planting.plantedOn, source: "planted_on" };
}

export function weatherByDateMap(days: CareWeatherDay[]) {
  const map = new Map<string, CareWeatherDay>();
  for (const day of days) {
    map.set(day.date, day);
  }
  return map;
}

function et0ScaleFromWindow(days: CareWeatherDay[]): number {
  if (days.length === 0) {
    return 1;
  }
  const average = sum(days.map((day) => day.et0Mm)) / days.length;
  return average / TYPICAL_ET0_MM_PER_DAY;
}

function urgencyForRain(
  upcomingInches: number,
  netDays: number,
  interval: number,
): RecommendationUrgency {
  if (upcomingInches + 1e-9 >= SKIP_RAIN_INCHES) {
    return "monitor";
  }
  if (upcomingInches + 1e-9 >= DOWNGRADE_RAIN_INCHES) {
    return "this_week";
  }
  if (netDays + 1e-9 >= interval * 2) {
    return "now";
  }
  return "today";
}

function datesAfter(startDate: string, endDate: string): string[] {
  return datesFrom(addCalendarDays(startDate, 1), daysBetween(startDate, endDate));
}

function datesFrom(startDate: string, count: number): string[] {
  if (count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, index) =>
    addCalendarDays(startDate, index),
  );
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
