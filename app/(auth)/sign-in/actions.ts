"use server";

import {
  isEmailAllowed,
  logRejectedAdmission,
} from "@/lib/auth/allowlist";
import { getAuthCallbackUrl, normalizeEmail } from "@/lib/auth/config";

export type PrepareMagicLinkResult =
  | { ok: true; email: string; callbackUrl: string }
  | { ok: false; message: string };

/**
 * Server-side admission check before the browser requests a magic link.
 * OTP itself runs in the browser so the PKCE verifier is stored in cookies.
 */
export async function prepareMagicLink(
  formData: FormData,
): Promise<PrepareMagicLinkResult> {
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    return {
      ok: false,
      message: "Enter a valid email address.",
    };
  }

  if (!isEmailAllowed(email)) {
    logRejectedAdmission(email);
    return {
      ok: false,
      message: "This email is not authorized to use GreenThumb.",
    };
  }

  return {
    ok: true,
    email,
    callbackUrl: getAuthCallbackUrl(process.env.SITE_URL),
  };
}
