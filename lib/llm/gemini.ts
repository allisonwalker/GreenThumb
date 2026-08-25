import { withModelInvocationLog } from "./invocation-log";
import type {
  GenerateJsonRequest,
  GenerateJsonResult,
  LlmClient,
  ProviderMessage,
  ProviderTurnResult,
  ToolCallRequest,
  ToolDefinition,
} from "./types";

export type GeminiClientOptions = {
  apiKey?: string;
  model?: string;
  fetchImplementation?: typeof fetch;
};

const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

type GeminiPart = Record<string, unknown> & {
  text?: string;
  functionCall?: {
    name?: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
  thoughtSignature?: string;
};

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string };
};

/**
 * Gemini client via REST so we can preserve `thoughtSignature` on parts.
 * The older `@google/generative-ai` SDK strips unknown fields and breaks
 * Gemini 3.x / flash-latest tool loops.
 */
export function createGeminiClient(
  options: GeminiClientOptions = {},
): LlmClient {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const modelName =
    options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const fetchImplementation = options.fetchImplementation ?? fetch;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return {
    provider: "gemini",
    model: modelName,
    async complete(request, options) {
      const body = JSON.stringify({
        systemInstruction: {
          parts: [{ text: request.system }],
        },
        contents: toGeminiContents(request.messages),
        tools: [
          {
            functionDeclarations: request.tools.map(toFunctionDeclaration),
          },
        ],
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens,
        },
      });

      if (options?.onTextDelta) {
        const url = new URL(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent`,
        );
        url.searchParams.set("alt", "sse");
        url.searchParams.set("key", apiKey);

        const response = await fetchImplementation(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });

        if (!response.ok) {
          const payload = (await response.json()) as GeminiResponse;
          throw new Error(
            payload.error?.message ??
              `Gemini request failed (${response.status})`,
          );
        }
        if (!response.body) {
          throw new Error("Gemini stream returned no body");
        }

        const payloads = await readGeminiSse(response.body, options.onTextDelta);
        return fromGeminiResponse(mergeGeminiStreamChunks(payloads));
      }

      const url = new URL(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      );
      url.searchParams.set("key", apiKey);

      const response = await fetchImplementation(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });

      const payload = (await response.json()) as GeminiResponse;
      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            `Gemini request failed (${response.status})`,
        );
      }

      return fromGeminiResponse(payload);
    },

    async generateJson(request) {
      return generateGeminiJson({
        apiKey,
        modelName,
        fetchImplementation,
        request,
      });
    },
  };
}

export async function generateGeminiJson(input: {
  apiKey: string;
  modelName: string;
  fetchImplementation: typeof fetch;
  request: GenerateJsonRequest;
}): Promise<GenerateJsonResult> {
  return withModelInvocationLog({
    model: input.modelName,
    provider: "gemini",
    question: input.request.user,
    invoke: () => generateGeminiJsonUnlogged(input),
    toLog: (result) => ({
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      outcome: result.stopReason,
      response: result.text,
    }),
  });
}

async function generateGeminiJsonUnlogged(input: {
  apiKey: string;
  modelName: string;
  fetchImplementation: typeof fetch;
  request: GenerateJsonRequest;
}): Promise<GenerateJsonResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.request.timeoutMs);

  try {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${input.modelName}:generateContent`,
    );
    url.searchParams.set("key", input.apiKey);

    const response = await input.fetchImplementation(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.request.system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.request.user }],
          },
        ],
        generationConfig: {
          maxOutputTokens: input.request.maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: toGeminiResponseSchema(input.request.schema),
        },
      }),
    });

    const payload = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new Error(
        payload.error?.message ??
          `Gemini request failed (${response.status})`,
      );
    }

    const turn = fromGeminiResponse(payload);
    if (!turn.text) {
      throw new Error("Gemini returned empty JSON text");
    }

    return {
      text: turn.text,
      inputTokens: turn.inputTokens,
      outputTokens: turn.outputTokens,
      stopReason: turn.stopReason === "max_tokens" ? "max_tokens" : "end",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gemini generateJson timed out after ${input.request.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function readGeminiSse(
  body: ReadableStream<Uint8Array>,
  onTextDelta?: (delta: string) => void,
): Promise<GeminiResponse[]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const payloads: GeminiResponse[] = [];

  const consume = (chunk: string) => {
    for (const payload of parseGeminiStreamChunk(chunk)) {
      payloads.push(payload);
      for (const part of payload.candidates?.[0]?.content?.parts ?? []) {
        if (typeof part.text === "string" && part.text.length > 0) {
          onTextDelta?.(part.text);
        }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = flushGeminiStreamBuffer(buffer, consume);
  }

  if (buffer.trim()) {
    consume(buffer);
  }

  return payloads;
}

/** Gemini SSE uses CRLF. Treat each `data:` line as its own JSON object. */
export function parseGeminiStreamChunk(chunk: string): GeminiResponse[] {
  const normalized = chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const payloads: GeminiResponse[] = [];

  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(":")) {
      continue;
    }
    const raw = trimmed.startsWith("data:")
      ? trimmed.slice("data:".length).trim()
      : trimmed;
    if (!raw || raw === "[DONE]") {
      continue;
    }
    if (!raw.startsWith("{") && !raw.startsWith("[")) {
      continue;
    }
    payloads.push(JSON.parse(raw) as GeminiResponse);
  }

  return payloads;
}

function flushGeminiStreamBuffer(
  buffer: string,
  consume: (chunk: string) => void,
): string {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const events = normalized.split("\n\n");
  const rest = events.pop() ?? "";
  for (const event of events) {
    consume(event);
  }
  return rest;
}

export function mergeGeminiStreamChunks(
  payloads: GeminiResponse[],
): GeminiResponse {
  const parts: GeminiPart[] = [];
  let finishReason: string | undefined;
  let usage: GeminiResponse["usageMetadata"];
  let error: GeminiResponse["error"];

  for (const payload of payloads) {
    if (payload.error) {
      error = payload.error;
    }
    const candidate = payload.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        const last = parts[parts.length - 1];
        if (
          typeof part.text === "string" &&
          last &&
          typeof last.text === "string" &&
          !part.functionCall &&
          !last.functionCall
        ) {
          last.text += part.text;
          continue;
        }
        parts.push({ ...part });
      }
    }
    if (candidate?.finishReason) {
      finishReason = candidate.finishReason;
    }
    if (payload.usageMetadata) {
      usage = payload.usageMetadata;
    }
  }

  return {
    candidates: [{ content: { parts }, finishReason }],
    usageMetadata: usage,
    error,
  };
}

