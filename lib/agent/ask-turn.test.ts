import { describe, expect, it, vi } from "vitest";

import { ASK_SYSTEM_PROMPT, TIME_BUDGET_SYSTEM_PROMPT } from "./prompts";
import { clearAskConversation, runAskTurn } from "./ask-turn";
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
    async clearMessages(userId, kind) {
      const conversation = await this.getOrCreate(userId, kind);
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.conversationId === conversation.id) {
          messages.splice(index, 1);
        }
      }
    },
  };
}

function turnDeps(
  store: ConversationStore,
  extra: Omit<
    NonNullable<Parameters<typeof runAskTurn>[1]>,
    "conversationStore"
  > = {},
): NonNullable<Parameters<typeof runAskTurn>[1]> {
  return {
    conversationStore: store,
    countDailyQa: async () => 0,
    dailyQaCap: 20,
    ...extra,
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
      turnDeps(store, { runAgent }),
    );

    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({
      kind: "ask",
      trigger: "ask",
      userId: "user-1",
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
    const runAgent = vi.fn();
    const events: AskStreamEvent[] = [];

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "One more?",
        timezone: "America/Los_Angeles",
        onEvent: (event) => events.push(event),
      },
      turnDeps(store, {
        runAgent,
        dailyQaCap: 2,
        countDailyQa: async () => 2,
        now: () => new Date("2026-08-13T20:00:00.000Z"),
      }),
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

  it("streams kind=time_budget through the same engine with the time-budget prompt", async () => {
    const store = memoryStore();
    const events: AskStreamEvent[] = [];
    const runAgent = vi.fn(async (options: RunAgentOptions) => {
      options.onTextDelta?.("Must-do\nWater the peppers.");
      return succeededResult({
        finalText: "Must-do\nWater the peppers.",
        agentRunId: "run-budget-1",
      });
    });

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "I have two hours Saturday.",
        kind: "time_budget",
        timezone: "America/Los_Angeles",
        onEvent: (event) => events.push(event),
      },
      turnDeps(store, { runAgent }),
    );

    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(runAgent.mock.calls[0]?.[0]).toMatchObject({
      kind: "time_budget",
      trigger: "time_budget",
      prompt: "I have two hours Saturday.",
      systemPrompt: TIME_BUDGET_SYSTEM_PROMPT,
    });
    expect(TIME_BUDGET_SYSTEM_PROMPT).not.toBe(ASK_SYSTEM_PROMPT);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      agentRunId: "run-budget-1",
      stopReason: "completed",
    });
    const conversation = await store.getOrCreate("user-1", "time_budget");
    expect(
      store.messages.filter((message) => message.conversationId === conversation.id),
    ).toHaveLength(2);
  });

  it("shares the daily Q&A cap across Ask and time-budget and does not call the model", async () => {
    const store = memoryStore();
    const runAgent = vi.fn();
    const events: AskStreamEvent[] = [];

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "I have two hours Saturday.",
        kind: "time_budget",
        timezone: "America/Los_Angeles",
        onEvent: (event) => events.push(event),
      },
      turnDeps(store, {
        runAgent,
        dailyQaCap: 2,
        countDailyQa: async () => 2,
        now: () => new Date("2026-08-13T20:00:00.000Z"),
      }),
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
      turnDeps(store, { runAgent }),
    );

    expect(writes).toEqual(["kind:ask"]);
    expect(
      store.messages.some((message) =>
        /recommendation|watered|logged/i.test(message.content),
      ),
    ).toBe(false);
  });

  it("does not persist recommendations from the time-budget path", async () => {
    const store = memoryStore();
    const writes: string[] = [];
    const runAgent = vi.fn(async (options: RunAgentOptions) => {
      writes.push(`kind:${options.kind}`);
      return succeededResult({
        finalText: "Must-do\nWater the peppers.\n\nIf you have time\nPrune the basil.",
      });
    });

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "I have two hours Saturday.",
        kind: "time_budget",
        timezone: "America/Los_Angeles",
        onEvent: () => {},
      },
      turnDeps(store, { runAgent }),
    );

    expect(writes).toEqual(["kind:time_budget"]);
    expect(store.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
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
      turnDeps(store, { runAgent }),
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
      async generateJson() {
        throw new Error("generateJson not used in ask tests");
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
      turnDeps(store, { runAgent, fallbackClient }),
    );

    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(runAgent.mock.calls[1]?.[0]?.client).toBe(fallbackClient);
    expect(events.some((event) => event.type === "token")).toBe(true);
    expect(store.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "Peppers want full sun.",
    });
  });

  it("does not treat leftover chat text as today's Q&A count", async () => {
    const store = memoryStore();
    const conversation = await store.getOrCreate("user-1", "ask");
    for (let index = 0; index < 20; index += 1) {
      await store.appendMessage({
        conversationId: conversation.id,
        role: "user",
        content: `Old question ${index}`,
      });
    }
    const runAgent = vi.fn(async () => succeededResult());

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "Do peppers want sun?",
        timezone: "America/Los_Angeles",
        onEvent: () => {},
      },
      turnDeps(store, {
        runAgent,
        dailyQaCap: 20,
        countDailyQa: async () => 0,
      }),
    );

    expect(runAgent).toHaveBeenCalledTimes(1);
  });

  it("omits cleared messages from the next model history and leaves the other mode", async () => {
    const store = memoryStore();
    const askConversation = await store.getOrCreate("user-1", "ask");
    await store.appendMessage({
      conversationId: askConversation.id,
      role: "user",
      content: "What about the peppers?",
    });
    await store.appendMessage({
      conversationId: askConversation.id,
      role: "assistant",
      content: "They want full sun.",
    });
    const hoursConversation = await store.getOrCreate("user-1", "time_budget");
    await store.appendMessage({
      conversationId: hoursConversation.id,
      role: "user",
      content: "I have two hours Saturday.",
    });

    await clearAskConversation("user-1", "ask", store);

    expect(await store.listMessages(askConversation.id)).toEqual([]);
    expect(await store.listMessages(hoursConversation.id)).toHaveLength(1);

    const runAgent = vi.fn(async () => succeededResult());
    await runAskTurn(
      {
        userId: "user-1",
        prompt: "Should I water basil?",
        timezone: "America/Los_Angeles",
        onEvent: () => {},
      },
      turnDeps(store, { runAgent }),
    );

    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({ history: [] }),
    );
  });

  it("still enforces the daily cap after the chat is cleared", async () => {
    const store = memoryStore();
    const conversation = await store.getOrCreate("user-1", "ask");
    await store.appendMessage({
      conversationId: conversation.id,
      role: "user",
      content: "Old question",
    });
    await clearAskConversation("user-1", "ask", store);
    const runAgent = vi.fn();

    await runAskTurn(
      {
        userId: "user-1",
        prompt: "One more after clear?",
        timezone: "America/Los_Angeles",
        onEvent: () => {},
      },
      turnDeps(store, {
        runAgent,
        dailyQaCap: 20,
        countDailyQa: async () => 20,
      }),
    );

    expect(runAgent).not.toHaveBeenCalled();
    expect(await store.listMessages(conversation.id)).toHaveLength(2);
    expect(store.messages.at(-1)?.content).toBe(DAILY_QA_CAP_MESSAGE);
  });
});
