import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { beds, gardens, sunZones } from "@/lib/db/schema";

import type {
  GardenProfileInput,
  GardenProfileRecord,
} from "./profile-validation";

export async function getGardenProfileRecord(): Promise<GardenProfileRecord | null> {
  const database = getDatabase();
  const rows = await database
    .select({
      gardenId: gardens.id,
      latitude: gardens.latitude,
      longitude: gardens.longitude,
      timezone: gardens.timezone,
      hardinessZone: gardens.hardinessZone,
      averageLastFrostOn: gardens.averageLastFrostOn,
      averageFirstFrostOn: gardens.averageFirstFrostOn,
      bedId: beds.id,
      bedLengthFt: beds.lengthFt,
      bedWidthFt: beds.widthFt,
      soilType: beds.soilType,
    })
    .from(gardens)
    .leftJoin(beds, eq(beds.gardenId, gardens.id))
    .limit(1);
  const profile = rows[0];

  if (!profile) {
    return null;
  }

  const zones = profile.bedId
    ? await database
        .select({
          startFt: sunZones.startFt,
          endFt: sunZones.endFt,
          sunExposure: sunZones.sunExposure,
        })
        .from(sunZones)
        .where(eq(sunZones.bedId, profile.bedId))
        .orderBy(asc(sunZones.startFt))
    : [];

  return {
    latitude: Number(profile.latitude),
    longitude: Number(profile.longitude),
    timezone: profile.timezone,
    hardinessZone: profile.hardinessZone,
    averageLastFrostOn: profile.averageLastFrostOn,
    averageFirstFrostOn: profile.averageFirstFrostOn,
    bedLengthFt: profile.bedLengthFt ? Number(profile.bedLengthFt) : 50,
    bedWidthFt: profile.bedWidthFt ? Number(profile.bedWidthFt) : 3,
    soilType: profile.soilType ?? "",
    sunZones: zones.map((zone) => ({
      startFt: Number(zone.startFt),
      endFt: Number(zone.endFt),
      sunExposure: zone.sunExposure,
    })),
  };
}

export async function saveGardenProfileRecord(input: GardenProfileInput) {
  const database = getDatabase();

  await database.transaction(async (transaction) => {
    const [garden] = await transaction
      .insert(gardens)
      .values({
        latitude: String(input.latitude),
        longitude: String(input.longitude),
        timezone: input.timezone,
        hardinessZone: input.hardinessZone,
        averageLastFrostOn: input.averageLastFrostOn,
        averageFirstFrostOn: input.averageFirstFrostOn,
      })
      .onConflictDoUpdate({
        target: gardens.singletonKey,
        set: {
          latitude: String(input.latitude),
          longitude: String(input.longitude),
          timezone: input.timezone,
          hardinessZone: input.hardinessZone,
          averageLastFrostOn: input.averageLastFrostOn,
          averageFirstFrostOn: input.averageFirstFrostOn,
          updatedAt: new Date(),
        },
      })
      .returning({ id: gardens.id });

    if (!garden) {
      throw new Error("Garden could not be saved.");
    }

    const [existingBed] = await transaction
      .select({ id: beds.id })
      .from(beds)
      .where(eq(beds.gardenId, garden.id))
      .limit(1);

    const bed = existingBed
      ? (
          await transaction
            .update(beds)
            .set({
              lengthFt: String(input.bedLengthFt),
              widthFt: String(input.bedWidthFt),
              soilType: input.soilType,
              updatedAt: new Date(),
            })
            .where(eq(beds.id, existingBed.id))
            .returning({ id: beds.id })
        )[0]
      : (
          await transaction
            .insert(beds)
            .values({
              gardenId: garden.id,
              lengthFt: String(input.bedLengthFt),
              widthFt: String(input.bedWidthFt),
              soilType: input.soilType,
            })
            .returning({ id: beds.id })
        )[0];

    if (!bed) {
      throw new Error("Bed could not be saved.");
    }

    await transaction.delete(sunZones).where(eq(sunZones.bedId, bed.id));
    await transaction.insert(sunZones).values(
      input.sunZones.map((zone) => ({
        bedId: bed.id,
        startFt: String(zone.startFt),
        endFt: String(zone.endFt),
        sunExposure: zone.sunExposure,
      })),
    );
  });
}
