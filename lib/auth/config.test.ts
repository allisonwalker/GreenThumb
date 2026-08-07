import { describe, expect, it } from "vitest";

import { getAuthCallbackUrl, normalizeEmail } from "./config";

describe("authentication configuration", () => {
  it("normalizes a valid email address", () => {
    expect(normalizeEmail("  Allison@Example.COM ")).toBe(
      "allison@example.com",
    );
  });

  it("rejects malformed email addresses", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("builds the fixed callback route from the configured site URL", () => {
    expect(getAuthCallbackUrl("https://garden.example.com")).toBe(
      "https://garden.example.com/auth/callback",
    );
  });

  it("rejects missing and non-http site URLs", () => {
    expect(() => getAuthCallbackUrl(undefined)).toThrow(
      "SITE_URL is not configured",
    );
    expect(() => getAuthCallbackUrl("javascript:alert(1)")).toThrow(
      "SITE_URL must use HTTP or HTTPS",
    );
  });
});
