import {
  readWeatherCache,
  refreshWeatherCache,
  type CachedWeather,
} from "@/lib/weather";
import { addCalendarDays, localDateString } from "@/lib/garden/local-date";

import { createGardenProfileStore } from "./get-garden-profile";
import type { ToolExecutionContext } from "./types";

export type WeatherToolResult = {
  startDate: string;
  endDate: string;
  timezone: string;
  isStale: boolean;
  staleByMs: number | null;
  fetchedAt: string | null;
  refreshError: string | null;
  weatherFetchId: string | null;
  days: Array<{
    date: string;
    kind: "observed" | "forecast";
    precipitationMm: number;
    temperatureMinC: number;
    temperatureMaxC: number;
    et0Mm: number;
    windSpeedMaxKph: number;
  }>;
};

export type WeatherToolDependencies = {
  profileStore?: ReturnType<typeof createGardenProfileStore>;
  readCache?: typeof readWeatherCache;
  refreshCache?: typeof refreshWeatherCache;
};

export async function getWeather(
  input: ToolExecutionContext & {
    pastDays?: number;
    forecastDays?: number;
  } = {},
  dependencies: WeatherToolDependencies = {},
): Promise<WeatherToolResult> {
  const pastDays = input.pastDays ?? 7;
  const forecastDays = input.forecastDays ?? 7;
  if (!Number.isInteger(pastDays) || pastDays < 0 || pastDays > 16) {
    throw new Error("pastDays must be an integer between 0 and 16");
  }
  if (!Number.isInteger(forecastDays) || forecastDays < 0 || forecastDays > 16) {
    throw new Error("forecastDays must be an integer between 0 and 16");
  }

  const profileStore =
    dependencies.profileStore ?? createGardenProfileStore();
  const profile = await profileStore.getProfile(input.gardenId);
  const now = input.now ?? new Date();
  const today = localDateString(now, profile.timezone);
  const startDate = addCalendarDays(today, -pastDays);
  const endDate = addCalendarDays(today, forecastDays);

  const readCache = dependencies.readCache ?? readWeatherCache;
  const refreshCache = dependencies.refreshCache ?? refreshWeatherCache;

  let cached: CachedWeather & { refreshError?: string | null } =
    await readCache({
      gardenId: profile.gardenId,
      startDate,
      endDate,
      now,
    });
  let refreshError: string | null = null;

  if (cached.isStale || cached.days.length === 0) {
    const refreshed = await refreshCache({
      gardenId: profile.gardenId,
      startDate,
      endDate,
      now,
    });
    cached = refreshed;
    refreshError = refreshed.refreshError;
  }

  const weatherFetchId =
    cached.days.find((day) => day.weatherFetchId)?.weatherFetchId ?? null;

  return {
    startDate,
    endDate,
    timezone: profile.timezone,
    isStale: cached.isStale,
    staleByMs: cached.staleByMs,
    fetchedAt: cached.fetchedAt?.toISOString() ?? null,
    refreshError,
    weatherFetchId,
    days: cached.days.map((day) => ({
      date: day.date,
      kind: day.kind,
      precipitationMm: day.precipitationMm,
      temperatureMinC: day.temperatureMinC,
      temperatureMaxC: day.temperatureMaxC,
      et0Mm: day.et0Mm,
      windSpeedMaxKph: day.windSpeedMaxKph,
    })),
  };
}
