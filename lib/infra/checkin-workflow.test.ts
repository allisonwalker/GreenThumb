import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflowPath = resolve(
  process.cwd(),
  ".github/workflows/checkin.yml",
);

function loadWorkflow() {
  return readFileSync(workflowPath, "utf8");
}

describe("daily matching check-in workflow", () => {
  it("schedules a POST to /api/care/checkin with the bearer secret", () => {
    const source = loadWorkflow();

    expect(source).toMatch(/cron:\s*"0 13 \* \* \*"/);
    expect(source).toContain("workflow_dispatch:");
    expect(source).toContain('url="${origin}/api/care/checkin"');
    expect(source).not.toMatch(/url=.*\/api\/agent\//);
    expect(source).not.toMatch(/\brunAgent\b/);
    expect(source).toContain("Authorization: Bearer ${CRON_SECRET}");
    expect(source).toContain("secrets.CRON_SECRET");
    expect(source).toContain("secrets.SITE_URL");
  });

  it("documents the UTC offset and DST caveat for ~06:00 garden-local", () => {
    const source = loadWorkflow();

    expect(source).toMatch(/America\/Los_Angeles/);
    expect(source).toMatch(/06:00/);
    expect(source).toMatch(/DST|daylight saving/i);
    expect(source).toMatch(/UTC/);
    expect(source).toMatch(/PST/);
    expect(source).toMatch(/PDT/);
  });

  it("fails the job when curl or required secrets fail", () => {
    const source = loadWorkflow();

    expect(source).toMatch(/set -euo pipefail/);
    expect(source).toMatch(/curl -sS --fail-with-body/);
    expect(source).not.toMatch(/curl -f/);
    expect(source).toMatch(/exit 1/);
  });

  it("does not store CRON_SECRET in the workflow file", () => {
    const source = loadWorkflow();

    expect(source).not.toMatch(/CRON_SECRET\s*[:=]\s*['"]?[^$\s#]/);
  });
});
