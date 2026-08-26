import { describe, expect, it } from "vitest";

import {
  readWeatherCache,
  refreshWeatherCache,
  type CachedWeather,
  type GardenWeatherConfig,
  type WeatherDayInput,
  type WeatherRepository,
} from "./index";
import { addCalendarDays } from "@/lib/garden/local-date";
import {
  buildOpenMeteoUrl,
  normalizeOpenMeteoResponse,
} from "./open-meteo";

const now = new Date("2026-08-01T19:00:00.000Z");
const garden: GardenWeatherConfig = {
  id: "00000000-0000-4000-8000-000000000001",
  latitude: 45.52,
  longitude: -122.68,
  timezone: "America/Los_Angeles",
};

describe("Open-Meteo weather cache", () => {
  it("builds an uncredentialed request from the garden coordinates and timezone", () => {
    const url = new URL(buildOpenMeteoUrl(garden));

    expect(url.origin).toBe("https://api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("45.52");
    expect(url.searchParams.get("longitude")).toBe("-122.68");
    expect(url.searchParams.get("timezone")).toBe("America/Los_Angeles");
    expect(url.searchParams.get("past_days")).toBe("7");
    expect(url.searchParams.get("forecast_days")).toBe("15");
    expect(url.search).not.toMatch(/key|token|secret/i);
  });

  it("normalizes seven observed days and today plus fourteen forecast days", () => {
    const days = normalizeOpenMeteoResponse(
      openMeteoResponse(),
      garden.timezone,
      now,
    );

    expect(days).toHaveLength(22);
    expect(days.filter(({ kind }) => kind === "observed")).toHaveLength(7);
    expect(days.filter(({ kind }) => kind === "forecast")).toHaveLength(15);
    expect(
      days
        .filter(({ kind }) => kind === "observed")
        .every(({ et0Mm }) => et0Mm > 0),
    ).toBe(true);
  });

  it("audits successful fetches and upserts repeated days", async () => {
    const repository = new InMemoryWeatherRepository(garden);
    const firstResponse = openMeteoResponse();
    const secondResponse = openMeteoResponse(9.5);

    await refreshWeatherCache(
      { now },
      {
        repository,
        fetchImplementation: jsonFetch(firstResponse),
      },
    );
    const result = await refreshWeatherCache(
      { now },
      {
        repository,
        fetchImplementation: jsonFetch(secondResponse),
      },
    );

    expect(repository.successfulAudits).toHaveLength(2);
    expect(repository.days).toHaveLength(22);
    expect(result.days).toHaveLength(22);
    expect(result.days[0]?.precipitationMm).toBe(9.5);
    expect(result.refreshError).toBeNull();
    expect(repository.successfulAudits[0]?.requestUrl).toContain(
      "latitude=45.52",
    );
    expect(repository.successfulAudits[0]?.rawResponse).toEqual(firstResponse);
  });

  it("returns cached data and reports staleness when refresh fails", async () => {
    const repository = new InMemoryWeatherRepository(garden);
    await refreshWeatherCache(
      { now },
      {
        repository,
        fetchImplementation: jsonFetch(openMeteoResponse()),
      },
    );
    const eightHoursLater = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
    const failed = await refreshWeatherCache(
      { now: eightHoursLater },
      {
        repository,
        fetchImplementation: rejectingFetch("network unavailable"),
      },
    );

    expect(failed.days).toHaveLength(22);
    expect(failed.refreshError).toBe("network unavailable");
    expect(failed.staleByMs).toBe(8 * 60 * 60 * 1_000);
    expect(failed.isStale).toBe(true);
    expect(repository.failedAudits).toEqual(["network unavailable"]);
  });

  it("serves reads from the cache without making a network request", async () => {
    const repository = new InMemoryWeatherRepository(garden);
    await repository.storeSuccessfulFetch({
      gardenId: garden.id,
      requestUrl: buildOpenMeteoUrl(garden),
      rawResponse: openMeteoResponse(),
      days: normalizeOpenMeteoResponse(
        openMeteoResponse(),
        garden.timezone,
        now,
      ),
    });

    const result = await readWeatherCache({ now }, repository);

    expect(result.days).toHaveLength(22);
    expect(result.isStale).toBe(false);
  });
});

class InMemoryWeatherRepository implements WeatherRepository {
  readonly successfulAudits: {
    id: string;
    requestUrl: string;
    rawResponse: unknown;
  }[] = [];
  readonly failedAudits: string[] = [];
  readonly dayMap = new Map<string, WeatherDayInput & { weatherFetchId: string }>();
  fetchedAt: Date | null = null;

  constructor(private readonly garden: GardenWeatherConfig) {}

  get days() {
    return [...this.dayMap.values()];
  }

  async getGardenConfig(gardenId?: string) {
    if (gardenId && gardenId !== this.garden.id) {
      throw new Error("Garden was not found");
    }
    return this.garden;
  }

  async storeSuccessfulFetch(input: {
    gardenId: string;
    requestUrl: string;
    rawResponse: unknown;
    days: WeatherDayInput[];
  }) {
    const id = `fetch-${this.successfulAudits.length + 1}`;
    this.successfulAudits.push({
      id,
      requestUrl: input.requestUrl,
      rawResponse: input.rawResponse,
    });
    for (const day of input.days) {
      this.dayMap.set(`${day.date}:${day.kind}`, {
        ...day,
        weatherFetchId: id,
      });
    }
    this.fetchedAt = now;
    return id;
  }

  async storeFailedFetch(input: {
    gardenId: string;
    requestUrl: string;
    error: string;
  }) {
    this.failedAudits.push(input.error);
  }

  async readCachedWeather(input: {
    gardenId: string;
    now: Date;
    staleAfterMs: number;
    startDate?: string;
    endDate?: string;
  }): Promise<CachedWeather> {
    const staleByMs = this.fetchedAt
      ? input.now.getTime() - this.fetchedAt.getTime()
      : null;
    const days = this.days
      .filter(
        ({ date }) =>
          (!input.startDate || date >= input.startDate) &&
          (!input.endDate || date <= input.endDate),
      )
      .sort((left, right) => left.date.localeCompare(right.date));

    return {
      days,
      fetchedAt: this.fetchedAt,
      staleByMs,
      isStale: staleByMs === null || staleByMs > input.staleAfterMs,
    };
  }
}

function openMeteoResponse(firstPrecipitation = 0.5) {
  const dates = datesBetween("2026-07-25", 22);
  const values = dates.map((_, index) => index + 1);

  return {
    daily: {
      time: dates,
      precipitation_sum: values.map((value, index) =>
        index === 0 ? firstPrecipitation : value / 10,
      ),
      temperature_2m_min: values.map((value) => 10 + value / 10),
      temperature_2m_max: values.map((value) => 20 + value / 10),
      et0_fao_evapotranspiration: values.map((value) => value / 10),
      wind_speed_10m_max: values.map((value) => 5 + value),
    },
  };
}

function datesBetween(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    addCalendarDays(start, index),
  );
}

function jsonFetch(body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function rejectingFetch(message: string): typeof fetch {
  return (async () => {
    throw new Error(message);
  }) as typeof fetch;
}
