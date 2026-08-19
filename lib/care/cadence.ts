import { daysBetween } from "@/lib/garden/local-date";

import { RECOMMENDATION_URGENCIES } from "./types";
import type { RecommendationUrgency } from "./types";
import {
  lastCareAction,
  type CareLogEvent,
  type CarePlantingInput,
} from "./watering";

export type CadenceAction = "fertilized" | "pruned";

export type CadenceNeed = {
  planting: CarePlantingInput;
  actionType: CadenceAction;
  lastOn: string;
  lastSource: "action_log" | "planted_on";
  daysSince: number;
  intervalDays: number;
  urgency: RecommendationUrgency;
};

export function evaluateFertilizePlanting(input: {
  today: string;
  planting: CarePlantingInput;
  log: CareLogEvent[];
}): CadenceNeed | null {
  const interval = input.planting.fertilizingIntervalDays;
  if (interval == null || interval <= 0) {
    return null;
  }
  return evaluateInterval({
    today: input.today,
    planting: input.planting,
    log: input.log,
    actionType: "fertilized",
    interval,
  });
}

export function evaluatePrunePlanting(input: {
  today: string;
  planting: CarePlantingInput;
  log: CareLogEvent[];
}): CadenceNeed | null {
  const pruning = input.planting.pruning;
  if (!pruning || !pruning.needed) {
    return null;
  }
  const interval = pruning.intervalDays;
  if (interval == null || interval <= 0) {
    return null;
  }
  return evaluateInterval({
    today: input.today,
    planting: input.planting,
    log: input.log,
    actionType: "pruned",
    interval,
  });
}

export function preferCadenceNeed(
  candidate: CadenceNeed,
  current: CadenceNeed | undefined,
): CadenceNeed {
  if (!current) {
    return candidate;
  }
  const candidateRank = RECOMMENDATION_URGENCIES.indexOf(candidate.urgency);
  const currentRank = RECOMMENDATION_URGENCIES.indexOf(current.urgency);
  if (candidateRank !== currentRank) {
    return candidateRank < currentRank ? candidate : current;
  }
  return candidate.daysSince > current.daysSince ? candidate : current;
}

function evaluateInterval(input: {
  today: string;
  planting: CarePlantingInput;
  log: CareLogEvent[];
  actionType: CadenceAction;
  interval: number;
}): CadenceNeed | null {
  if (daysBetween(input.planting.plantedOn, input.today) < 0) {
    return null;
  }

  const last = lastCareAction(input.planting, input.log, input.actionType);
  const daysSince = daysBetween(last.occurredOn, input.today);
  if (daysSince < 0 || daysSince + 1e-9 < input.interval) {
    return null;
  }

  return {
    planting: input.planting,
    actionType: input.actionType,
    lastOn: last.occurredOn,
    lastSource: last.source,
    daysSince,
    intervalDays: input.interval,
    urgency: daysSince + 1e-9 >= input.interval * 2 ? "now" : "today",
  };
}
