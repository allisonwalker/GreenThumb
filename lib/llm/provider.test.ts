import { describe, expect, it } from "vitest";

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
      gemini: { apiKey: "test-gemini-key", model: "gemini-2.0-flash" },
    });
    const anthropic = createLlmClient({
      provider: "anthropic",
      anthropic: { apiKey: "test-anthropic-key", model: "claude-test" },
    });

    expect(gemini.provider).toBe("gemini");
    expect(gemini.model).toBe("gemini-2.0-flash");
    expect(anthropic.provider).toBe("anthropic");
    expect(anthropic.model).toBe("claude-test");
  });
});
