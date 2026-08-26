import { describe, expect, it } from "vitest";

import { sanitizeAssistantReply } from "./plain-reply";

const MARKDOWN_AND_DASH_FIXTURE = `# Heading
Peppers want **full sun** — check the catalog field \`sun_preference\`.
`;

describe("sanitizeAssistantReply", () => {
  it("turns leftover markdown and an em dash into readable prose", () => {
    const cleaned = sanitizeAssistantReply(MARKDOWN_AND_DASH_FIXTURE);

    expect(cleaned).not.toMatch(/\*\*/);
    expect(cleaned).not.toMatch(/`/);
    expect(cleaned).not.toMatch(/^#/m);
    expect(cleaned).not.toContain("\u2014");
    expect(cleaned).toMatch(/Heading/);
    expect(cleaned).toMatch(/full sun/);
    expect(cleaned).toMatch(/sun_preference/);
    expect(cleaned).toMatch(/Peppers want full sun[,.]/);
  });

  it("keeps time-budget packs as plain labeled lines", () => {
    const cleaned = sanitizeAssistantReply(
      "## Must-do\n**Water the peppers** — 20 minutes\n\n## If you have time\nPrune the basil.",
    );

    expect(cleaned).not.toMatch(/^#/m);
    expect(cleaned).not.toMatch(/\*\*/);
    expect(cleaned).not.toContain("\u2014");
    expect(cleaned).toMatch(/^Must-do$/m);
    expect(cleaned).toMatch(/^If you have time$/m);
    expect(cleaned).toMatch(/Water the peppers/);
    expect(cleaned).toMatch(/Prune the basil/);
  });

  it("flattens GFM table pipes and drops fenced code markers", () => {
    const cleaned = sanitizeAssistantReply(
      ["| Crop | Sun |", "| --- | --- |", "| Pepper | full_sun |", "", "```", "leave this", "```"].join(
        "\n",
      ),
    );

    expect(cleaned).not.toContain("|");
    expect(cleaned).not.toContain("```");
    expect(cleaned).toMatch(/Pepper, full_sun/);
    expect(cleaned).toMatch(/leave this/);
  });

  it("uses a hyphen only for a tight compound em dash", () => {
    expect(sanitizeAssistantReply("well\u2014known bed")).toBe("well-known bed");
  });
});
