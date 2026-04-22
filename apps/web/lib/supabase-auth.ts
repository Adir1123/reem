import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Auth-scoped server client. Reads + refreshes the session via cookies.
// Use from RSC pages and server actions when you need the *user's* identity
// (not the service role). For service-role bypass, use getServiceClient.
export async function getAuthSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // RSC pages can't mutate cookies — Next throws if we try. Wrapping in
        // try/catch lets the same factory work in both server actions (where
        // mutation is allowed) and pages (where it isn't); refreshes happen
        // on the next request that *can* set cookies.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // ignore in pure RSC context
        }
      },
    },
  });
}

// Returns the signed-in user or null. Auth-page components call this
// directly; protected routes rely on proxy.ts to redirect first.
export async function getCurrentUser() {
  const sb = await getAuthSupabase();
  const { data } = await sb.auth.getUser();
  return data.user;
}
