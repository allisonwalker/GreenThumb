import { eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import {
  agentRuns,
  type AgentToolTraceEntry,
} from "@/lib/db/schema";
import type { LlmProviderName, RunToolLoopStopReason } from "@/lib/llm/types";

export type AgentRunKind =
  | "scheduled_checkin"
  | "ask"
  | "script"
  | "test"
  | "time_budget";
export type AgentRunStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "budget_exceeded";

export type AgentRunRecord = {
  id: string;
  kind: AgentRunKind;
  trigger: string;
  status: AgentRunStatus;
  provider: string;
  model: string;
};

export type AgentRunStore = {
  create(input: {
    kind: AgentRunKind;
    trigger: string;
    provider: LlmProviderName;
    model: string;
  }): Promise<AgentRunRecord>;
  finalize(input: {
    id: string;
    status: AgentRunStatus;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    toolCalls: AgentToolTraceEntry[];
    weatherFetchId?: string | null;
    finalText?: string | null;
    error?: string | null;
    stopReason: RunToolLoopStopReason;
    finishedAt?: Date;
  }): Promise<void>;
};

export function createAgentRunStore(): AgentRunStore {
  return {
    async create(input) {
      const database = getDatabase();
      const rows = await database
        .insert(agentRuns)
        .values({
          kind: input.kind,
          trigger: input.trigger,
          status: "running",
          provider: input.provider,
          model: input.model,
          toolCalls: [],
        })
        .returning({
          id: agentRuns.id,
          kind: agentRuns.kind,
          trigger: agentRuns.trigger,
          status: agentRuns.status,
          provider: agentRuns.provider,
          model: agentRuns.model,
        });

      const row = rows[0];
      if (!row) {
        throw new Error("Failed to create agent_run row");
      }
      return row;
    },

    async finalize(input) {
      const database = getDatabase();
      await database
        .update(agentRuns)
        .set({
          status: input.status,
          inputTokens: String(input.inputTokens),
          outputTokens: String(input.outputTokens),
          estimatedCostUsd: String(input.estimatedCostUsd),
          toolCalls: input.toolCalls,
          weatherFetchId: input.weatherFetchId ?? null,
          finalText: input.finalText ?? null,
          error: input.error ?? null,
          stopReason: input.stopReason,
          finishedAt: input.finishedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentRuns.id, input.id));
    },
  };
}

export function statusFromStopReason(
  stopReason: RunToolLoopStopReason,
): AgentRunStatus {
  switch (stopReason) {
    case "completed":
      return "succeeded";
    case "timeout":
      return "timed_out";
    case "max_iterations":
    case "token_budget":
      return "budget_exceeded";
    case "error":
      return "failed";
  }
}
