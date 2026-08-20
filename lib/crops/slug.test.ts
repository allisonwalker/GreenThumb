import { describe, expect, it } from "vitest";

import {
  catalogSlug,
  cropCareCopyLabel,
  cropIdentityLabel,
  cropMatchesQuery,
  cropSlug,
  normalizeVariety,
} from "./slug";

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

describe("catalogSlug", () => {
  it("uses the name slug when variety is null", () => {
    expect(catalogSlug("Tomato", null)).toBe("tomato");
    expect(catalogSlug("Cherry tomato", null)).toBe("cherry-tomato");
  });

  it("joins name and variety with a double hyphen", () => {
    expect(catalogSlug("Tomato", "Sungold")).toBe("tomato--sungold");
    expect(catalogSlug("Tomato", "  Sungold  ")).toBe("tomato--sungold");
  });

  it("does not merge Cherry tomato with Tomato / Cherry", () => {
    expect(catalogSlug("Cherry tomato", null)).toBe("cherry-tomato");
    expect(catalogSlug("Tomato", "Cherry")).toBe("tomato--cherry");
    expect(catalogSlug("Cherry tomato", null)).not.toBe(
      catalogSlug("Tomato", "Cherry"),
    );
  });

  it("cannot put -- inside one field because cropSlug collapses punctuation", () => {
    expect(cropSlug("sun--gold")).toBe("sun-gold");
    expect(catalogSlug("Tomato", "sun--gold")).toBe("tomato--sun-gold");
  });

  it("treats blank variety as unnamed", () => {
    expect(catalogSlug("Tomato", "   ")).toBe("tomato");
    expect(normalizeVariety("   ")).toBeNull();
    expect(normalizeVariety(null)).toBeNull();
  });

  it("rejects a variety with no letters or numbers", () => {
    expect(() => catalogSlug("Tomato", "***")).toThrow(
      "Variety must include letters or numbers.",
    );
  });
});

describe("crop identity labels", () => {
  it("shows name / variety when a variety is present", () => {
    expect(cropIdentityLabel("Tomato", "Sungold")).toBe("Tomato / Sungold");
    expect(cropIdentityLabel("Tomato", null)).toBe("Tomato");
  });

  it("puts variety first in matching copy", () => {
    expect(cropCareCopyLabel("tomatoes", "Sungold")).toBe("Sungold tomatoes");
    expect(cropCareCopyLabel("tomatoes", null)).toBe("tomatoes");
  });
});

describe("cropMatchesQuery", () => {
  it("matches by display name or slug", () => {
    expect(cropMatchesQuery("Tomato", "tomato", "tom")).toBe(true);
    expect(cropMatchesQuery("Tomato", "tomato", "TOMATO")).toBe(true);
    expect(cropMatchesQuery("Pepper", "pepper", "tom")).toBe(false);
  });

  it("matches variety and composite slug", () => {
    expect(
      cropMatchesQuery("Tomato", "tomato--sungold", "sungold", "Sungold"),
    ).toBe(true);
    expect(
      cropMatchesQuery("Tomato", "tomato--sungold", "tomato--sungold", "Sungold"),
    ).toBe(true);
    expect(
      cropMatchesQuery("Tomato", "tomato", "sungold", null),
    ).toBe(false);
  });

  it("treats a blank query as a match", () => {
    expect(cropMatchesQuery("Pepper", "pepper", "  ")).toBe(true);
  });
});
