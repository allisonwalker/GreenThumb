import { describe, expect, it, vi } from "vitest";

import { ASK_SYSTEM_PROMPT } from "./prompts";
import { runAskTurn } from "./ask-turn";
import { DAILY_QA_CAP_MESSAGE } from "./qa-cap";
import type { ConversationStore, MessageRecord } from "./conversation";
import type { AskStreamEvent } from "./ask-stream";
import type { LlmClient } from "@/lib/llm/types";
import type { RunAgentOptions, RunAgentResult } from "./run";

function memoryStore(): ConversationStore & { messages: MessageRecord[] } {
  const conversations = new Map<
    string,
    { id: string; userId: string; kind: "ask" | "time_budget" }
  >();
  const messages: MessageRecord[] = [];
  let ids = 0;

  return {
    messages,
    async getOrCreate(userId, kind) {
      const key = `${userId}:${kind}`;
      const existing = conversations.get(key);
      if (existing) {
        return existing;
      }
      const created = { id: `conv-${++ids}`, userId, kind };
      conversations.set(key, created);
      return created;
    },
    async listMessages(conversationId) {
      return messages.filter((message) => message.conversationId === conversationId);
    },
    async appendMessage(input) {
      const row: MessageRecord = {
        id: `msg-${++ids}`,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        agentRunId: input.agentRunId ?? null,
        createdAt: new Date("2026-08-13T20:00:00.000Z"),
      };
      messages.push(row);
      return row;
    },
    async countUserMessagesSince(input) {
      const conversationIds = [...conversations.values()]
        .filter(
          (conversation) =>
            conversation.userId === input.userId &&
            conversation.kind === input.kind,
        )
        .map((conversation) => conversation.id);
      return messages.filter(
        (message) =>
          conversationIds.includes(message.conversationId) &&
          message.role === input.role &&
          message.createdAt >= input.since,
      ).length;
    },
  };
}

function succeededResult(
  overrides: Partial<RunAgentResult> = {},
): RunAgentResult {
  return {
    finalText: "Peppers want full sun.",
    provider: "gemini",
    model: "gemini-flash-latest",
    iterations: 1,
    inputTokens: 10,
    outputTokens: 5,
    estimatedCostUsd: 0,
    toolTrace: [],
    stopReason: "completed",
    agentRunId: "run-ask-1",
    status: "succeeded",
    ...overrides,
  };
}

describe("runAskTurn", () => {
  it("streams kind=ask through the same engine and links the assistant message to agent_run", async () => {
    const store = memoryStore();
    const events: AskStreamEvent[] = [];
    const runAgent = vi.fn(async (options: RunAgentOptions) => {
      options.onTextDelta?.("Peppers ");
      options.onTextDelta?.("want full sun.");
      return succeededResult({ finalText: "Peppers want full sun." });
    });

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "Do peppers want full sun?",
        timezone: "America/Los_Angeles",
        onEvent: (event) => events.push(event),
      },
      { conversationStore: store, runAgent, dailyQaCap: 20 },
    );

    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({
      kind: "ask",
      trigger: "ask",
      prompt: "Do peppers want full sun?",
      systemPrompt: ASK_SYSTEM_PROMPT,
      history: [],
    });
    expect(events.filter((event) => event.type === "token")).toEqual([
      { type: "token", text: "Peppers " },
      { type: "token", text: "want full sun." },
    ]);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      agentRunId: "run-ask-1",
      stopReason: "completed",
    });
    expect(store.messages).toHaveLength(2);
    expect(store.messages[1]).toMatchObject({
      role: "assistant",
      content: "Peppers want full sun.",
      agentRunId: "run-ask-1",
    });
  });

  it("returns daily_qa_cap without calling the model", async () => {
    const store = memoryStore();
    const conversation = await store.getOrCreate("user-1", "ask");
    for (let index = 0; index < 2; index += 1) {
      await store.appendMessage({
        conversationId: conversation.id,
        role: "user",
        content: `Question ${index}`,
      });
    }
    const runAgent = vi.fn();
    const events: AskStreamEvent[] = [];

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "One more?",
        timezone: "America/Los_Angeles",
        onEvent: (event) => events.push(event),
      },
      {
        conversationStore: store,
        runAgent,
        dailyQaCap: 2,
        now: () => new Date("2026-08-13T20:00:00.000Z"),
      },
    );

    expect(runAgent).not.toHaveBeenCalled();
    expect(events).toEqual([
      { type: "token", text: DAILY_QA_CAP_MESSAGE },
      expect.objectContaining({
        type: "done",
        agentRunId: null,
        stopReason: "daily_qa_cap",
      }),
    ]);
    expect(store.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: DAILY_QA_CAP_MESSAGE,
      agentRunId: null,
    });
  });

  it("does not persist recommendations from the Ask path", async () => {
    const store = memoryStore();
    const writes: string[] = [];
    const runAgent = vi.fn(async (options: RunAgentOptions) => {
      writes.push(`kind:${options.kind}`);
      return succeededResult();
    });

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "Water the peppers",
        timezone: "America/Los_Angeles",
        onEvent: () => {},
      },
      { conversationStore: store, runAgent },
    );

    expect(writes).toEqual(["kind:ask"]);
    expect(
      store.messages.some((message) =>
        /recommendation|watered|logged/i.test(message.content),
      ),
    ).toBe(false);
  });

  it("replaces a Gemini quota error with a short retry message", async () => {
    const store = memoryStore();
    const events: AskStreamEvent[] = [];
    const runAgent = vi.fn(async () =>
      succeededResult({
        finalText: "",
        stopReason: "error",
        status: "failed",
        error:
          "You exceeded your current quota, please check your plan and billing details. Please retry in 56.024294264s.",
      }),
    );

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "Do peppers want sun?",
        timezone: "America/Los_Angeles",
        onEvent: (event) => events.push(event),
      },
      { conversationStore: store, runAgent },
    );

    expect(events[0]).toMatchObject({
      type: "token",
      text: expect.stringMatching(/few minutes/i),
    });
    expect(events[0]).not.toMatchObject({
      text: expect.stringMatching(/generativelanguage|billing details/i),
    });
  });

  it("retries on the fallback provider when Gemini is out of quota", async () => {
    const store = memoryStore();
    const events: AskStreamEvent[] = [];
    const fallbackClient: LlmClient = {
      provider: "anthropic",
      model: "claude-test",
      async complete() {
        return {
          text: "From backup",
          toolCalls: [],
          inputTokens: 1,
          outputTokens: 1,
          stopReason: "end",
        };
      },
    };
    const runAgent = vi
      .fn()
      .mockResolvedValueOnce(
        succeededResult({
          finalText: "",
          stopReason: "error",
          status: "failed",
          error: "You exceeded your current quota. Please retry in 56s.",
        }),
      )
      .mockImplementationOnce(async (options: RunAgentOptions) => {
        options.onTextDelta?.("Peppers want full sun.");
        return succeededResult({
          finalText: "Peppers want full sun.",
          provider: "anthropic",
          model: "claude-test",
        });
      });

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "Do peppers want sun?",
        timezone: "America/Los_Angeles",
        onEvent: (event) => events.push(event),
      },
      { conversationStore: store, runAgent, fallbackClient },
    );

    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(runAgent.mock.calls[1]?.[0]?.client).toBe(fallbackClient);
    expect(events.some((event) => event.type === "token")).toBe(true);
    expect(store.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "Peppers want full sun.",
    });
  });
});
