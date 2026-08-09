import {
  GoogleGenerativeAI,
  type Content,
  type FunctionDeclaration,
  type GenerativeModel,
  type Part,
  SchemaType,
} from "@google/generative-ai";

import type {
  LlmClient,
  ProviderMessage,
  ProviderTurnResult,
  ToolCallRequest,
  ToolDefinition,
} from "./types";

export type GeminiClientOptions = {
  apiKey?: string;
  model?: string;
  generativeModel?: GenerativeModel;
};

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

export function createGeminiClient(
  options: GeminiClientOptions = {},
): LlmClient {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const modelName =
    options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

  if (!options.generativeModel && !apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return {
    provider: "gemini",
    model: modelName,
    async complete(request) {
      const generativeModel =
        options.generativeModel ??
        new GoogleGenerativeAI(apiKey!).getGenerativeModel({
          model: modelName,
          systemInstruction: request.system,
          tools: [
            {
              functionDeclarations: request.tools.map(toFunctionDeclaration),
            },
          ],
          generationConfig: {
            maxOutputTokens: request.maxOutputTokens,
          },
        });

      const response = await generativeModel.generateContent({
        contents: toGeminiContents(request.messages),
      });

      return fromGeminiResponse(response.response);
    },
  };
}

function toFunctionDeclaration(tool: ToolDefinition): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: SchemaType.OBJECT,
      ...(tool.inputSchema as Omit<
        NonNullable<FunctionDeclaration["parameters"]>,
        "type"
      >),
    },
  };
}

function toGeminiContents(messages: ProviderMessage[]): Content[] {
  const contents: Content[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: message.content }],
      });
      continue;
    }

    if (message.role === "assistant") {
      const parts: Part[] = [];
      if (message.content) {
        parts.push({ text: message.content });
      }
      for (const call of message.toolCalls) {
        parts.push({
          functionCall: {
            name: call.name,
            args: call.input,
          },
        });
      }
      contents.push({ role: "model", parts });
      continue;
    }

    const previous = contents[contents.length - 1];
    const part: Part = {
      functionResponse: {
        name: message.name,
        response: parseToolPayload(message.content),
      },
    };

    if (previous?.role === "user") {
      previous.parts.push(part);
    } else {
      contents.push({ role: "user", parts: [part] });
    }
  }

  return contents;
}

function fromGeminiResponse(
  response: {
    candidates?: Array<{
      content?: { parts?: Part[] };
      finishReason?: string;
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
    text?: () => string;
  },
): ProviderTurnResult {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const toolCalls: ToolCallRequest[] = [];
  const textParts: string[] = [];

  for (const [index, part] of parts.entries()) {
    if ("text" in part && typeof part.text === "string") {
      textParts.push(part.text);
      continue;
    }
    if ("functionCall" in part && part.functionCall?.name) {
      toolCalls.push({
        id: `gemini-tool-${index}-${part.functionCall.name}`,
        name: part.functionCall.name,
        input: (part.functionCall.args as Record<string, unknown>) ?? {},
      });
    }
  }

  const finishReason = response.candidates?.[0]?.finishReason ?? "";
  let stopReason: ProviderTurnResult["stopReason"] = "end";
  if (toolCalls.length > 0) {
    stopReason = "tool_use";
  } else if (finishReason === "MAX_TOKENS") {
    stopReason = "max_tokens";
  }

  return {
    text: textParts.join("\n").trim() || null,
    toolCalls,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    stopReason,
  };
}

function parseToolPayload(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: content };
  }
}
