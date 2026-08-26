import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PRIMARY_NAV_HREFS } from "./identity";

const root = process.cwd();

function load(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

const MOTIF_HEX = {
  forest: "#172217",
  cream: "#f7faf7",
  leaf: "#d7e5d7",
  "leaf-muted": "#c5d9c5",
  selection: "#3d6b3d",
  line: "#dbe5db",
} as const;

const MOTIF_HEX_PATTERN =
  /#(?:172217|f7faf7|d7e5d7|c5d9c5|3d6b3d|dbe5db)/i;

const QUIET_PAGE_BODY_FILES = [
  "app/garden/page.tsx",
  "app/garden/current-locations-panel.tsx",
  "app/garden/setup/page.tsx",
  "app/garden/[locationId]/page.tsx",
  "app/catalog/page.tsx",
  "app/catalog/catalog-list.tsx",
  "app/catalog/[cropId]/page.tsx",
  "app/log/page.tsx",
  "app/log/log-action-form.tsx",
  "app/ask/page.tsx",
  "app/ask/ask-thread.tsx",
];

const MARKETING_FILES = [
  "components/marketing-screen.tsx",
  "app/page.tsx",
  "app/(auth)/sign-in/page.tsx",
];

describe("shared motif tokens (ALL-99)", () => {
  it("names forest, cream, and landing type-strength roles in globals.css", () => {
    const css = load("app/globals.css");

    expect(css).toContain("@theme");
    expect(css).toContain("--color-forest: #172217");
    expect(css).toContain("--color-cream: #f7faf7");
    expect(css).toContain("--color-leaf: #d7e5d7");
    expect(css).toContain("--color-leaf-muted: #c5d9c5");
    expect(css).toContain("--color-selection: #3d6b3d");
    expect(css).toContain("--color-line: #dbe5db");
    expect(css).toContain("--font-sans: Arial, Helvetica, sans-serif");
    expect(css).toContain(
      "--text-display: clamp(3.75rem, 16vw, 8.5rem)",
    );
    expect(css).toContain("--text-display--line-height: 0.82");
    expect(css).toContain(
      "--text-display-compact: clamp(3rem, 10vw, 6.5rem)",
    );
    expect(css).toContain("--text-display-compact--line-height: 0.88");
    expect(css).toContain("--tracking-display: -0.04em");
    expect(css).toContain("--background: var(--color-cream)");
    expect(css).toContain("--foreground: var(--color-forest)");
    expect(Object.values(MOTIF_HEX)).toHaveLength(6);
  });

  it("points marketing at named tokens instead of motif hex", () => {
    for (const relative of MARKETING_FILES) {
      expect(load(relative)).not.toMatch(MOTIF_HEX_PATTERN);
    }

    const marketing = load("components/marketing-screen.tsx");
    expect(marketing).toContain("bg-forest");
    expect(marketing).toContain("text-cream");
    expect(marketing).toContain("selection:bg-selection");

    const landing = load("app/page.tsx");
    expect(landing).toContain("text-display");
    expect(landing).toContain("tracking-display");
    expect(landing).toContain("text-leaf");
    expect(landing).toContain("bg-cream");
    expect(landing).toContain("text-forest");

    const signIn = load("app/(auth)/sign-in/page.tsx");
    expect(signIn).toContain("text-display-compact");
    expect(signIn).toContain("text-leaf-muted");
    expect(signIn).toContain("bg-cream");
    expect(signIn).toContain("text-forest");
  });

  it("applies motif tokens to signed-in chrome at Operate density", () => {
    const shell = load("components/app-shell.tsx");
    const nav = load("components/app-nav.tsx");

    expect(shell).toContain("isMarketingPath");
    expect(shell).toContain("bg-forest");
    expect(shell).toContain("text-cream");
    expect(shell).toContain("tracking-display");
    expect(shell).toContain("text-leaf");
    expect(shell).toContain("sticky top-0");
    expect(shell).toContain("md:hidden");
    expect(shell).toContain("md:grid md:grid-cols-[auto_1fr]");
    expect(shell).not.toContain("bg-white");
    expect(shell).not.toContain("text-neutral-");
    expect(shell).toContain("PRODUCT_LABEL");

    expect(nav).toContain("isMarketingPath");
    expect(nav).toContain("fixed inset-x-0 bottom-0");
    expect(nav).toContain("md:static");
    expect(nav).toContain("bg-forest");
    expect(nav).toContain("bg-selection");
    expect(nav).toContain("text-leaf");
    expect(nav).toContain("text-cream");
    expect(nav).not.toContain("bg-white");
    expect(nav).not.toContain("bg-green-50");
    expect(nav).not.toContain("text-neutral-");
    expect(nav).toContain("Sign out");
    expect(nav).toContain('action={signOut}');

    for (const href of PRIMARY_NAV_HREFS) {
      expect(nav).toContain(`"${href}"`);
    }
  });

  it("does not restyle Operate page bodies still waiting on their bolder ticket", () => {
    for (const relative of QUIET_PAGE_BODY_FILES) {
      const source = load(relative);
      expect(source).not.toContain("bg-forest");
      expect(source).not.toContain("text-display");
      expect(source).not.toContain("text-display-compact");
      expect(source).not.toContain("tracking-display");
    }

    expect(load("app/garden/current-locations-panel.tsx")).toContain(
      "hover:bg-green-50",
    );
    expect(load("app/log/log-action-form.tsx")).toContain("bg-white");
    expect(load("app/ask/ask-thread.tsx")).toContain("focus:ring-green-200");
  });

  it("bolders Today with one type peak, then quieter rows (ALL-100)", () => {
    const page = load("app/today/page.tsx");
    const card = load("app/today/recommendation-card.tsx");

    expect(page).toContain("Open garden tasks");
    expect(page).toContain("tracking-display");
    expect(page).toContain("text-5xl");
    expect(page).toContain("text-forest");
    expect(page).not.toContain("text-display");
    expect(page).not.toContain("text-display-compact");
    expect(page).not.toContain("bg-forest");
    expect(page).not.toContain("uppercase");
    expect(page).not.toContain("text-green-700");
    expect(page).not.toContain("text-green-800");
    expect(page).toContain("Mark a task done when you finish it");
    expect(page).toContain("Nothing open.");
    expect(page).toContain('href="/ask?mode=hours"');

    expect(card).toContain("rounded-2xl border bg-white");
    expect(card).not.toContain("shadow-sm");
    expect(card).toContain("bg-forest");
    expect(card).toContain("text-cream");
    expect(card).toContain("completeRecommendation");
    expect(card).toContain("skipRecommendation");
    expect(card).toContain("Done");
    expect(card).toContain("Dismiss");
    expect(card).not.toContain("text-display");
    expect(card).not.toContain("bg-green-800");
  });

  it("keeps GreenThumb out of chrome copy", () => {
    expect(load("components/app-shell.tsx")).not.toMatch(/GreenThumb/i);
    expect(load("components/app-nav.tsx")).not.toMatch(/GreenThumb/i);
    expect(load("components/marketing-screen.tsx")).not.toMatch(/GreenThumb/i);
    expect(load("app/page.tsx")).not.toMatch(/GreenThumb/i);
    expect(load("app/(auth)/sign-in/page.tsx")).not.toMatch(/GreenThumb/i);
  });
});
