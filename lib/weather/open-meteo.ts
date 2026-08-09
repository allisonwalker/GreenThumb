const DAILY_FIELDS = [
  "precipitation_sum",
  "temperature_2m_min",
  "temperature_2m_max",
  "et0_fao_evapotranspiration",
  "wind_speed_10m_max",
] as const;

export type GardenWeatherConfig = {
  id: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type WeatherDayInput = {
  date: string;
  kind: "observed" | "forecast";
  precipitationMm: number;
  temperatureMinC: number;
  temperatureMaxC: number;
  et0Mm: number;
  windSpeedMaxKph: number;
};

type OpenMeteoDaily = {
  time: unknown;
  precipitation_sum: unknown;
  temperature_2m_min: unknown;
  temperature_2m_max: unknown;
  et0_fao_evapotranspiration: unknown;
  wind_speed_10m_max: unknown;
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
};

export function buildOpenMeteoUrl(config: GardenWeatherConfig): string {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(config.latitude));
  url.searchParams.set("longitude", String(config.longitude));
  url.searchParams.set("timezone", config.timezone);
  url.searchParams.set("daily", DAILY_FIELDS.join(","));
  url.searchParams.set("past_days", "7");
  // Open-Meteo includes today, so 15 days covers today plus 14 days ahead.
  url.searchParams.set("forecast_days", "15");

  return url.toString();
}

export async function fetchOpenMeteo(
  requestUrl: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<{ rawResponse: unknown; days: WeatherDayInput[] }> {
  const response = await fetchImplementation(requestUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const rawResponse: unknown = await response.json();
  return {
    rawResponse,
    days: normalizeOpenMeteoResponse(rawResponse, timezoneFromUrl(requestUrl)),
  };
}

export function normalizeOpenMeteoResponse(
  rawResponse: unknown,
  timezone: string,
  now: Date = new Date(),
): WeatherDayInput[] {
  if (!isRecord(rawResponse)) {
    throw new Error("Open-Meteo returned a non-object response");
  }

  const daily = (rawResponse as OpenMeteoResponse).daily;
  if (!daily || !isRecord(daily)) {
    throw new Error("Open-Meteo response is missing daily weather");
  }

  const dates = requireStringArray(daily.time, "daily.time");
  const precipitation = requireNumberArray(
    daily.precipitation_sum,
    "daily.precipitation_sum",
    dates.length,
  );
  const temperatureMin = requireNumberArray(
    daily.temperature_2m_min,
    "daily.temperature_2m_min",
    dates.length,
  );
  const temperatureMax = requireNumberArray(
    daily.temperature_2m_max,
    "daily.temperature_2m_max",
    dates.length,
  );
  const et0 = requireNumberArray(
    daily.et0_fao_evapotranspiration,
    "daily.et0_fao_evapotranspiration",
    dates.length,
  );
  const windSpeedMax = requireNumberArray(
    daily.wind_speed_10m_max,
    "daily.wind_speed_10m_max",
    dates.length,
  );
  const localToday = dateInTimezone(now, timezone);

  return dates.map((date, index) => ({
    date,
    kind: date < localToday ? "observed" : "forecast",
    precipitationMm: precipitation[index],
    temperatureMinC: temperatureMin[index],
    temperatureMaxC: temperatureMax[index],
    et0Mm: et0[index],
    windSpeedMaxKph: windSpeedMax[index],
  }));
}

function timezoneFromUrl(requestUrl: string): string {
  const timezone = new URL(requestUrl).searchParams.get("timezone");
  if (!timezone) {
    throw new Error("Open-Meteo request URL is missing timezone");
  }
  return timezone;
}

function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(`${path} must be a non-empty string array`);
  }
  return value;
}

function requireNumberArray(
  value: unknown,
  path: string,
  expectedLength: number,
): number[] {
  if (
    !Array.isArray(value) ||
    value.length !== expectedLength ||
    !value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    throw new Error(
      `${path} must contain ${expectedLength} finite numeric values`,
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
