import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import {
  gardens,
  locations,
  recommendations,
  type RecommendationEvidence,
} from "@/lib/db/schema";

import { RECOMMENDATION_URGENCIES } from "./types";
import type { OpenCareRecommendation } from "./types";

type Database =
  | ReturnType<typeof getDatabase>
  | Parameters<
      Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
    >[0];

export async function listOpenRecommendationsForSingletonGarden(
  database: Database = getDatabase(),
): Promise<OpenCareRecommendation[]> {
  const [garden] = await database
    .select({ id: gardens.id })
    .from(gardens)
    .limit(1);

  if (!garden) {
    return [];
  }

  return listOpenRecommendations(garden.id, database);
}

export async function listOpenRecommendations(
  gardenId: string,
  database: Database = getDatabase(),
): Promise<OpenCareRecommendation[]> {
  const rows = await database
    .select({
      id: recommendations.id,
      careRunId: recommendations.careRunId,
      locationId: recommendations.locationId,
      locationName: locations.name,
      plantingId: recommendations.plantingId,
      cropId: recommendations.cropId,
      actionType: recommendations.actionType,
      urgency: recommendations.urgency,
      headline: recommendations.headline,
      rationale: recommendations.rationale,
      confidence: recommendations.confidence,
      evidence: recommendations.evidence,
      estimatedMinutes: recommendations.estimatedMinutes,
      dueBy: recommendations.dueBy,
      createdAt: recommendations.createdAt,
      gardenId: locations.gardenId,
    })
    .from(recommendations)
    .innerJoin(locations, eq(recommendations.locationId, locations.id))
    .where(
      and(
        eq(recommendations.status, "open"),
        eq(locations.gardenId, gardenId),
      ),
    );

  return rows
    .map((row) => ({
      id: row.id,
      careRunId: row.careRunId,
      locationId: row.locationId,
      locationName: row.locationName,
      plantingId: row.plantingId,
      cropId: row.cropId,
      actionType: row.actionType,
      urgency: row.urgency,
      headline: row.headline,
      rationale: row.rationale,
      confidence: row.confidence === null ? null : Number(row.confidence),
      evidence: parseEvidence(row.evidence),
      estimatedMinutes: row.estimatedMinutes,
      status: "open" as const,
      dueBy: row.dueBy?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }))
    .sort(
      (left, right) =>
        RECOMMENDATION_URGENCIES.indexOf(left.urgency) -
        RECOMMENDATION_URGENCIES.indexOf(right.urgency),
    );
}

function parseEvidence(value: unknown): RecommendationEvidence {
  const facts = Array.isArray((value as { facts?: unknown })?.facts)
    ? (value as { facts: unknown[] }).facts
    : [];
  return {
    facts: facts.flatMap((fact) => {
      if (typeof fact === "string") {
        return [{ source: "record", figure: fact }];
      }
      if (
        fact &&
        typeof fact === "object" &&
        typeof (fact as { source?: unknown }).source === "string" &&
        typeof (fact as { figure?: unknown }).figure === "string"
      ) {
        return [
          {
            source: (fact as { source: string }).source,
            figure: (fact as { figure: string }).figure,
          },
        ];
      }
      return [];
    }),
  };
}
