import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PRIMARY_NAV_HREFS } from "@/lib/shell/identity";

import {
  GARDEN_PATH,
  GARDEN_SETUP_PATH,
  GARDEN_SETUP_SEGMENT,
  gardenLocationPath,
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

  it("opens location plantings at /garden/{uuid}", () => {
    const locationId = "2f4e81e6-05af-4ef5-90a3-74004df408a6";
    expect(gardenLocationPath(locationId)).toBe(`${GARDEN_PATH}/${locationId}`);
    expect(isGardenLocationIdSegment(locationId)).toBe(true);
  });

  it("keeps /garden as a locations dashboard, not setup forms or an LLM page", () => {
    const gardenPage = readFileSync(
      resolve(process.cwd(), "app/garden/page.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      resolve(process.cwd(), "app/garden/current-locations-panel.tsx"),
      "utf8",
    );

    expect(gardenPage).toContain("listCurrentLocations");
    expect(gardenPage).toContain("GARDEN_SETUP_PATH");
    expect(gardenPage).not.toContain("redirect(");
    expect(gardenPage).not.toContain("GardenProfileForm");
    expect(gardenPage).not.toContain("SeasonSectionsPanel");
    expect(gardenPage).not.toMatch(/lib\/llm|runAgent|generateContent/);
    expect(panel).toContain("plantingSummary");
    expect(panel).toContain("gardenLocationPath");
    expect(panel).not.toContain("location.detail");
  });
});
