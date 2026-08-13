import { describe, expect, it } from "vitest";

import { cropMatchesQuery, cropSlug } from "./slug";

describe("cropSlug", () => {
  it("normalizes tomato and Tomato to the same slug", () => {
    expect(cropSlug("tomato")).toBe("tomato");
    expect(cropSlug("Tomato")).toBe("tomato");
    expect(cropSlug("  Tomato  ")).toBe("tomato");
  });

  it("does not share a slug between tomato and pepper", () => {
    expect(cropSlug("tomato")).not.toBe(cropSlug("pepper"));
    expect(cropSlug("Tomato")).not.toBe(cropSlug("Pepper"));
  });

  it("collapses punctuation and spaces", () => {
    expect(cropSlug("cherry tomato")).toBe("cherry-tomato");
    expect(cropSlug("Cherry  Tomato!")).toBe("cherry-tomato");
  });

  it("rejects a name with no letters or numbers", () => {
    expect(() => cropSlug("   ")).toThrow(
      "Crop name must include letters or numbers.",
    );
    expect(() => cropSlug("***")).toThrow(
      "Crop name must include letters or numbers.",
    );
  });
});

describe("cropMatchesQuery", () => {
  it("matches by display name or slug", () => {
    expect(cropMatchesQuery("Tomato", "tomato", "tom")).toBe(true);
    expect(cropMatchesQuery("Tomato", "tomato", "TOMATO")).toBe(true);
    expect(cropMatchesQuery("Pepper", "pepper", "tom")).toBe(false);
  });

  it("treats a blank query as a match", () => {
    expect(cropMatchesQuery("Pepper", "pepper", "  ")).toBe(true);
  });
});
