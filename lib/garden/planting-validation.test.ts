import { describe, expect, it } from "vitest";

import {
  parseAddPlantingForm,
  parseRemovePlantingForm,
} from "./planting-validation";

function form(entries: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        data.append(key, item);
      }
    } else {
      data.append(key, value);
    }
  }
  return data;
}

describe("parseAddPlantingForm", () => {
  it("accepts free-text crop names like sungold tomato", () => {
    expect(
      parseAddPlantingForm(
        form({
          locationId: "loc-1",
          cropName: "sungold tomato",
          variety: "Sungold",
          method: "transplant",
          plantedOn: "2026-05-12",
        }),
      ),
    ).toEqual({
      locationId: "loc-1",
      cropName: "sungold tomato",
      variety: "Sungold",
      method: "transplant",
      plantedOn: "2026-05-12",
    });
  });

  it("treats blank variety as null", () => {
    expect(
      parseAddPlantingForm(
        form({
          locationId: "loc-1",
          cropName: "basil",
          variety: "  ",
          method: "seed",
          plantedOn: "2026-04-01",
        }),
      ).variety,
    ).toBeNull();
  });

  it("rejects an invalid method", () => {
    expect(() =>
      parseAddPlantingForm(
        form({
          locationId: "loc-1",
          cropName: "lettuce",
          method: "direct",
          plantedOn: "2026-04-01",
        }),
      ),
    ).toThrow("Method must be seed or transplant.");
  });

  it("rejects a missing crop name", () => {
    expect(() =>
      parseAddPlantingForm(
        form({
          locationId: "loc-1",
          cropName: " ",
          method: "seed",
          plantedOn: "2026-04-01",
        }),
      ),
    ).toThrow("Crop name is required.");
  });

  it("rejects an invalid planted date", () => {
    expect(() =>
      parseAddPlantingForm(
        form({
          locationId: "loc-1",
          cropName: "kale",
          method: "seed",
          plantedOn: "2026-13-40",
        }),
      ),
    ).toThrow("Planted date must be a valid date.");
  });
});

describe("parseRemovePlantingForm", () => {
  it("parses a removal with date", () => {
    expect(
      parseRemovePlantingForm(
        form({
          plantingId: "plant-1",
          locationId: "loc-1",
          removedOn: "2026-08-01",
        }),
      ),
    ).toEqual({
      plantingId: "plant-1",
      locationId: "loc-1",
      removedOn: "2026-08-01",
    });
  });

  it("requires a removal date", () => {
    expect(() =>
      parseRemovePlantingForm(
        form({
          plantingId: "plant-1",
          locationId: "loc-1",
          removedOn: "",
        }),
      ),
    ).toThrow("Removal date is required.");
  });
});
