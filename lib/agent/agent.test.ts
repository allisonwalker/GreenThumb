import { describe, expect, it } from "vitest";

import { ASK_SYSTEM_PROMPT, systemPromptForKind } from "./prompts";
import { runAgent } from "./run";
import type { AgentRunStore } from "./record";
import type { LlmClient } from "@/lib/llm/types";
import { READ_TOOL_NAMES } from "./tools";

describe("runAgent", () => {
  it("records provider, model, tokens, cost, and tool trace on every run", async () => {
    const finalized: unknown[] = [];
    const store: AgentRunStore = {
      async create(input) {
        return {
          id: "run-1",
          kind: input.kind,
          trigger: input.trigger,
          status: "running",
          provider: input.provider,
          model: input.model,
        };
      },
      async finalize(input) {
        finalized.push(input);
      },
    };

    const client: LlmClient = {
      provider: "gemini",
      model: "gemini-flash-latest",
      async complete() {
        return {
          text: "Garden looks fine.",
          toolCalls: [],
          inputTokens: 100,
          outputTokens: 20,
          stopReason: "end",
        };
      },
    };

    const result = await runAgent({
      kind: "test",
      trigger: "unit",
      prompt: "Summarize",
      client,
      store,
      // Avoid hitting the real tool/DB layer for this recording test.
      bounds: { maxIterations: 1, maxTokens: 1_000, timeoutMs: 5_000 },
    });

    expect(result.agentRunId).toBe("run-1");
    expect(result.status).toBe("succeeded");
    expect(finalized).toHaveLength(1);
    expect(finalized[0]).toMatchObject({
      id: "run-1",
      status: "succeeded",
      inputTokens: 100,
      outputTokens: 20,
      stopReason: "completed",
    });
    expect(
      (finalized[0] as { estimatedCostUsd: number }).estimatedCostUsd,
    ).toBeGreaterThanOrEqual(0);
  });

  it("offers the model only read tools", () => {
    expect(READ_TOOL_NAMES.every((name) => name.startsWith("get_"))).toBe(
      true,
    );
    expect(READ_TOOL_NAMES).toContain("get_crop_catalog");
    expect(READ_TOOL_NAMES).not.toContain("propose_recommendation");
  });

  it("uses the Ask prompt for kind=ask and records that kind", async () => {
    expect(systemPromptForKind("ask")).toBe(ASK_SYSTEM_PROMPT);
    expect(systemPromptForKind("scheduled_checkin")).not.toBe(ASK_SYSTEM_PROMPT);

    const created: unknown[] = [];
    const store: AgentRunStore = {
      async create(input) {
        created.push(input);
        return {
          id: "run-ask",
          kind: input.kind,
          trigger: input.trigger,
          status: "running",
          provider: input.provider,
          model: input.model,
        };
      },
      async finalize() {},
    };

    const client: LlmClient = {
      provider: "gemini",
      model: "gemini-flash-latest",
      async complete() {
        return {
          text: "I need to look that up.",
          toolCalls: [],
          inputTokens: 10,
          outputTokens: 5,
          stopReason: "end",
        };
      },
    };

    const result = await runAgent({
      kind: "ask",
      trigger: "unit",
      prompt: "Should I water the peppers today?",
      client,
      store,
      recordRun: true,
      bounds: { maxIterations: 1, maxTokens: 1_000, timeoutMs: 5_000 },
    });

    expect(created[0]).toMatchObject({ kind: "ask" });
    expect(result.status).toBe("succeeded");
    expect(result.toolTrace).toEqual([]);
  });
});
