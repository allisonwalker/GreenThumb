import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "schema.ts");

describe("schema timestamps", () => {
  it("declares every timestamp column with timezone", () => {
    const source = readFileSync(schemaPath, "utf8");
    const calls = [...source.matchAll(/timestamp\(([^)]*)\)/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const match of calls) {
      expect(match[1]).toMatch(/withTimezone:\s*true/);
    }
  });
});
