import { describe, expect, it } from "vitest";

import { formatTimeBudgetPrompt } from "./time-budget-prompt";

describe("formatTimeBudgetPrompt", () => {
  it("matches the ALL-65 eval phrasing for a two-hour Saturday", () => {
    expect(formatTimeBudgetPrompt({ saturdayHours: 2, sundayHours: 0 })).toEqual({
      prompt: "I have two hours Saturday.",
    });
  });

  it("states Saturday and Sunday hours together", () => {
    expect(formatTimeBudgetPrompt({ saturdayHours: 2, sundayHours: 2 })).toEqual({
      prompt: "I have two hours Saturday and two hours Sunday.",
    });
  });

  it("rejects a blank budget before a model call", () => {
    expect(formatTimeBudgetPrompt({ saturdayHours: 0, sundayHours: 0 })).toEqual({
      error: "Say how many hours you have on Saturday or Sunday.",
    });
  });
});
