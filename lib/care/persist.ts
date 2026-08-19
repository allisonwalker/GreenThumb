import "server-only";

import { eq, inArray } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { actionLogs, careRuns, recommendations } from "@/lib/db/schema";

import { planCarePersist } from "./persist-decisions";
import type { ExistingRecommendation, PersistMatchingInput } from "./types";

type AppDatabase = ReturnType<typeof getDatabase>;
type Database =
  | AppDatabase
  | Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

const NOT_OPEN = "That task is no longer open.";

export async function persistMatchingRecommendations(
  input: PersistMatchingInput,
  database: AppDatabase = getDatabase(),
) {
  return database.transaction((tx) => persistMatchingOnDb(tx, input));
}

/** Same writes as persistMatchingRecommendations, without opening a nested transaction. */
export async function persistMatchingOnDb(
  database: Database,
  input: PersistMatchingInput,
) {
  const startedAt = input.asOf;

  const [run] = await database
    .insert(careRuns)
    .values({
      trigger: input.trigger,
      status: "running",
      startedAt,
      weatherFetchId: input.weatherFetchId ?? null,
      simulatedWeather: input.simulatedWeather ?? null,
      taskCount: 0,
    })
    .returning({ id: careRuns.id });

  if (!run) {
    throw new Error("Failed to create care_run");
  }

  const existingRows = await database
    .select({
      id: recommendations.id,
      locationId: recommendations.locationId,
      actionType: recommendations.actionType,
      status: recommendations.status,
      dueBy: recommendations.dueBy,
      resolvedAt: recommendations.resolvedAt,
      updatedAt: recommendations.updatedAt,
    })
    .from(recommendations);

  const existing: ExistingRecommendation[] = existingRows.map((row) => ({
    ...row,
    dueBy: row.dueBy,
    resolvedAt: row.resolvedAt,
  }));

  const plan = planCarePersist({
    existing,
    tasks: input.tasks,
    asOf: input.asOf,
    timeZone: input.timeZone,
  });

  if (plan.expireIds.length > 0) {
    await database
      .update(recommendations)
      .set({
        status: "expired",
        updatedAt: input.asOf,
      })
      .where(inArray(recommendations.id, plan.expireIds));
  }

  if (plan.supersedeIds.length > 0) {
    await database
      .update(recommendations)
      .set({
        status: "superseded",
        updatedAt: input.asOf,
      })
      .where(inArray(recommendations.id, plan.supersedeIds));
  }

  if (plan.inserts.length > 0) {
    await database.insert(recommendations).values(
      plan.inserts.map((task) => ({
        careRunId: run.id,
        agentRunId: null,
        locationId: task.locationId,
        plantingId: task.plantingId,
        cropId: task.cropId,
        actionType: task.actionType,
        urgency: task.urgency,
        headline: task.headline,
        rationale: task.rationale,
        confidence: null,
        evidence: task.evidence,
        estimatedMinutes: task.estimatedMinutes,
        dueBy: task.dueBy,
        status: "open" as const,
      })),
    );
  }

  const [finished] = await database
    .update(careRuns)
    .set({
      status: "succeeded",
      finishedAt: new Date(),
      taskCount: plan.inserts.length,
      updatedAt: new Date(),
    })
    .where(eq(careRuns.id, run.id))
    .returning({
      id: careRuns.id,
      taskCount: careRuns.taskCount,
    });

  return {
    careRunId: finished?.id ?? run.id,
    inserted: plan.inserts.length,
    superseded: plan.supersedeIds.length,
    expired: plan.expireIds.length,
  };
}

export async function markRecommendationDone(
  input: {
    recommendationId: string;
    userId: string;
    occurredAt?: Date;
  },
  database: AppDatabase = getDatabase(),
) {
  return database.transaction((tx) => markRecommendationDoneOnDb(tx, input));
}

export async function markRecommendationDoneOnDb(
  database: Database,
  input: {
    recommendationId: string;
    userId: string;
    occurredAt?: Date;
  },
) {
  const occurredAt = input.occurredAt ?? new Date();

  const [row] = await database
    .select({
      id: recommendations.id,
      status: recommendations.status,
      locationId: recommendations.locationId,
      plantingId: recommendations.plantingId,
      actionType: recommendations.actionType,
    })
    .from(recommendations)
    .where(eq(recommendations.id, input.recommendationId))
    .limit(1);

  if (!row || row.status !== "open") {
    throw new Error(NOT_OPEN);
  }

  const [log] = await database
    .insert(actionLogs)
    .values({
      locationId: row.locationId,
      plantingId: row.plantingId,
      userId: input.userId,
      actionType: row.actionType,
      occurredAt,
    })
    .returning({ id: actionLogs.id });

  if (!log) {
    throw new Error("Could not write the action log.");
  }

  await database
    .update(recommendations)
    .set({
      status: "done",
      resolvedAt: occurredAt,
      resolvedBy: input.userId,
      resolvedActionLogId: log.id,
      updatedAt: occurredAt,
    })
    .where(eq(recommendations.id, row.id));

  return { actionLogId: log.id };
}

export async function dismissRecommendation(
  input: {
    recommendationId: string;
    userId: string;
    occurredAt?: Date;
  },
  database: AppDatabase = getDatabase(),
) {
  return database.transaction((tx) => dismissRecommendationOnDb(tx, input));
}

export async function dismissRecommendationOnDb(
  database: Database,
  input: {
    recommendationId: string;
    userId: string;
    occurredAt?: Date;
  },
) {
  const occurredAt = input.occurredAt ?? new Date();

  const [row] = await database
    .select({
      id: recommendations.id,
      status: recommendations.status,
    })
    .from(recommendations)
    .where(eq(recommendations.id, input.recommendationId))
    .limit(1);

  if (!row || row.status !== "open") {
    throw new Error(NOT_OPEN);
  }

  await database
    .update(recommendations)
    .set({
      status: "dismissed",
      resolvedAt: occurredAt,
      resolvedBy: input.userId,
      resolvedActionLogId: null,
      updatedAt: occurredAt,
    })
    .where(eq(recommendations.id, row.id));
}
