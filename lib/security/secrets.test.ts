import { describe, expect, it } from "vitest";

import {
  findPublicSecretEnvVars,
  findServerOnlyEnvReads,
  isSecretEnvVarName,
  PUBLIC_ENV_PREFIX,
  SECRET_ENV_VARS,
} from "./secrets";

/**
 * Built from the prefix constant rather than written out. This repository scans
 * its own source for `NEXT_PUBLIC_` on a secret, and a literal fixture here
 * would be a finding.
 */
function publicVar(name: string) {
  return `${PUBLIC_ENV_PREFIX}${name}`;
}

describe("isSecretEnvVarName", () => {
  it("covers every configured secret", () => {
    for (const name of SECRET_ENV_VARS) {
      expect(isSecretEnvVarName(name), name).toBe(true);
    }
  });

  it("recognizes credential-shaped names that are not on the list yet", () => {
    expect(isSecretEnvVarName("STRIPE_SECRET_KEY")).toBe(true);
    expect(isSecretEnvVarName("SMTP_PASSWORD")).toBe(true);
    expect(isSecretEnvVarName("SESSION_TOKEN")).toBe(true);
    expect(isSecretEnvVarName("REDIS_CONNECTION_STRING")).toBe(true);
  });

  it("leaves non-secret configuration alone", () => {
    expect(isSecretEnvVarName("SITE_URL")).toBe(false);
    expect(isSecretEnvVarName("LLM_PROVIDER")).toBe(false);
    expect(isSecretEnvVarName("GEMINI_MODEL")).toBe(false);
    expect(isSecretEnvVarName("NODE_ENV")).toBe(false);
  });
});

describe("findPublicSecretEnvVars", () => {
  it("reports a secret published through the public prefix, with its line", () => {
    const source = ["# comment", `${publicVar("ANTHROPIC_API_KEY")}=sk-test`].join(
      "\n",
    );

    expect(findPublicSecretEnvVars(source)).toEqual([
      { variable: publicVar("ANTHROPIC_API_KEY"), line: 2 },
    ]);
  });

  it("reports a secret read from the public prefix in source code", () => {
    const source = `const key = process.env.${publicVar("SUPABASE_SERVICE_ROLE_KEY")};`;

    expect(findPublicSecretEnvVars(source)).toEqual([
      { variable: publicVar("SUPABASE_SERVICE_ROLE_KEY"), line: 1 },
    ]);
  });

  it("allows a public variable that carries no secret", () => {
    const source = `${publicVar("SITE_NAME")}=GreenThumb\n${publicVar("ANALYTICS_ID")}=abc`;

    expect(findPublicSecretEnvVars(source)).toEqual([]);
  });

  it("ignores a secret that is correctly left server-only", () => {
    expect(findPublicSecretEnvVars("CRON_SECRET=abc\nDATABASE_URL=x")).toEqual(
      [],
    );
  });
});

describe("findServerOnlyEnvReads", () => {
  it("finds dotted and bracketed secret reads", () => {
    const source = [
      "const a = process.env.DATABASE_URL;",
      'const b = process.env["CRON_SECRET"];',
      "const c = process.env.SITE_URL;",
    ].join("\n");

    expect(findServerOnlyEnvReads(source)).toEqual([
      "CRON_SECRET",
      "DATABASE_URL",
    ]);
  });

  it("returns nothing for a module that reads no secret", () => {
    expect(findServerOnlyEnvReads("const x = process.env.NODE_ENV;")).toEqual(
      [],
    );
  });
});
