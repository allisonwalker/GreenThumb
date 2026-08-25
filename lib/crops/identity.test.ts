import { describe, expect, it } from "vitest";

import {
  DuplicateCropError,
  duplicateCropMessage,
  planVarietySplit,
  varietyGroupKey,
} from "./identity";

describe("DuplicateCropError", () => {
  it("names an existing unnamed tomato", () => {
    expect(duplicateCropMessage("Tomato", null)).toBe(
      "A Tomato with no variety already exists. Add a variety to distinguish it, or open the existing row.",
    );
  });

  it("names an existing Tomato / Sungold row", () => {
    const error = new DuplicateCropError({
      id: "crop-sungold",
      name: "Tomato",
      variety: "Sungold",
    });
    expect(error.message).toBe(
      "A Tomato / Sungold row already exists. Open the existing row instead of creating a duplicate.",
    );
    expect(error.existingCropId).toBe("crop-sungold");
  });
});

describe("varietyGroupKey", () => {
  it("groups blank and punctuation-only varieties as none", () => {
    expect(varietyGroupKey(null)).toBe("none");
    expect(varietyGroupKey("  ")).toBe("none");
    expect(varietyGroupKey("***")).toBe("none");
  });

  it("normalizes Sungold spellings onto one key", () => {
    expect(varietyGroupKey("Sungold")).toBe("sungold");
    expect(varietyGroupKey("sungold")).toBe("sungold");
  });
});

describe("planVarietySplit", () => {
  const tomato = { id: "crop-tomato", name: "Tomato", slug: "tomato" };

  it("leaves crops with no plantings unchanged", () => {
    expect(planVarietySplit([tomato], [])).toEqual({
      assignToOriginal: [],
      insertRows: [],
    });
  });

  it("leaves a crop whose plantings are all unnamed", () => {
    expect(
      planVarietySplit(
        [tomato],
        [
          { id: "p1", cropId: tomato.id, variety: null },
          { id: "p2", cropId: tomato.id, variety: "  " },
        ],
      ),
    ).toEqual({
      assignToOriginal: [],
      insertRows: [],
    });
  });

  it("copies a shared variety onto the original crop and rewrites the slug", () => {
    expect(
      planVarietySplit(
        [tomato],
        [
          { id: "p1", cropId: tomato.id, variety: "Sungold" },
          { id: "p2", cropId: tomato.id, variety: "sungold" },
        ],
      ),
    ).toEqual({
      assignToOriginal: [
        { cropId: tomato.id, variety: "Sungold", slug: "tomato--sungold" },
      ],
      insertRows: [],
    });
  });

  it("keeps the original row for unnamed plantings and inserts a Sungold row", () => {
    expect(
      planVarietySplit(
        [tomato],
        [
          { id: "p-plain", cropId: tomato.id, variety: null },
          { id: "p-sungold", cropId: tomato.id, variety: "Sungold" },
        ],
      ),
    ).toEqual({
      assignToOriginal: [],
      insertRows: [
        {
          fromCropId: tomato.id,
          variety: "Sungold",
          slug: "tomato--sungold",
          plantingIds: ["p-sungold"],
        },
      ],
    });
  });

  it("keeps one named group on the original when there is no unnamed group", () => {
    expect(
      planVarietySplit(
        [tomato],
        [
          { id: "p-early", cropId: tomato.id, variety: "Early Girl" },
          { id: "p-sungold", cropId: tomato.id, variety: "Sungold" },
        ],
      ),
    ).toEqual({
      assignToOriginal: [
        {
          cropId: tomato.id,
          variety: "Early Girl",
          slug: "tomato--early-girl",
        },
      ],
      insertRows: [
        {
          fromCropId: tomato.id,
          variety: "Sungold",
          slug: "tomato--sungold",
          plantingIds: ["p-sungold"],
        },
      ],
    });
  });

  it("does not merge Cherry tomato with Tomato / Cherry", () => {
    const cherryTomato = {
      id: "crop-cherry-tomato",
      name: "Cherry tomato",
      slug: "cherry-tomato",
    };
    const plan = planVarietySplit(
      [tomato, cherryTomato],
      [
        { id: "p-cherry", cropId: cherryTomato.id, variety: null },
        { id: "p-tomato-cherry", cropId: tomato.id, variety: "Cherry" },
      ],
    );

    expect(plan.assignToOriginal).toEqual([
      { cropId: tomato.id, variety: "Cherry", slug: "tomato--cherry" },
    ]);
    expect(plan.insertRows).toEqual([]);
  });
});
