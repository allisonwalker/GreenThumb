import { type NextRequest, NextResponse } from "next/server";

import { admitOrRejectSession } from "@/lib/auth/allowlist";
import { ensureAppUser } from "@/lib/auth/app-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function clearSessionBestEffort() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Could not clear auth session.", error);
    }
  } catch (error) {
    console.error("Could not clear auth session.", error);
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=invalid-link", request.url),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      throw userError ?? new Error("Authenticated user has no email address");
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
      return NextResponse.redirect(
        new URL("/sign-in?error=not-allowed", request.url),
      );
    }

    await ensureAppUser({ id: user.id, email: user.email });

    return NextResponse.redirect(new URL("/today", request.url));
  } catch (error) {
    console.error("Magic-link callback failed.", error);
    await clearSessionBestEffort();

    return NextResponse.redirect(
      new URL("/sign-in?error=sign-in-failed", request.url),
    );
  }
}
