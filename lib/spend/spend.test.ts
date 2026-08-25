import { describe, expect, it } from "vitest";

import { resolveSpendConfig } from "./config";
import { decideSpend, newlyCrossedThresholds } from "./decide";
import {
  dailyQaCapApplies,
  isMatchingKind,
  llmSpendCapApplies,
} from "./kinds";

const config = resolveSpendConfig({
  LLM_MONTHLY_CAP_USD: "100",
  LLM_DAILY_QA_LIMIT: "20",
  LLM_ALERT_THRESHOLDS: "50,80",
});

describe("spend kinds", () => {
  it("caps conversation and draft kinds, not matching", () => {
    expect(llmSpendCapApplies("ask")).toBe(true);
    expect(llmSpendCapApplies("time_budget")).toBe(true);
    expect(llmSpendCapApplies("crop_draft")).toBe(true);
    expect(llmSpendCapApplies("scheduled_checkin")).toBe(false);
    expect(llmSpendCapApplies("script")).toBe(false);
    expect(isMatchingKind("scheduled_checkin")).toBe(true);
    expect(dailyQaCapApplies("ask")).toBe(true);
    expect(dailyQaCapApplies("crop_draft")).toBe(false);
  });
});

describe("decideSpend", () => {
  it("refuses conversation/draft when paid monthly spend is at the cap", () => {
    const decision = decideSpend({
      kind: "ask",
      monthlyPaidSpendUsd: 100,
      dailyQaCount: 0,
      config,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("monthly_cap");
      expect(decision.message).toMatch(/care list is unaffected/i);
    }
  });

  it("refuses crop drafts at the monthly cap and still allows matching", () => {
    expect(
      decideSpend({
        kind: "crop_draft",
        monthlyPaidSpendUsd: 100,
        dailyQaCount: 0,
        config,
      }).ok,
    ).toBe(false);
    expect(
      decideSpend({
        kind: "scheduled_checkin",
        monthlyPaidSpendUsd: 100,
        dailyQaCount: 0,
        config,
      }).ok,
    ).toBe(true);
  });

  it("does not count Gemini-free script/test kinds against the conversation cap", () => {
    expect(
      decideSpend({
        kind: "script",
        monthlyPaidSpendUsd: 500,
        dailyQaCount: 0,
        config,
      }).ok,
    ).toBe(true);
  });

  it("returns a friendly daily Q&A message instead of an error", () => {
    const decision = decideSpend({
      kind: "time_budget",
      monthlyPaidSpendUsd: 10,
      dailyQaCount: 20,
      config,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("daily_qa_cap");
      expect(decision.message).not.toMatch(/error/i);
      expect(decision.message).toMatch(/try again tomorrow/i);
    }
  });
});

describe("threshold alerts", () => {
  it("fires once at $50 and once at $80", () => {
    expect(
      newlyCrossedThresholds({
        previousSpendUsd: 49.9,
        nextSpendUsd: 81,
        thresholdsUsd: [50, 80],
        alreadyAlerted: [],
      }),
    ).toEqual([50, 80]);

    expect(
      newlyCrossedThresholds({
        previousSpendUsd: 79,
        nextSpendUsd: 81,
        thresholdsUsd: [50, 80],
        alreadyAlerted: [50],
      }),
    ).toEqual([80]);

    expect(
      newlyCrossedThresholds({
        previousSpendUsd: 80,
        nextSpendUsd: 90,
        thresholdsUsd: [50, 80],
        alreadyAlerted: [50, 80],
      }),
    ).toEqual([]);
  });
});
