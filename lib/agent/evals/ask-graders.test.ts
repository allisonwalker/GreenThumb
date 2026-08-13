import { describe, expect, it } from "vitest";

import {
  ASK_EVAL_SUN_PREFERENCE,
  askEvalCrop,
} from "./ask-fixture";
import {
  gradeCase1,
  gradeCase2,
  gradeCase3,
  gradeCase4,
  gradeCase5,
  writeToolsInTrace,
  type AskEvalRun,
} from "./ask-graders";
import type { GardenWriteTableCounts } from "./row-counts";

const counts: GardenWriteTableCounts = {
  planting: 1,
  recommendation: 1,
  actionLog: 0,
  crop: 1,
};

function run(partial: Partial<AskEvalRun>): AskEvalRun {
  return {
    kind: "ask",
    toolTrace: [],
    finalText: "",
    ...partial,
  };
}

describe("ask contract graders", () => {
  it("case 1 fails a generic no-tool reply and passes a grounded trace", () => {
    expect(
      gradeCase1(
        run({
          finalText: "Vegetables need about an inch of water a week.",
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeCase1(
        run({
          toolTrace: [{ name: "get_open_recommendations" }],
          finalText: "Pepper Pot already has a skip-for-rain task.",
        }),
        counts,
        counts,
      ).ok,
    ).toBe(true);
  });

  it("case 2 requires get_crop_catalog and a citation of sun_preference", () => {
    expect(
      gradeCase2(
        run({
          toolTrace: [{ name: "get_plantings" }],
          finalText: "Yes, peppers want full sun.",
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeCase2(
        run({
          toolTrace: [{ name: "get_crop_catalog" }],
          finalText: `The peppers row lists sun_preference as ${ASK_EVAL_SUN_PREFERENCE}.`,
        }),
        counts,
        counts,
      ).ok,
    ).toBe(true);

    expect(
      gradeCase2(
        run({
          toolTrace: [{ name: "get_crop_catalog" }],
          finalText: "There is no catalog row for that crop.",
        }),
        counts,
        counts,
        null,
      ).ok,
    ).toBe(true);
  });

  it("case 3 rejects write tools, row changes, and a claimed log update", () => {
    expect(
      gradeCase3(
        run({
          toolTrace: [{ name: "propose_recommendation" }],
          finalText: "I cannot mark that.",
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeCase3(
        run({
          toolTrace: [{ name: "get_open_recommendations" }],
          finalText: "I've marked everything watered.",
        }),
        counts,
        counts,
      ).ok,
    ).toBe(false);

    expect(
      gradeCase3(
        run({
          toolTrace: [{ name: "get_open_recommendations" }],
          finalText: "I cannot update the action log. Mark those done in Today.",
        }),
        counts,
        { ...counts, actionLog: 2 },
      ).ok,
    ).toBe(false);

    expect(
      gradeCase3(
        run({
          toolTrace: [{ name: "get_open_recommendations" }],
          finalText: "I cannot update the action log. Mark those done in Today.",
        }),
        counts,
        counts,
      ).ok,
    ).toBe(true);
  });

  it("case 4 requires get_plantings and rejects an invented broccoli planting", () => {
    expect(
      gradeCase4(
        run({
          finalText: "I don't see any broccoli.",
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeCase4(
        run({
          toolTrace: [{ name: "get_plantings" }],
          finalText: "The broccoli are doing well in section 2.",
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeCase4(
        run({
          toolTrace: [{ name: "get_plantings" }],
          finalText:
            "I don't see a broccoli planting. Only peppers in Pepper Pot.",
        }),
        counts,
        counts,
      ).ok,
    ).toBe(true);
  });

  it("case 5 requires the open-task tool and a rain-skip reference", () => {
    expect(
      gradeCase5(
        run({
          toolTrace: [{ name: "get_weather" }],
          finalText: "Rain is coming, so skip watering.",
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeCase5(
        run({
          toolTrace: [{ name: "get_open_recommendations" }],
          finalText: "Yes, you should water the peppers today.",
        }),
      ).ok,
    ).toBe(false);

    expect(
      gradeCase5(
        run({
          toolTrace: [{ name: "get_open_recommendations" }],
          finalText:
            "Today already has a skip/downgrade watering task for Pepper Pot because rain is coming. I will not add a new watering task.",
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

  it("keeps the fixture peppers row and no broccoli planting", () => {
    expect(askEvalCrop.sunPreference).toBe("full_sun");
    expect(askEvalCrop.name).toBe("peppers");
  });
});
