import { describe, expect, it } from "vitest";

import { runToolLoop } from "./loop";
import type { LlmClient, ProviderTurnResult, ToolCallRequest } from "./types";

function mockClient(
  turns: ProviderTurnResult[],
  delaysMs: number[] = [],
): LlmClient {
  let index = 0;
  return {
    provider: "gemini",
    model: "mock-model",
    async complete() {
      const delay = delaysMs[index] ?? 0;
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      const turn = turns[Math.min(index, turns.length - 1)];
      index += 1;
      if (!turn) {
        throw new Error("mock client exhausted");
      }
      return turn;
    },
  };
}

const noopTools = [
  {
    name: "ping",
    description: "ping",
    inputSchema: { type: "object", properties: {} },
  },
];

describe("runToolLoop bounds", () => {
  it("stops when the iteration cap is reached", async () => {
    const toolCall: ToolCallRequest = {
      id: "1",
      name: "ping",
      input: {},
    };
    const foreverToolUse: ProviderTurnResult = {
      text: null,
      toolCalls: [toolCall],
      inputTokens: 10,
      outputTokens: 5,
      stopReason: "tool_use",
    };

    const result = await runToolLoop({
      client: mockClient([foreverToolUse]),
      system: "test",
      userMessage: "go",
      tools: noopTools,
      executeTool: async () => ({ ok: true }),
      maxIterations: 3,
      maxTokens: 100_000,
      timeoutMs: 30_000,
    });

    expect(result.stopReason).toBe("max_iterations");
    expect(result.iterations).toBe(3);
    expect(result.toolTrace).toHaveLength(3);
    expect(result.error).toMatch(/Iteration cap/);
  });

  it("stops when the token budget is exhausted", async () => {
    const result = await runToolLoop({
      client: mockClient([
        {
          text: null,
          toolCalls: [{ id: "1", name: "ping", input: {} }],
          inputTokens: 40,
          outputTokens: 20,
          stopReason: "tool_use",
        },
        {
          text: "done",
          toolCalls: [],
          inputTokens: 40,
          outputTokens: 20,
          stopReason: "end",
        },
      ]),
      system: "test",
      userMessage: "go",
      tools: noopTools,
      executeTool: async () => ({ ok: true }),
      maxIterations: 10,
      maxTokens: 50,
      timeoutMs: 30_000,
    });

    expect(result.stopReason).toBe("token_budget");
    expect(result.inputTokens + result.outputTokens).toBeGreaterThanOrEqual(50);
    expect(result.error).toMatch(/Token budget/);
  });

  it("stops when the wall-clock timeout is exceeded", async () => {
    let current = 0;
    const result = await runToolLoop({
      client: mockClient([
        {
          text: null,
          toolCalls: [{ id: "1", name: "ping", input: {} }],
          inputTokens: 1,
          outputTokens: 1,
          stopReason: "tool_use",
        },
      ]),
      system: "test",
      userMessage: "go",
      tools: noopTools,
      executeTool: async () => {
        current += 100;
        return { ok: true };
      },
      maxIterations: 10,
      maxTokens: 100_000,
      timeoutMs: 50,
      now: () => {
        const value = current;
        current += 60;
        return value;
      },
    });

    expect(result.stopReason).toBe("timeout");
    expect(result.error).toMatch(/timeout/i);
  });

  it("completes when the model returns a final text turn", async () => {
    const result = await runToolLoop({
      client: mockClient([
        {
          text: null,
          toolCalls: [{ id: "1", name: "ping", input: {} }],
          inputTokens: 5,
          outputTokens: 2,
          stopReason: "tool_use",
        },
        {
          text: "All good",
          toolCalls: [],
          inputTokens: 8,
          outputTokens: 4,
          stopReason: "end",
        },
      ]),
      system: "test",
      userMessage: "go",
      tools: noopTools,
      executeTool: async () => ({ pong: true }),
      maxIterations: 5,
      maxTokens: 1_000,
      timeoutMs: 5_000,
    });

    expect(result.stopReason).toBe("completed");
    expect(result.finalText).toBe("All good");
    expect(result.toolTrace[0]?.output).toEqual({ pong: true });
    expect(result.estimatedCostUsd).toBeGreaterThanOrEqual(0);
  });

  it("forwards streamed text deltas before the turn completes", async () => {
    const deltas: string[] = [];
    const result = await runToolLoop({
      client: {
        provider: "gemini",
        model: "mock-model",
        async complete(_request, options) {
          options?.onTextDelta?.("Hel");
          options?.onTextDelta?.("lo");
          return {
            text: "Hello",
            toolCalls: [],
            inputTokens: 3,
            outputTokens: 2,
            stopReason: "end",
          };
        },
      },
      system: "test",
      userMessage: "go",
      tools: noopTools,
      executeTool: async () => ({}),
      maxIterations: 1,
      maxTokens: 1_000,
      timeoutMs: 5_000,
      onTextDelta: (delta) => deltas.push(delta),
    });

    expect(deltas).toEqual(["Hel", "lo"]);
    expect(result.finalText).toBe("Hello");
  });
});
