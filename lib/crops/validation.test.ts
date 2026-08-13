import { describe, expect, it } from "vitest";

import { parseCreateStubCropForm, parseCropEditForm } from "./validation";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.append(key, value);
  }
  return data;
}

const validEdit = {
  id: "crop-1",
  name: "Tomato",
};

describe("parseCreateStubCropForm", () => {
  it("creates a stub from a crop name", () => {
    expect(parseCreateStubCropForm(form({ name: " Tomato " }))).toEqual({
      name: "Tomato",
    });
  });

  it("rejects a blank name", () => {
    expect(() => parseCreateStubCropForm(form({ name: " " }))).toThrow(
      "Crop name is required.",
    );
  });
});

describe("parseCropEditForm", () => {
  it("accepts a partial edit with a watering interval and time estimates", () => {
    expect(
      parseCropEditForm(
        form({
          ...validEdit,
          wateringIntervalDays: "3",
          minutes_watered: "8",
          minutes_observed: "12",
        }),
      ),
    ).toEqual({
      id: "crop-1",
      name: "Tomato",
      wateringIntervalDays: 3,
      fertilizingIntervalDays: null,
      pruning: null,
      frostSensitive: null,
      sunPreference: null,
      plantWindowStart: null,
      plantWindowEnd: null,
      daysToHarvestMin: null,
      daysToHarvestMax: null,
      timeEstimates: { watered: 8, observed: 12 },
      notes: null,
    });
  });

  it("stores pruning none as a valid explicit value", () => {
    expect(
      parseCropEditForm(form({ ...validEdit, pruning: "none" })).pruning,
    ).toEqual({ needed: false });
  });

  it("rejects a non-positive watering interval", () => {
    expect(() =>
      parseCropEditForm(form({ ...validEdit, wateringIntervalDays: "0" })),
    ).toThrow("Watering interval must be a positive whole number.");
    expect(() =>
      parseCropEditForm(form({ ...validEdit, wateringIntervalDays: "-2" })),
    ).toThrow("Watering interval must be a whole number.");
  });

  it("rejects an unknown sun preference", () => {
    expect(() =>
      parseCropEditForm(form({ ...validEdit, sunPreference: "bright_indirect" })),
    ).toThrow("Sun preference is not a known value.");
  });

  it("rejects a non-boolean frost value", () => {
    expect(() =>
      parseCropEditForm(form({ ...validEdit, frostSensitive: "maybe" })),
    ).toThrow("Frost sensitive must be yes or no.");
  });

  it("rejects out-of-range minutes", () => {
    expect(() =>
      parseCropEditForm(form({ ...validEdit, minutes_watered: "0" })),
    ).toThrow("Watered minutes must be between 1 and 480 minutes.");
    expect(() =>
      parseCropEditForm(form({ ...validEdit, minutes_watered: "9999" })),
    ).toThrow("Watered minutes must be between 1 and 480 minutes.");
  });

  it("accepts frost true/false and a known sun preference", () => {
    expect(
      parseCropEditForm(
        form({
          ...validEdit,
          frostSensitive: "true",
          sunPreference: "full_sun",
        }),
      ),
    ).toMatchObject({
      frostSensitive: true,
      sunPreference: "full_sun",
    });
  });
});
