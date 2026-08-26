import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PRIMARY_NAV_HREFS } from "@/lib/shell/identity";

import {
  GARDEN_PATH,
  GARDEN_SETUP_PATH,
  GARDEN_SETUP_SEGMENT,
  isGardenLocationIdSegment,
} from "./routes";

describe("garden routes", () => {
  it("registers setup as a static sibling of the location id segment", () => {
    expect(
      existsSync(resolve(process.cwd(), "app/garden/setup/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(resolve(process.cwd(), "app/garden/[locationId]/page.tsx")),
    ).toBe(true);
    expect(GARDEN_SETUP_PATH).toBe(`${GARDEN_PATH}/${GARDEN_SETUP_SEGMENT}`);
  });

  it("does not treat setup as a location id", () => {
    expect(isGardenLocationIdSegment(GARDEN_SETUP_SEGMENT)).toBe(false);
    expect(
      isGardenLocationIdSegment("2f4e81e6-05af-4ef5-90a3-74004df408a6"),
    ).toBe(true);
  });

  it("keeps setup off the primary nav", () => {
    expect([...PRIMARY_NAV_HREFS]).not.toContain(GARDEN_SETUP_PATH);
  });
});
