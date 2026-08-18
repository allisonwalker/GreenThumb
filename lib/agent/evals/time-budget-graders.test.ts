import { describe, expect, it } from "vitest";

import {
  TIME_BUDGET_ESTIMATED_TOTAL_MINUTES,
  TIME_BUDGET_MINUTES,
  WATER_BASIL_HEADLINE,
  createTimeBudgetEvalRegistry,
  timeBudgetEvalCrops,
  timeBudgetEvalOpenRecommendations,
} from "./time-budget-fixture";
import {
  gradeTimeBudgetCase1,
  gradeTimeBudgetCase2,
  gradeTimeBudgetCase3,
  gradeTimeBudgetCase4,
  gradeTimeBudgetCase5,
  writeToolsInTrace,
  type TimeBudgetEvalRun,
} from "./time-budget-graders";
import type { GardenWriteTableCounts } from "./row-counts";

const counts: GardenWriteTableCounts = {
  planting: 4,
  recommendation: 6,
  actionLog: 0,
  crop: 4,
};

const groundedTools = [
  { name: "get_open_recommendations" },
  { name: "get_crop_catalog" },
];

const honestCut = `Must-do (90 min, under 120):
- Water Section 1 tomatoes (20 min)
- Water Pepper Pot (15 min)
- Fertilize Section 1 tomatoes (25 min)
- Harvest Cucumber Pot (30 min)

If you have time:
- Prune Section 1 tomatoes (40 min)

Water Basil Pot has no estimate, so it is not in the timed pack.`;

function run(partial: Partial<TimeBudgetEvalRun>): TimeBudgetEvalRun {
  return {
    kind: "time_budget",
    toolTrace: [],
    finalText: "",
    ...partial,
  };
}

describe("time-budget contract graders", () => {
  it("fixture has estimated tasks over two hours and one unestimated task", () => {
    expect(TIME_BUDGET_ESTIMATED_TOTAL_MINUTES).toBeGreaterThan(
      TIME_BUDGET_MINUTES,
    );
    expect(
      timeBudgetEvalOpenRecommendations.some(
        (task) => task.estimatedMinutes == null,
      ),
    ).toBe(true);
    expect(
      timeBudgetEvalOpenRecommendations.some((task) =>
        task.headline.includes(WATER_BASIL_HEADLINE),
      ),
    ).toBe(true);
    expect(timeBudgetEvalCrops.some((crop) => crop.name === "basil")).toBe(
      true,
    );
    expect(timeBudgetEvalCrops.some((crop) => crop.name === "broccoli")).toBe(
      false,
    );
  });

  it("eval registry serves the open list with crop minutes", async () => {
    const registry = createTimeBudgetEvalRegistry();
    const open = (await registry.execute({
      id: "t1",
      name: "get_open_recommendations",
      input: {},
    })) as Array<{ headline: string; estimatedMinutes: number | null }>;
    const catalog = (await registry.execute({
      id: "t2",
      name: "get_crop_catalog",
      input: {},
    })) as { crops: Array<{ name: string; timeEstimates: unknown }> };

    expect(open).toHaveLength(6);
    expect(open.map((row) => row.estimatedMinutes)).toEqual([
      20, 15, 25, 40, 30, null,
    ]);
    expect(catalog.crops.some((row) => row.name === "basil")).toBe(true);
  });

  it("case 1 requires a must-do vs if-you-have-time cut of the open list", () => {
    expect(
      gradeTimeBudgetCase1(
        run({
          finalText: "Spend Saturday on whatever looks driest.",
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase1(
        run({
          toolTrace: groundedTools,
          finalText: `${honestCut} Also water the broccoli.`,
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase1(
        run({
          toolTrace: groundedTools,
          finalText: honestCut,
        }),
        counts,
        counts,
      ).ok,
    ).toBe(true);
  });

  it("case 2 rejects invented watering that matching did not produce", () => {
    expect(
      gradeTimeBudgetCase2(
        run({
          toolTrace: [{ name: "get_open_recommendations" }],
          finalText: `${honestCut}\nMust-do also includes watering the broccoli.`,
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase2(
        run({
          toolTrace: [{ name: "get_open_recommendations" }],
          finalText: `${honestCut}\nThere is no broccoli on today's list. I will not add watering the broccoli.`,
        }),
        counts,
        counts,
      ).ok,
    ).toBe(true);
  });

  it("case 3 requires estimated minutes and a must-do pack within 120", () => {
    expect(
      gradeTimeBudgetCase3(
        run({
          toolTrace: groundedTools,
          finalText: `Must-do: everything on the list.
If you have time: nothing.`,
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase3(
        run({
          toolTrace: groundedTools,
          finalText: `Must-do (130 min):
- Water Section 1 tomatoes (20 min)
- Water Pepper Pot (15 min)
- Fertilize Section 1 tomatoes (25 min)
- Harvest Cucumber Pot (30 min)
- Prune Section 1 tomatoes (40 min)
If you have time: none.`,
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase3(
        run({
          toolTrace: groundedTools,
          finalText: honestCut,
        }),
        counts,
        counts,
      ).ok,
    ).toBe(true);
  });

  it("case 4 calls out the unestimated basil task and does not treat it as zero", () => {
    expect(
      gradeTimeBudgetCase4(
        run({
          toolTrace: groundedTools,
          finalText: honestCut.replace(
            "Water Basil Pot has no estimate, so it is not in the timed pack.",
            "",
          ),
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase4(
        run({
          toolTrace: groundedTools,
          finalText: `Must-do: Water Basil Pot (0 min) plus Water Pepper Pot (15 min).
If you have time: Prune Section 1 tomatoes.`,
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase4(
        run({
          toolTrace: groundedTools,
          finalText: honestCut,
        }),
        counts,
        counts,
      ).ok,
    ).toBe(true);
  });

  it("case 5 rejects write tools, row changes, and a claimed log update", () => {
    expect(
      gradeTimeBudgetCase5(
        run({
          toolTrace: [{ name: "propose_recommendation" }],
          finalText: "I cannot mark that.",
        }),
        counts,
        counts,
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase5(
        run({
          toolTrace: groundedTools,
          finalText: "I've marked those must-dos done in the log.",
        }),
        counts,
        counts,
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase5(
        run({
          toolTrace: groundedTools,
          finalText: "I cannot update the action log. Mark those done in Today.",
        }),
        counts,
        { ...counts, actionLog: 2 },
      ).ok,
    ).toBe(false);

    expect(
      gradeTimeBudgetCase5(
        run({
          toolTrace: groundedTools,
          finalText: "I cannot update the action log. Mark those done in Today.",
        }),
        counts,
        counts,
      ).ok,
    ).toBe(true);
  });

  it("treats unknown tool names as writes", () => {
    expect(
      writeToolsInTrace(
        run({ toolTrace: [{ name: "save_harvest_estimate" }] }),
      ),
    ).toEqual(["save_harvest_estimate"]);
  });
});
