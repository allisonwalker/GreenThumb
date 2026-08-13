export type LlmProviderName = "anthropic" | "gemini";

export type JsonSchema = Record<string, unknown>;

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

export type ToolCallRequest = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** Opaque provider metadata (e.g. Gemini thoughtSignature). */
  providerMeta?: Record<string, unknown>;
};

export type ToolTraceEntry = {
  iteration: number;
  toolCallId: string;
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
};

export type ProviderTurnRequest = {
  system: string;
  messages: ProviderMessage[];
  tools: ToolDefinition[];
  /** Soft cap for this single model call's output tokens. */
  maxOutputTokens: number;
};

export type ProviderMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      toolCalls: ToolCallRequest[];
      /**
       * Opaque provider content to echo back unchanged (Gemini thought
       * signatures live on these parts and must not be rebuilt).
       */
      providerContent?: unknown;
    }
  | {
      role: "tool";
      toolCallId: string;
      name: string;
      content: string;
    };

export type ProviderTurnResult = {
  text: string | null;
  toolCalls: ToolCallRequest[];
  inputTokens: number;
  outputTokens: number;
  stopReason: "tool_use" | "end" | "max_tokens";
  providerContent?: unknown;
};

export type CompleteOptions = {
  onTextDelta?: (delta: string) => void;
};

export type LlmClient = {
  provider: LlmProviderName;
  model: string;
  complete(
    request: ProviderTurnRequest,
    options?: CompleteOptions,
  ): Promise<ProviderTurnResult>;
};

export type RunToolLoopStopReason =
  | "completed"
  | "max_iterations"
  | "token_budget"
  | "timeout"
  | "error";

export type RunToolLoopOptions = {
  client: LlmClient;
  system: string;
  userMessage: string;
  tools: ToolDefinition[];
  executeTool: (call: ToolCallRequest) => Promise<unknown>;
  maxIterations: number;
  maxTokens: number;
  timeoutMs: number;
  now?: () => number;
  onTextDelta?: (delta: string) => void;
};

export type RunToolLoopResult = {
  finalText: string;
  provider: LlmProviderName;
  model: string;
  iterations: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  toolTrace: ToolTraceEntry[];
  stopReason: RunToolLoopStopReason;
  error?: string;
};
