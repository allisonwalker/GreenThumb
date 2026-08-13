import { asc } from "drizzle-orm";

import { cropMatchesQuery } from "@/lib/crops/slug";
import type { CropPruning, CropTimeEstimates } from "@/lib/crops/types";
import { getDatabase } from "@/lib/db/client";
import { crops } from "@/lib/db/schema";

import type { ToolExecutionContext } from "./types";

export type CropCatalogRow = {
  id: string;
  name: string;
  slug: string;
  wateringIntervalDays: number | null;
  fertilizingIntervalDays: number | null;
  pruning: CropPruning | null;
  frostSensitive: boolean | null;
  sunPreference: string | null;
  plantWindowStart: string | null;
  plantWindowEnd: string | null;
  daysToHarvestMin: number | null;
  daysToHarvestMax: number | null;
  timeEstimates: CropTimeEstimates | null;
  notes: string | null;
  source: string;
};

export type CropCatalogResult = {
  crops: CropCatalogRow[];
};

export type CropCatalogStore = {
  list(input: { query?: string }): Promise<CropCatalogRow[]>;
};

export function createCropCatalogStore(): CropCatalogStore {
  return {
    async list({ query } = { query: undefined }) {
      const database = getDatabase();
      const rows = await database
        .select({
          id: crops.id,
          name: crops.name,
          slug: crops.slug,
          wateringIntervalDays: crops.wateringIntervalDays,
          fertilizingIntervalDays: crops.fertilizingIntervalDays,
          pruning: crops.pruning,
          frostSensitive: crops.frostSensitive,
          sunPreference: crops.sunPreference,
          plantWindowStart: crops.plantWindowStart,
          plantWindowEnd: crops.plantWindowEnd,
          daysToHarvestMin: crops.daysToHarvestMin,
          daysToHarvestMax: crops.daysToHarvestMax,
          timeEstimates: crops.timeEstimates,
          notes: crops.notes,
          source: crops.source,
        })
        .from(crops)
        .orderBy(asc(crops.name));

      const catalog = rows.map((row) => ({
        ...row,
        sunPreference: row.sunPreference ?? null,
      }));

      if (!query?.trim()) {
        return catalog;
      }

      return catalog.filter((row) =>
        cropMatchesQuery(row.name, row.slug, query),
      );
    },
  };
}

export async function getCropCatalog(
  context: ToolExecutionContext & { query?: string } = {},
  store?: CropCatalogStore,
): Promise<CropCatalogResult> {
  const catalog = await (store ?? createCropCatalogStore()).list({
    query: context.query,
  });
  return { crops: catalog };
}
