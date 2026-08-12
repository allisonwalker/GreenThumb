import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { beds, gardens, locations, seasons, sunZones } from "@/lib/db/schema";

import type {
  CreateSeasonInput,
  OverrideSectionInput,
  SaveSectionsInput,
} from "./season-validation";
import {
  formatSectionSunExposureDisplay,
  type SunExposureMix,
  type SunZoneInput,
} from "./sun-exposure";

export type SeasonSectionRecord = {
  id: string;
  name: string;
  startFt: number;
  endFt: number;
  sunExposure: string;
  sunExposureSource: "derived" | "override";
  sunExposureMix: SunExposureMix | null;
  sunExposureDisplay: string;
};

export type SeasonRecord = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  sections: SeasonSectionRecord[];
};

export type SeasonBoardRecord = {
  gardenId: string;
  bedId: string;
  bedLengthFt: number;
  sunZones: SunZoneInput[];
  currentSeason: SeasonRecord | null;
  pastSeasons: SeasonRecord[];
};

function toMix(value: unknown): SunExposureMix | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as SunExposureMix;
}

function toSection(row: {
  id: string;
  name: string;
  startFt: string | null;
  endFt: string | null;
  sunExposure: string;
  sunExposureSource: "derived" | "override";
  sunExposureMix: unknown;
}): SeasonSectionRecord {
  const mix = toMix(row.sunExposureMix);
  return {
    id: row.id,
    name: row.name,
    startFt: Number(row.startFt),
    endFt: Number(row.endFt),
    sunExposure: row.sunExposure,
    sunExposureSource: row.sunExposureSource,
    sunExposureMix: mix,
    sunExposureDisplay: formatSectionSunExposureDisplay(row.sunExposure, mix),
  };
}

async function loadSectionsForSeasons(seasonIds: string[]) {
  if (seasonIds.length === 0) {
    return new Map<string, SeasonSectionRecord[]>();
  }

  const database = getDatabase();
  const rows = await database
    .select({
      id: locations.id,
      seasonId: locations.seasonId,
      name: locations.name,
      startFt: locations.startFt,
      endFt: locations.endFt,
      sunExposure: locations.sunExposure,
      sunExposureSource: locations.sunExposureSource,
      sunExposureMix: locations.sunExposureMix,
    })
    .from(locations)
    .where(
      and(
        eq(locations.kind, "bed_section"),
        isNull(locations.retiredAt),
        inArray(locations.seasonId, seasonIds),
      ),
    )
    .orderBy(asc(locations.startFt));

  const bySeason = new Map<string, SeasonSectionRecord[]>();
  for (const row of rows) {
    if (!row.seasonId) {
      continue;
    }
    const list = bySeason.get(row.seasonId) ?? [];
    list.push(toSection(row));
    bySeason.set(row.seasonId, list);
  }
  return bySeason;
}

export async function getSeasonBoardRecord(): Promise<SeasonBoardRecord | null> {
  const database = getDatabase();
  const [garden] = await database
    .select({
      gardenId: gardens.id,
      bedId: beds.id,
      bedLengthFt: beds.lengthFt,
    })
    .from(gardens)
    .innerJoin(beds, eq(beds.gardenId, gardens.id))
    .limit(1);

  if (!garden?.bedId) {
    return null;
  }

  const zones = await database
    .select({
      startFt: sunZones.startFt,
      endFt: sunZones.endFt,
      sunExposure: sunZones.sunExposure,
    })
    .from(sunZones)
    .where(eq(sunZones.bedId, garden.bedId))
    .orderBy(asc(sunZones.startFt));

  if (zones.length === 0) {
    return null;
  }

  const seasonRows = await database
    .select({
      id: seasons.id,
      name: seasons.name,
      startsOn: seasons.startsOn,
      endsOn: seasons.endsOn,
      isCurrent: seasons.isCurrent,
    })
    .from(seasons)
    .where(eq(seasons.gardenId, garden.gardenId))
    .orderBy(desc(seasons.startsOn), asc(seasons.name));

  const sectionsBySeason = await loadSectionsForSeasons(
    seasonRows.map((season) => season.id),
  );

  const mapped = seasonRows.map((season) => ({
    id: season.id,
    name: season.name,
    startsOn: season.startsOn,
    endsOn: season.endsOn,
    isCurrent: season.isCurrent,
    sections: sectionsBySeason.get(season.id) ?? [],
  }));

  return {
    gardenId: garden.gardenId,
    bedId: garden.bedId,
    bedLengthFt: Number(garden.bedLengthFt),
    sunZones: zones.map((zone) => ({
      startFt: Number(zone.startFt),
      endFt: Number(zone.endFt),
      sunExposure: zone.sunExposure,
    })),
    currentSeason: mapped.find((season) => season.isCurrent) ?? null,
    pastSeasons: mapped.filter((season) => !season.isCurrent),
  };
}

