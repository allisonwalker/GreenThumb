export function parseAskRequestBody(
  body: unknown,
): { prompt: string } | { error: string } {
  if (typeof body !== "object" || body === null || !("prompt" in body)) {
    return { error: "Expected a prompt" };
  }
  const prompt = (body as { prompt: unknown }).prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { error: "Ask a question about this garden first." };
  }
  return { prompt: prompt.trim() };
}
