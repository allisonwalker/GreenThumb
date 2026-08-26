import { afterEach, describe, expect, it, vi } from "vitest";

import { estimateCostUsd, LLM_LIST_PRICE_USD_PER_MILLION } from "./cost";
import { withModelInvocationLog, type ModelCallLog } from "./invocation-log";

afterEach(() => {
  vi.restoreAllMocks();
});

function parseLogLine(value: unknown): ModelCallLog {
  expect(typeof value).toBe("string");
  return JSON.parse(value as string) as ModelCallLog;
}

describe("withModelInvocationLog", () => {
  it("emits exactly one JSON log line with tokens, cost, and texts", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await withModelInvocationLog({
      model: "gemini-flash-latest",
      provider: "gemini",
      question: "When did I plant peppers?",
      invoke: async () => ({
        text: "April 12",
        inputTokens: 100,
        outputTokens: 20,
        stopReason: "end" as const,
      }),
      toLog: (turn) => ({
        inputTokens: turn.inputTokens,
        outputTokens: turn.outputTokens,
        outcome: turn.stopReason,
        response: turn.text,
      }),
    });

    expect(result.text).toBe("April 12");
    expect(log).toHaveBeenCalledTimes(1);
    const record = parseLogLine(log.mock.calls[0]?.[0]);
    expect(record.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(record.model).toBe("gemini-flash-latest");
    expect(record.latencyMs).toBeGreaterThanOrEqual(0);
    expect(record.inputTokens).toBe(100);
    expect(record.outputTokens).toBe(20);
    expect(record.estimatedCostUsd).toBe(
      estimateCostUsd({
        provider: "gemini",
        inputTokens: 100,
        outputTokens: 20,
      }),
    );
    expect(record.estimatedCostUsd).toBe(
      Math.round(
        ((100 / 1_000_000) *
          LLM_LIST_PRICE_USD_PER_MILLION.gemini.inputPerMillion +
          (20 / 1_000_000) *
            LLM_LIST_PRICE_USD_PER_MILLION.gemini.outputPerMillion) *
          1_000_000,
      ) / 1_000_000,
    );
    expect(record.outcome).toBe("end");
    expect(record.question).toBe("When did I plant peppers?");
    expect(record.response).toBe("April 12");
  });

  it("logs outcome error then rethrows without changing the error", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const failure = new Error("provider down");

    await expect(
      withModelInvocationLog({
        model: "mock-model",
        provider: "anthropic",
        question: "hello",
        invoke: async () => {
          throw failure;
        },
        toLog: () => ({
          inputTokens: 1,
          outputTokens: 1,
          outcome: "end",
          response: "unused",
        }),
      }),
    ).rejects.toBe(failure);

    expect(log).toHaveBeenCalledTimes(1);
    const record = parseLogLine(log.mock.calls[0]?.[0]);
    expect(record.outcome).toBe("error");
    expect(record.inputTokens).toBe(0);
    expect(record.outputTokens).toBe(0);
    expect(record.response).toBe("");
    expect(record.question).toBe("hello");
  });
});
