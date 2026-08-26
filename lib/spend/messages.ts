export const MONTHLY_CAP_MESSAGE =
  "This month's Ask and crop-draft budget is used up, so I can't start a new question or crop draft until next month. Today's care list still works.";

export const DAILY_QA_CAP_MESSAGE =
  "You've asked quite a few questions today. Take a break and try again tomorrow — today's care list is still there.";

export function monthlyCapAlertMessage(thresholdUsd: number, spendUsd: number) {
  return `Jory Journal Ask and crop-draft spend has crossed $${thresholdUsd.toFixed(0)} (about $${spendUsd.toFixed(2)} so far this month). Ask and crop drafts are capped at $100; today's care list is unchanged.`;
}
