import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { formatViolation } from "./client-boundary";
import {
  createModuleReader,
  listClientReachableModules,
  listSourceFiles,
  scanClientBoundary,
  scanPublicSecretEnvVars,
} from "./repo-scan";
import { SECRET_ENV_VARS } from "./secrets";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

/**
 * These run the guards over this repository, so a regression fails `npm test`
 * as well as `npm run build`. The unit tests for the same functions live in
 * `client-boundary.test.ts` and `secrets.test.ts`.
 */
describe("this repository's client boundary", () => {
  it("keeps database, Supabase, and model-provider code out of the browser", () => {
    const violations = scanClientBoundary(rootDir);

    expect(violations.map(formatViolation)).toEqual([]);
  });

  it("has client components to check, so an empty result means something", () => {
    const reachable = listClientReachableModules(rootDir);

    expect(reachable.length).toBeGreaterThan(5);
    expect(reachable).toContain("components/app-nav.tsx");
  });

  it("never names a secret in a module the browser can reach", () => {
    const readModule = createModuleReader(rootDir);
    const offenders = listClientReachableModules(rootDir).filter((path) => {
      const source = readModule(path) ?? "";
      return SECRET_ENV_VARS.some((name) => source.includes(name));
    });

    expect(offenders).toEqual([]);
  });
});

describe("this repository's environment variables", () => {
  it("gives no secret a NEXT_PUBLIC_ prefix", () => {
    const findings = scanPublicSecretEnvVars(rootDir).map(
      ({ file, line, variable }) => `${file}:${line} ${variable}`,
    );

    expect(findings).toEqual([]);
  });

  it("confines the Supabase service role key to server-side code", () => {
    const readModule = createModuleReader(rootDir);
    const clientReachable = new Set(listClientReachableModules(rootDir));
    const referencing = listSourceFiles(rootDir).filter((path) =>
      (readModule(path) ?? "").includes("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // The key is unused by the application; only the guard's own inventory and
    // tests name it. Whatever references it must not be browser-reachable.
    expect(
      referencing.filter((path) => clientReachable.has(path)),
    ).toEqual([]);
  });
});
