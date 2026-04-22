"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Used in client components for the magic-link
// sign-in flow. Reads the session cookie set by the auth callback.
export function getBrowserSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }
  return createBrowserClient(url, anon);
}
