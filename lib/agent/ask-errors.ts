export const LLM_QUOTA_MESSAGE =
  "Gemini's free Ask limit is still exhausted. Wait a few minutes and try again — Today's list still works without asking.";

export function isLlmQuotaError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }
  return /quota|rate[- ]limit|resource.?exhausted|429/i.test(message);
}

export function friendlyAskError(message: string | undefined): string {
  if (!message) {
    return "Ask did not return an answer.";
  }
  if (!isLlmQuotaError(message)) {
    return message;
  }
  return LLM_QUOTA_MESSAGE;
}
