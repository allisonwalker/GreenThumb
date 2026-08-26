import { describe, expect, it, vi } from "vitest";

import { retryPing } from "./ping";

describe("retryPing", () => {
  it("returns on the first successful ping", async () => {
    const ping = vi.fn().mockResolvedValue(undefined);

    await retryPing(ping, { attempts: 3, delayMs: 1 });

    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed ping then succeeds", async () => {
    const ping = vi
      .fn()
      .mockRejectedValueOnce(new Error("paused"))
      .mockResolvedValueOnce(undefined);

    await retryPing(ping, { attempts: 3, delayMs: 1 });

    expect(ping).toHaveBeenCalledTimes(2);
  });

  it("throws the last error when every attempt fails", async () => {
    const ping = vi.fn().mockRejectedValue(new Error("unreachable"));

    await expect(retryPing(ping, { attempts: 2, delayMs: 1 })).rejects.toThrow(
      "unreachable",
    );
    expect(ping).toHaveBeenCalledTimes(2);
  });
});
