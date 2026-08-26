"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  admitOrRejectSession,
  isEmailAllowed,
  logRejectedAdmission,
} from "@/lib/auth/allowlist";
import { ensureAppUser } from "@/lib/auth/app-user";
import {
  getAuthCallbackUrl,
  normalizeEmail,
  normalizeSignInCode,
} from "@/lib/auth/config";
import { pingDatabase } from "@/lib/db/client";
import { DATABASE_UNAVAILABLE_MESSAGE } from "@/lib/db/ping";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RequestSignInCodeResult =
  | { ok: true; email: string }
  | { ok: false; message: string };

export type VerifySignInCodeResult =
  | { ok: true }
  | { ok: false; message: string };

const NOT_AUTHORIZED = "This email is not authorized to use GreenThumb.";
const SEND_FAILED = "We could not send the sign-in code. Please try again.";
const CODE_REJECTED =
  "That code is invalid or expired. Request a new code and try again.";

/**
 * Emails a one-time code. The browser never holds Supabase credentials, so the
 * request is made here and the anon key stays on the server.
 */
export async function requestSignInCode(
  formData: FormData,
): Promise<RequestSignInCodeResult> {
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (!isEmailAllowed(email)) {
    logRejectedAdmission(email);
    return { ok: false, message: NOT_AUTHORIZED };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const [{ error }] = await Promise.all([
      supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getAuthCallbackUrl(process.env.SITE_URL),
          shouldCreateUser: true,
        },
      }),
      // Free-tier Postgres may be paused. Wake it while the email is in flight
      // so entering the code does not sit on a dead connection.
      pingDatabase().catch((error) => {
        console.error("Database was not reachable while sending a sign-in code.", error);
      }),
    ]);

    if (error) {
      console.error("Supabase could not send a sign-in code.", error);

      return {
        ok: false,
        message: /rate limit/i.test(error.message)
          ? "Too many sign-in emails were requested. Wait about an hour (Supabase’s free email limit), then try once."
          : SEND_FAILED,
      };
    }
  } catch (error) {
    console.error("Sign-in code request failed.", error);
    return { ok: false, message: SEND_FAILED };
  }

  return { ok: true, email };
}

/**
 * Exchanges the emailed code for a session cookie, then re-checks admission
 * against the signed-in identity rather than the submitted form value.
 */
export async function verifySignInCode(
  formData: FormData,
): Promise<VerifySignInCodeResult> {
  const email = normalizeEmail(formData.get("email"));
  const code = normalizeSignInCode(formData.get("code"));

  if (!email) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (!code) {
    return { ok: false, message: "Enter the 6–8 digit code from the email." };
  }

  if (!isEmailAllowed(email)) {
    logRejectedAdmission(email);
    return { ok: false, message: NOT_AUTHORIZED };
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (!(await exchangeEmailCode(supabase, email, code))) {
      return { ok: false, message: CODE_REJECTED };
    }

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
      return { ok: false, message: NOT_AUTHORIZED };
    }

    try {
      await pingDatabase();
      await ensureAppUser({ id: user.id, email: user.email });
    } catch (error) {
      console.error("Could not persist the signed-in user.", error);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Could not clear the session after a database failure.", signOutError);
      }
      return { ok: false, message: DATABASE_UNAVAILABLE_MESSAGE };
    }

    return { ok: true };
  } catch (error) {
    console.error("Sign-in code verification failed.", error);
    return {
      ok: false,
      message: "Sign-in failed. Request a new code and try again.",
    };
  }
}

/**
 * signInWithOtp emails a magiclink-type code, but a Supabase project configured
 * for plain email OTP issues the other type. Try both before rejecting.
 */
async function exchangeEmailCode(
  supabase: SupabaseClient,
  email: string,
  token: string,
) {
  for (const type of ["magiclink", "email"] as const) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type });

    if (!error) {
      return true;
    }

    console.error(
      `Supabase rejected the sign-in code as type "${type}".`,
      error,
    );
  }

  return false;
}
