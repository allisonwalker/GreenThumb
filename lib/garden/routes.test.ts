import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PRIMARY_NAV_HREFS } from "@/lib/shell/identity";

import {
  emptyGardenDashboardRedirect,
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
    expect(gardenPage).toContain("emptyGardenDashboardRedirect");
    expect(gardenPage).toContain("redirect(");
    expect(gardenPage).toContain("GARDEN_SETUP_PATH");
    expect(gardenPage).not.toContain("GardenProfileForm");
    expect(gardenPage).not.toContain("SeasonSectionsPanel");
    expect(gardenPage).not.toMatch(/lib\/llm|runAgent|generateContent/);
    expect(panel).toContain("plantingSummary");
    expect(panel).toContain("gardenLocationPath");
    expect(panel).not.toContain("location.detail");
  });

  it("sends empty current locations from the dashboard to setup with no query string", () => {
    expect(emptyGardenDashboardRedirect(0)).toBe(GARDEN_SETUP_PATH);
    expect(GARDEN_SETUP_PATH).toBe("/garden/setup");
    expect(GARDEN_SETUP_PATH).not.toContain("?");
    expect(GARDEN_SETUP_PATH).not.toContain("next=");
    expect(emptyGardenDashboardRedirect(1)).toBeNull();
    expect(emptyGardenDashboardRedirect(8)).toBeNull();
  });

  it("does not empty-redirect setup, location pages, or the other tabs", () => {
    const pages = [
      "app/garden/setup/page.tsx",
      "app/garden/[locationId]/page.tsx",
      "app/today/page.tsx",
      "app/catalog/page.tsx",
      "app/log/page.tsx",
      "app/ask/page.tsx",
    ];

    for (const page of pages) {
      const source = readFileSync(resolve(process.cwd(), page), "utf8");
      expect(source).not.toContain("emptyGardenDashboardRedirect");
    }
  });

  it("does not put the empty-garden rule in the auth proxy", () => {
    const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    expect(proxy).not.toContain("listCurrentLocations");
    expect(proxy).not.toContain("emptyGardenDashboardRedirect");
  });
});
