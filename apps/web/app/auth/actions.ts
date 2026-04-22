"use server";

import { redirect } from "next/navigation";
import { getAuthSupabase } from "@/lib/supabase-auth";

export async function signOutAction() {
  const sb = await getAuthSupabase();
  await sb.auth.signOut();
  redirect("/login");
}
