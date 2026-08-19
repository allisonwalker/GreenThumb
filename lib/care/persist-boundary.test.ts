import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("care persist modules", () => {
  it("does not import an LLM provider or the agent write tool", () => {
    const persist = readFileSync(
      new URL("./persist.ts", import.meta.url),
      "utf8",
    );
    const listOpen = readFileSync(
      new URL("./list-open.ts", import.meta.url),
      "utf8",
    );
    const decisions = readFileSync(
      new URL("./persist-decisions.ts", import.meta.url),
      "utf8",
    );
    const source = `${persist}\n${listOpen}\n${decisions}`;

    expect(source).not.toMatch(/lib\/llm/);
    expect(source).not.toMatch(/lib\/agent/);
    expect(source).not.toMatch(/propose_recommendation/);
  });
});
