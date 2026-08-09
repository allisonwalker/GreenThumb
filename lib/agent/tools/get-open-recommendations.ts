import { and, eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { locations, recommendations } from "@/lib/db/schema";

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
  status: "open";
  dueBy: string | null;
  createdAt: string;
};

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
        })
        .from(recommendations)
        .innerJoin(locations, eq(recommendations.locationId, locations.id))
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
        status: "open" as const,
        dueBy: row.dueBy?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      }));
    },
  };
}

export async function getOpenRecommendations(
  context: ToolExecutionContext = {},
  store: OpenRecommendationsStore = createOpenRecommendationsStore(),
  profileStore = createGardenProfileStore(),
): Promise<OpenRecommendation[]> {
  const profile = await profileStore.getProfile(context.gardenId);
  return store.list(profile.gardenId);
}
