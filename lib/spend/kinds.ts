import type { AgentRunKind } from "@/lib/agent/record";

/** Conversation and crop-draft runs — hard-capped against paid LLM spend. */
export const LLM_SPEND_CAP_KINDS = [
  "ask",
  "time_budget",
  "crop_draft",
] as const satisfies readonly AgentRunKind[];

/** Q&A-style requests that share the per-user daily cap. */
export const DAILY_QA_CAP_KINDS = [
  "ask",
  "time_budget",
] as const satisfies readonly AgentRunKind[];

/**
 * Matching / care check-in must never be gated on LLM budget (ALL-15 / ALL-52).
 * `scheduled_checkin` is the matching job's kind; it is not a model loop.
 */
export const MATCHING_KINDS = [
  "scheduled_checkin",
] as const satisfies readonly AgentRunKind[];

export type LlmSpendCapKind = (typeof LLM_SPEND_CAP_KINDS)[number];
export type DailyQaCapKind = (typeof DAILY_QA_CAP_KINDS)[number];

export function llmSpendCapApplies(kind: AgentRunKind): boolean {
  return (LLM_SPEND_CAP_KINDS as readonly string[]).includes(kind);
}

export function dailyQaCapApplies(kind: AgentRunKind): boolean {
  return (DAILY_QA_CAP_KINDS as readonly string[]).includes(kind);
}

export function isMatchingKind(kind: AgentRunKind): boolean {
  return (MATCHING_KINDS as readonly string[]).includes(kind);
}
