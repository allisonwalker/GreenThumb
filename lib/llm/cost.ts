import type { LlmProviderName } from "./types";

/** Published list prices used for agent_run estimates (USD per million tokens). */
const RATES: Record<
  LlmProviderName,
  { inputPerMillion: number; outputPerMillion: number }
> = {
  // Intro Sonnet rates through 2026-08-31; still active for this build window.
  anthropic: { inputPerMillion: 2, outputPerMillion: 10 },
  // Flash list price; free-tier calls still record an estimate for comparison.
  gemini: { inputPerMillion: 0.1, outputPerMillion: 0.4 },
};

export function estimateCostUsd(input: {
  provider: LlmProviderName;
  inputTokens: number;
  outputTokens: number;
}): number {
  const rates = RATES[input.provider];
  const cost =
    (input.inputTokens / 1_000_000) * rates.inputPerMillion +
    (input.outputTokens / 1_000_000) * rates.outputPerMillion;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
