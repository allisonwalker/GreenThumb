import type { CachedWeather } from "@/lib/weather";

import type { GardenProfile } from "../tools/get-garden-profile";
import type { OpenRecommendation } from "../tools/get-open-recommendations";
import type { PlantingSummary } from "../tools/get-plantings";
import type { CropCatalogRow } from "../tools/get-crop-catalog";
import type { CurrentLocation } from "../tools/get-current-locations";
import {
  createToolRegistry,
  type ToolRegistry,
  type ToolRegistryDependencies,
} from "../tools";

export const TIME_BUDGET_MINUTES = 120;

export const WATER_TOMATOES_HEADLINE = "Water Section 1 tomatoes";
export const WATER_PEPPERS_HEADLINE = "Water Pepper Pot";
export const FERTILIZE_TOMATOES_HEADLINE = "Fertilize Section 1 tomatoes";
export const PRUNE_TOMATOES_HEADLINE = "Prune Section 1 tomatoes";
export const HARVEST_CUCUMBERS_HEADLINE = "Harvest Cucumber Pot";
export const WATER_BASIL_HEADLINE = "Water Basil Pot";

const GARDEN_ID = "time-budget-eval-garden";
const NOW = new Date("2026-08-13T19:00:00.000Z");

const SECTION_1_ID = "tb-eval-section-1";
const PEPPER_POT_ID = "tb-eval-pepper-pot";
const CUCUMBER_POT_ID = "tb-eval-cucumber-pot";
const BASIL_POT_ID = "tb-eval-basil-pot";

const TOMATO_CROP_ID = "tb-eval-tomatoes";
const PEPPER_CROP_ID = "tb-eval-peppers";
const CUCUMBER_CROP_ID = "tb-eval-cucumbers";
const BASIL_CROP_ID = "tb-eval-basil";

const TOMATO_PLANTING_ID = "tb-eval-tomato-planting";
const PEPPER_PLANTING_ID = "tb-eval-pepper-planting";
const CUCUMBER_PLANTING_ID = "tb-eval-cucumber-planting";
const BASIL_PLANTING_ID = "tb-eval-basil-planting";

export type TimeBudgetOpenTask = {
  id: string;
  headline: string;
  locationName: string;
  actionType: string;
  urgency: string;
  estimatedMinutes: number | null;
  mention: RegExp;
};

export const TIME_BUDGET_OPEN_TASKS: TimeBudgetOpenTask[] = [
  {
    id: "water-tomatoes",
    headline: WATER_TOMATOES_HEADLINE,
    locationName: "Section 1",
    actionType: "watered",
    urgency: "now",
    estimatedMinutes: 20,
    mention: /water(?:ing)?\s+(?:the\s+)?(?:section\s*1\s+)?tomatoes?|tomatoes?\s+(?:in\s+section\s*1\s+)?(?:need|to\s+)?water/i,
  },
  {
    id: "water-peppers",
    headline: WATER_PEPPERS_HEADLINE,
    locationName: "Pepper Pot",
    actionType: "watered",
    urgency: "today",
    estimatedMinutes: 15,
    mention: /water(?:ing)?\s+(?:the\s+)?peppers?|pepper\s+pot/i,
  },
  {
    id: "fertilize-tomatoes",
    headline: FERTILIZE_TOMATOES_HEADLINE,
    locationName: "Section 1",
    actionType: "fertilized",
    urgency: "today",
    estimatedMinutes: 25,
    mention: /fertiliz(?:e|ing|er)\s+(?:the\s+)?(?:section\s*1\s+)?tomatoes?|tomatoes?.{0,40}fertiliz/i,
  },
  {
    id: "prune-tomatoes",
    headline: PRUNE_TOMATOES_HEADLINE,
    locationName: "Section 1",
    actionType: "pruned",
    urgency: "this_week",
    estimatedMinutes: 40,
    mention: /prun(?:e|ing)\s+(?:the\s+)?(?:section\s*1\s+)?tomatoes?|tomatoes?.{0,40}prun/i,
  },
  {
    id: "harvest-cucumbers",
    headline: HARVEST_CUCUMBERS_HEADLINE,
    locationName: "Cucumber Pot",
    actionType: "harvested",
    urgency: "today",
    estimatedMinutes: 30,
    mention: /harvest(?:ing)?\s+(?:the\s+)?cucumbers?|cucumber\s+pot/i,
  },
  {
    id: "water-basil",
    headline: WATER_BASIL_HEADLINE,
    locationName: "Basil Pot",
    actionType: "watered",
    urgency: "today",
    estimatedMinutes: null,
    mention: /basil/i,
  },
];

