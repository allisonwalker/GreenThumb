import { findServerOnlyEnvReads } from "./secrets";

/**
 * Packages that only ever belong on the server: they hold a connection, spend
 * money, or read a credential. A `"use client"` module that can reach one of
 * these — directly or through any number of hops — has put database or provider
 * access in the browser bundle.
 *
 * Internal modules are deliberately absent: they are caught transitively
 * through whichever package they wrap, so this list stays the only place that
 * has to be maintained.
 */
const SERVER_ONLY_PACKAGES: { pattern: RegExp; reason: string }[] = [
  { pattern: /^postgres$/, reason: "opens a Postgres connection" },
  { pattern: /^drizzle-orm(\/.*)?$/, reason: "builds and runs SQL" },
  { pattern: /^@supabase\/ssr$/, reason: "creates Supabase clients" },
  { pattern: /^@supabase\/supabase-js$/, reason: "queries Supabase directly" },
  { pattern: /^@anthropic-ai\/sdk(\/.*)?$/, reason: "uses ANTHROPIC_API_KEY" },
  { pattern: /^@google\/generative-ai(\/.*)?$/, reason: "uses GEMINI_API_KEY" },
  { pattern: /^nodemailer(\/.*)?$/, reason: "uses GMAIL_APP_PASSWORD" },
  { pattern: /^server-only$/, reason: "is marked server-only" },
];

const MODULE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export type ClientBoundaryViolation = {
  /** Import chain from the `"use client"` module to the offending module. */
  chain: string[];
  detail: string;
};

/** Reads a module's source, or returns null when the path does not resolve. */
export type ModuleReader = (path: string) => string | null;

export function readLeadingDirective(source: string): string | null {
  for (const raw of source.split("\n")) {
    const line = raw.trim();

    if (line === "" || line.startsWith("//") || line.startsWith("/*")) {
      continue;
    }

    const directive = /^["'](use client|use server)["'];?$/.exec(line);
    return directive?.[1] ?? null;
  }

  return null;
}

export function isClientModule(source: string) {
  return readLeadingDirective(source) === "use client";
}

export function isServerActionModule(source: string) {
  return readLeadingDirective(source) === "use server";
}

/**
 * Import specifiers that survive compilation. Type-only imports are erased by
 * TypeScript and never reach the bundle, so a client component may safely
 * import a type from a server module.
 */
export function parseValueImports(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const specifiers = new Set<string>();

  const staticImport =
    /\bimport\s+(?!type\b)([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  for (const [, clause, specifier] of withoutComments.matchAll(staticImport)) {
    if (clause !== undefined && specifier && !isTypeOnlyClause(clause)) {
      specifiers.add(specifier);
    }
  }

  const patterns = [
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bexport\s+(?!type\b)[\s\S]*?\bfrom\s*["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const [, specifier] of withoutComments.matchAll(pattern)) {
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers];
}

/**
 * `import { type A, type B } from "x"` erases entirely, the same as
 * `import type`. A single value member keeps the import alive.
 */
function isTypeOnlyClause(clause: string) {
  const named = /^\{([\s\S]*)\}$/.exec(clause.trim());

  if (!named?.[1]) {
    return false;
  }

  const members = named[1]
    .split(",")
    .map((member) => member.trim())
    .filter((member) => member !== "");

  return (
    members.length > 0 && members.every((member) => /^type\s/.test(member))
  );
}

export function classifyServerOnlyPackage(specifier: string): string | null {
  const match = SERVER_ONLY_PACKAGES.find(({ pattern }) =>
    pattern.test(specifier),
  );

  return match ? `imports "${specifier}", which ${match.reason}` : null;
}

function isRelative(specifier: string) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function isInternal(specifier: string) {
  return specifier.startsWith("@/") || isRelative(specifier);
}

/** Mirrors the `@/*` tsconfig path alias and Node-style index resolution. */
export function resolveModulePath(
  specifier: string,
  importerPath: string,
  readModule: ModuleReader,
): string | null {
  const base = specifier.startsWith("@/")
    ? specifier.slice(2)
    : joinPath(dirname(importerPath), specifier);

  const candidates = [
    base,
    ...MODULE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...MODULE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ];

  return candidates.find((candidate) => readModule(candidate) !== null) ?? null;
}

function dirname(path: string) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function joinPath(directory: string, relative: string) {
  const segments = directory === "" ? [] : directory.split("/");

  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
}

/**
 * Every module the browser can reach from a `"use client"` entry point, mapped
 * to the import chain that reached it first.
 *
 * `"use server"` modules terminate the walk: Next.js compiles them in a
 * server-only layer, and the client receives an RPC reference rather than the
 * code, so what they import stays on the server.
 */
export function collectClientReachableModules(options: {
  entryPoints: string[];
  readModule: ModuleReader;
}): Map<string, string[]> {
  const { entryPoints, readModule } = options;
  const reachable = new Map<string, string[]>();

  const walk = (path: string, chain: string[]) => {
    if (reachable.has(path)) {
      return;
    }

    const source = readModule(path);

    if (source === null || isServerActionModule(source)) {
      return;
    }

    reachable.set(path, chain);

    for (const specifier of parseValueImports(source)) {
      if (!isInternal(specifier)) {
        continue;
      }

      const resolved = resolveModulePath(specifier, path, readModule);

      if (resolved) {
        walk(resolved, [...chain, resolved]);
      }
    }
  };

  for (const entryPoint of entryPoints) {
    walk(entryPoint, [entryPoint]);
  }

  return reachable;
}

/**
 * Server-only packages and secret reads anywhere in the browser-reachable graph.
 * An empty result is the evidence that no client component can query the
 * database or read a credential.
 */
export function findClientBoundaryViolations(options: {
  entryPoints: string[];
  readModule: ModuleReader;
}): ClientBoundaryViolation[] {
  const violations: ClientBoundaryViolation[] = [];

  for (const [path, chain] of collectClientReachableModules(options)) {
    const source = options.readModule(path) ?? "";

    for (const variable of findServerOnlyEnvReads(source)) {
      violations.push({
        chain,
        detail: `reads process.env.${variable} in browser-reachable code`,
      });
    }

    for (const specifier of parseValueImports(source)) {
      const packageViolation = classifyServerOnlyPackage(specifier);

      if (packageViolation) {
        violations.push({ chain, detail: packageViolation });
      }
    }
  }

  return violations;
}

export function formatViolation(violation: ClientBoundaryViolation) {
  return `${violation.chain.join(" -> ")}\n    ${violation.detail}`;
}
