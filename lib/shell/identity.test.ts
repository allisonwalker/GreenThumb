import { describe, expect, it } from "vitest";

import {
  DEFAULT_GARDEN_NAME,
  PRIMARY_NAV_HREFS,
  PRODUCT_LABEL,
  resolveGardenDisplayName,
} from "./identity";

describe("shell identity", () => {
  it("keeps the product label as branding, not a garden column", () => {
    expect(PRODUCT_LABEL).toBe("Jory Journal");
    expect(PRODUCT_LABEL).not.toBe(DEFAULT_GARDEN_NAME);
  });

  it("uses the stored singleton name, falling back to the schema default", () => {
    expect(resolveGardenDisplayName("West-side bed")).toBe("West-side bed");
    expect(resolveGardenDisplayName("  ")).toBe(DEFAULT_GARDEN_NAME);
    expect(resolveGardenDisplayName(null)).toBe(DEFAULT_GARDEN_NAME);
    expect(resolveGardenDisplayName(undefined)).toBe(DEFAULT_GARDEN_NAME);
  });

  it("names exactly five primary destinations, not a sixth identity tab", () => {
    expect([...PRIMARY_NAV_HREFS]).toEqual([
      "/today",
      "/garden",
      "/catalog",
      "/log",
      "/ask",
    ]);
    expect(PRIMARY_NAV_HREFS).not.toContain("/garden/setup");
  });
});