export async function createSeasonRecord(input: CreateSeasonInput) {
  const database = getDatabase();

  await database.transaction(async (transaction) => {
    const [garden] = await transaction
      .select({ id: gardens.id })
      .from(gardens)
      .limit(1);

    if (!garden) {
      throw new Error("Save the garden profile before creating a season.");
    }

    if (input.markCurrent) {
      await transaction
        .update(seasons)
        .set({ isCurrent: false, updatedAt: new Date() })
        .where(
          and(eq(seasons.gardenId, garden.id), eq(seasons.isCurrent, true)),
        );
    }

    await transaction.insert(seasons).values({
      gardenId: garden.id,
      name: input.name,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      isCurrent: input.markCurrent,
    });
  });
}

export async function saveSeasonSectionsRecord(input: SaveSectionsInput) {
  const database = getDatabase();

  await database.transaction(async (transaction) => {
    const [season] = await transaction
      .select({
        id: seasons.id,
        gardenId: seasons.gardenId,
        isCurrent: seasons.isCurrent,
      })
      .from(seasons)
      .where(eq(seasons.id, input.seasonId))
      .limit(1);

    if (!season) {
      throw new Error("Season not found.");
    }

    if (!season.isCurrent) {
      throw new Error("Only the current season's sections can be edited.");
    }

    const [bed] = await transaction
      .select({ id: beds.id })
      .from(beds)
      .where(eq(beds.gardenId, season.gardenId))
      .limit(1);

    if (!bed) {
      throw new Error("Garden bed is missing.");
    }

    const existing = await transaction
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.seasonId, season.id),
          eq(locations.kind, "bed_section"),
          isNull(locations.retiredAt),
        ),
      );

    const keptIds = new Set(
      input.sections
        .map((section) => section.id)
        .filter((id): id is string => Boolean(id)),
    );
    const toDelete = existing
      .map((row) => row.id)
      .filter((id) => !keptIds.has(id));

    if (toDelete.length > 0) {
      await transaction
        .delete(locations)
        .where(inArray(locations.id, toDelete));
    }

    for (const section of input.sections) {
      if (section.id && keptIds.has(section.id)) {
        await transaction
          .update(locations)
          .set({
            name: section.name,
            startFt: String(section.startFt),
            endFt: String(section.endFt),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(locations.id, section.id),
              eq(locations.seasonId, season.id),
              eq(locations.kind, "bed_section"),
            ),
          );
        continue;
      }

      await transaction.insert(locations).values({
        gardenId: season.gardenId,
        kind: "bed_section",
        name: section.name,
        bedId: bed.id,
        seasonId: season.id,
        startFt: String(section.startFt),
        endFt: String(section.endFt),
        sunExposure: "pending",
        sunExposureSource: "derived",
        sunExposureMix: {},
      });
    }
  });
}

export async function overrideSectionExposureRecord(
  input: OverrideSectionInput,
) {
  const database = getDatabase();

  const updated = await database
    .update(locations)
    .set({
      sunExposure: input.sunExposure,
      sunExposureSource: "override",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(locations.id, input.sectionId),
        eq(locations.kind, "bed_section"),
        isNull(locations.retiredAt),
      ),
    )
    .returning({ id: locations.id });

  if (updated.length === 0) {
    throw new Error("Section not found.");
  }
}

export async function revertSectionExposureRecord(sectionId: string) {
  const database = getDatabase();

  const updated = await database
    .update(locations)
    .set({
      sunExposureSource: "derived",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(locations.id, sectionId),
        eq(locations.kind, "bed_section"),
        isNull(locations.retiredAt),
      ),
    )
    .returning({ id: locations.id });

  if (updated.length === 0) {
    throw new Error("Section not found.");
  }
}
