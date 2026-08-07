import { type NextRequest, NextResponse } from "next/server";

import { ensureAppUser } from "@/lib/auth/app-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

    await ensureAppUser({ id: user.id, email: user.email });

    return NextResponse.redirect(new URL("/today", request.url));
  } catch (error) {
    console.error("Magic-link callback failed.", error);

    return NextResponse.redirect(
      new URL("/sign-in?error=sign-in-failed", request.url),
    );
  }
}
