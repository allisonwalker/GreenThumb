/**
 * Build gate for the two mistakes that silently publish a secret: prefixing a
 * credential with `NEXT_PUBLIC_`, and letting a `"use client"` module reach
 * database or provider code. Runs before `next build` (see package.json), so
 * either mistake fails the build instead of shipping.
 */
import { formatViolation } from "../lib/security/client-boundary";
import {
  scanClientBoundary,
  scanPublicSecretEnvVars,
} from "../lib/security/repo-scan";

function main() {
  const rootDir = process.cwd();
  const publicSecrets = scanPublicSecretEnvVars(rootDir);
  const boundaryViolations = scanClientBoundary(rootDir);

  for (const finding of publicSecrets) {
    console.error(
      `Secret exposed to the browser: ${finding.variable} at ${finding.file}:${finding.line}`,
    );
  }

  for (const violation of boundaryViolations) {
    console.error(`Client boundary violation: ${formatViolation(violation)}`);
  }

  if (publicSecrets.length > 0 || boundaryViolations.length > 0) {
    console.error(
      "\nNEXT_PUBLIC_ inlines a value into the client bundle at build time, and a" +
        "\nbrowser-reachable import ships that module to the browser. Both are" +
        "\nirreversible once deployed. Fix the findings above, then rebuild.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "No NEXT_PUBLIC_ secrets and no server-only code reachable from a client component.",
  );
}

main();
