/** Placeholder until ALL-15 owns the household spend/rate policy. */
export const DEFAULT_DAILY_QA_CAP = 20;

export const DAILY_QA_CAP_MESSAGE =
  "You've asked as many questions as we allow today. Today's list on Today is still available — try Ask again tomorrow.";

export function resolveDailyQaCap(
  raw: string | undefined = process.env.DAILY_QA_CAP,
): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_DAILY_QA_CAP;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("DAILY_QA_CAP must be a positive integer");
  }
  return parsed;
}

export function isDailyQaCapExceeded(count: number, cap: number): boolean {
  return count >= cap;
}
