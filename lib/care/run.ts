import "server-only";

import { evaluateCareList } from "./evaluate";
import { loadCareMatchingSnapshot } from "./load-inputs";
import { persistMatchingRecommendations } from "./persist";
import type { CareRunTrigger } from "./types";

export async function runCareMatching(input: {
  trigger?: CareRunTrigger;
  asOf?: Date;
} = {}) {
  const asOf = input.asOf ?? new Date();
  const snapshot = await loadCareMatchingSnapshot(asOf);
  if (!snapshot) {
    return { skipped: true as const };
  }

  const tasks = evaluateCareList(snapshot);
  const result = await persistMatchingRecommendations({
    trigger: input.trigger ?? "manual",
    asOf,
    timeZone: snapshot.timeZone,
    tasks,
    ownedActionTypes: ["watered"],
    weatherFetchId: snapshot.weatherFetchId,
  });

  return { skipped: false as const, ...result };
}
