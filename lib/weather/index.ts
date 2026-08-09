import {
  buildOpenMeteoUrl,
  fetchOpenMeteo,
} from "./open-meteo";
import {
  createWeatherRepository,
  type CachedWeather,
  type WeatherRepository,
} from "./repository";

const DEFAULT_STALE_AFTER_MS = 6 * 60 * 60 * 1_000;

export type WeatherReadOptions = {
  gardenId?: string;
  startDate?: string;
  endDate?: string;
  now?: Date;
  staleAfterMs?: number;
};

export type WeatherRefreshResult = CachedWeather & {
  refreshError: string | null;
};

type WeatherDependencies = {
  repository?: WeatherRepository;
  fetchImplementation?: typeof fetch;
};

export async function refreshWeatherCache(
  options: WeatherReadOptions = {},
  dependencies: WeatherDependencies = {},
): Promise<WeatherRefreshResult> {
  const repository = dependencies.repository ?? createWeatherRepository();
  const garden = await repository.getGardenConfig(options.gardenId);
  const requestUrl = buildOpenMeteoUrl(garden);
  let refreshError: string | null = null;

  try {
    const response = await fetchOpenMeteo(
      requestUrl,
      dependencies.fetchImplementation,
    );
    await repository.storeSuccessfulFetch({
      gardenId: garden.id,
      requestUrl,
      rawResponse: response.rawResponse,
      days: response.days,
    });
  } catch (error) {
    refreshError = errorMessage(error);
    await repository.storeFailedFetch({
      gardenId: garden.id,
      requestUrl,
      error: refreshError,
    });
  }

  return {
    ...(await readFromRepository(repository, garden.id, options)),
    refreshError,
  };
}

export async function readWeatherCache(
  options: WeatherReadOptions = {},
  repository: WeatherRepository = createWeatherRepository(),
): Promise<CachedWeather> {
  const garden = await repository.getGardenConfig(options.gardenId);
  return readFromRepository(repository, garden.id, options);
}

async function readFromRepository(
  repository: WeatherRepository,
  gardenId: string,
  options: WeatherReadOptions,
): Promise<CachedWeather> {
  return repository.readCachedWeather({
    gardenId,
    now: options.now ?? new Date(),
    staleAfterMs: options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS,
    startDate: options.startDate,
    endDate: options.endDate,
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown weather refresh error";
}

export type {
  CachedWeather,
  CachedWeatherDay,
  WeatherRepository,
} from "./repository";
export type {
  GardenWeatherConfig,
  WeatherDayInput,
} from "./open-meteo";
