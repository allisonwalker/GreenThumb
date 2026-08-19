import type { OpenCareRecommendation } from "@/lib/care/types";
import { listOpenRecommendations } from "@/lib/care/list-open";
import type { CropTimeEstimates, TimeEstimateAction } from "@/lib/crops/types";

import { createGardenProfileStore } from "./get-garden-profile";
import type { ToolExecutionContext } from "./types";

export type OpenRecommendation = OpenCareRecommendation;

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
      return listOpenRecommendations(gardenId);
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
