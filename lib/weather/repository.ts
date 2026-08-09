import "server-only";

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import {
  gardens,
  weatherDays,
  weatherFetches,
} from "@/lib/db/schema";

import type {
  GardenWeatherConfig,
  WeatherDayInput,
} from "./open-meteo";

export type CachedWeatherDay = WeatherDayInput & {
  weatherFetchId: string;
};

export type CachedWeather = {
  days: CachedWeatherDay[];
  fetchedAt: Date | null;
  staleByMs: number | null;
  isStale: boolean;
};

export type WeatherRepository = {
  getGardenConfig(gardenId?: string): Promise<GardenWeatherConfig>;
  storeSuccessfulFetch(input: {
    gardenId: string;
    requestUrl: string;
    rawResponse: unknown;
    days: WeatherDayInput[];
  }): Promise<string>;
  storeFailedFetch(input: {
    gardenId: string;
    requestUrl: string;
    error: string;
  }): Promise<void>;
  readCachedWeather(input: {
    gardenId: string;
    now: Date;
    staleAfterMs: number;
    startDate?: string;
    endDate?: string;
  }): Promise<CachedWeather>;
};

export function createWeatherRepository(): WeatherRepository {
  return {
    async getGardenConfig(gardenId) {
      const database = getDatabase();
      const rows = await database
        .select({
          id: gardens.id,
          latitude: gardens.latitude,
          longitude: gardens.longitude,
          timezone: gardens.timezone,
        })
        .from(gardens)
        .where(gardenId ? eq(gardens.id, gardenId) : undefined)
        .limit(1);
      const garden = rows[0];

      if (!garden) {
        throw new Error(
          gardenId ? `Garden ${gardenId} was not found` : "Garden was not found",
        );
      }

      return {
        id: garden.id,
        latitude: Number(garden.latitude),
        longitude: Number(garden.longitude),
        timezone: garden.timezone,
      };
    },

    async storeSuccessfulFetch(input) {
      const database = getDatabase();

      return database.transaction(async (transaction) => {
        const fetchRows = await transaction
          .insert(weatherFetches)
          .values({
            gardenId: input.gardenId,
            requestUrl: input.requestUrl,
            rawResponse: input.rawResponse,
            success: true,
          })
          .returning({ id: weatherFetches.id });
        const weatherFetch = fetchRows[0];

        if (!weatherFetch) {
          throw new Error("Weather fetch audit row was not created");
        }

        if (input.days.length > 0) {
          await transaction
            .insert(weatherDays)
            .values(
              input.days.map((day) => ({
                gardenId: input.gardenId,
                weatherFetchId: weatherFetch.id,
                date: day.date,
                kind: day.kind,
                precipitationMm: String(day.precipitationMm),
                temperatureMinC: String(day.temperatureMinC),
                temperatureMaxC: String(day.temperatureMaxC),
                et0Mm: String(day.et0Mm),
                windSpeedMaxKph: String(day.windSpeedMaxKph),
              })),
            )
            .onConflictDoUpdate({
              target: [
                weatherDays.gardenId,
                weatherDays.date,
                weatherDays.kind,
              ],
              set: {
                weatherFetchId: weatherFetch.id,
                precipitationMm: sql`excluded.precipitation_mm`,
                temperatureMinC: sql`excluded.temperature_min_c`,
                temperatureMaxC: sql`excluded.temperature_max_c`,
                et0Mm: sql`excluded.et0_mm`,
                windSpeedMaxKph: sql`excluded.wind_speed_max_kph`,
                updatedAt: new Date(),
              },
            });
        }

        return weatherFetch.id;
      });
    },

    async storeFailedFetch(input) {
      await getDatabase().insert(weatherFetches).values({
        gardenId: input.gardenId,
        requestUrl: input.requestUrl,
        success: false,
        error: input.error,
      });
    },

    async readCachedWeather(input) {
      const database = getDatabase();
      const [days, fetchRows] = await Promise.all([
        database
          .select({
            weatherFetchId: weatherDays.weatherFetchId,
            date: weatherDays.date,
            kind: weatherDays.kind,
            precipitationMm: weatherDays.precipitationMm,
            temperatureMinC: weatherDays.temperatureMinC,
            temperatureMaxC: weatherDays.temperatureMaxC,
            et0Mm: weatherDays.et0Mm,
            windSpeedMaxKph: weatherDays.windSpeedMaxKph,
          })
          .from(weatherDays)
          .where(
            and(
              eq(weatherDays.gardenId, input.gardenId),
              input.startDate
                ? gte(weatherDays.date, input.startDate)
                : undefined,
              input.endDate ? lte(weatherDays.date, input.endDate) : undefined,
            ),
          )
          .orderBy(asc(weatherDays.date)),
        database
          .select({ fetchedAt: weatherFetches.fetchedAt })
          .from(weatherFetches)
          .where(
            and(
              eq(weatherFetches.gardenId, input.gardenId),
              eq(weatherFetches.success, true),
            ),
          )
          .orderBy(desc(weatherFetches.fetchedAt))
          .limit(1),
      ]);
      const fetchedAt = fetchRows[0]?.fetchedAt ?? null;
      const staleByMs = fetchedAt
        ? Math.max(0, input.now.getTime() - fetchedAt.getTime())
        : null;

      return {
        days: days.map((day) => ({
          weatherFetchId: day.weatherFetchId,
          date: day.date,
          kind: day.kind,
          precipitationMm: Number(day.precipitationMm),
          temperatureMinC: Number(day.temperatureMinC),
          temperatureMaxC: Number(day.temperatureMaxC),
          et0Mm: Number(day.et0Mm),
          windSpeedMaxKph: Number(day.windSpeedMaxKph),
        })),
        fetchedAt,
        staleByMs,
        isStale: staleByMs === null || staleByMs > input.staleAfterMs,
      };
    },
  };
}
