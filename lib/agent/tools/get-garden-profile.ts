import { eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { beds, gardens } from "@/lib/db/schema";

import type { ToolExecutionContext } from "./types";

export type GardenProfile = {
  gardenId: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  hardinessZone: string;
  averageLastFrostOn: string | null;
  averageFirstFrostOn: string | null;
  bed: {
    id: string;
    name: string;
    lengthFt: number;
    widthFt: number;
    soilType: string;
  } | null;
};

export type GardenProfileStore = {
  getProfile(gardenId?: string): Promise<GardenProfile>;
};

export function createGardenProfileStore(): GardenProfileStore {
  return {
    async getProfile(gardenId) {
      const database = getDatabase();
      const rows = await database
        .select({
          gardenId: gardens.id,
          name: gardens.name,
          latitude: gardens.latitude,
          longitude: gardens.longitude,
          timezone: gardens.timezone,
          hardinessZone: gardens.hardinessZone,
          averageLastFrostOn: gardens.averageLastFrostOn,
          averageFirstFrostOn: gardens.averageFirstFrostOn,
          bedId: beds.id,
          bedName: beds.name,
          bedLengthFt: beds.lengthFt,
          bedWidthFt: beds.widthFt,
          bedSoilType: beds.soilType,
        })
        .from(gardens)
        .leftJoin(beds, eq(beds.gardenId, gardens.id))
        .where(gardenId ? eq(gardens.id, gardenId) : undefined)
        .limit(1);

      const row = rows[0];
      if (!row) {
        throw new Error(
          gardenId ? `Garden ${gardenId} was not found` : "Garden was not found",
        );
      }

      return {
        gardenId: row.gardenId,
        name: row.name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        timezone: row.timezone,
        hardinessZone: row.hardinessZone,
        averageLastFrostOn: row.averageLastFrostOn,
        averageFirstFrostOn: row.averageFirstFrostOn,
        bed: row.bedId
          ? {
              id: row.bedId,
              name: row.bedName!,
              lengthFt: Number(row.bedLengthFt),
              widthFt: Number(row.bedWidthFt),
              soilType: row.bedSoilType!,
            }
          : null,
      };
    },
  };
}

export async function getGardenProfile(
  context: ToolExecutionContext = {},
  store: GardenProfileStore = createGardenProfileStore(),
): Promise<GardenProfile> {
  return store.getProfile(context.gardenId);
}
