import { type NextRequest, NextResponse } from "next/server";

import { refreshAuthSession } from "@/lib/supabase/proxy";

const PROTECTED_PATHS = ["/today", "/garden", "/log", "/ask"];

export function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function redirectWithCookies(
  request: NextRequest,
  destination: string,
  response: NextResponse,
) {
  const redirect = NextResponse.redirect(new URL(destination, request.url));

  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });

  return redirect;
}

export function shouldRedirectAuthenticatedSignIn(
  pathname: string,
  method: string,
  hasUser: boolean,
) {
  return pathname === "/sign-in" && hasUser && method === "GET";
}

export async function proxy(request: NextRequest) {
  const { response, user } = await refreshAuthSession(request);
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !user) {
    return redirectWithCookies(request, "/sign-in", response);
  }

  // Only redirect document navigations. Server actions POST to /sign-in after
  // OTP verification and must not be turned into a redirect response.
  if (shouldRedirectAuthenticatedSignIn(pathname, request.method, Boolean(user))) {
    return redirectWithCookies(request, "/today", response);
  }

  return response;
}

export const config = {
  matcher: [
    "/today/:path*",
    "/garden/:path*",
    "/log/:path*",
    "/ask/:path*",
    "/sign-in",
  ],
};
