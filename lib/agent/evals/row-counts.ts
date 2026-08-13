import { count } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { actionLogs, crops, plantings, recommendations } from "@/lib/db/schema";

export type GardenWriteTableCounts = {
  planting: number;
  recommendation: number;
  actionLog: number;
  crop: number;
};

export async function countGardenWriteTables(): Promise<GardenWriteTableCounts> {
  const database = getDatabase();
  const [planting] = await database.select({ n: count() }).from(plantings);
  const [recommendation] = await database
    .select({ n: count() })
    .from(recommendations);
  const [actionLog] = await database.select({ n: count() }).from(actionLogs);
  const [crop] = await database.select({ n: count() }).from(crops);

  return {
    planting: Number(planting?.n ?? 0),
    recommendation: Number(recommendation?.n ?? 0),
    actionLog: Number(actionLog?.n ?? 0),
    crop: Number(crop?.n ?? 0),
  };
}

export function rowCountDiffs(
  before: GardenWriteTableCounts,
  after: GardenWriteTableCounts,
): string[] {
  const diffs: string[] = [];
  for (const key of Object.keys(before) as (keyof GardenWriteTableCounts)[]) {
    if (before[key] !== after[key]) {
      diffs.push(`${key}: ${before[key]} → ${after[key]}`);
    }
  }
  return diffs;
}
