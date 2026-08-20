export const MONTHLY_CAP_MESSAGE =
  "This month's conversation budget is used up, so I can't start a new question or crop draft until next month. Your morning care list is unaffected and does not use the model.";

export const DAILY_QA_CAP_MESSAGE =
  "You've asked quite a few questions today. Take a break and try again tomorrow — the morning care list will still be there, and it doesn't use the model.";

export function monthlyCapAlertMessage(thresholdUsd: number, spendUsd: number) {
  return `GreenThumb paid LLM spend has crossed $${thresholdUsd.toFixed(0)} (about $${spendUsd.toFixed(2)} so far this month). Conversation and crop drafts are capped at $100; matching / the morning care list does not use the model.`;
}
