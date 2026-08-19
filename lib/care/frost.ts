import { addCalendarDays } from "@/lib/garden/local-date";

import { RECOMMENDATION_URGENCIES } from "./types";
import type { RecommendationUrgency } from "./types";
import {
  weatherByDateMap,
  type CareLogEvent,
  type CarePlantingInput,
  type CareWeatherDay,
} from "./watering";

/** Forecast min at or below this (°C) is frost for matching. */
export const FROST_THRESHOLD_C = 0;

export type FrostNeed = {
  planting: CarePlantingInput;
  tonightMinC: number;
  thresholdC: number;
  urgency: Extract<RecommendationUrgency, "now" | "today">;
};

export function evaluateFrostPlanting(input: {
  today: string;
  planting: CarePlantingInput;
  weatherDays: CareWeatherDay[];
  log: CareLogEvent[];
}): FrostNeed | null {
  if (input.planting.frostSensitive !== true) {
    return null;
  }
  if (alreadyCovered(input.planting, input.log, input.today)) {
    return null;
  }

  const byDate = weatherByDateMap(input.weatherDays);
  const tonight = byDate.get(input.today);
  if (!tonight) {
    return null;
  }
  const tomorrow = byDate.get(addCalendarDays(input.today, 1));
  const tonightMinC = tonight.temperatureMinC;
  const tomorrowMinC = tomorrow?.temperatureMinC;

  if (tonightMinC <= FROST_THRESHOLD_C) {
    return {
      planting: input.planting,
      tonightMinC,
      thresholdC: FROST_THRESHOLD_C,
      urgency: "now",
    };
  }
  if (tomorrowMinC != null && tomorrowMinC <= FROST_THRESHOLD_C) {
    return {
      planting: input.planting,
      tonightMinC: tomorrowMinC,
      thresholdC: FROST_THRESHOLD_C,
      urgency: "today",
    };
  }
  return null;
}

export function preferFrostNeed(
  candidate: FrostNeed,
  current: FrostNeed | undefined,
): FrostNeed {
  if (!current) {
    return candidate;
  }
  const candidateRank = RECOMMENDATION_URGENCIES.indexOf(candidate.urgency);
  const currentRank = RECOMMENDATION_URGENCIES.indexOf(current.urgency);
  if (candidateRank !== currentRank) {
    return candidateRank < currentRank ? candidate : current;
  }
  return candidate.tonightMinC < current.tonightMinC ? candidate : current;
}

function alreadyCovered(
  planting: CarePlantingInput,
  log: CareLogEvent[],
  today: string,
): boolean {
  return log.some((event) => {
    if (event.occurredOn !== today) {
      return false;
    }
    if (event.actionType !== "treated" && event.actionType !== "observed") {
      return false;
    }
    return (
      event.plantingId === planting.plantingId ||
      event.locationId === planting.locationId
    );
  });
}
