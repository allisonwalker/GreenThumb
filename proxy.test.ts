import { describe, expect, it } from "vitest";

import {
  config,
  isProtectedPath,
  shouldRedirectAuthenticatedSignIn,
} from "./proxy";

describe("authentication proxy", () => {
  it.each([
    "/today",
    "/garden/sections",
    "/garden/setup",
    "/log",
    "/ask/history",
  ])("protects %s", (pathname) => {
    expect(isProtectedPath(pathname)).toBe(true);
  });

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

  it("redirects authenticated GET visits away from sign-in", () => {
    expect(shouldRedirectAuthenticatedSignIn("/sign-in", "GET", true)).toBe(
      true,
    );
  });

  it("allows authenticated POSTs to sign-in so OTP finish actions can run", () => {
    expect(shouldRedirectAuthenticatedSignIn("/sign-in", "POST", true)).toBe(
      false,
    );
  });
});
