import { and, inArray, isNull } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { currentLocations, plantings } from "@/lib/db/schema";
import { daysBetween, gardenLocalToday } from "@/lib/garden/local-date";

import { createGardenProfileStore } from "./get-garden-profile";
import type { ToolExecutionContext } from "./types";

export type PlantingSummary = {
  id: string;
  locationId: string;
  locationName: string;
  cropName: string;
  variety: string | null;
  method: "seed" | "transplant";
  plantedOn: string;
  daysSincePlanted: number;
  status: string;
  removedOn: string | null;
};

export type PlantingsStore = {
  list(input: {
    gardenId?: string;
    timezone: string;
    now: Date;
  }): Promise<PlantingSummary[]>;
};

export function createPlantingsStore(): PlantingsStore {
  return {
    async list({ gardenId, timezone, now }) {
      const database = getDatabase();
      const locationRows = await database
        .select({
          id: currentLocations.id,
          name: currentLocations.name,
          gardenId: currentLocations.gardenId,
        })
        .from(currentLocations);

      const locations = locationRows.filter((row) =>
        gardenId ? row.gardenId === gardenId : true,
      );
      if (locations.length === 0) {
        return [];
      }

      const locationIds = locations.map((row) => row.id!);
      const locationNameById = new Map(
        locations.map((row) => [row.id!, row.name!]),
      );
      const today = gardenLocalToday({ timezone }, now);

      const rows = await database
        .select({
          id: plantings.id,
          locationId: plantings.locationId,
          cropName: plantings.cropName,
          variety: plantings.variety,
          method: plantings.method,
          plantedOn: plantings.plantedOn,
          removedOn: plantings.removedOn,
          status: plantings.status,
        })
        .from(plantings)
        .where(
          and(
            inArray(plantings.locationId, locationIds),
            isNull(plantings.removedOn),
          ),
        );

      return rows.map((row) => ({
        id: row.id,
        locationId: row.locationId,
        locationName: locationNameById.get(row.locationId) ?? "Unknown",
        cropName: row.cropName,
        variety: row.variety,
        method: row.method,
        plantedOn: row.plantedOn,
        daysSincePlanted: daysBetween(row.plantedOn, today),
        status: row.status,
        removedOn: row.removedOn,
      }));
    },
  };
}

export async function getPlantings(
  context: ToolExecutionContext = {},
  store?: PlantingsStore,
  profileStore = createGardenProfileStore(),
): Promise<PlantingSummary[]> {
  const profile = await (profileStore ?? createGardenProfileStore()).getProfile(
    context.gardenId,
  );
  return (store ?? createPlantingsStore()).list({
    gardenId: profile.gardenId,
    timezone: profile.timezone,
    now: context.now ?? new Date(),
  });
}
