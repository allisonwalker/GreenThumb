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

export const ASK_EVAL_LOCATION_NAME = "Pepper Pot";
export const ASK_EVAL_CROP_NAME = "peppers";
export const ASK_EVAL_SUN_PREFERENCE = "full_sun";
export const ASK_EVAL_SKIP_HEADLINE =
  "Skip watering Pepper Pot — rain coming";
export const ASK_EVAL_SKIP_RATIONALE =
  "Downgrade/skip watering the peppers today because rain is coming.";

const GARDEN_ID = "ask-eval-garden";
const LOCATION_ID = "ask-eval-pepper-pot";
const CROP_ID = "ask-eval-peppers";
const PLANTING_ID = "ask-eval-pepper-planting";
const RECOMMENDATION_ID = "ask-eval-skip-water";

export const askEvalProfile: GardenProfile = {
  gardenId: GARDEN_ID,
  name: "Ask eval fixture",
  latitude: 45.52,
  longitude: -122.68,
  timezone: "America/Los_Angeles",
  hardinessZone: "8b",
  averageLastFrostOn: null,
  averageFirstFrostOn: null,
  bed: null,
};

export const askEvalLocation: CurrentLocation = {
  id: LOCATION_ID,
  kind: "pot",
  name: ASK_EVAL_LOCATION_NAME,
  sunExposure: "full_sun",
  sunExposureSource: "override",
  drynessFactor: 1.4,
  startFt: null,
  endFt: null,
  volumeGal: 10,
  material: "terracotta",
  soilType: "potting mix",
  notes: null,
};

export const askEvalCrop: CropCatalogRow = {
  id: CROP_ID,
  name: ASK_EVAL_CROP_NAME,
  slug: "peppers",
  wateringIntervalDays: 3,
  fertilizingIntervalDays: 14,
  pruning: { needed: false },
  frostSensitive: true,
  sunPreference: ASK_EVAL_SUN_PREFERENCE,
  plantWindowStart: "05-01",
  plantWindowEnd: "06-15",
  daysToHarvestMin: 60,
  daysToHarvestMax: 80,
  timeEstimates: { watered: 8 },
  notes: null,
  source: "edited",
};

export const askEvalPlanting: PlantingSummary = {
  id: PLANTING_ID,
  locationId: LOCATION_ID,
  locationName: ASK_EVAL_LOCATION_NAME,
  cropName: ASK_EVAL_CROP_NAME,
  variety: "Carmen",
  method: "transplant",
  plantedOn: "2026-06-01",
  daysSincePlanted: 73,
  status: "growing",
  removedOn: null,
};

export const askEvalOpenRecommendation: OpenRecommendation = {
  id: RECOMMENDATION_ID,
  locationId: LOCATION_ID,
  locationName: ASK_EVAL_LOCATION_NAME,
  plantingId: PLANTING_ID,
  actionType: "watered",
  urgency: "today",
  headline: ASK_EVAL_SKIP_HEADLINE,
  rationale: ASK_EVAL_SKIP_RATIONALE,
  confidence: 0.9,
  evidence: {
    facts: ["Rain is forecast in the next 24 hours"],
    inferences: [],
  },
  estimatedMinutes: 8,
  status: "open",
  dueBy: null,
  createdAt: "2026-08-13T12:00:00.000Z",
};

const rainCache: CachedWeather = {
  days: [
    {
      date: "2026-08-13",
      kind: "forecast",
      precipitationMm: 12,
      temperatureMinC: 12,
      temperatureMaxC: 20,
      et0Mm: 1.1,
      windSpeedMaxKph: 8,
      weatherFetchId: "ask-eval-weather",
    },
  ],
  fetchedAt: new Date("2026-08-13T12:00:00.000Z"),
  staleByMs: 0,
  isStale: false,
};

export function createAskEvalDependencies(): ToolRegistryDependencies {
  return {
    gardenProfileStore: {
      getProfile: async () => askEvalProfile,
    },
    currentLocationsStore: {
      list: async () => [askEvalLocation],
    },
    plantingsStore: {
      list: async () => [askEvalPlanting],
    },
    cropCatalogStore: {
      list: async ({ query } = { query: undefined }) => {
        if (!query?.trim()) {
          return [askEvalCrop];
        }
        const needle = query.trim().toLowerCase();
        if (
          askEvalCrop.name.includes(needle) ||
          askEvalCrop.slug.includes(needle)
        ) {
          return [askEvalCrop];
        }
        return [];
      },
    },
    careHistoryStore: {
      list: async ({ days }) => ({ days, entries: [] }),
    },
    gardenNotesStore: {
      list: async () => [],
    },
    openRecommendationsStore: {
      list: async () => [askEvalOpenRecommendation],
    },
    weather: {
      readCache: async () => rainCache,
      refreshCache: async () => ({ ...rainCache, refreshError: null }),
    },
  };
}

export function createAskEvalRegistry(): ToolRegistry {
  return createToolRegistry(
    { gardenId: GARDEN_ID, now: new Date("2026-08-13T19:00:00.000Z") },
    createAskEvalDependencies(),
  );
}
