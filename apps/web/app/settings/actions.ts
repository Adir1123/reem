"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSupabase, getCurrentUser } from "@/lib/supabase-auth";
import { encryptSecret } from "@/lib/encryption";

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("not signed in");
  return user.id;
}

// Strip optional `KEY=value` / `TOKEN=value` prefix and surrounding quotes —
// users often copy-paste straight from a `.env` file. Without this, the leading
// `APIFY_TOKEN=` becomes part of the encrypted value and Apify rejects every
// request silently with "User was not found or authentication token is not valid".
function cleanSecret(raw: FormDataEntryValue | null): string {
  return (raw ?? "")
    .toString()
    .trim()
    .replace(/^[A-Z_]+\s*=\s*/, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

// Persists pasted Anthropic + Apify keys (encrypted) into app_settings.
// Empty values are ignored so the user can rotate one key without re-entering
// the other.
export async function saveKeysAction(formData: FormData) {
  const clientId = await requireUserId();
  const anthropic = cleanSecret(formData.get("anthropic_key"));
  const apify = cleanSecret(formData.get("apify_key"));

  const patch: Record<string, string> = {};
  if (anthropic) patch.anthropic_key_ciphertext = encryptSecret(anthropic);
  if (apify) patch.apify_key_ciphertext = encryptSecret(apify);
  if (Object.keys(patch).length === 0) {
    redirect("/settings?saved=empty");
  }

  const sb = await getAuthSupabase();
  const { error } = await sb
    .from("app_settings")
    .upsert({ client_id: clientId, ...patch, updated_at: new Date().toISOString() });
  if (error) throw new Error(`saveKeysAction: ${error.message}`);

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function toggleCronAction(formData: FormData) {
  const clientId = await requireUserId();
  const paused = formData.get("paused") === "true";

  const sb = await getAuthSupabase();
  const { error } = await sb
    .from("app_settings")
    .upsert({
      client_id: clientId,
      cron_paused: paused,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(`toggleCronAction: ${error.message}`);

  revalidatePath("/settings");
}
