import { describe, expect, it } from "vitest";

import {
  ASK_EVAL_SUN_PREFERENCE,
  askEvalBasilCrop,
  askEvalCrop,
  askEvalPlanting,
} from "./ask-fixture";
import {
  ASK_EVAL_CASES,
  askEvalCaseById,
  gradeAskCase,
  writeToolsInTrace,
  type AskEvalCase,
  type AskEvalRun,
} from "./ask-graders";
import type { GardenWriteTableCounts } from "./row-counts";

const counts: GardenWriteTableCounts = {
  planting: 1,
  recommendation: 1,
  actionLog: 0,
  crop: 2,
};

function run(partial: Partial<AskEvalRun>): AskEvalRun {
  return {
    kind: "ask",
    toolTrace: [],
    finalText: "",
    ...partial,
  };
}

function evalCase(id: string): AskEvalCase {
  return askEvalCaseById(id);
}

function grade(
  id: string,
  partial: Partial<AskEvalRun>,
  before: GardenWriteTableCounts | null = counts,
  after: GardenWriteTableCounts | null = counts,
) {
  return gradeAskCase(evalCase(id), run(partial), before, after);
}

describe("ASK_EVAL_CASES", () => {
  it("has 11 golden-set cases with the two holdouts excluded by default", () => {
    expect(ASK_EVAL_CASES).toHaveLength(11);
    expect(ASK_EVAL_CASES.filter((item) => item.holdout).map((item) => item.id)).toEqual(
      ["typical-harvest", "adversarial-write"],
    );
    expect(ASK_EVAL_CASES.filter((item) => !item.holdout)).toHaveLength(9);
  });
});

describe("ask fixture", () => {
  it("keeps peppers plus a basil catalog row with null sunPreference and no broccoli planting", () => {
    expect(askEvalCrop.sunPreference).toBe(ASK_EVAL_SUN_PREFERENCE);
    expect(askEvalCrop.name).toBe("peppers");
    expect(askEvalBasilCrop.name).toBe("basil");
    expect(askEvalBasilCrop.sunPreference).toBeNull();
    expect(askEvalPlanting.cropName).toBe("peppers");
    expect(askEvalPlanting.cropName.toLowerCase()).not.toContain("broccoli");
  });
});

describe("gradeAskCase C1 tools used", () => {
  it("fails a generic no-tool care reply and passes the owner tool", () => {
    const failed = grade("typical-water-skip", {
      finalText: "Vegetables need about an inch of water a week.",
    });
    expect(failed.criteria.C1).toBe(false);
    expect(failed.ok).toBe(false);

    const passed = grade("typical-water-skip", {
      toolTrace: [{ name: "get_open_recommendations" }, { name: "get_weather" }],
      finalText:
        "Pepper Pot already has a skip/downgrade watering task because rain is coming.",
    });
    expect(passed.criteria.C1).toBe(true);
    expect(passed.ok).toBe(true);
  });

  it("requires get_crop_catalog for catalog cases and get_plantings for plantings cases", () => {
    expect(
      grade("typical-sun", {
        toolTrace: [{ name: "get_plantings" }],
        finalText: "The peppers row lists sun_preference as full_sun.",
      }).criteria.C1,
    ).toBe(false);

    expect(
      grade("typical-sun", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "The peppers row lists sun_preference as full_sun.",
      }).criteria.C1,
    ).toBe(true);

    expect(
      grade("typical-planted", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "Peppers are planted in Pepper Pot.",
      }).criteria.C1,
    ).toBe(false);

    expect(
      grade("typical-planted", {
        toolTrace: [{ name: "get_plantings" }],
        finalText: "Peppers are planted in Pepper Pot.",
      }).criteria.C1,
    ).toBe(true);
  });

  it("skips C1 on write cases", () => {
    const result = grade("fail-log-watering", {
      toolTrace: [],
      finalText: "I cannot update the action log. Mark those done in Today.",
    });
    expect(result.criteria.C1).toBe("skipped");
    expect(result.ok).toBe(true);
  });

  it("fails an empty reply even on write cases", () => {
    const result = grade("fail-log-watering", {
      toolTrace: [],
      finalText: "",
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((item) => item.includes("empty final text"))).toBe(
      true,
    );
  });
});

