import { wateringTask } from "./copy";
import type { MatchingTaskInput } from "./types";
import {
  evaluateWateringPlanting,
  preferWateringNeed,
  type CareLogEvent,
  type CarePlantingInput,
  type CareWeatherDay,
  type WateringNeed,
} from "./watering";

export type EvaluateCareListInput = {
  today: string;
  timeZone: string;
  plantings: CarePlantingInput[];
  weatherDays: CareWeatherDay[];
  log: CareLogEvent[];
};

export function evaluateCareList(
  input: EvaluateCareListInput,
): MatchingTaskInput[] {
  const byLocation = new Map<string, WateringNeed>();

  for (const planting of input.plantings) {
    const need = evaluateWateringPlanting({
      today: input.today,
      planting,
      weatherDays: input.weatherDays,
      log: input.log,
    });
    if (!need) {
      continue;
    }
    byLocation.set(
      planting.locationId,
      preferWateringNeed(need, byLocation.get(planting.locationId)),
    );
  }

  return [...byLocation.values()].map((need) =>
    wateringTask(need, input.today, input.timeZone),
  );
}

export type {
  CareLogEvent,
  CarePlantingInput,
  CareWeatherDay,
} from "./watering";
