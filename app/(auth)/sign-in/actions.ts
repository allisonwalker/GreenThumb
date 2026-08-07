"use server";

import {
  isEmailAllowed,
  logRejectedAdmission,
} from "@/lib/auth/allowlist";
import { getAuthCallbackUrl, normalizeEmail } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "error" | "sent";
  message?: string;
};

export async function requestMagicLink(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    return {
      status: "error",
      message: "Enter a valid email address.",
    };
  }

  if (!isEmailAllowed(email)) {
    logRejectedAdmission(email);
    return {
      status: "error",
      message: "This email is not authorized to use GreenThumb.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(process.env.SITE_URL),
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("Supabase could not send a magic sign-in link.", error);

    return {
      status: "error",
      message: "We could not send the sign-in link. Please try again.",
    };
  }

  return {
    status: "sent",
    message: `Check ${email} for your sign-in link.`,
  };
}
