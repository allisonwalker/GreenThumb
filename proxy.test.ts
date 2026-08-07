import { describe, expect, it } from "vitest";

import { config, isProtectedPath } from "./proxy";

describe("authentication proxy", () => {
  it.each(["/today", "/garden/sections", "/log", "/ask/history"])(
    "protects %s",
    (pathname) => {
      expect(isProtectedPath(pathname)).toBe(true);
    },
  );

  it.each(["/", "/sign-in", "/health", "/auth/callback", "/todayish"])(
    "does not classify %s as a protected garden screen",
    (pathname) => {
      expect(isProtectedPath(pathname)).toBe(false);
    },
  );

  it("runs before every protected screen and the sign-in page", () => {
    expect(config.matcher).toEqual([
      "/today/:path*",
      "/garden/:path*",
      "/log/:path*",
      "/ask/:path*",
      "/sign-in",
    ]);
  });
});
