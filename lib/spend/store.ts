import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { agentRuns, appMetadata, gardens } from "@/lib/db/schema";
import {
  localDayInterval,
  localMonthInterval,
} from "@/lib/garden/local-date";

import { DEFAULT_GARDEN_TIMEZONE, type SpendConfig } from "./config";
import { DAILY_QA_CAP_KINDS } from "./kinds";

export type SpendStore = {
  gardenTimezone(): Promise<string>;
  monthlyPaidSpendUsd(
    now: Date,
    timeZone: string,
    paidProvider: string,
  ): Promise<number>;
  dailyQaCount(input: {
    userId: string;
    now: Date;
    timeZone: string;
  }): Promise<number>;
  alertedThresholds(monthKey: string): Promise<number[]>;
  markThresholdAlerted(
    monthKey: string,
    thresholdUsd: number,
    at: Date,
  ): Promise<void>;
};

const ALERT_KEY_PREFIX = "spend_alert:";

export function alertMetadataKey(monthKey: string) {
  return `${ALERT_KEY_PREFIX}${monthKey}`;
}

export function createSpendStore(): SpendStore {
  return {
    async gardenTimezone() {
      const database = getDatabase();
      const rows = await database
        .select({ timezone: gardens.timezone })
        .from(gardens)
        .limit(1);
      return rows[0]?.timezone ?? DEFAULT_GARDEN_TIMEZONE;
    },

    async monthlyPaidSpendUsd(now, timeZone, paidProvider) {
      const database = getDatabase();
      const { start, end } = localMonthInterval(now, timeZone);
      const rows = await database
        .select({
          total: sql<string>`coalesce(sum(${agentRuns.estimatedCostUsd}), 0)`,
        })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.provider, paidProvider),
            gte(agentRuns.startedAt, start),
            lt(agentRuns.startedAt, end),
          ),
        );
      return Number(rows[0]?.total ?? 0);
    },

    async dailyQaCount(input) {
      const database = getDatabase();
      const { start, end } = localDayInterval(input.now, input.timeZone);
      const rows = await database
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.userId, input.userId),
            inArray(agentRuns.kind, [...DAILY_QA_CAP_KINDS]),
            gte(agentRuns.startedAt, start),
            lt(agentRuns.startedAt, end),
          ),
        );
      return Number(rows[0]?.total ?? 0);
    },

    async alertedThresholds(monthKey) {
      const database = getDatabase();
      const rows = await database
        .select({ value: appMetadata.value })
        .from(appMetadata)
        .where(eq(appMetadata.key, alertMetadataKey(monthKey)))
        .limit(1);
      const raw = rows[0]?.value;
      if (!raw) {
        return [];
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        const values = Array.isArray(parsed)
          ? parsed
          : parsed &&
              typeof parsed === "object" &&
              "thresholds" in parsed &&
              Array.isArray((parsed as { thresholds: unknown }).thresholds)
            ? (parsed as { thresholds: unknown[] }).thresholds
            : [];
        return values.filter(
          (value): value is number =>
            typeof value === "number" && Number.isFinite(value),
        );
      } catch {
        return [];
      }
    },

    async markThresholdAlerted(monthKey, thresholdUsd, at) {
      const database = getDatabase();
      const key = alertMetadataKey(monthKey);
      const existing = await this.alertedThresholds(monthKey);
      const next = [...new Set([...existing, thresholdUsd])].sort(
        (a, b) => a - b,
      );
      const value = JSON.stringify({
        thresholds: next,
        updatedAt: at.toISOString(),
      });
      await database
        .insert(appMetadata)
        .values({ key, value })
        .onConflictDoUpdate({
          target: appMetadata.key,
          set: { value },
        });
    },
  };
}

export async function listRecentAgentRuns(limit = 40) {
  const database = getDatabase();
  return database
    .select({
      id: agentRuns.id,
      kind: agentRuns.kind,
      status: agentRuns.status,
      provider: agentRuns.provider,
      model: agentRuns.model,
      startedAt: agentRuns.startedAt,
      finishedAt: agentRuns.finishedAt,
      inputTokens: agentRuns.inputTokens,
      outputTokens: agentRuns.outputTokens,
      estimatedCostUsd: agentRuns.estimatedCostUsd,
      stopReason: agentRuns.stopReason,
      error: agentRuns.error,
    })
    .from(agentRuns)
    .orderBy(sql`${agentRuns.startedAt} desc`)
    .limit(limit);
}

export type SpendSnapshot = {
  monthKey: string;
  timeZone: string;
  paidSpendUsd: number;
  monthlyCapUsd: number;
  alertThresholdsUsd: number[];
  alertedThresholdsUsd: number[];
  paidProvider: string;
};

export async function getSpendSnapshot(
  config: SpendConfig,
  store: SpendStore = createSpendStore(),
  now: Date = new Date(),
): Promise<SpendSnapshot> {
  const timeZone = await store
    .gardenTimezone()
    .catch(() => config.gardenTimezoneFallback);
  const { monthKey } = localMonthInterval(now, timeZone);
  const [paidSpendUsd, alertedThresholdsUsd] = await Promise.all([
    store.monthlyPaidSpendUsd(now, timeZone, config.paidProvider),
    store.alertedThresholds(monthKey),
  ]);
  return {
    monthKey,
    timeZone,
    paidSpendUsd,
    monthlyCapUsd: config.monthlyCapUsd,
    alertThresholdsUsd: config.alertThresholdsUsd,
    alertedThresholdsUsd,
    paidProvider: config.paidProvider,
  };
}
