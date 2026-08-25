const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGN_IN_CODE_PATTERN = /^\d{6,8}$/;

export function normalizeEmail(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

/** Emailed one-time codes are 6–8 digits; users often paste them with spaces. */
export function normalizeSignInCode(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const code = value.replace(/\s/g, "");
  return SIGN_IN_CODE_PATTERN.test(code) ? code : null;
}

export function getAuthCallbackUrl(siteUrl: string | undefined) {
  if (!siteUrl) {
    throw new Error("SITE_URL is not configured");
  }

  const baseUrl = new URL(siteUrl);

  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("SITE_URL must use HTTP or HTTPS");
  }

  return new URL("/auth/callback", baseUrl).toString();
}
