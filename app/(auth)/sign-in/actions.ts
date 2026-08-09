"use server";

import {
  isEmailAllowed,
  logRejectedAdmission,
  admitOrRejectSession,
} from "@/lib/auth/allowlist";
import { ensureAppUser } from "@/lib/auth/app-user";
import { getAuthCallbackUrl, normalizeEmail } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PrepareMagicLinkResult =
  | { ok: true; email: string; callbackUrl: string }
  | { ok: false; message: string };

export type FinishSignInResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Server-side admission check before the browser requests a one-time code.
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

/**
 * After the browser verifies the email OTP, enforce allowlist and upsert app_user.
 */
export async function finishSignIn(): Promise<FinishSignInResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return {
        ok: false,
        message: "Sign-in did not complete. Check the code and try again.",
      };
    }

    const admission = await admitOrRejectSession({
      email: user.email,
      signOut: async () => {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          throw signOutError;
        }
      },
    });

    if (admission.status === "rejected") {
      return {
        ok: false,
        message: "This email is not authorized to use GreenThumb.",
      };
    }

    await ensureAppUser({ id: user.id, email: user.email });
    return { ok: true };
  } catch (error) {
    console.error("finishSignIn failed.", error);
    return {
      ok: false,
      message: "Sign-in failed while saving your account. Try again.",
    };
  }
}
