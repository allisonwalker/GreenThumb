import { normalizeEmail } from "@/lib/auth/config";

export function parseAllowedEmails(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    throw new Error("ALLOWED_EMAILS is not configured");
  }

  const emails = raw
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter((email): email is string => email !== null);

  if (emails.length === 0) {
    throw new Error("ALLOWED_EMAILS must list at least one valid email");
  }

  return [...new Set(emails)];
}

export function getAllowedEmails(
  raw: string | undefined = process.env.ALLOWED_EMAILS,
) {
  return parseAllowedEmails(raw);
}

export function isEmailAllowed(
  email: string,
  allowedEmails: string[] = getAllowedEmails(),
) {
  const normalized = normalizeEmail(email);
  return normalized !== null && allowedEmails.includes(normalized);
}

export function logRejectedAdmission(email: string, at: Date = new Date()) {
  console.warn(
    `[admission] Rejected sign-in attempt for ${email} at ${at.toISOString()}`,
  );
}

export type AdmissionResult =
  | { status: "allowed" }
  | { status: "rejected" };

type AdmitSessionOptions = {
  email: string;
  signOut: () => Promise<unknown>;
  allowedEmails?: string[];
  logRejected?: (email: string, at: Date) => void;
  now?: Date;
};

/**
 * Server-side admission gate. Call after a session exists so a rejected
 * attempt can terminate that session before any app user row is created.
 */
export async function admitOrRejectSession(
  options: AdmitSessionOptions,
): Promise<AdmissionResult> {
  const email =
    normalizeEmail(options.email) ?? options.email.trim().toLowerCase();
  const allowedEmails = options.allowedEmails ?? getAllowedEmails();
  const logRejected = options.logRejected ?? logRejectedAdmission;
  const now = options.now ?? new Date();

  if (!isEmailAllowed(email, allowedEmails)) {
    logRejected(email, now);
    await options.signOut();
    return { status: "rejected" };
  }

  return { status: "allowed" };
}