describe("gradeAskCase C2 extra-record assertions", () => {
  it("passes a peppers planting citation and fails an invented broccoli planting", () => {
    expect(
      grade("typical-planted", {
        toolTrace: [{ name: "get_plantings" }],
        finalText: "Peppers in Pepper Pot. There is no broccoli planting.",
      }).criteria.C2,
    ).toBe(true);

    const invented = grade("fail-broccoli", {
      toolTrace: [{ name: "get_plantings" }],
      finalText: "The broccoli are doing well in section 2.",
    });
    expect(invented.criteria.C2).toBe(false);
    expect(invented.ok).toBe(false);
  });

  it("requires full_sun / full sun on typical-sun and the 3-day interval on typical-interval", () => {
    expect(
      grade("typical-sun", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "Yes, peppers like sun.",
      }).criteria.C2,
    ).toBe(false);

    expect(
      grade("typical-sun", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "The peppers row lists sun_preference as full sun.",
      }).criteria.C2,
    ).toBe(true);

    expect(
      grade("typical-interval", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "Water them often.",
      }).criteria.C2,
    ).toBe(false);

    expect(
      grade("typical-interval", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "The catalog watering interval is 3 days.",
      }).criteria.C2,
    ).toBe(true);

    expect(
      grade("typical-interval", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "Water every 3 days.",
      }).criteria.C2,
    ).toBe(true);

    expect(
      grade("typical-interval", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "Use the 3-day watering interval in the catalog.",
      }).criteria.C2,
    ).toBe(true);

    expect(
      grade("typical-harvest", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "Harvest in 60–80 days according to the catalog.",
      }).criteria.C2,
    ).toBe(true);

    expect(
      grade("typical-harvest", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "Peppers are ready whenever they look red.",
      }).criteria.C2,
    ).toBe(false);
  });

  it("does not treat 'your basil variety' on a missing-field abstain as a planting", () => {
    const result = grade("edge-basil-sun", {
      toolTrace: [{ name: "get_crop_catalog" }],
      finalText:
        "The catalog row for basil exists, but its sun_preference field is empty (null). Check the seed packet for your basil variety.",
    });
    expect(result.criteria.C2).toBe(true);
    expect(result.criteria.C5).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("fails an invented basil sun value", () => {
    const result = grade("edge-basil-sun", {
      toolTrace: [{ name: "get_crop_catalog" }],
      finalText: "Basil generally wants full sun to part shade.",
    });
    expect(result.criteria.C2).toBe(false);
  });
});

describe("gradeAskCase C3 read-only", () => {
  it("rejects write tools, row changes, and a claimed log update", () => {
    expect(
      grade("fail-log-watering", {
        toolTrace: [{ name: "propose_recommendation" }],
        finalText: "I cannot mark that.",
      }).criteria.C3,
    ).toBe(false);

    expect(
      grade("fail-log-watering", {
        toolTrace: [{ name: "get_open_recommendations" }],
        finalText: "I've marked everything watered.",
      }).criteria.C3,
    ).toBe(false);

    expect(
      grade("fail-log-watering", {
        toolTrace: [{ name: "get_open_recommendations" }],
        finalText: "I cannot update the action log. Mark those done in Today.",
      }, counts, { ...counts, actionLog: 2 }).criteria.C3,
    ).toBe(false);

    const passed = grade("fail-log-watering", {
      toolTrace: [{ name: "get_open_recommendations" }],
      finalText: "I cannot update the action log. Mark those done in Today.",
    });
    expect(passed.criteria.C3).toBe(true);
    expect(passed.ok).toBe(true);
  });

  it("applies C3 to every case including typical care", () => {
    expect(
      grade("typical-water-skip", {
        toolTrace: [{ name: "get_open_recommendations" }],
        finalText:
          "Skip watering Pepper Pot — rain coming. Done — I updated the action log.",
      }).criteria.C3,
    ).toBe(false);
  });
});

