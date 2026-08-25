import Anthropic from "@anthropic-ai/sdk";

import type {
  LlmClient,
  ProviderMessage,
  ProviderTurnResult,
  ToolCallRequest,
} from "./types";

export type AnthropicClientOptions = {
  apiKey?: string;
  model?: string;
  client?: Anthropic;
};

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

export function createAnthropicClient(
  options: AnthropicClientOptions = {},
): LlmClient {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model =
    options.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;

  if (!options.client && !apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client =
    options.client ??
    new Anthropic({
      apiKey: apiKey!,
    });

  return {
    provider: "anthropic",
    model,
    async complete(request, options) {
      const params = {
        model,
        max_tokens: request.maxOutputTokens,
        system: request.system,
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
        })),
        messages: toAnthropicMessages(request.messages),
      };

      if (options?.onTextDelta) {
        const stream = client.messages.stream(params);
        stream.on("text", (delta) => {
          options.onTextDelta?.(delta);
        });
        const response = await stream.finalMessage();
        return fromAnthropicResponse(response);
      }

      const response = await client.messages.create(params);
      return fromAnthropicResponse(response);
    },
    async generateJson() {
      throw new Error(
        "Crop draft uses Gemini generateJson; Anthropic is not the draft provider.",
      );
    },
  };
}

function toAnthropicMessages(
  messages: ProviderMessage[],
): Anthropic.MessageParam[] {
  const converted: Anthropic.MessageParam[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      converted.push({ role: "user", content: message.content });
      continue;
    }

    if (message.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      if (message.content) {
        content.push({ type: "text", text: message.content });
      }
      for (const call of message.toolCalls) {
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.input,
        });
      }
      converted.push({ role: "assistant", content });
      continue;
    }

    const previous = converted[converted.length - 1];
    const toolResult: Anthropic.ToolResultBlockParam = {
      type: "tool_result",
      tool_use_id: message.toolCallId,
      content: message.content,
    };

    if (
      previous?.role === "user" &&
      Array.isArray(previous.content)
    ) {
      (previous.content as Anthropic.ContentBlockParam[]).push(toolResult);
    } else {
      converted.push({ role: "user", content: [toolResult] });
    }
  }

  return converted;
}

function fromAnthropicResponse(
  response: Anthropic.Message,
): ProviderTurnResult {
  const toolCalls: ToolCallRequest[] = [];
  const textParts: string[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      textParts.push(block.text);
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: asRecord(block.input),
      });
    }
  }

  let stopReason: ProviderTurnResult["stopReason"] = "end";
  if (toolCalls.length > 0 || response.stop_reason === "tool_use") {
    stopReason = "tool_use";
  } else if (response.stop_reason === "max_tokens") {
    stopReason = "max_tokens";
  }

  return {
    text: textParts.join("\n").trim() || null,
    toolCalls,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    stopReason,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