/**
 * Gemini function-calling accepts a subset of JSON Schema. Fields like
 * `additionalProperties` cause a 400 Bad Request if left in place.
 */
export function toGeminiParameters(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned = stripUnsupportedSchemaKeys(schema) as Record<string, unknown>;
  const { type: _ignoredType, ...rest } = cleaned;
  return {
    type: "OBJECT",
    ...rest,
  };
}

/** responseSchema for one-shot JSON generate — uppercase Gemini types. */
export function toGeminiResponseSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return uppercaseGeminiSchemaTypes(
    stripUnsupportedSchemaKeys(schema),
  ) as Record<string, unknown>;
}

function uppercaseGeminiSchemaTypes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(uppercaseGeminiSchemaTypes);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "type" && typeof child === "string") {
      result[key] = child.toUpperCase();
      continue;
    }
    result[key] = uppercaseGeminiSchemaTypes(child);
  }
  return result;
}

function toFunctionDeclaration(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: toGeminiParameters(tool.inputSchema),
  };
}

const UNSUPPORTED_SCHEMA_KEYS = new Set([
  "additionalProperties",
  "$schema",
  "$id",
  "$ref",
  "definitions",
  "$defs",
]);

function stripUnsupportedSchemaKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUnsupportedSchemaKeys);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (UNSUPPORTED_SCHEMA_KEYS.has(key)) {
      continue;
    }
    result[key] = stripUnsupportedSchemaKeys(child);
  }
  return result;
}

export function toGeminiContents(messages: ProviderMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: message.content }],
      });
      continue;
    }

    if (message.role === "assistant") {
      if (Array.isArray(message.providerContent)) {
        contents.push({
          role: "model",
          parts: message.providerContent as GeminiPart[],
        });
        continue;
      }

      const parts: GeminiPart[] = [];
      if (message.content) {
        parts.push({ text: message.content });
      }
      for (const call of message.toolCalls) {
        const part: GeminiPart = {
          functionCall: {
            name: call.name,
            args: call.input,
          },
        };
        const signature = call.providerMeta?.thoughtSignature;
        if (typeof signature === "string" && signature.length > 0) {
          part.thoughtSignature = signature;
        }
        parts.push(part);
      }
      contents.push({ role: "model", parts });
      continue;
    }

    const previous = contents[contents.length - 1];
    const part: GeminiPart = {
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

function fromGeminiResponse(payload: GeminiResponse): ProviderTurnResult {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const toolCalls: ToolCallRequest[] = [];
  const textParts: string[] = [];

  for (const [index, part] of parts.entries()) {
    if (typeof part.text === "string" && part.text.length > 0) {
      textParts.push(part.text);
    }
    if (part.functionCall?.name) {
      const providerMeta: Record<string, unknown> = {};
      if (typeof part.thoughtSignature === "string") {
        providerMeta.thoughtSignature = part.thoughtSignature;
      }
      toolCalls.push({
        id: `gemini-tool-${index}-${part.functionCall.name}`,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
        providerMeta:
          Object.keys(providerMeta).length > 0 ? providerMeta : undefined,
      });
    }
  }

  const finishReason = payload.candidates?.[0]?.finishReason ?? "";
  let stopReason: ProviderTurnResult["stopReason"] = "end";
  if (toolCalls.length > 0) {
    stopReason = "tool_use";
  } else if (finishReason === "MAX_TOKENS") {
    stopReason = "max_tokens";
  }

  return {
    text: textParts.join("\n").trim() || null,
    toolCalls,
    inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
    stopReason,
    // Echo model parts verbatim so thought signatures survive the next turn.
    providerContent: parts.length > 0 ? parts : undefined,
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
