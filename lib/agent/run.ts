import { resolveAgentBounds, type AgentBounds } from "./bounds";
import { buildUserMessage, systemPromptForKind } from "./prompts";
import {
  createAgentRunStore,
  statusFromStopReason,
  type AgentRunKind,
  type AgentRunStore,
} from "./record";
import {
  createToolRegistry,
  type ToolExecutionContext,
  type ToolRegistry,
  type ToolRegistryDependencies,
} from "./tools";
import {
  createLlmClient,
  runToolLoop,
  type LlmClient,
  type RunToolLoopResult,
} from "@/lib/llm";

export type RunAgentOptions = {
  kind: AgentRunKind;
  trigger: string;
  prompt?: string;
  systemPrompt?: string;
  context?: ToolExecutionContext;
  toolDependencies?: ToolRegistryDependencies;
  registry?: ToolRegistry;
  bounds?: Partial<AgentBounds>;
  client?: LlmClient;
  store?: AgentRunStore;
  recordRun?: boolean;
};

export type RunAgentResult = RunToolLoopResult & {
  agentRunId: string | null;
  status: ReturnType<typeof statusFromStopReason>;
};

/**
 * Framework-free agent entrypoint. Safe to call from a Node script or a
 * Next.js route handler — imports nothing from `next`.
 */
export async function runAgent(
  options: RunAgentOptions,
): Promise<RunAgentResult> {
  const bounds = resolveAgentBounds(options.bounds);
  const client = options.client ?? createLlmClient();
  const registry =
    options.registry ??
    createToolRegistry(options.context ?? {}, options.toolDependencies ?? {});
  const shouldRecord = options.recordRun ?? true;
  const store = options.store ?? createAgentRunStore();

  let agentRunId: string | null = null;
  if (shouldRecord) {
    const created = await store.create({
      kind: options.kind,
      trigger: options.trigger,
      provider: client.provider,
      model: client.model,
    });
    agentRunId = created.id;
  }

  const loopResult = await runToolLoop({
    client,
    system: options.systemPrompt ?? systemPromptForKind(options.kind),
    userMessage: buildUserMessage({
      kind: options.kind,
      prompt: options.prompt,
    }),
    tools: registry.definitions,
    executeTool: registry.execute,
    maxIterations: bounds.maxIterations,
    maxTokens: bounds.maxTokens,
    timeoutMs: bounds.timeoutMs,
  });

  const status = statusFromStopReason(loopResult.stopReason);
  const weatherFetchId = extractWeatherFetchId(loopResult.toolTrace);

  if (shouldRecord && agentRunId) {
    await store.finalize({
      id: agentRunId,
      status,
      inputTokens: loopResult.inputTokens,
      outputTokens: loopResult.outputTokens,
      estimatedCostUsd: loopResult.estimatedCostUsd,
      toolCalls: loopResult.toolTrace,
      weatherFetchId,
      finalText: loopResult.finalText,
      error: loopResult.error ?? null,
      stopReason: loopResult.stopReason,
    });
  }

  return {
    ...loopResult,
    agentRunId,
    status,
  };
}

function extractWeatherFetchId(
  toolTrace: RunToolLoopResult["toolTrace"],
): string | null {
  for (let index = toolTrace.length - 1; index >= 0; index -= 1) {
    const entry = toolTrace[index];
    if (entry?.name !== "get_weather" || !entry.output) {
      continue;
    }
    if (
      typeof entry.output === "object" &&
      entry.output !== null &&
      "weatherFetchId" in entry.output
    ) {
      const value = (entry.output as { weatherFetchId?: unknown }).weatherFetchId;
      if (typeof value === "string") {
        return value;
      }
    }
  }
  return null;
}
