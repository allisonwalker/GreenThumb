import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  authenticateApiRequest,
  getAuthenticatedIdentity,
} from "./session";

function authUser(overrides: Partial<User> = {}): User {
  return {
    id: "b5cefa4e-e7a5-43d4-a4a4-cd017e2ff1db",
    email: "allison@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("server-side authentication", () => {
  it("returns the identity later writes use for attribution", async () => {
    await expect(
      getAuthenticatedIdentity(async () => authUser()),
    ).resolves.toEqual({
      id: "b5cefa4e-e7a5-43d4-a4a4-cd017e2ff1db",
      email: "allison@example.com",
    });
  });

  it("rejects an unauthenticated API request with 401", async () => {
    const result = await authenticateApiRequest(async () => null);

    expect(result.identity).toBeUndefined();
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({
      error: "Authentication required",
    });
  });

  it("allows either household identity without user-specific filtering", async () => {
    const first = await authenticateApiRequest(async () => authUser());
    const second = await authenticateApiRequest(async () =>
      authUser({
        id: "0b523ada-f56b-479c-9f3b-297aca3649bf",
        email: "partner@example.com",
      }),
    );

    expect(first.identity?.email).toBe("allison@example.com");
    expect(second.identity?.email).toBe("partner@example.com");
  });
});
