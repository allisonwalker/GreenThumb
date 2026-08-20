import type { AgentRunKind } from "@/lib/agent/record";
import { localMonthInterval } from "@/lib/garden/local-date";

import { resolveSpendConfig, type SpendConfig } from "./config";
import {
  decideSpend,
  newlyCrossedThresholds,
  type SpendDecision,
} from "./decide";
import { monthlyCapAlertMessage } from "./messages";
import { createSpendStore, type SpendStore } from "./store";

export type SpendGate = {
  authorize(input: {
    kind: AgentRunKind;
    userId?: string | null;
    now?: Date;
  }): Promise<SpendDecision>;
  recordThresholdAlerts(input: {
    previousSpendUsd: number;
    nextSpendUsd: number;
    now?: Date;
  }): Promise<SpendAlert[]>;
};

export type SpendAlert = {
  thresholdUsd: number;
  spendUsd: number;
  message: string;
};

export function allowAllSpendGate(): SpendGate {
  return {
    async authorize() {
      return { ok: true, monthlyPaidSpendUsd: 0 };
    },
    async recordThresholdAlerts() {
      return [];
    },
  };
}

export function createSpendGate(
  options: {
    config?: SpendConfig;
    store?: SpendStore;
    onAlert?: (alert: SpendAlert) => void;
  } = {},
): SpendGate {
  const config = options.config ?? resolveSpendConfig();
  const store = options.store ?? createSpendStore();
  const onAlert =
    options.onAlert ??
    ((alert: SpendAlert) => {
      console.warn(`[spend] ${alert.message}`);
    });

  async function timezoneOrFallback() {
    try {
      return await store.gardenTimezone();
    } catch {
      return config.gardenTimezoneFallback;
    }
  }

  return {
    async authorize(input) {
      const now = input.now ?? new Date();
      const timeZone = await timezoneOrFallback();
      const monthlyPaidSpendUsd = await store.monthlyPaidSpendUsd(
        now,
        timeZone,
        config.paidProvider,
      );
      const dailyQaCount =
        input.userId != null && input.userId !== ""
          ? await store.dailyQaCount({
              userId: input.userId,
              now,
              timeZone,
            })
          : 0;

      return decideSpend({
        kind: input.kind,
        monthlyPaidSpendUsd,
        dailyQaCount,
        config,
      });
    },

    async recordThresholdAlerts(input) {
      const now = input.now ?? new Date();
      const timeZone = await timezoneOrFallback();
      const { monthKey } = localMonthInterval(now, timeZone);
      const alreadyAlerted = await store.alertedThresholds(monthKey);
      const crossed = newlyCrossedThresholds({
        previousSpendUsd: input.previousSpendUsd,
        nextSpendUsd: input.nextSpendUsd,
        thresholdsUsd: config.alertThresholdsUsd,
        alreadyAlerted,
      });

      const alerts: SpendAlert[] = [];
      for (const thresholdUsd of crossed) {
        await store.markThresholdAlerted(monthKey, thresholdUsd, now);
        const alert = {
          thresholdUsd,
          spendUsd: input.nextSpendUsd,
          message: monthlyCapAlertMessage(thresholdUsd, input.nextSpendUsd),
        };
        onAlert(alert);
        alerts.push(alert);
      }
      return alerts;
    },
  };
}
