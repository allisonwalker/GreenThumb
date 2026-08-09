export type AgentBounds = {
  maxIterations: number;
  maxTokens: number;
  timeoutMs: number;
};

/** First-version hard caps — present from day one, not a later hardening pass. */
export const DEFAULT_AGENT_BOUNDS: AgentBounds = {
  maxIterations: 10,
  maxTokens: 80_000,
  timeoutMs: 90_000,
};

export function resolveAgentBounds(
  overrides: Partial<AgentBounds> = {},
): AgentBounds {
  return {
    maxIterations: overrides.maxIterations ?? DEFAULT_AGENT_BOUNDS.maxIterations,
    maxTokens: overrides.maxTokens ?? DEFAULT_AGENT_BOUNDS.maxTokens,
    timeoutMs: overrides.timeoutMs ?? DEFAULT_AGENT_BOUNDS.timeoutMs,
  };
}