export const TIME_BUDGET_ESTIMATED_TOTAL_MINUTES = TIME_BUDGET_OPEN_TASKS.reduce(
  (sum, task) => sum + (task.estimatedMinutes ?? 0),
  0,
);

export const timeBudgetEvalProfile: GardenProfile = {
  gardenId: GARDEN_ID,
  name: "Time-budget eval fixture",
  latitude: 45.52,
  longitude: -122.68,
  timezone: "America/Los_Angeles",
  hardinessZone: "8b",
  averageLastFrostOn: null,
  averageFirstFrostOn: null,
  bed: null,
};

const locations: CurrentLocation[] = [
  location("Section 1", SECTION_1_ID, "bed_section"),
  location("Pepper Pot", PEPPER_POT_ID, "pot"),
  location("Cucumber Pot", CUCUMBER_POT_ID, "pot"),
  location("Basil Pot", BASIL_POT_ID, "pot"),
];

export const timeBudgetEvalCrops: CropCatalogRow[] = [
  crop(TOMATO_CROP_ID, "tomatoes", "tomatoes", {
    watered: 20,
    fertilized: 25,
    pruned: 40,
  }),
  crop(PEPPER_CROP_ID, "peppers", "peppers", { watered: 15 }),
  crop(CUCUMBER_CROP_ID, "cucumbers", "cucumbers", { harvested: 30 }),
  crop(BASIL_CROP_ID, "basil", "basil", null),
];

const plantings: PlantingSummary[] = [
  planting(TOMATO_PLANTING_ID, SECTION_1_ID, "Section 1", "tomatoes"),
  planting(PEPPER_PLANTING_ID, PEPPER_POT_ID, "Pepper Pot", "peppers"),
  planting(CUCUMBER_PLANTING_ID, CUCUMBER_POT_ID, "Cucumber Pot", "cucumbers"),
  planting(BASIL_PLANTING_ID, BASIL_POT_ID, "Basil Pot", "basil"),
];

export const timeBudgetEvalOpenRecommendations: OpenRecommendation[] = [
  openRec({
    id: "tb-eval-water-tomatoes",
    locationId: SECTION_1_ID,
    locationName: "Section 1",
    plantingId: TOMATO_PLANTING_ID,
    actionType: "watered",
    urgency: "now",
    headline: WATER_TOMATOES_HEADLINE,
    estimatedMinutes: 20,
  }),
  openRec({
    id: "tb-eval-water-peppers",
    locationId: PEPPER_POT_ID,
    locationName: "Pepper Pot",
    plantingId: PEPPER_PLANTING_ID,
    actionType: "watered",
    urgency: "today",
    headline: WATER_PEPPERS_HEADLINE,
    estimatedMinutes: 15,
  }),
  openRec({
    id: "tb-eval-fertilize-tomatoes",
    locationId: SECTION_1_ID,
    locationName: "Section 1",
    plantingId: TOMATO_PLANTING_ID,
    actionType: "fertilized",
    urgency: "today",
    headline: FERTILIZE_TOMATOES_HEADLINE,
    estimatedMinutes: 25,
  }),
  openRec({
    id: "tb-eval-prune-tomatoes",
    locationId: SECTION_1_ID,
    locationName: "Section 1",
    plantingId: TOMATO_PLANTING_ID,
    actionType: "pruned",
    urgency: "this_week",
    headline: PRUNE_TOMATOES_HEADLINE,
    estimatedMinutes: 40,
  }),
  openRec({
    id: "tb-eval-harvest-cucumbers",
    locationId: CUCUMBER_POT_ID,
    locationName: "Cucumber Pot",
    plantingId: CUCUMBER_PLANTING_ID,
    actionType: "harvested",
    urgency: "today",
    headline: HARVEST_CUCUMBERS_HEADLINE,
    estimatedMinutes: 30,
  }),
  openRec({
    id: "tb-eval-water-basil",
    locationId: BASIL_POT_ID,
    locationName: "Basil Pot",
    plantingId: BASIL_PLANTING_ID,
    actionType: "watered",
    urgency: "today",
    headline: WATER_BASIL_HEADLINE,
    estimatedMinutes: null,
  }),
];

