import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role server client. Used by RSC pages and route handlers that need to
// bypass RLS. Regular auth-scoped reads will use @supabase/ssr cookies (added
// in Phase 3 when we wire magic-link login).
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
