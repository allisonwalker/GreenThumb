/**
 * The single inventory of environment variables that must never reach the
 * browser. README § Secrets documents rotation for each one; the guards in this
 * folder, `scripts/verify-env.ts`, and `scripts/scan-build-secrets.ts` all read
 * this list, so adding a secret here is enough to bring it under every check.
 */
export const SECRET_ENV_VARS = [
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GMAIL_APP_PASSWORD",
  "CRON_SECRET",
] as const;

/**
 * Not credentials, but still server-only: they identify the project and the
 * household, and nothing in the browser needs them.
 */
export const SERVER_ONLY_ENV_VARS = [
  ...SECRET_ENV_VARS,
  "SUPABASE_URL",
  "ALLOWED_EMAILS",
] as const;

/** Substrings that mark a variable name as credential-shaped. */
const SECRET_NAME_PATTERNS = [
  "PASSWORD",
  "SECRET",
  "TOKEN",
  "CREDENTIAL",
  "PRIVATE_KEY",
  "SERVICE_ROLE",
  "API_KEY",
  "ANON_KEY",
  "DATABASE_URL",
  "CONNECTION_STRING",
];

export const PUBLIC_ENV_PREFIX = "NEXT_PUBLIC_";

/**
 * True for a known server-only variable or any name shaped like a credential,
 * so a secret introduced later is caught without editing this file.
 */
export function isSecretEnvVarName(name: string) {
  const normalized = name.toUpperCase();

  if ((SERVER_ONLY_ENV_VARS as readonly string[]).includes(normalized)) {
    return true;
  }

  return SECRET_NAME_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export type PublicSecretFinding = {
  variable: string;
  line: number;
};

/**
 * Finds `NEXT_PUBLIC_`-prefixed variables that carry a secret. Next.js inlines
 * every such variable into the client bundle at build time, which publishes the
 * value irreversibly once a build is deployed and cached.
 */
export function findPublicSecretEnvVars(source: string): PublicSecretFinding[] {
  const findings: PublicSecretFinding[] = [];
  const pattern = new RegExp(`${PUBLIC_ENV_PREFIX}[A-Z0-9_]+`, "g");

  source.split("\n").forEach((text, index) => {
    for (const [variable] of text.matchAll(pattern)) {
      const suffix = variable.slice(PUBLIC_ENV_PREFIX.length);

      if (isSecretEnvVarName(suffix)) {
        findings.push({ variable, line: index + 1 });
      }
    }
  });

  return findings;
}

/**
 * Server-only variables read outside a `process.env` lookup are not the concern
 * here; this reports the variables a module actually reads, so the client
 * boundary check can reject secret reads in browser-reachable code.
 */
export function findServerOnlyEnvReads(source: string): string[] {
  const reads = new Set<string>();
  const patterns = [
    /process\.env\.([A-Za-z0-9_]+)/g,
    /process\.env\[\s*["'`]([A-Za-z0-9_]+)["'`]\s*\]/g,
  ];

  for (const pattern of patterns) {
    for (const [, name] of source.matchAll(pattern)) {
      if (name && isSecretEnvVarName(name)) {
        reads.add(name);
      }
    }
  }

  return [...reads].sort();
}
