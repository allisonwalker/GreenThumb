/** Anthropic credits are the $100 balance; Gemini free-tier estimates do not count. */
export const PAID_LLM_PROVIDER = "anthropic";

export const DEFAULT_MONTHLY_CAP_USD = 100;
export const DEFAULT_DAILY_QA_LIMIT = 20;
export const DEFAULT_ALERT_THRESHOLDS_USD = [50, 80] as const;
export const DEFAULT_GARDEN_TIMEZONE = "America/Los_Angeles";

export type SpendConfig = {
  monthlyCapUsd: number;
  dailyQaLimit: number;
  alertThresholdsUsd: number[];
  paidProvider: string;
  gardenTimezoneFallback: string;
};

export function parsePositiveNumber(
  raw: string | undefined,
  fallback: number,
): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Expected a non-negative number, got ${raw}`);
  }
  return value;
}

export function parseAlertThresholds(
  raw: string | undefined,
  fallback: readonly number[] = DEFAULT_ALERT_THRESHOLDS_USD,
): number[] {
  if (raw === undefined || raw.trim() === "") {
    return [...fallback];
  }
  const values = raw.split(",").map((part) => Number(part.trim()));
  if (
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new Error(
      `LLM_ALERT_THRESHOLDS must be comma-separated numbers (got ${raw})`,
    );
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

export function resolveSpendConfig(
  environment: Record<string, string | undefined> = process.env,
): SpendConfig {
  return {
    monthlyCapUsd: parsePositiveNumber(
      environment.LLM_MONTHLY_CAP_USD,
      DEFAULT_MONTHLY_CAP_USD,
    ),
    dailyQaLimit: Math.floor(
      parsePositiveNumber(
        environment.LLM_DAILY_QA_LIMIT,
        DEFAULT_DAILY_QA_LIMIT,
      ),
    ),
    alertThresholdsUsd: parseAlertThresholds(environment.LLM_ALERT_THRESHOLDS),
    paidProvider: PAID_LLM_PROVIDER,
    gardenTimezoneFallback: DEFAULT_GARDEN_TIMEZONE,
  };
}
