import { afterEach, describe, expect, it, vi } from "vitest";

import {
  admitOrRejectSession,
  getAllowedEmails,
  isEmailAllowed,
  parseAllowedEmails,
} from "./allowlist";

describe("admission allowlist", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses and normalizes a comma-separated allowlist", () => {
    expect(
      parseAllowedEmails("  Allison@Example.COM , partner@example.com "),
    ).toEqual(["allison@example.com", "partner@example.com"]);
  });

  it("fails closed when ALLOWED_EMAILS is missing or empty", () => {
    expect(() => parseAllowedEmails(undefined)).toThrow(
      "ALLOWED_EMAILS is not configured",
    );
    expect(() => parseAllowedEmails(" ,  ")).toThrow(
      "ALLOWED_EMAILS must list at least one valid email",
    );
  });

  it("reads ALLOWED_EMAILS from the environment", () => {
    vi.stubEnv(
      "ALLOWED_EMAILS",
      "allison@example.com,partner@example.com",
    );

    expect(getAllowedEmails()).toEqual([
      "allison@example.com",
      "partner@example.com",
    ]);
    expect(isEmailAllowed("Allison@Example.COM")).toBe(true);
    expect(isEmailAllowed("stranger@example.com")).toBe(false);
  });

  it("rejects a non-allowlisted address, signs out, and logs the attempt", async () => {
    let signedOut = false;
    const logs: Array<{ email: string; at: Date }> = [];
    const now = new Date("2026-08-07T19:00:00.000Z");

    const result = await admitOrRejectSession({
      email: "Stranger@Evil.COM",
      signOut: async () => {
        signedOut = true;
      },
      allowedEmails: ["allison@example.com", "partner@example.com"],
      logRejected: (email, at) => {
        logs.push({ email, at });
      },
      now,
    });

    expect(result).toEqual({ status: "rejected" });
    expect(signedOut).toBe(true);
    expect(logs).toEqual([{ email: "stranger@evil.com", at: now }]);
  });

  it("allows either household address without signing out", async () => {
    let signedOut = false;

    const result = await admitOrRejectSession({
      email: "partner@example.com",
      signOut: async () => {
        signedOut = true;
      },
      allowedEmails: ["allison@example.com", "partner@example.com"],
    });

    expect(result).toEqual({ status: "allowed" });
    expect(signedOut).toBe(false);
  });
});
