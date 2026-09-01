import { describe, expect, it } from "vitest";

import {
  createGeminiClient,
  generateGeminiJson,
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

  it("puts the Gemini API key in x-goog-api-key, never on the URL, for all three fetches", async () => {
    const apiKey = "test-gemini-key";
    const captured: Array<{ href: string; headers: Headers }> = [];

    const jsonBody = JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text: '{"ok":true}' }] },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    });
    const sseBody = `data: ${jsonBody}\r\n\r\n`;

    const captureFetch: typeof fetch = async (input, init) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      captured.push({
        href,
        headers: new Headers(init?.headers),
      });
      const isStream = href.includes("streamGenerateContent");
      return new Response(isStream ? sseBody : jsonBody, {
        status: 200,
        headers: {
          "content-type": isStream
            ? "text/event-stream"
            : "application/json",
        },
      });
    };

    const assertKeyOffUrl = (href: string, headers: Headers) => {
      const url = new URL(href);
      expect(href).not.toContain(apiKey);
      expect(url.searchParams.has("key")).toBe(false);
      expect(headers.get("x-goog-api-key")).toBe(apiKey);
      expect(headers.get("content-type")).toBe("application/json");
    };

    const client = createGeminiClient({
      apiKey,
      model: "gemini-flash-latest",
      fetchImplementation: captureFetch,
    });

    await client.complete(
      {
        system: "test",
        messages: [{ role: "user", content: "hi" }],
        tools: [],
        maxOutputTokens: 64,
      },
      { onTextDelta: () => undefined },
    );
    await client.complete({
      system: "test",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      maxOutputTokens: 64,
    });
    await generateGeminiJson({
      apiKey,
      modelName: "gemini-flash-latest",
      fetchImplementation: captureFetch,
      request: {
        system: "test",
        user: "draft",
        schema: { type: "object", properties: { ok: { type: "boolean" } } },
        maxOutputTokens: 64,
        timeoutMs: 5_000,
      },
    });

    expect(captured).toHaveLength(3);
    assertKeyOffUrl(captured[0]!.href, captured[0]!.headers);
    expect(new URL(captured[0]!.href).searchParams.get("alt")).toBe("sse");
    expect(captured[0]!.href).toContain("streamGenerateContent");

    assertKeyOffUrl(captured[1]!.href, captured[1]!.headers);
    expect(new URL(captured[1]!.href).searchParams.get("alt")).toBeNull();
    expect(captured[1]!.href).toContain("generateContent");

    assertKeyOffUrl(captured[2]!.href, captured[2]!.headers);
    expect(captured[2]!.href).toContain("generateContent");
  });

  it("retries generateJson when Gemini reports high demand, then succeeds", async () => {
    const jsonOk = JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text: '{"ok":true}' }] },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    });
    const busy = JSON.stringify({
      error: {
        message:
          "This model is currently experiencing high demand. Please try again later.",
      },
    });
    let calls = 0;
    const result = await generateGeminiJson({
      apiKey: "test-gemini-key",
      modelName: "gemini-flash-latest",
      retryDelaysMs: [0],
      fetchImplementation: async () => {
        calls += 1;
        if (calls === 1) {
          return new Response(busy, { status: 503 });
        }
        return new Response(jsonOk, { status: 200 });
      },
      request: {
        system: "test",
        user: "draft",
        schema: { type: "object" },
        maxOutputTokens: 64,
        timeoutMs: 5_000,
      },
    });

    expect(calls).toBe(2);
    expect(result.text).toBe('{"ok":true}');
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
