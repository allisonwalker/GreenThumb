import "server-only";

export function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL;

  if (!url) {
    throw new Error("SUPABASE_URL must be configured");
  }

  return url;
}

/** Public anon key — required for user-session / PKCE cookie flows. */
export function getSupabaseAnonKey() {
  const key = process.env.SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error("SUPABASE_ANON_KEY must be configured");
  }

  return key;
}
