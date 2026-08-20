import "server-only";

import { createAgentRunStore } from "@/lib/agent/record";
import { getGardenProfileRecord } from "@/lib/garden/profile-repository";
import { createGeminiClient } from "@/lib/llm";
import { createSpendGate } from "@/lib/spend";

import {
  draftCropCareFlow,
  type CropDraftResult,
  type DraftCropCareFlowOptions,
} from "./draft-flow";
import {
  applyGeneratedCareFields,
  getCropRecord,
} from "./repository";

export {
  buildCropDraftUserMessage,
  CROP_DRAFT_MAX_OUTPUT_TOKENS,
  CROP_DRAFT_RESPONSE_SCHEMA,
  CROP_DRAFT_SYSTEM_PROMPT,
  CROP_DRAFT_TIMEOUT_MS,
  CropDraftDecodeError,
  decodeCropDraftJson,
} from "./draft-core";
export { draftCropCareFlow } from "./draft-flow";
export type {
  CropDraftOutcome,
  CropDraftResult,
  DraftCropCareFlowOptions,
} from "./draft-flow";

export type DraftCropCareOptions = Omit<
  DraftCropCareFlowOptions,
  "getCrop" | "applyCare" | "client" | "hardinessZone"
> & {
  hardinessZone?: string;
  client?: DraftCropCareFlowOptions["client"];
  getCrop?: DraftCropCareFlowOptions["getCrop"];
  applyCare?: DraftCropCareFlowOptions["applyCare"];
};

/**
 * Session-facing crop draft. Uses Gemini even when Ask uses Anthropic.
 */
export async function draftCropCare(
  options: DraftCropCareOptions,
): Promise<CropDraftResult> {
  const hardinessZone =
    options.hardinessZone ??
    (await getGardenProfileRecord())?.hardinessZone ??
    "unknown";

  return draftCropCareFlow({
    ...options,
    hardinessZone,
    getCrop: options.getCrop ?? getCropRecord,
    applyCare: options.applyCare ?? applyGeneratedCareFields,
    client: options.client ?? createGeminiClient(),
    store: options.store ?? createAgentRunStore(),
    spendGate: options.spendGate ?? createSpendGate(),
    recordRun: options.recordRun ?? true,
  });
}
