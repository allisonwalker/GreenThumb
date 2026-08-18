import { and, eq } from "drizzle-orm";

import type { CropTimeEstimates, TimeEstimateAction } from "@/lib/crops/types";
import { getDatabase } from "@/lib/db/client";
import { crops, locations, plantings, recommendations } from "@/lib/db/schema";

import { createGardenProfileStore } from "./get-garden-profile";
import type { ToolExecutionContext } from "./types";

export type OpenRecommendation = {
  id: string;
  locationId: string;
  locationName: string;
  plantingId: string | null;
  actionType: string;
  urgency: string;
  headline: string;
  rationale: string;
  confidence: number;
  evidence: { facts: string[]; inferences: string[] };
  estimatedMinutes: number | null;
  status: "open";
  dueBy: string | null;
  createdAt: string;
};

export function estimatedMinutesForAction(
  timeEstimates: CropTimeEstimates | null | undefined,
  actionType: string,
): number | null {
  if (!timeEstimates) {
    return null;
  }
  const minutes = timeEstimates[actionType as TimeEstimateAction];
  return typeof minutes === "number" ? minutes : null;
}

export type OpenRecommendationsStore = {
  list(gardenId: string): Promise<OpenRecommendation[]>;
};

export function createOpenRecommendationsStore(): OpenRecommendationsStore {
  return {
    async list(gardenId) {
      const database = getDatabase();
      const rows = await database
        .select({
          id: recommendations.id,
          locationId: recommendations.locationId,
          locationName: locations.name,
          plantingId: recommendations.plantingId,
          actionType: recommendations.actionType,
          urgency: recommendations.urgency,
          headline: recommendations.headline,
          rationale: recommendations.rationale,
          confidence: recommendations.confidence,
          evidence: recommendations.evidence,
          dueBy: recommendations.dueBy,
          createdAt: recommendations.createdAt,
          gardenId: locations.gardenId,
          status: recommendations.status,
          timeEstimates: crops.timeEstimates,
        })
        .from(recommendations)
        .innerJoin(locations, eq(recommendations.locationId, locations.id))
        .leftJoin(plantings, eq(recommendations.plantingId, plantings.id))
        .leftJoin(crops, eq(plantings.cropId, crops.id))
        .where(
          and(
            eq(recommendations.status, "open"),
            eq(locations.gardenId, gardenId),
          ),
        );

      return rows.map((row) => ({
        id: row.id,
        locationId: row.locationId,
        locationName: row.locationName,
        plantingId: row.plantingId,
        actionType: row.actionType,
        urgency: row.urgency,
        headline: row.headline,
        rationale: row.rationale,
        confidence: Number(row.confidence),
        evidence: row.evidence,
        estimatedMinutes: estimatedMinutesForAction(
          row.timeEstimates,
          row.actionType,
        ),
        status: "open" as const,
        dueBy: row.dueBy?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      }));
    },
  };
}

export async function getOpenRecommendations(
  context: ToolExecutionContext = {},
  store?: OpenRecommendationsStore,
  profileStore = createGardenProfileStore(),
): Promise<OpenRecommendation[]> {
  const profile = await (profileStore ?? createGardenProfileStore()).getProfile(
    context.gardenId,
  );
  return (store ?? createOpenRecommendationsStore()).list(profile.gardenId);
}
