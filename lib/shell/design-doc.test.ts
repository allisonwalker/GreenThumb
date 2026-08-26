import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const designPath = resolve(process.cwd(), "DESIGN.md");

function loadDesignDoc() {
  return readFileSync(designPath, "utf8");
}

describe("DESIGN.md Persuade vs Operate capture", () => {
  it("lives at the repo root", () => {
    expect(() => loadDesignDoc()).not.toThrow();
  });

  it("documents Persuade routes, motif, type, color, and skipped AppShell", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/^## Persuade/m);
    expect(source).toContain("`/`");
    expect(source).toContain("`/sign-in`");
    expect(source).toContain("MarketingScreen");
    expect(source).toContain("#172217");
    expect(source).toContain("#f7faf7");
    expect(source).toMatch(/clamp\(3\.75rem/);
    expect(source).toContain("components/app-shell.tsx");
    expect(source).toMatch(/skip|skipped/i);
  });

  it("documents Operate chrome, five destinations, quiet type, and quieter-than-landing", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/^## Operate/m);
    expect(source).toContain("`/today`");
    expect(source).toContain("`/garden`");
    expect(source).toContain("`/catalog`");
    expect(source).toContain("`/log`");
    expect(source).toContain("`/ask`");
    expect(source).toContain("AppNav");
    expect(source).toContain("neutral-");
    expect(source).toContain("text-3xl");
    expect(source).toMatch(/quieter than landing/i);
    expect(source).toContain("tracking-display");
    expect(source).toContain("text-5xl");
    expect(source).toContain("Open garden tasks");
    expect(source).toContain("Current locations");
    expect(source).toContain("Your garden profile");
  });

  it("states Operate should inherit motif and type conviction at Operate density", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/motif and type conviction/i);
    expect(source).toMatch(/Operate density/i);
    expect(source).toMatch(/not a fold-covering poster/i);
  });

  it("lists promoted motif tokens vs leftover Operate page-body utilities", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/^## Primitives/m);
    expect(source).toContain("--background");
    expect(source).toContain("--foreground");
    expect(source).toContain("--color-forest");
    expect(source).toContain("--color-cream");
    expect(source).toContain("Hardcoded marketing hex");
    expect(source).toContain("neutral-*");
  });
});