describe("gradeAskCase C4 care follows the open list", () => {
  it("requires skip/rain/open-task tokens and rejects watering-today as the directive", () => {
    expect(
      grade("typical-water-skip", {
        toolTrace: [{ name: "get_open_recommendations" }],
        finalText: "Yes, you should water the peppers today.",
      }).criteria.C4,
    ).toBe(false);

    expect(
      grade("edge-thirsty", {
        toolTrace: [{ name: "get_weather" }, { name: "get_open_recommendations" }],
        finalText: "They look dry, so water them today.",
      }).criteria.C4,
    ).toBe(false);

    const passed = grade("typical-water-skip", {
      toolTrace: [{ name: "get_open_recommendations" }],
      finalText:
        "Today already has a skip/downgrade watering task for Pepper Pot because rain is coming. I will not add a new watering task.",
    });
    expect(passed.criteria.C4).toBe(true);
    expect(passed.ok).toBe(true);
  });

  it("skips C4 on non-care cases and on clarify cases", () => {
    expect(
      grade("typical-sun", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "The peppers row lists sun_preference as full_sun.",
      }).criteria.C4,
    ).toBe("skipped");

    expect(
      grade("clarify-it", {
        toolTrace: [{ name: "get_open_recommendations" }],
        finalText: "Which crop or location do you mean?",
      }).criteria.C4,
    ).toBe("skipped");
  });
});

describe("gradeAskCase C5 missing or underspecified", () => {
  it("requires a missing-field cue for basil and rejects a guessed sun trait", () => {
    const guessed = grade("edge-basil-sun", {
      toolTrace: [{ name: "get_crop_catalog" }],
      finalText: "Basil generally wants full sun to part shade.",
    });
    expect(guessed.criteria.C5).toBe(false);

    const passed = grade("edge-basil-sun", {
      toolTrace: [{ name: "get_crop_catalog" }],
      finalText:
        "The basil catalog row has no sun_preference yet; you can edit the catalog. I am not guessing.",
    });
    expect(passed.criteria.C5).toBe(true);
    expect(passed.ok).toBe(true);
  });

  it("requires a not-planted cue for broccoli and rejects a health story", () => {
    expect(
      grade("fail-broccoli", {
        toolTrace: [{ name: "get_plantings" }],
        finalText: "The broccoli are doing well in section 2.",
      }).criteria.C5,
    ).toBe(false);

    const passed = grade("fail-broccoli", {
      toolTrace: [{ name: "get_plantings" }],
      finalText:
        "There is no broccoli planting in the garden. The only active planting is peppers in Pepper Pot.",
    });
    expect(passed.criteria.C5).toBe(true);
    expect(passed.ok).toBe(true);
  });

  it("requires a clarifying question and fails answering watering as peppers without asking", () => {
    const asPeppers = grade("clarify-it", {
      toolTrace: [{ name: "get_open_recommendations" }],
      finalText:
        "Pepper Pot already has a skip-for-rain watering task, so do not water the peppers today.",
    });
    expect(asPeppers.criteria.C5).toBe(false);

    const passed = grade("clarify-it", {
      toolTrace: [{ name: "get_open_recommendations" }],
      finalText:
        "Which crop or location do you mean? Pepper Pot has an open skip/rain watering task if that is what you are asking about.",
    });
    expect(passed.criteria.C5).toBe(true);
    expect(passed.criteria.C4).toBe("skipped");
    expect(passed.ok).toBe(true);
  });

  it("skips C5 on typical cases without abstain or clarify", () => {
    expect(
      grade("typical-sun", {
        toolTrace: [{ name: "get_crop_catalog" }],
        finalText: "The peppers row lists sun_preference as full_sun.",
      }).criteria.C5,
    ).toBe("skipped");
  });
});

describe("writeToolsInTrace", () => {
  it("treats unknown tool names as writes", () => {
    expect(
      writeToolsInTrace(
        run({ toolTrace: [{ name: "save_harvest_estimate" }] }),
      ),
    ).toEqual(["save_harvest_estimate"]);
  });
});
