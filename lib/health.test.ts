import { describe, expect, it } from "vitest";

import { createHealthPayload, getCommitSha } from "./health";

describe("health response", () => {
  it("reports a successful database check with its commit", () => {
    expect(createHealthPayload("abc123")).toEqual({
      status: "ok",
      database: "connected",
      commitSha: "abc123",
    });
  });

  it("prefers the Vercel commit SHA", () => {
    expect(
      getCommitSha({
        VERCEL_GIT_COMMIT_SHA: "vercel-sha",
        GIT_COMMIT_SHA: "fallback-sha",
      }),
    ).toBe("vercel-sha");
  });

  it("identifies a local build when no commit variable exists", () => {
    expect(getCommitSha({})).toBe("local");
  });
});
