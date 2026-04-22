"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthSupabase, getCurrentUser } from "@/lib/supabase-auth";
import type { Theme } from "@reem/types";

const VALID_THEMES: Theme[] = ["saving", "investing", "debt", "mindset", "tools"];

function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (VALID_THEMES as string[]).includes(v);
}

export async function createTopicAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("not signed in");

  const heLabel = (formData.get("he_label") ?? "").toString().trim();
  const enQuery = (formData.get("en_query") ?? "").toString().trim();
  const themeRaw = (formData.get("theme") ?? "").toString().trim();
  const notes = (formData.get("notes") ?? "").toString().trim() || null;

  if (!heLabel) throw new Error("חסר תיאור בעברית");
  if (!enQuery) throw new Error("missing en_query");
  if (!isTheme(themeRaw)) throw new Error(`invalid theme: ${themeRaw}`);

  const sb = await getAuthSupabase();
  const { error } = await sb.from("topics").insert({
    client_id: user.id,
    he_label: heLabel,
    en_query: enQuery,
    theme: themeRaw,
    source: "client_added",
    status: "available",
    notes,
  });
  if (error) throw new Error(`createTopicAction: ${error.message}`);

  revalidatePath("/topics");
  redirect("/topics");
}
