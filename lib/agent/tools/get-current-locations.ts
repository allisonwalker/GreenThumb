import { and, asc, eq, isNull } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { currentLocations } from "@/lib/db/schema";

import type { ToolExecutionContext } from "./types";

export type CurrentLocation = {
  id: string;
  kind: "bed_section" | "pot";
  name: string;
  sunExposure: string;
  sunExposureSource: "derived" | "override";
  drynessFactor: number;
  startFt: number | null;
  endFt: number | null;
  volumeGal: number | null;
  material: string | null;
  soilType: string | null;
  notes: string | null;
};

export type CurrentLocationsStore = {
  list(gardenId?: string): Promise<CurrentLocation[]>;
};

export function createCurrentLocationsStore(): CurrentLocationsStore {
  return {
    async list(gardenId) {
      const database = getDatabase();
      const rows = await database
        .select({
          id: currentLocations.id,
          kind: currentLocations.kind,
          name: currentLocations.name,
          sunExposure: currentLocations.sunExposure,
          sunExposureSource: currentLocations.sunExposureSource,
          drynessFactor: currentLocations.drynessFactor,
          startFt: currentLocations.startFt,
          endFt: currentLocations.endFt,
          volumeGal: currentLocations.volumeGal,
          material: currentLocations.material,
          soilType: currentLocations.soilType,
          notes: currentLocations.notes,
        })
        .from(currentLocations)
        .where(
          gardenId
            ? and(
                eq(currentLocations.gardenId, gardenId),
                isNull(currentLocations.retiredAt),
              )
            : isNull(currentLocations.retiredAt),
        )
        .orderBy(asc(currentLocations.name));

      return rows.map((row) => ({
        id: row.id!,
        kind: row.kind!,
        name: row.name!,
        sunExposure: row.sunExposure!,
        sunExposureSource: row.sunExposureSource!,
        drynessFactor: Number(row.drynessFactor),
        startFt: row.startFt == null ? null : Number(row.startFt),
        endFt: row.endFt == null ? null : Number(row.endFt),
        volumeGal: row.volumeGal == null ? null : Number(row.volumeGal),
        material: row.material,
        soilType: row.soilType,
        notes: row.notes,
      }));
    },
  };
}

export async function getCurrentLocations(
  context: ToolExecutionContext = {},
  store?: CurrentLocationsStore,
): Promise<CurrentLocation[]> {
  return (store ?? createCurrentLocationsStore()).list(context.gardenId);
}
