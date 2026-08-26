import { estimateCostUsd } from "./cost";
import type { LlmProviderName } from "./types";

export type ModelCallOutcome = "end" | "tool_use" | "max_tokens" | "error";

export type ModelCallLog = {
  requestId: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  outcome: ModelCallOutcome;
  question: string;
  response: string;
};

export async function withModelInvocationLog<T>(input: {
  model: string;
  provider: LlmProviderName;
  question: string;
  invoke: () => Promise<T>;
  toLog: (result: T) => {
    inputTokens: number;
    outputTokens: number;
    outcome: ModelCallOutcome;
    response: string;
  };
}): Promise<T> {
  const requestId = crypto.randomUUID();
  const started = Date.now();

  try {
    const result = await input.invoke();
    const mapped = input.toLog(result);
    emitModelCallLog({
      requestId,
      model: input.model,
      latencyMs: Date.now() - started,
      inputTokens: mapped.inputTokens,
      outputTokens: mapped.outputTokens,
      estimatedCostUsd: estimateCostUsd({
        provider: input.provider,
        inputTokens: mapped.inputTokens,
        outputTokens: mapped.outputTokens,
      }),
      outcome: mapped.outcome,
      question: input.question,
      response: mapped.response,
    });
    return result;
  } catch (error) {
    emitModelCallLog({
      requestId,
      model: input.model,
      latencyMs: Date.now() - started,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: estimateCostUsd({
        provider: input.provider,
        inputTokens: 0,
        outputTokens: 0,
      }),
      outcome: "error",
      question: input.question,
      response: "",
    });
    throw error;
  }
}

function emitModelCallLog(record: ModelCallLog): void {
  console.log(JSON.stringify(record));
}
