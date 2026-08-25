import {
  type AgentRunStore,
} from "@/lib/agent/record";
import { estimateCostUsd } from "@/lib/llm/cost";
import type { GenerateJsonResult, LlmClient } from "@/lib/llm/types";
import {
  allowAllSpendGate,
  type SpendGate,
} from "@/lib/spend/gate";

import {
  buildCropDraftUserMessage,
  CROP_DRAFT_MAX_OUTPUT_TOKENS,
  CROP_DRAFT_RESPONSE_SCHEMA,
  CROP_DRAFT_SYSTEM_PROMPT,
  CROP_DRAFT_TIMEOUT_MS,
  CropDraftDecodeError,
  decodeCropDraftJson,
} from "./draft-core";
import type { CropCareFields } from "./validation";
import type { CropRecord } from "./types";

export type CropDraftOutcome =
  | "generated"
  | "stub_invalid_json"
  | "stub_validation"
  | "stub_timeout"
  | "stub_provider_error"
  | "stub_monthly_cap";

export type CropDraftResult = {
  crop: CropRecord;
  outcome: CropDraftOutcome;
  message: string;
  agentRunId: string | null;
  modelCalls: number;
};

export type DraftCropCareFlowOptions = {
  cropId: string;
  trigger: string;
  userId?: string | null;
  hardinessZone: string;
  getCrop: (id: string) => Promise<CropRecord | null>;
  applyCare: (input: {
    id: string;
    care: CropCareFields;
    generatedByProvider: string;
    generatedByModel: string;
  }) => Promise<CropRecord>;
  client: LlmClient;
  spendGate?: SpendGate;
  store?: AgentRunStore;
  recordRun?: boolean;
  generateJson?: (input: {
    system: string;
    user: string;
  }) => Promise<GenerateJsonResult>;
};

/**
 * Framework-free draft orchestration. Callers supply crop I/O and the Gemini
 * client so unit tests never need a live provider or database.
 */
export async function draftCropCareFlow(
  options: DraftCropCareFlowOptions,
): Promise<CropDraftResult> {
  const existing = await options.getCrop(options.cropId);
  if (!existing) {
    throw new Error("Crop not found.");
  }

  const shouldRecord = options.recordRun ?? Boolean(options.store);
  const store = options.store;
  const spendGate = options.spendGate ?? allowAllSpendGate();

  const decision = await spendGate.authorize({
    kind: "crop_draft",
    userId: options.userId,
  });

  if (!decision.ok) {
    return {
      crop: existing,
      outcome: "stub_monthly_cap",
      message: decision.message,
      agentRunId: null,
      modelCalls: 0,
    };
  }

  const userMessage = buildCropDraftUserMessage({
    name: existing.name,
    variety: existing.variety,
    hardinessZone: options.hardinessZone,
  });

  let agentRunId: string | null = null;
  if (shouldRecord && store) {
    const created = await store.create({
      kind: "crop_draft",
      trigger: options.trigger,
      provider: options.client.provider,
      model: options.client.model,
      userId: options.userId,
    });
    agentRunId = created.id;
  }

  let generateResult: GenerateJsonResult;
  try {
    generateResult = options.generateJson
      ? await options.generateJson({
          system: CROP_DRAFT_SYSTEM_PROMPT,
          user: userMessage,
        })
      : await options.client.generateJson({
          system: CROP_DRAFT_SYSTEM_PROMPT,
          user: userMessage,
          schema: CROP_DRAFT_RESPONSE_SCHEMA as Record<string, unknown>,
          maxOutputTokens: CROP_DRAFT_MAX_OUTPUT_TOKENS,
          timeoutMs: CROP_DRAFT_TIMEOUT_MS,
        });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemini crop draft failed.";
    const timedOut = /timed out/i.test(message);
    if (shouldRecord && store && agentRunId) {
      await store.finalize({
        id: agentRunId,
        status: timedOut ? "timed_out" : "failed",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        toolCalls: [],
        error: message,
        stopReason: timedOut ? "timeout" : "error",
      });
    }
    return {
      crop: existing,
      outcome: timedOut ? "stub_timeout" : "stub_provider_error",
      message: timedOut
        ? "Gemini timed out — saved a blank stub you can edit."
        : "Gemini could not draft care fields — saved a blank stub you can edit.",
      agentRunId,
      modelCalls: 1,
    };
  }

  const estimatedCostUsd = estimateCostUsd({
    provider: options.client.provider,
    inputTokens: generateResult.inputTokens,
    outputTokens: generateResult.outputTokens,
  });

  try {
    const care = decodeCropDraftJson(generateResult.text);
    const updated = await options.applyCare({
      id: existing.id,
      care,
      generatedByProvider: options.client.provider,
      generatedByModel: options.client.model,
    });

    if (shouldRecord && store && agentRunId) {
      await store.finalize({
        id: agentRunId,
        status: "succeeded",
        inputTokens: generateResult.inputTokens,
        outputTokens: generateResult.outputTokens,
        estimatedCostUsd,
        toolCalls: [],
        finalText: generateResult.text,
        stopReason: "completed",
      });
    }

    return {
      crop: updated,
      outcome: "generated",
      message: "Drafted by Gemini",
      agentRunId,
      modelCalls: 1,
    };
  } catch (error) {
    const decodeError =
      error instanceof CropDraftDecodeError
        ? error
        : new CropDraftDecodeError(
            "validation",
            error instanceof Error ? error.message : "validation failed",
          );

    if (shouldRecord && store && agentRunId) {
      await store.finalize({
        id: agentRunId,
        status: "failed",
        inputTokens: generateResult.inputTokens,
        outputTokens: generateResult.outputTokens,
        estimatedCostUsd,
        toolCalls: [],
        finalText: generateResult.text,
        error: decodeError.message,
        stopReason:
          decodeError.code === "invalid_json"
            ? "invalid_json"
            : "validation_failed",
      });
    }

    return {
      crop: existing,
      outcome:
        decodeError.code === "invalid_json"
          ? "stub_invalid_json"
          : "stub_validation",
      message:
        "Gemini returned care fields we could not use — saved a blank stub you can edit.",
      agentRunId,
      modelCalls: 1,
    };
  }
}
