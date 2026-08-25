import { createAnthropicClient } from "./anthropic";
import { createGeminiClient } from "./gemini";
import type { LlmClient, LlmProviderName } from "./types";

export type CreateLlmClientOptions = {
  provider?: LlmProviderName;
  anthropic?: Parameters<typeof createAnthropicClient>[0];
  gemini?: Parameters<typeof createGeminiClient>[0];
};

export function resolveLlmProvider(
  raw: string | undefined = process.env.LLM_PROVIDER,
): LlmProviderName {
  const value = (raw ?? "gemini").trim().toLowerCase();
  if (value === "anthropic" || value === "gemini") {
    return value;
  }
  throw new Error(
    `LLM_PROVIDER must be "anthropic" or "gemini" (got ${raw ?? "undefined"})`,
  );
}

export function createLlmClient(
  options: CreateLlmClientOptions = {},
): LlmClient {
  const provider = options.provider ?? resolveLlmProvider();
  if (provider === "anthropic") {
    return createAnthropicClient(options.anthropic);
  }
  return createGeminiClient(options.gemini);
}

export function fallbackLlmProvider(
  primary: LlmProviderName = resolveLlmProvider(),
): LlmProviderName {
  return primary === "gemini" ? "anthropic" : "gemini";
}

export function isLlmProviderConfigured(provider: LlmProviderName): boolean {
  if (provider === "anthropic") {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function createFallbackLlmClient(
  options: CreateLlmClientOptions = {},
): LlmClient | undefined {
  const fallback = fallbackLlmProvider(
    options.provider ?? resolveLlmProvider(),
  );
  if (!isLlmProviderConfigured(fallback)) {
    return undefined;
  }
  try {
    return createLlmClient({ ...options, provider: fallback });
  } catch {
    return undefined;
  }
}

export { createAnthropicClient } from "./anthropic";
export { createGeminiClient } from "./gemini";
export { estimateCostUsd } from "./cost";
export { runToolLoop } from "./loop";
export type * from "./types";
