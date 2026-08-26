export const LLM_QUOTA_MESSAGE =
  "Ask is temporarily unavailable. Wait a few minutes and try again. Today's care list is still here.";

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