const weatherCache: CachedWeather = {
  days: [
    {
      date: "2026-08-13",
      kind: "forecast",
      precipitationMm: 0,
      temperatureMinC: 12,
      temperatureMaxC: 24,
      et0Mm: 3.1,
      windSpeedMaxKph: 8,
      weatherFetchId: "tb-eval-weather",
    },
  ],
  fetchedAt: new Date("2026-08-13T12:00:00.000Z"),
  staleByMs: 0,
  isStale: false,
};

export function createTimeBudgetEvalDependencies(): ToolRegistryDependencies {
  return {
    gardenProfileStore: {
      getProfile: async () => timeBudgetEvalProfile,
    },
    currentLocationsStore: {
      list: async () => locations,
    },
    plantingsStore: {
      list: async () => plantings,
    },
    cropCatalogStore: {
      list: async ({ query } = { query: undefined }) => {
        if (!query?.trim()) {
          return timeBudgetEvalCrops;
        }
        const needle = query.trim().toLowerCase();
        return timeBudgetEvalCrops.filter(
          (row) => row.name.includes(needle) || row.slug.includes(needle),
        );
      },
    },
    careHistoryStore: {
      list: async ({ days }) => ({ days, entries: [] }),
    },
    gardenNotesStore: {
      list: async () => [],
    },
    openRecommendationsStore: {
      list: async () => timeBudgetEvalOpenRecommendations,
    },
    weather: {
      readCache: async () => weatherCache,
      refreshCache: async () => ({ ...weatherCache, refreshError: null }),
    },
  };
}

export function createTimeBudgetEvalRegistry(): ToolRegistry {
  return createToolRegistry(
    { gardenId: GARDEN_ID, now: NOW },
    createTimeBudgetEvalDependencies(),
  );
}

function location(
  name: string,
  id: string,
  kind: "bed_section" | "pot",
): CurrentLocation {
  return {
    id,
    kind,
    name,
    sunExposure: "full_sun",
    sunExposureSource: kind === "bed_section" ? "derived" : "override",
    drynessFactor: kind === "pot" ? 1.4 : 1,
    startFt: kind === "bed_section" ? 0 : null,
    endFt: kind === "bed_section" ? 10 : null,
    volumeGal: kind === "pot" ? 10 : null,
    material: kind === "pot" ? "terracotta" : null,
    soilType: kind === "pot" ? "potting mix" : null,
    notes: null,
  };
}

function crop(
  id: string,
  name: string,
  slug: string,
  timeEstimates: CropCatalogRow["timeEstimates"],
): CropCatalogRow {
  return {
    id,
    name,
    slug,
    wateringIntervalDays: 3,
    fertilizingIntervalDays: 14,
    pruning: { needed: false },
    frostSensitive: true,
    sunPreference: "full_sun",
    plantWindowStart: null,
    plantWindowEnd: null,
    daysToHarvestMin: 50,
    daysToHarvestMax: 80,
    timeEstimates,
    notes: null,
    source: "edited",
  };
}

function planting(
  id: string,
  locationId: string,
  locationName: string,
  cropName: string,
): PlantingSummary {
  return {
    id,
    locationId,
    locationName,
    cropName,
    variety: null,
    method: "transplant",
    plantedOn: "2026-06-01",
    daysSincePlanted: 73,
    status: "growing",
    removedOn: null,
  };
}

function openRec(input: {
  id: string;
  locationId: string;
  locationName: string;
  plantingId: string;
  actionType: string;
  urgency: string;
  headline: string;
  estimatedMinutes: number | null;
}): OpenRecommendation {
  return {
    id: input.id,
    locationId: input.locationId,
    locationName: input.locationName,
    plantingId: input.plantingId,
    actionType: input.actionType,
    urgency: input.urgency,
    headline: input.headline,
    rationale: `${input.headline} is on today's matching list.`,
    confidence: 0.9,
    evidence: { facts: ["Seeded for time-budget eval"], inferences: [] },
    estimatedMinutes: input.estimatedMinutes,
    status: "open",
    dueBy: null,
    createdAt: "2026-08-13T12:00:00.000Z",
  };
}
