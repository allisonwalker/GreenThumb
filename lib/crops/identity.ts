import {
  catalogSlug,
  cropIdentityLabel,
  cropSlug,
  normalizeVariety,
} from "./slug";

export class DuplicateCropError extends Error {
  readonly existingCropId: string;
  readonly existingName: string;
  readonly existingVariety: string | null;

  constructor(existing: {
    id: string;
    name: string;
    variety: string | null;
  }) {
    super(duplicateCropMessage(existing.name, existing.variety));
    this.name = "DuplicateCropError";
    this.existingCropId = existing.id;
    this.existingName = existing.name;
    this.existingVariety = existing.variety;
  }
}

export function duplicateCropMessage(
  name: string,
  variety: string | null,
): string {
  if (normalizeVariety(variety) === null) {
    return `A ${name} with no variety already exists. Add a variety to distinguish it, or open the existing row.`;
  }
  return `A ${cropIdentityLabel(name, variety)} row already exists. Open the existing row instead of creating a duplicate.`;
}

export function varietyGroupKey(variety: string | null): string {
  const normalized = normalizeVariety(variety);
  if (!normalized) {
    return "none";
  }
  try {
    return cropSlug(normalized);
  } catch {
    return "none";
  }
}

export type VarietySplitSourceCrop = {
  id: string;
  name: string;
  slug: string;
};

export type VarietySplitSourcePlanting = {
  id: string;
  cropId: string;
  variety: string | null;
};

export type VarietySplitAssign = {
  cropId: string;
  variety: string | null;
  slug: string;
};

export type VarietySplitInsert = {
  fromCropId: string;
  variety: string;
  slug: string;
  plantingIds: string[];
};

export type VarietySplitPlan = {
  assignToOriginal: VarietySplitAssign[];
  insertRows: VarietySplitInsert[];
};

type VarietyGroup = {
  key: string;
  variety: string | null;
  plantingIds: string[];
};

export function planVarietySplit(
  crops: VarietySplitSourceCrop[],
  plantings: VarietySplitSourcePlanting[],
): VarietySplitPlan {
  const plantingsByCrop = new Map<string, VarietySplitSourcePlanting[]>();
  for (const planting of plantings) {
    const list = plantingsByCrop.get(planting.cropId) ?? [];
    list.push(planting);
    plantingsByCrop.set(planting.cropId, list);
  }

  const assignToOriginal: VarietySplitAssign[] = [];
  const insertRows: VarietySplitInsert[] = [];

  for (const crop of crops) {
    const cropPlantings = plantingsByCrop.get(crop.id) ?? [];
    if (cropPlantings.length === 0) {
      continue;
    }

    const groups = groupPlantings(cropPlantings);
    if (groups.length === 1) {
      const [group] = groups;
      if (group && group.key !== "none") {
        assignToOriginal.push({
          cropId: crop.id,
          variety: group.variety,
          slug: catalogSlug(crop.name, group.variety),
        });
      }
      continue;
    }

    const unnamed = groups.find((group) => group.key === "none");
    const named = groups
      .filter((group) => group.key !== "none" && group.variety !== null)
      .sort((left, right) => left.key.localeCompare(right.key));

    if (!unnamed && named[0]) {
      const kept = named[0];
      assignToOriginal.push({
        cropId: crop.id,
        variety: kept.variety,
        slug: catalogSlug(crop.name, kept.variety),
      });
      named.shift();
    }

    for (const group of named) {
      if (group.variety === null) {
        continue;
      }
      insertRows.push({
        fromCropId: crop.id,
        variety: group.variety,
        slug: catalogSlug(crop.name, group.variety),
        plantingIds: group.plantingIds,
      });
    }
  }

  return { assignToOriginal, insertRows };
}

function groupPlantings(
  cropPlantings: VarietySplitSourcePlanting[],
): VarietyGroup[] {
  const groups = new Map<string, VarietyGroup>();

  for (const planting of cropPlantings) {
    const key = varietyGroupKey(planting.variety);
    const existing = groups.get(key);
    if (existing) {
      existing.plantingIds.push(planting.id);
      continue;
    }

    groups.set(key, {
      key,
      variety: key === "none" ? null : normalizeVariety(planting.variety),
      plantingIds: [planting.id],
    });
  }

  return [...groups.values()];
}
