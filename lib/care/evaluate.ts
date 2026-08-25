import {
  evaluateFertilizePlanting,
  evaluatePrunePlanting,
  preferCadenceNeed,
  type CadenceNeed,
} from "./cadence";
import { cadenceTask, frostTask, wateringTask } from "./copy";
import {
  evaluateFrostPlanting,
  preferFrostNeed,
  type FrostNeed,
} from "./frost";
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
  const wateringByLocation = new Map<string, WateringNeed>();
  const fertilizeByLocation = new Map<string, CadenceNeed>();
  const pruneByLocation = new Map<string, CadenceNeed>();
  const frostByLocation = new Map<string, FrostNeed>();

  for (const planting of input.plantings) {
    const watering = evaluateWateringPlanting({
      today: input.today,
      planting,
      weatherDays: input.weatherDays,
      log: input.log,
    });
    if (watering) {
      wateringByLocation.set(
        planting.locationId,
        preferWateringNeed(watering, wateringByLocation.get(planting.locationId)),
      );
    }

    const fertilize = evaluateFertilizePlanting({
      today: input.today,
      planting,
      log: input.log,
    });
    if (fertilize) {
      fertilizeByLocation.set(
        planting.locationId,
        preferCadenceNeed(
          fertilize,
          fertilizeByLocation.get(planting.locationId),
        ),
      );
    }

    const prune = evaluatePrunePlanting({
      today: input.today,
      planting,
      log: input.log,
    });
    if (prune) {
      pruneByLocation.set(
        planting.locationId,
        preferCadenceNeed(prune, pruneByLocation.get(planting.locationId)),
      );
    }

    const frost = evaluateFrostPlanting({
      today: input.today,
      planting,
      weatherDays: input.weatherDays,
      log: input.log,
    });
    if (frost) {
      frostByLocation.set(
        planting.locationId,
        preferFrostNeed(frost, frostByLocation.get(planting.locationId)),
      );
    }
  }

  return [
    ...[...wateringByLocation.values()].map((need) =>
      wateringTask(need, input.today, input.timeZone),
    ),
    ...[...fertilizeByLocation.values()].map((need) =>
      cadenceTask(need, input.today, input.timeZone),
    ),
    ...[...pruneByLocation.values()].map((need) =>
      cadenceTask(need, input.today, input.timeZone),
    ),
    ...[...frostByLocation.values()].map((need) =>
      frostTask(need, input.today, input.timeZone),
    ),
  ];
}

export type {
  CareLogEvent,
  CarePlantingInput,
  CareWeatherDay,
} from "./watering";
