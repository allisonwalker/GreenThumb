/**
 * Pre-deploy check: searches the build output the browser can actually download
 * for any fragment of a configured secret. Run after `npm run build` and before
 * a public deploy (see README § Before a public deploy).
 *
 * Findings never print the matched text — only the variable name, the fragment
 * length, and the file — so a failure is safe to paste into an issue or CI log.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { SECRET_ENV_VARS } from "../lib/security/secrets";

/**
 * Client-visible build output. `.next/static` is everything the browser
 * downloads; the prerendered HTML and RSC payloads under `.next/server/app` are
 * also sent to the browser, and are where a value leaks if a Server Component
 * passes it to a Client Component as a prop.
 */
const SCAN_TARGETS: { directory: string; extensions?: string[] }[] = [
  { directory: ".next/static" },
  {
    directory: ".next/server/app",
    extensions: [".html", ".rsc", ".body", ".json"],
  },
];

/** Below this length a fragment matches unrelated text too often to be useful. */
const MIN_FRAGMENT_LENGTH = 12;
const EDGE_FRAGMENT_LENGTH = 24;

type Finding = {
  variable: string;
  file: string;
  fragmentLength: number;
};

function main() {
  const rootDir = process.cwd();

  if (!isDirectory(join(rootDir, ".next"))) {
    console.error(
      "No .next directory found. Run `npm run build` before scanning the build output.",
    );
    process.exitCode = 1;
    return;
  }

  const configured = SECRET_ENV_VARS.filter((name) => hasValue(process.env[name]));
  const missing = SECRET_ENV_VARS.filter((name) => !hasValue(process.env[name]));

  if (configured.length === 0) {
    console.error(
      "No secrets are set in this environment, so the scan would prove nothing.\n" +
        "Run it with the same values the build used (locally: .env.local).",
    );
    process.exitCode = 1;
    return;
  }

  const fragmentsByVariable = new Map(
    configured.map((name) => [
      name,
      secretFragments(process.env[name] as string),
    ]),
  );
  const files = collectScanTargets(rootDir);
  const findings: Finding[] = [];

  for (const file of files) {
    const contents = readFileSync(join(rootDir, file), "latin1");

    for (const [variable, fragments] of fragmentsByVariable) {
      const matched = fragments.find((fragment) => contents.includes(fragment));

      if (matched) {
        findings.push({ variable, file, fragmentLength: matched.length });
      }
    }
  }

  console.log(
    `Scanned ${files.length} client-visible build files for ${configured.length} secrets.`,
  );

  if (missing.length > 0) {
    console.log(
      `Not set in this environment, so not covered: ${missing.join(", ")}.`,
    );
  }

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(
        `Secret in browser-visible output: ${finding.variable} (${finding.fragmentLength}-character fragment) in ${finding.file}`,
      );
    }

    console.error(
      "\nDo not deploy this build. Treat the matched secrets as compromised and" +
        "\nrotate them (README § Secrets), then remove whatever put the value in" +
        "\nthe client bundle and rebuild.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("No secret fragments found in the client-visible build output.");
}

/**
 * The whole value, plus the pieces of it that could leak on their own: a
 * connection string's password, each token of a dot-separated key, and the
 * leading and trailing run of a long key.
 */
export function secretFragments(value: string): string[] {
  const fragments = new Set<string>();
  const trimmed = value.trim();

  const add = (candidate: string) => {
    if (candidate.length >= MIN_FRAGMENT_LENGTH) {
      fragments.add(candidate);
    }
  };

  add(trimmed);

  const password = connectionStringPassword(trimmed);
  if (password) {
    add(password);
  }

  for (const token of trimmed.split(/[^A-Za-z0-9_-]+/)) {
    add(token);
  }

  if (trimmed.length >= EDGE_FRAGMENT_LENGTH * 2) {
    add(trimmed.slice(0, EDGE_FRAGMENT_LENGTH));
    add(trimmed.slice(-EDGE_FRAGMENT_LENGTH));
  }

  return [...fragments];
}

/** A connection string's host and user are public; its password is not. */
function connectionStringPassword(value: string) {
  try {
    const password = new URL(value).password;
    return password === "" ? null : decodeURIComponent(password);
  } catch {
    return null;
  }
}

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim() !== "";
}

function collectScanTargets(rootDir: string) {
  return SCAN_TARGETS.flatMap(({ directory, extensions }) => {
    const absolute = join(rootDir, directory);

    if (!isDirectory(absolute)) {
      return [];
    }

    return walkFiles(rootDir, absolute).filter(
      (file) =>
        extensions === undefined ||
        extensions.some((extension) => file.endsWith(extension)),
    );
  }).sort();
}

function walkFiles(rootDir: string, directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      return walkFiles(rootDir, absolute);
    }

    return entry.isFile() ? [relative(rootDir, absolute).split(sep).join("/")] : [];
  });
}

function isDirectory(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

main();
