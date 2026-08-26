import {
  createConversationStore,
  type ConversationKind,
  type ConversationStore,
  type MessageRecord,
} from "./conversation";
import { sanitizeAssistantReply } from "./plain-reply";
import { systemPromptForKind } from "./prompts";
import { friendlyAskError, isLlmQuotaError } from "./ask-errors";
import {
  DAILY_QA_CAP_MESSAGE,
  isDailyQaCapExceeded,
  resolveDailyQaCap,
} from "./qa-cap";
import { runAgent, type RunAgentOptions, type RunAgentResult } from "./run";
import type { AskStreamEvent } from "./ask-stream";
import { createLlmClient, createFallbackLlmClient } from "@/lib/llm";
import type { LlmClient } from "@/lib/llm/types";
import { createSpendStore } from "@/lib/spend/store";

const HISTORY_LIMIT = 20;

export type AskTurnInput = {
  userId: string;
  prompt: string;
  timezone: string;
  kind?: ConversationKind;
  onEvent: (event: AskStreamEvent) => void;
};

export type AskTurnDependencies = {
  conversationStore?: ConversationStore;
  runAgent?: (options: RunAgentOptions) => Promise<RunAgentResult>;
  createClient?: () => LlmClient;
  fallbackClient?: LlmClient;
  now?: () => Date;
  dailyQaCap?: number;
  countDailyQa?: () => Promise<number>;
};

export async function runAskTurn(
  input: AskTurnInput,
  dependencies: AskTurnDependencies = {},
): Promise<void> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("Ask a question about this garden first.");
  }

  const store = dependencies.conversationStore ?? createConversationStore();
  const now = dependencies.now?.() ?? new Date();
  const cap = dependencies.dailyQaCap ?? resolveDailyQaCap();
  const kind = input.kind ?? "ask";

  const conversation = await store.getOrCreate(input.userId, kind);
  const history = await store.listMessages(conversation.id);
  const priorTurns = history.slice(-HISTORY_LIMIT).map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const askedToday = await resolveAskedToday(input, dependencies, now);

  const userMessage = await store.appendMessage({
    conversationId: conversation.id,
    role: "user",
    content: prompt,
  });

  if (isDailyQaCapExceeded(askedToday, cap)) {
    await emitAssistantReply({
      store,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      content: DAILY_QA_CAP_MESSAGE,
      agentRunId: null,
      stopReason: "daily_qa_cap",
      onEvent: input.onEvent,
    });
    return;
  }

  const executeAgent = dependencies.runAgent ?? runAgent;
  const client = resolveAskClient(dependencies);
  let streamed = "";
  const onTextDelta = (delta: string) => {
    streamed += delta;
    input.onEvent({ type: "token", text: delta });
  };

  let result;
  try {
    result = await executeAgent({
      kind,
      trigger: kind,
      userId: input.userId,
      prompt,
      history: priorTurns,
      systemPrompt: systemPromptForKind(kind),
      client,
      onTextDelta,
    });
  } catch (error) {
    result = {
      finalText: "",
      provider: client?.provider ?? "gemini",
      model: client?.model ?? "",
      iterations: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      toolTrace: [],
      stopReason: "error" as const,
      error: error instanceof Error ? error.message : "Ask failed.",
      agentRunId: null,
      status: "failed" as const,
    };
  }

  const fallbackClient = resolveAskFallbackClient(dependencies, client);
  if (
    fallbackClient &&
    isLlmQuotaError(result.error) &&
    !result.finalText.trim() &&
    streamed.length === 0
  ) {
    streamed = "";
    try {
      result = await executeAgent({
        kind,
        trigger: kind,
        userId: input.userId,
        prompt,
        history: priorTurns,
        systemPrompt: systemPromptForKind(kind),
        client: fallbackClient,
        onTextDelta,
      });
    } catch (error) {
      result = {
        ...result,
        finalText: "",
        stopReason: "error",
        error: error instanceof Error ? error.message : "Ask failed.",
        agentRunId: null,
        status: "failed",
      };
    }
  }

  const content = sanitizeAssistantReply(
    result.finalText.trim() || streamed.trim(),
  );
  if (!content) {
    const message = friendlyAskError(result.error);
    if (isLlmQuotaError(result.error)) {
      await emitAssistantReply({
        store,
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        content: message,
        agentRunId: result.agentRunId,
        stopReason: result.stopReason,
        onEvent: input.onEvent,
      });
      return;
    }
    input.onEvent({
      type: "error",
      message,
    });
    return;
  }

  const assistant = await store.appendMessage({
    conversationId: conversation.id,
    role: "assistant",
    content,
    agentRunId: result.agentRunId,
  });

  if (!streamed) {
    input.onEvent({ type: "token", text: content });
  }

  input.onEvent({
    type: "done",
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    assistantMessageId: assistant.id,
    agentRunId: result.agentRunId,
    stopReason: result.stopReason,
    content,
  });
}

async function emitAssistantReply(input: {
  store: ConversationStore;
  conversationId: string;
  userMessageId: string;
  content: string;
  agentRunId: string | null;
  stopReason: string;
  onEvent: (event: AskStreamEvent) => void;
}) {
  const content = sanitizeAssistantReply(input.content);
  const assistant = await input.store.appendMessage({
    conversationId: input.conversationId,
    role: "assistant",
    content,
    agentRunId: input.agentRunId,
  });
  input.onEvent({ type: "token", text: content });
  input.onEvent({
    type: "done",
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    assistantMessageId: assistant.id,
    agentRunId: input.agentRunId,
    stopReason: input.stopReason,
    content,
  });
}

export async function loadAskMessages(
  userId: string,
  kind: ConversationKind = "ask",
  store: ConversationStore = createConversationStore(),
): Promise<MessageRecord[]> {
  const conversation = await store.getOrCreate(userId, kind);
  return store.listMessages(conversation.id);
}

export async function clearAskConversation(
  userId: string,
  kind: ConversationKind,
  store: ConversationStore = createConversationStore(),
): Promise<void> {
  await store.clearMessages(userId, kind);
}

function resolveAskedToday(
  input: AskTurnInput,
  dependencies: AskTurnDependencies,
  now: Date,
): Promise<number> {
  if (dependencies.countDailyQa) {
    return dependencies.countDailyQa();
  }
  return createSpendStore().dailyQaCount({
    userId: input.userId,
    now,
    timeZone: input.timezone,
  });
}

function resolveAskClient(
  dependencies: AskTurnDependencies,
): LlmClient | undefined {
  if (dependencies.createClient) {
    return dependencies.createClient();
  }
  if (dependencies.runAgent) {
    return undefined;
  }
  return createLlmClient();
}

function resolveAskFallbackClient(
  dependencies: AskTurnDependencies,
  primary: LlmClient | undefined,
): LlmClient | undefined {
  if (dependencies.fallbackClient) {
    return dependencies.fallbackClient;
  }
  if (dependencies.createClient || dependencies.runAgent) {
    return undefined;
  }
  return createFallbackLlmClient(
    primary ? { provider: primary.provider } : {},
  );
}
