import { estimateCostUsd } from "./cost";
import type {
  ProviderMessage,
  RunToolLoopOptions,
  RunToolLoopResult,
  ToolTraceEntry,
} from "./types";

const DEFAULT_OUTPUT_TOKENS_PER_TURN = 4_096;

/**
 * Provider-agnostic tool-use loop with hard bounds on iterations, tokens,
 * and wall-clock time. Bounds are checked before each model call.
 */
export async function runToolLoop(
  options: RunToolLoopOptions,
): Promise<RunToolLoopResult> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const messages: ProviderMessage[] = [
    { role: "user", content: options.userMessage },
  ];
  const toolTrace: ToolTraceEntry[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let iterations = 0;
  let finalText = "";

  try {
    while (iterations < options.maxIterations) {
      if (now() - startedAt >= options.timeoutMs) {
        return finalize({
          finalText,
          iterations,
          inputTokens,
          outputTokens,
          toolTrace,
          options,
          stopReason: "timeout",
          error: `Wall-clock timeout exceeded (${options.timeoutMs}ms)`,
        });
      }

      if (inputTokens + outputTokens >= options.maxTokens) {
        return finalize({
          finalText,
          iterations,
          inputTokens,
          outputTokens,
          toolTrace,
          options,
          stopReason: "token_budget",
          error: `Token budget exceeded (${options.maxTokens})`,
        });
      }

      iterations += 1;
      const remainingTokens = Math.max(
        256,
        options.maxTokens - (inputTokens + outputTokens),
      );
      const turn = await options.client.complete(
        {
          system: options.system,
          messages,
          tools: options.tools,
          maxOutputTokens: Math.min(
            DEFAULT_OUTPUT_TOKENS_PER_TURN,
            remainingTokens,
          ),
        },
        options.onTextDelta
          ? { onTextDelta: options.onTextDelta }
          : undefined,
      );

      inputTokens += turn.inputTokens;
      outputTokens += turn.outputTokens;

      if (turn.text) {
        finalText = turn.text;
      }

      if (turn.toolCalls.length === 0) {
        return finalize({
          finalText: turn.text ?? finalText,
          iterations,
          inputTokens,
          outputTokens,
          toolTrace,
          options,
          stopReason: "completed",
        });
      }

      messages.push({
        role: "assistant",
        content: turn.text,
        toolCalls: turn.toolCalls,
        providerContent: turn.providerContent,
      });

      for (const call of turn.toolCalls) {
        if (now() - startedAt >= options.timeoutMs) {
          return finalize({
            finalText,
            iterations,
            inputTokens,
            outputTokens,
            toolTrace,
            options,
            stopReason: "timeout",
            error: `Wall-clock timeout exceeded (${options.timeoutMs}ms)`,
          });
        }

        const callStarted = now();
        try {
          const output = await options.executeTool(call);
          toolTrace.push({
            iteration: iterations,
            toolCallId: call.id,
            name: call.name,
            input: call.input,
            output,
            durationMs: now() - callStarted,
          });
          messages.push({
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: JSON.stringify(output),
          });
        } catch (error) {
          const message = errorMessage(error);
          toolTrace.push({
            iteration: iterations,
            toolCallId: call.id,
            name: call.name,
            input: call.input,
            error: message,
            durationMs: now() - callStarted,
          });
          messages.push({
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: JSON.stringify({ error: message }),
          });
        }
      }

      if (inputTokens + outputTokens >= options.maxTokens) {
        return finalize({
          finalText,
          iterations,
          inputTokens,
          outputTokens,
          toolTrace,
          options,
          stopReason: "token_budget",
          error: `Token budget exceeded (${options.maxTokens})`,
        });
      }
    }

    return finalize({
      finalText,
      iterations,
      inputTokens,
      outputTokens,
      toolTrace,
      options,
      stopReason: "max_iterations",
      error: `Iteration cap exceeded (${options.maxIterations})`,
    });
  } catch (error) {
    return finalize({
      finalText,
      iterations,
      inputTokens,
      outputTokens,
      toolTrace,
      options,
      stopReason: "error",
      error: errorMessage(error),
    });
  }
}

function finalize(input: {
  finalText: string;
  iterations: number;
  inputTokens: number;
  outputTokens: number;
  toolTrace: ToolTraceEntry[];
  options: RunToolLoopOptions;
  stopReason: RunToolLoopResult["stopReason"];
  error?: string;
}): RunToolLoopResult {
  return {
    finalText: input.finalText,
    provider: input.options.client.provider,
    model: input.options.client.model,
    iterations: input.iterations,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCostUsd: estimateCostUsd({
      provider: input.options.client.provider,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    }),
    toolTrace: input.toolTrace,
    stopReason: input.stopReason,
    error: input.error,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown LLM error";
}
