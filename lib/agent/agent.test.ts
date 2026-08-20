import { describe, expect, it } from "vitest";

import {
  ASK_EVAL_PROMPTS,
  ASK_SYSTEM_PROMPT,
  TIME_BUDGET_SYSTEM_PROMPT,
  systemPromptForKind,
} from "./prompts";
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
      async generateJson() {
        throw new Error("generateJson not used in agent loop tests");
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
    expect(systemPromptForKind("time_budget")).not.toBe(ASK_SYSTEM_PROMPT);
    expect(ASK_EVAL_PROMPTS["ask-sys-v2"]).toContain(
      "If the question does not name a crop or location",
    );
    expect(ASK_EVAL_PROMPTS["ask-sys-v3"]).toContain("still call tools, then ask");
    expect(ASK_EVAL_PROMPTS["ask-sys-v1"]).not.toContain(
      "If the question does not name a crop or location",
    );

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
      async generateJson() {
        throw new Error("generateJson not used in agent loop tests");
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

  it("uses the time-budget prompt for kind=time_budget and records that kind", async () => {
    expect(systemPromptForKind("time_budget")).toBe(TIME_BUDGET_SYSTEM_PROMPT);
    expect(TIME_BUDGET_SYSTEM_PROMPT).not.toBe(ASK_SYSTEM_PROMPT);

    const created: unknown[] = [];
    let seenSystem = "";
    const store: AgentRunStore = {
      async create(input) {
        created.push(input);
        return {
          id: "run-time-budget",
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
      async complete(request) {
        seenSystem = request.system;
        return {
          text: "Must-do vs if you have time.",
          toolCalls: [],
          inputTokens: 10,
          outputTokens: 5,
          stopReason: "end",
        };
      },
      async generateJson() {
        throw new Error("generateJson not used in agent loop tests");
      },
    };

    const result = await runAgent({
      kind: "time_budget",
      trigger: "unit",
      prompt: "I have two hours Saturday.",
      client,
      store,
      recordRun: true,
      bounds: { maxIterations: 1, maxTokens: 1_000, timeoutMs: 5_000 },
    });

    expect(created[0]).toMatchObject({ kind: "time_budget" });
    expect(seenSystem).toBe(TIME_BUDGET_SYSTEM_PROMPT);
    expect(result.status).toBe("succeeded");
  });

  it("puts prior Ask turns in a delimited history section", async () => {
    const { buildUserMessage } = await import("./prompts");
    const message = buildUserMessage({
      kind: "ask",
      prompt: "What about the pots?",
      history: [
        { role: "user", content: "Should I water the peppers?" },
        { role: "assistant", content: "There is an open watering task." },
      ],
    });

    expect(message).toContain("<conversation_history>");
    expect(message).toContain("</conversation_history>");
    expect(message).toContain("<current_question>");
    expect(message).toContain("What about the pots?");
    expect(message).toContain("Should I water the peppers?");
  });
});
