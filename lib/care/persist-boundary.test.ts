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
    const evaluate = readFileSync(
      new URL("./evaluate.ts", import.meta.url),
      "utf8",
    );
    const watering = readFileSync(
      new URL("./watering.ts", import.meta.url),
      "utf8",
    );
    const copy = readFileSync(new URL("./copy.ts", import.meta.url), "utf8");
    const run = readFileSync(new URL("./run.ts", import.meta.url), "utf8");
    const load = readFileSync(
      new URL("./load-inputs.ts", import.meta.url),
      "utf8",
    );
    const cadence = readFileSync(
      new URL("./cadence.ts", import.meta.url),
      "utf8",
    );
    const frost = readFileSync(new URL("./frost.ts", import.meta.url), "utf8");
    const source = `${persist}\n${listOpen}\n${decisions}\n${evaluate}\n${watering}\n${cadence}\n${frost}\n${copy}\n${run}\n${load}`;

    expect(source).not.toMatch(/lib\/llm/);
    expect(source).not.toMatch(/lib\/agent/);
    expect(source).not.toMatch(/propose_recommendation/);
  });
});
