import { describe, expect, it } from "vitest";

import { toGeminiContents, toGeminiParameters } from "./gemini";
import { createLlmClient, resolveLlmProvider } from "./index";

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
});
