const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
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
