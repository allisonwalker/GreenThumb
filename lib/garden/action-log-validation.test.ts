import { describe, expect, it } from "vitest";

import { parseActionLogForm, parseVoidActionLogForm } from "./action-log-validation";

const locationId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-08-09T16:00:00.000Z");

function validForm() {
  const form = new FormData();
  form.set("locationId", locationId);
  form.set("actionType", "watered");
  form.set("timeZone", "America/Los_Angeles");
  form.set("occurredAt", "2026-08-08T21:30");
  form.set("detail", "Half can");
  return form;
}

describe("action log form validation", () => {
  it("parses a watering with garden-local back-dated time", () => {
    expect(parseActionLogForm(validForm(), now)).toEqual({
      locationId,
      actionType: "watered",
      detail: "Half can",
      occurredAt: new Date("2026-08-09T04:30:00.000Z"),
      timeZone: "America/Los_Angeles",
    });
  });

  it("defaults an empty time to now", () => {
    const form = validForm();
    form.set("occurredAt", "");
    expect(parseActionLogForm(form, now).occurredAt).toEqual(now);
  });

  it("rejects a missing location, invalid action, and a future time", () => {
    const missingLocation = validForm();
    missingLocation.delete("locationId");
    expect(() => parseActionLogForm(missingLocation, now)).toThrow(
      "Location is required",
    );

    const invalidAction = validForm();
    invalidAction.set("actionType", "skipped");
    expect(() => parseActionLogForm(invalidAction, now)).toThrow(
      "valid action type",
    );

    const future = validForm();
    future.set("occurredAt", "2026-08-10T12:00");
    expect(() => parseActionLogForm(future, now)).toThrow("future");
  });

  it("parses a correction targeting an existing entry", () => {
    const form = new FormData();
    form.set("actionLogId", locationId);
    expect(parseVoidActionLogForm(form)).toEqual({ actionLogId: locationId });
  });
});
