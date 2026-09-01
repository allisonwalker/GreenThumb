import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const designPath = resolve(process.cwd(), "DESIGN.md");

function loadDesignDoc() {
  return readFileSync(designPath, "utf8");
}

describe("DESIGN.md bold incumbent (ALL-105)", () => {
  it("lives at the repo root", () => {
    expect(() => loadDesignDoc()).not.toThrow();
  });

  it("frames the post-Phase-A look as the world Phase B preserves", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/after Phase A/i);
    expect(source).toMatch(/Phase B polish/i);
    expect(source).toMatch(/refines this world/i);
    expect(source).not.toMatch(/before Phase A bolder work/i);
    expect(source).not.toMatch(/Intent for later bolder/i);
  });

  it("marks pre-bolder quiet Operate as superseded, not the system to keep", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/^\*\*Superseded/m);
    expect(source).toContain("neutral-*");
    expect(source).toContain("text-3xl");
    expect(source).toMatch(/do not preserve/i);
    expect(source).toMatch(/historical/i);
  });

  it("documents Persuade routes as already-bold, with motif, type, color, and skipped AppShell", () => {
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
    expect(source).toMatch(/Already amplified/i);
    expect(source).toMatch(/Do not bolder/i);
    expect(source).toMatch(/Not an Operate surface and not a second bolder target/i);
  });

  it("documents amplified Operate chrome, five destinations, and title peaks", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/^## Operate/m);
    expect(source).toContain("`/today`");
    expect(source).toContain("`/garden`");
    expect(source).toContain("`/catalog`");
    expect(source).toContain("`/log`");
    expect(source).toContain("`/ask`");
    expect(source).toContain("AppNav");
    expect(source).toContain("promoted tokens");
    expect(source).toContain("tracking-display");
    expect(source).toContain("text-5xl");
    expect(source).toContain("Open garden tasks");
    expect(source).toContain("Current locations");
    expect(source).toContain("Your garden profile");
    expect(source).toContain("Crop catalog");
    expect(source).toContain("What we already did");
    expect(source).toMatch(/\*\*Ask\*\* — peak/);
    expect(source).toMatch(/quieter than landing/i);
  });

  it("states one language: motif and type conviction at Operate density, not a poster", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/One product language/i);
    expect(source).toMatch(/motif and type conviction/i);
    expect(source).toMatch(/Operate density/i);
    expect(source).toMatch(/not a fold-covering poster/i);
  });

  it("lists promoted motif tokens vs leftover sign-in widgets", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/^## Primitives/m);
    expect(source).toContain("--background");
    expect(source).toContain("--foreground");
    expect(source).toContain("--color-forest");
    expect(source).toContain("--color-cream");
    expect(source).toContain("Hardcoded marketing hex");
    expect(source).toContain("neutral-*");
  });

  it("tells Phase B to audit drift against this file, not invent a third world", () => {
    const source = loadDesignDoc();

    expect(source).toMatch(/^## Intent for Phase B/m);
    expect(source).toMatch(/drift against this file/i);
    expect(source).toMatch(/Do not invent new hex/i);
    expect(source).toMatch(/Do not restore superseded quiet Operate/i);
  });
});
