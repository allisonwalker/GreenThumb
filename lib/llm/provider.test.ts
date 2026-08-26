import { describe, expect, it } from "vitest";

import {
  createGeminiClient,
  parseGeminiStreamChunk,
  toGeminiContents,
  toGeminiParameters,
  toGeminiResponseSchema,
} from "./gemini";
import { createLlmClient, fallbackLlmProvider, resolveLlmProvider } from "./index";

describe("LLM provider seam", () => {
  it("defaults to gemini and accepts anthropic without code changes", () => {
    expect(resolveLlmProvider(undefined)).toBe("gemini");
    expect(resolveLlmProvider("gemini")).toBe("gemini");
    expect(resolveLlmProvider("anthropic")).toBe("anthropic");
    expect(resolveLlmProvider("ANTHROPIC")).toBe("anthropic");
  });

  it("builds the selected provider client from LLM_PROVIDER", () => {
    const gemini = createLlmClient({
      provider: "gemini",
      gemini: { apiKey: "test-gemini-key", model: "gemini-flash-latest" },
    });
    const anthropic = createLlmClient({
      provider: "anthropic",
      anthropic: { apiKey: "test-anthropic-key", model: "claude-test" },
    });

    expect(gemini.provider).toBe("gemini");
    expect(gemini.model).toBe("gemini-flash-latest");
    expect(anthropic.provider).toBe("anthropic");
    expect(anthropic.model).toBe("claude-test");
  });

  it("names the other provider for failover", () => {
    expect(fallbackLlmProvider("gemini")).toBe("anthropic");
    expect(fallbackLlmProvider("anthropic")).toBe("gemini");
  });

  it("strips Gemini-unsupported JSON Schema keys from tool parameters", () => {
    const parameters = toGeminiParameters({
      type: "object",
      properties: {
        days: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    });

    expect(parameters).toEqual({
      type: "OBJECT",
      properties: {
        days: { type: "integer", minimum: 1 },
      },
    });
    expect(parameters).not.toHaveProperty("additionalProperties");
  });

  it("uppercases types for Gemini responseSchema on one-shot JSON generate", () => {
    expect(
      toGeminiResponseSchema({
        type: "object",
        properties: {
          wateringIntervalDays: { type: "integer", nullable: true },
        },
        additionalProperties: false,
      }),
    ).toEqual({
      type: "OBJECT",
      properties: {
        wateringIntervalDays: { type: "INTEGER", nullable: true },
      },
    });
  });

  it("echoes Gemini providerContent so thought signatures survive tool turns", () => {
    const contents = toGeminiContents([
      { role: "user", content: "inspect" },
      {
        role: "assistant",
        content: null,
        toolCalls: [
          {
            id: "1",
            name: "get_garden_profile",
            input: {},
            providerMeta: { thoughtSignature: "sig-abc" },
          },
        ],
        providerContent: [
          {
            functionCall: { name: "get_garden_profile", args: {} },
            thoughtSignature: "sig-abc",
          },
        ],
      },
      {
        role: "tool",
        toolCallId: "1",
        name: "get_garden_profile",
        content: JSON.stringify({ ok: true }),
      },
    ]);

    expect(contents[1]).toEqual({
      role: "model",
      parts: [
        {
          functionCall: { name: "get_garden_profile", args: {} },
          thoughtSignature: "sig-abc",
        },
      ],
    });
  });

  it("parses Gemini CRLF SSE without gluing two JSON objects together", () => {
    const crlf = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Pep"}]}}]}\r\n',
      "\r\n",
      'data: {"candidates":[{"content":{"parts":[{"text":"pers"}]},"finishReason":"STOP"}]}\r\n',
      "\r\n",
    ].join("");

    const payloads = parseGeminiStreamChunk(crlf);
    expect(payloads).toHaveLength(2);
    expect(
      payloads.map(
        (payload) => payload.candidates?.[0]?.content?.parts?.[0]?.text,
      ),
    ).toEqual(["Pep", "pers"]);
  });

  it("streams Gemini SSE text deltas through complete()", async () => {
    const sse = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Pep"}]}}]}\r\n\r\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"pers"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":4,"candidatesTokenCount":2}}\r\n\r\n',
    ].join("");
    const deltas: string[] = [];
    const client = createGeminiClient({
      apiKey: "test-gemini-key",
      model: "gemini-flash-latest",
      fetchImplementation: async () =>
        new Response(sse, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
    });

    const result = await client.complete(
      {
        system: "test",
        messages: [{ role: "user", content: "hi" }],
        tools: [],
        maxOutputTokens: 64,
      },
      { onTextDelta: (delta) => deltas.push(delta) },
    );

    expect(deltas).toEqual(["Pep", "pers"]);
    expect(result.text).toBe("Peppers");
    expect(result.inputTokens).toBe(4);
    expect(result.outputTokens).toBe(2);
  });
});
