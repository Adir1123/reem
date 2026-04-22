// Resolves the Anthropic + Apify keys for the Python pipeline.
//
// Production path: read encrypted ciphertext from app_settings and decrypt
// with MASTER_ENCRYPTION_KEY (set by the client via the web app's /settings).
// Dev path: fall back to process.env at the repo root so iterating locally
// doesn't require a real /settings round-trip.

import { getSupabase } from "./supabase.js";
import { decryptSecret } from "./encryption.js";

export interface PipelineKeys {
  ANTHROPIC_API_KEY: string;
  APIFY_TOKEN: string;
}

export async function resolvePipelineKeys(clientId: string): Promise<PipelineKeys> {
  // Try DB-stored ciphertext first.
  const sb = getSupabase();
  const { data: settings, error } = await sb
    .from("app_settings")
    .select("anthropic_key_ciphertext, apify_key_ciphertext")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    // DB read failed — surface the error so we don't silently fall back to
    // a stale env var.
    throw new Error(`resolvePipelineKeys: DB read failed: ${error.message}`);
  }

  if (settings?.anthropic_key_ciphertext && settings?.apify_key_ciphertext) {
    return {
      ANTHROPIC_API_KEY: decryptSecret(settings.anthropic_key_ciphertext),
      APIFY_TOKEN: decryptSecret(settings.apify_key_ciphertext),
    };
  }

  // Dev fallback: env vars on the trigger worker.
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const apify = process.env.APIFY_TOKEN;
  if (!anthropic || !apify) {
    throw new Error(
      "No keys in app_settings and no ANTHROPIC_API_KEY/APIFY_TOKEN env fallback. Visit /settings to set them.",
    );
  }
  return { ANTHROPIC_API_KEY: anthropic, APIFY_TOKEN: apify };
}
