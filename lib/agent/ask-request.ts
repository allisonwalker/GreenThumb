import type { ConversationKind } from "./conversation";

export type AskRequestBody = {
  prompt: string;
  kind: ConversationKind;
};

export function parseAskRequestBody(
  body: unknown,
): AskRequestBody | { error: string } {
  if (typeof body !== "object" || body === null || !("prompt" in body)) {
    return { error: "Expected a prompt" };
  }
  const prompt = (body as { prompt: unknown }).prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { error: "Ask a question about this garden first." };
  }

  const rawKind = "kind" in body ? (body as { kind: unknown }).kind : "ask";
  if (rawKind !== "ask" && rawKind !== "time_budget") {
    return { error: "Expected kind to be ask or time_budget." };
  }

  return { prompt: prompt.trim(), kind: rawKind };
}
