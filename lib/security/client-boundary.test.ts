import { describe, expect, it } from "vitest";

import {
  classifyServerOnlyPackage,
  findClientBoundaryViolations,
  isClientModule,
  isServerActionModule,
  parseValueImports,
  readLeadingDirective,
  resolveModulePath,
  type ModuleReader,
} from "./client-boundary";

function readerFor(modules: Record<string, string>): ModuleReader {
  return (path) => modules[path] ?? null;
}

describe("readLeadingDirective", () => {
  it("reads the directive past comments and blank lines", () => {
    expect(readLeadingDirective('\n// header\n"use client";\n')).toBe(
      "use client",
    );
    expect(readLeadingDirective("'use server';\n")).toBe("use server");
  });

  it("returns null when the module has no directive", () => {
    expect(readLeadingDirective('import x from "y";\n"use client";')).toBeNull();
    expect(readLeadingDirective("export const a = 1;")).toBeNull();
  });

  it("distinguishes the two directives", () => {
    expect(isClientModule('"use client";')).toBe(true);
    expect(isClientModule('"use server";')).toBe(false);
    expect(isServerActionModule('"use server";')).toBe(true);
  });
});

describe("parseValueImports", () => {
  it("collects static, bare, dynamic, and re-exported specifiers", () => {
    const source = [
      'import { useState } from "react";',
      'import "./styles.css";',
      'export { helper } from "./helper";',
      'const mod = await import("./lazy");',
    ].join("\n");

    expect(parseValueImports(source).sort()).toEqual([
      "./helper",
      "./lazy",
      "./styles.css",
      "react",
    ]);
  });

  it("skips type-only imports, which are erased before bundling", () => {
    const source = [
      'import type { Row } from "@/lib/db/schema";',
      'import { type A, type B } from "./types";',
      'import { value, type C } from "./mixed";',
    ].join("\n");

    expect(parseValueImports(source)).toEqual(["./mixed"]);
  });

  it("ignores specifiers inside comments", () => {
    const source = [
      '// import { getDatabase } from "@/lib/db/client";',
      '/* import postgres from "postgres"; */',
      'import Link from "next/link";',
    ].join("\n");

    expect(parseValueImports(source)).toEqual(["next/link"]);
  });
});

describe("classifyServerOnlyPackage", () => {
  it("flags database, Supabase, and model-provider packages", () => {
    expect(classifyServerOnlyPackage("postgres")).toContain("postgres");
    expect(classifyServerOnlyPackage("drizzle-orm/postgres-js")).not.toBeNull();
    expect(classifyServerOnlyPackage("@supabase/ssr")).not.toBeNull();
    expect(classifyServerOnlyPackage("@anthropic-ai/sdk")).not.toBeNull();
    expect(classifyServerOnlyPackage("server-only")).not.toBeNull();
  });

  it("leaves browser packages alone", () => {
    expect(classifyServerOnlyPackage("react")).toBeNull();
    expect(classifyServerOnlyPackage("next/link")).toBeNull();
    expect(classifyServerOnlyPackage("lucide-react")).toBeNull();
  });
});

describe("resolveModulePath", () => {
  const readModule = readerFor({
    "lib/a.ts": "",
    "lib/nested/index.tsx": "",
    "app/page.tsx": "",
  });

  it("resolves the @/ alias, relative paths, and index files", () => {
    expect(resolveModulePath("@/lib/a", "app/page.tsx", readModule)).toBe(
      "lib/a.ts",
    );
    expect(resolveModulePath("./nested", "lib/a.ts", readModule)).toBe(
      "lib/nested/index.tsx",
    );
    expect(resolveModulePath("../app/page", "lib/a.ts", readModule)).toBe(
      "app/page.tsx",
    );
  });

  it("returns null for a specifier that does not resolve", () => {
    expect(resolveModulePath("@/lib/missing", "app/page.tsx", readModule)).toBeNull();
  });
});

describe("findClientBoundaryViolations", () => {
  it("passes a client component that only reaches browser-safe code", () => {
    const readModule = readerFor({
      "app/form.tsx": '"use client";\nimport { slugify } from "@/lib/slug";',
      "lib/slug.ts": "export const slugify = (v: string) => v.trim();",
    });

    expect(
      findClientBoundaryViolations({
        entryPoints: ["app/form.tsx"],
        readModule,
      }),
    ).toEqual([]);
  });

  it("catches a database import several hops from the client component", () => {
    const readModule = readerFor({
      "app/form.tsx": '"use client";\nimport { list } from "@/lib/list";',
      "lib/list.ts": 'import { db } from "@/lib/db";',
      "lib/db.ts": 'import postgres from "postgres";',
    });

    const violations = findClientBoundaryViolations({
      entryPoints: ["app/form.tsx"],
      readModule,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.chain).toEqual([
      "app/form.tsx",
      "lib/list.ts",
      "lib/db.ts",
    ]);
    expect(violations[0]?.detail).toContain("postgres");
  });

  it("catches a secret read in browser-reachable code", () => {
    const readModule = readerFor({
      "app/form.tsx": '"use client";\nimport { key } from "@/lib/config";',
      "lib/config.ts": "export const key = process.env.ANTHROPIC_API_KEY;",
    });

    const violations = findClientBoundaryViolations({
      entryPoints: ["app/form.tsx"],
      readModule,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.detail).toContain("ANTHROPIC_API_KEY");
  });

  it("stops at a server action, which the client only references by RPC", () => {
    const readModule = readerFor({
      "app/form.tsx": '"use client";\nimport { save } from "./actions";',
      "app/actions.ts": '"use server";\nimport postgres from "postgres";',
    });

    expect(
      findClientBoundaryViolations({
        entryPoints: ["app/form.tsx"],
        readModule,
      }),
    ).toEqual([]);
  });

  it("allows a type-only import of a server module", () => {
    const readModule = readerFor({
      "app/form.tsx": '"use client";\nimport type { Row } from "@/lib/repo";',
      "lib/repo.ts": 'import postgres from "postgres";\nexport type Row = { id: string };',
    });

    expect(
      findClientBoundaryViolations({
        entryPoints: ["app/form.tsx"],
        readModule,
      }),
    ).toEqual([]);
  });

  it("survives a cycle between two modules", () => {
    const readModule = readerFor({
      "app/form.tsx": '"use client";\nimport { a } from "@/lib/a";',
      "lib/a.ts": 'import { b } from "@/lib/b";',
      "lib/b.ts": 'import { a } from "@/lib/a";',
    });

    expect(
      findClientBoundaryViolations({
        entryPoints: ["app/form.tsx"],
        readModule,
      }),
    ).toEqual([]);
  });
});
