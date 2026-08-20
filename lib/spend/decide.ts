import type { AgentRunKind } from "@/lib/agent/record";

import type { SpendConfig } from "./config";
import {
  dailyQaCapApplies,
  isMatchingKind,
  llmSpendCapApplies,
} from "./kinds";
import { DAILY_QA_CAP_MESSAGE, MONTHLY_CAP_MESSAGE } from "./messages";

export type SpendDecision =
  | { ok: true; monthlyPaidSpendUsd: number }
  | {
      ok: false;
      code: "monthly_cap" | "daily_qa_cap";
      message: string;
    };

export function decideSpend(input: {
  kind: AgentRunKind;
  monthlyPaidSpendUsd: number;
  dailyQaCount: number;
  config: SpendConfig;
}): SpendDecision {
  if (isMatchingKind(input.kind) || !llmSpendCapApplies(input.kind)) {
    return { ok: true, monthlyPaidSpendUsd: input.monthlyPaidSpendUsd };
  }

  if (input.monthlyPaidSpendUsd >= input.config.monthlyCapUsd) {
    return {
      ok: false,
      code: "monthly_cap",
      message: MONTHLY_CAP_MESSAGE,
    };
  }

  if (
    dailyQaCapApplies(input.kind) &&
    input.dailyQaCount >= input.config.dailyQaLimit
  ) {
    return {
      ok: false,
      code: "daily_qa_cap",
      message: DAILY_QA_CAP_MESSAGE,
    };
  }

  return { ok: true, monthlyPaidSpendUsd: input.monthlyPaidSpendUsd };
}

export function newlyCrossedThresholds(input: {
  previousSpendUsd: number;
  nextSpendUsd: number;
  thresholdsUsd: number[];
  alreadyAlerted: number[];
}): number[] {
  const alerted = new Set(input.alreadyAlerted);
  return input.thresholdsUsd.filter(
    (threshold) =>
      !alerted.has(threshold) &&
      input.previousSpendUsd < threshold &&
      input.nextSpendUsd >= threshold,
  );
}
