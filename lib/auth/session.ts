import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import type { AuthIdentity } from "@/lib/auth/app-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type FetchUser = () => Promise<User | null>;

async function fetchSupabaseUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}

export async function getAuthenticatedIdentity(
  fetchUser: FetchUser = fetchSupabaseUser,
): Promise<AuthIdentity | null> {
  const user = await fetchUser();

  if (!user?.email) {
    return null;
  }

  return { id: user.id, email: user.email };
}

export async function requirePageUser() {
  const identity = await getAuthenticatedIdentity();

  if (!identity) {
    redirect("/sign-in");
  }

  return identity;
}

export type ApiAuthentication =
  | { identity: AuthIdentity; response?: never }
  | { identity?: never; response: Response };

export async function authenticateApiRequest(
  fetchUser?: FetchUser,
): Promise<ApiAuthentication> {
  const identity = await getAuthenticatedIdentity(fetchUser);

  if (!identity) {
    return {
      response: Response.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }

  return { identity };
}
