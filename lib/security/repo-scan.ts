import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import {
  collectClientReachableModules,
  findClientBoundaryViolations,
  isClientModule,
  type ClientBoundaryViolation,
  type ModuleReader,
} from "./client-boundary";
import { findPublicSecretEnvVars, type PublicSecretFinding } from "./secrets";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  "drizzle",
  "coverage",
]);

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"];

/** Repo-relative, forward-slashed paths so findings read the same everywhere. */
function toModulePath(rootDir: string, absolutePath: string) {
  return relative(rootDir, absolutePath).split(sep).join("/");
}

function walkDirectory(rootDir: string, directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        found.push(...walkDirectory(rootDir, join(directory, entry.name)));
      }
      continue;
    }

    if (entry.isFile()) {
      found.push(toModulePath(rootDir, join(directory, entry.name)));
    }
  }

  return found;
}

export function listRepositoryFiles(rootDir: string) {
  return walkDirectory(rootDir, rootDir).sort();
}

export function listSourceFiles(rootDir: string) {
  return listRepositoryFiles(rootDir).filter((path) =>
    SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension)),
  );
}

/** Environment files, including untracked local ones, are scanned too. */
export function listEnvFiles(rootDir: string) {
  return listRepositoryFiles(rootDir).filter((path) =>
    /(^|\/)\.env($|\.)/.test(path),
  );
}

export function createModuleReader(rootDir: string): ModuleReader {
  const cache = new Map<string, string | null>();

  return (path: string) => {
    const cached = cache.get(path);

    if (cached !== undefined) {
      return cached;
    }

    let source: string | null = null;

    try {
      const absolutePath = join(rootDir, path);

      if (statSync(absolutePath).isFile()) {
        source = readFileSync(absolutePath, "utf8");
      }
    } catch {
      source = null;
    }

    cache.set(path, source);
    return source;
  };
}

export function findClientEntryPoints(rootDir: string, readModule: ModuleReader) {
  return listSourceFiles(rootDir).filter((path) => {
    const source = readModule(path);
    return source !== null && isClientModule(source);
  });
}

/**
 * Every module the browser can reach, checked for server-only packages and
 * secret reads. An empty result is the proof behind "no client component
 * queries the database".
 */
export function scanClientBoundary(rootDir: string): ClientBoundaryViolation[] {
  const readModule = createModuleReader(rootDir);

  return findClientBoundaryViolations({
    entryPoints: findClientEntryPoints(rootDir, readModule),
    readModule,
  });
}

/** The browser-reachable module graph, for checks that need the file list. */
export function listClientReachableModules(rootDir: string) {
  const readModule = createModuleReader(rootDir);

  return [
    ...collectClientReachableModules({
      entryPoints: findClientEntryPoints(rootDir, readModule),
      readModule,
    }).keys(),
  ].sort();
}

export type PublicEnvFinding = PublicSecretFinding & { file: string };

/**
 * Source and `.env*` files checked for `NEXT_PUBLIC_` on a secret. Covers env
 * files because that is where the mistake is usually made.
 */
export function scanPublicSecretEnvVars(rootDir: string): PublicEnvFinding[] {
  const readModule = createModuleReader(rootDir);
  const files = [
    ...new Set([...listSourceFiles(rootDir), ...listEnvFiles(rootDir)]),
  ].sort();

  return files.flatMap((file) => {
    const source = readModule(file);

    if (source === null) {
      return [];
    }

    return findPublicSecretEnvVars(source).map((finding) => ({
      ...finding,
      file,
    }));
  });
}
