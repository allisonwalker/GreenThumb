import { localDateString } from "@/lib/garden/local-date";

import type {
  ExistingRecommendation,
  MatchingTaskInput,
  OpenCareRecommendation,
} from "./types";
import { RECOMMENDATION_URGENCIES } from "./types";

export function taskKey(locationId: string, actionType: string) {
  return `${locationId}:${actionType}`;
}

export function planCarePersist(input: {
  existing: ExistingRecommendation[];
  tasks: MatchingTaskInput[];
  asOf: Date;
  timeZone: string;
}): {
  expireIds: string[];
  supersedeIds: string[];
  inserts: MatchingTaskInput[];
} {
  const today = localDateString(input.asOf, input.timeZone);
  const expireIds = input.existing
    .filter(
      (row) =>
        row.status === "open" &&
        row.dueBy !== null &&
        localDateString(row.dueBy, input.timeZone) < today,
    )
    .map((row) => row.id);
  const expired = new Set(expireIds);

  const live = input.existing.filter(
    (row) =>
      !expired.has(row.id) &&
      row.status !== "superseded" &&
      row.status !== "expired",
  );
  const latest = new Map<string, ExistingRecommendation>();
  const chronological = [...live].sort(
    (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime(),
  );
  for (const row of chronological) {
    latest.set(taskKey(row.locationId, row.actionType), row);
  }

  const supersedeIds: string[] = [];
  const inserts: MatchingTaskInput[] = [];

  for (const task of input.tasks) {
    const previous = latest.get(taskKey(task.locationId, task.actionType));
    if (!previous) {
      inserts.push(task);
      continue;
    }
    if (previous.status === "open") {
      supersedeIds.push(previous.id);
      inserts.push(task);
      continue;
    }
    if (
      (previous.status === "done" || previous.status === "dismissed") &&
      shouldSkipRestate(previous, today, input.timeZone)
    ) {
      continue;
    }
    inserts.push(task);
  }

  return { expireIds, supersedeIds, inserts };
}

function shouldSkipRestate(
  row: ExistingRecommendation,
  todayLocal: string,
  timeZone: string,
) {
  if (row.resolvedAt) {
    return localDateString(row.resolvedAt, timeZone) === todayLocal;
  }
  if (row.dueBy) {
    return localDateString(row.dueBy, timeZone) >= todayLocal;
  }
  return true;
}

export function groupOpenByUrgency(rows: OpenCareRecommendation[]) {
  return RECOMMENDATION_URGENCIES.map((urgency) => ({
    urgency,
    rows: rows.filter((row) => row.urgency === urgency),
  })).filter((group) => group.rows.length > 0);
}
