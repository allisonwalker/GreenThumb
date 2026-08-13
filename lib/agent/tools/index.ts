import type { ToolCallRequest, ToolDefinition } from "@/lib/llm/types";

import {
  getCareHistory,
  type CareHistoryStore,
} from "./get-care-history";
import {
  getCropCatalog,
  type CropCatalogStore,
} from "./get-crop-catalog";
import {
  getCurrentLocations,
  type CurrentLocationsStore,
} from "./get-current-locations";
import {
  createGardenNotesStore,
  getGardenNotes,
  type GardenNotesStore,
} from "./get-garden-notes";
import {
  createGardenProfileStore,
  getGardenProfile,
  type GardenProfileStore,
} from "./get-garden-profile";
import {
  getOpenRecommendations,
  type OpenRecommendationsStore,
} from "./get-open-recommendations";
import { getPlantings, type PlantingsStore } from "./get-plantings";
import { getWeather, type WeatherToolDependencies } from "./get-weather";
import { emptyObjectSchema, type ToolExecutionContext } from "./types";

/**
 * Conversational registry — getters only. Ask and time-budget share this
 * list. Do not add a write tool.
 */
export const READ_TOOL_NAMES = [
  "get_garden_profile",
  "get_current_locations",
  "get_plantings",
  "get_crop_catalog",
  "get_care_history",
  "get_weather",
  "get_garden_notes",
  "get_open_recommendations",
] as const;

/** Names that must never be registered or executable from conversation. */
export const FORBIDDEN_WRITE_TOOL_NAMES = [
  "propose_recommendation",
  "save_harvest_estimate",
] as const;

export type ReadToolName = (typeof READ_TOOL_NAMES)[number];

export const agentToolDefinitions: ToolDefinition[] = [
  {
    name: "get_garden_profile",
    description:
      "Return the singleton garden profile: coordinates, timezone, hardiness zone, frost dates, and bed dimensions.",
    inputSchema: { ...emptyObjectSchema },
  },
  {
    name: "get_current_locations",
    description:
      "List current plantable locations (active season bed sections plus permanent pots) with sun exposure and dryness_factor.",
    inputSchema: { ...emptyObjectSchema },
  },
  {
    name: "get_plantings",
    description:
      "List active plantings with crop, planted_on, and days since planting.",
    inputSchema: { ...emptyObjectSchema },
  },
  {
    name: "get_crop_catalog",
    description:
      "Return crop care rows (sun_preference, watering interval, frost, harvest window, time estimates). Optional query filters by name or slug. If a row or field is missing, say so — do not guess.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional crop name or slug to search for.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_care_history",
    description:
      "Return recent care actions from the action log (default last 30 days).",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 365,
          description: "How many days of history to include. Defaults to 30.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_weather",
    description:
      "Return cached garden weather (precipitation, temps, ET₀, wind) for a past/forecast window. Defaults to past 7 and next 7 local days.",
    inputSchema: {
      type: "object",
      properties: {
        past_days: {
          type: "integer",
          minimum: 0,
          maximum: 16,
          description: "Days of history before local today. Defaults to 7.",
        },
        forecast_days: {
          type: "integer",
          minimum: 0,
          maximum: 16,
          description: "Days of forecast after local today. Defaults to 7.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_garden_notes",
    description:
      "Return free-text garden notes that correct or specialize model knowledge about this yard.",
    inputSchema: { ...emptyObjectSchema },
  },
  {
    name: "get_open_recommendations",
    description:
      "Return the already-computed open Today list. Read this instead of recomputing care. Do not invent tasks that are not in the result.",
    inputSchema: { ...emptyObjectSchema },
  },
];

export type ToolRegistry = {
  definitions: ToolDefinition[];
  execute: (call: ToolCallRequest) => Promise<unknown>;
};

export type ToolRegistryDependencies = {
  gardenProfileStore?: GardenProfileStore;
  currentLocationsStore?: CurrentLocationsStore;
  plantingsStore?: PlantingsStore;
  cropCatalogStore?: CropCatalogStore;
  careHistoryStore?: CareHistoryStore;
  gardenNotesStore?: GardenNotesStore;
  openRecommendationsStore?: OpenRecommendationsStore;
  weather?: WeatherToolDependencies;
};

export function createToolRegistry(
  context: ToolExecutionContext = {},
  dependencies: ToolRegistryDependencies = {},
): ToolRegistry {
  const profileStore =
    dependencies.gardenProfileStore ?? createGardenProfileStore();

  return {
    definitions: agentToolDefinitions,
    async execute(call) {
      if (
        (FORBIDDEN_WRITE_TOOL_NAMES as readonly string[]).includes(call.name)
      ) {
        throw new Error(`Unknown tool: ${call.name}`);
      }

      switch (call.name as ReadToolName) {
        case "get_garden_profile":
          return getGardenProfile(context, profileStore);
        case "get_current_locations":
          return getCurrentLocations(
            context,
            dependencies.currentLocationsStore,
          );
        case "get_plantings":
          return getPlantings(
            context,
            dependencies.plantingsStore,
            profileStore,
          );
        case "get_crop_catalog":
          return getCropCatalog(
            {
              ...context,
              query: optionalString(call.input.query),
            },
            dependencies.cropCatalogStore,
          );
        case "get_care_history":
          return getCareHistory(
            {
              ...context,
              days: optionalInteger(call.input.days),
            },
            dependencies.careHistoryStore,
          );
        case "get_weather":
          return getWeather(
            {
              ...context,
              pastDays: optionalInteger(call.input.past_days),
              forecastDays: optionalInteger(call.input.forecast_days),
            },
            {
              profileStore,
              ...dependencies.weather,
            },
          );
        case "get_garden_notes":
          return getGardenNotes(
            context,
            dependencies.gardenNotesStore ?? createGardenNotesStore(),
            profileStore,
          );
        case "get_open_recommendations":
          return getOpenRecommendations(
            context,
            dependencies.openRecommendationsStore,
            profileStore,
          );
        default:
          throw new Error(`Unknown tool: ${call.name}`);
      }
    },
  };
}

function optionalInteger(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }
  throw new Error(`Expected integer, got ${typeof value}`);
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`Expected string, got ${typeof value}`);
}

export type { ToolExecutionContext } from "./types";

export {
  getCareHistory,
  getCropCatalog,
  getCurrentLocations,
  getGardenNotes,
  getGardenProfile,
  getOpenRecommendations,
  getPlantings,
  getWeather,
};
