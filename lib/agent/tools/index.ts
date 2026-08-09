import type { ToolCallRequest, ToolDefinition } from "@/lib/llm/types";

import { getCareHistory } from "./get-care-history";
import { getCurrentLocations } from "./get-current-locations";
import { getGardenNotes } from "./get-garden-notes";
import { getGardenProfile } from "./get-garden-profile";
import { getOpenRecommendations } from "./get-open-recommendations";
import { getPlantings } from "./get-plantings";
import { getWeather } from "./get-weather";
import { emptyObjectSchema, type ToolExecutionContext } from "./types";

export const READ_TOOL_NAMES = [
  "get_garden_profile",
  "get_current_locations",
  "get_plantings",
  "get_care_history",
  "get_weather",
  "get_garden_notes",
  "get_open_recommendations",
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
      "Return currently open recommendations so you avoid restating advice that is already pending.",
    inputSchema: { ...emptyObjectSchema },
  },
];

export type ToolRegistry = {
  definitions: ToolDefinition[];
  execute: (call: ToolCallRequest) => Promise<unknown>;
};

export function createToolRegistry(
  context: ToolExecutionContext = {},
): ToolRegistry {
  return {
    definitions: agentToolDefinitions,
    async execute(call) {
      switch (call.name as ReadToolName) {
        case "get_garden_profile":
          return getGardenProfile(context);
        case "get_current_locations":
          return getCurrentLocations(context);
        case "get_plantings":
          return getPlantings(context);
        case "get_care_history":
          return getCareHistory({
            ...context,
            days: optionalInteger(call.input.days),
          });
        case "get_weather":
          return getWeather({
            ...context,
            pastDays: optionalInteger(call.input.past_days),
            forecastDays: optionalInteger(call.input.forecast_days),
          });
        case "get_garden_notes":
          return getGardenNotes(context);
        case "get_open_recommendations":
          return getOpenRecommendations(context);
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

export type { ToolExecutionContext } from "./types";

export {
  getCareHistory,
  getCurrentLocations,
  getGardenNotes,
  getGardenProfile,
  getOpenRecommendations,
  getPlantings,
  getWeather,
};
