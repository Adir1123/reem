// Resolves the Anthropic key for the per-slide chat editor.
//
// Mirrors apps/trigger/src/lib/pipelineKeys.ts: prefer the encrypted
// app_settings ciphertext (the production path the client sets via /settings),
// fall back to ANTHROPIC_API_KEY env so local dev works without a /settings
// round-trip. The decrypt routine is the same AES-256-GCM helper used to
// encrypt at write time (apps/web/lib/encryption.ts).

import Anthropic from "@anthropic-ai/sdk";
import { decryptSecret } from "./encryption";
import { getServiceClient } from "./supabase-server";

export async function getAnthropicClient(clientId: string): Promise<Anthropic> {
  const sb = getServiceClient();
  const { data: settings, error } = await sb
    .from("app_settings")
    .select("anthropic_key_ciphertext")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`getAnthropicClient: DB read failed: ${error.message}`);
  }

  let apiKey: string | undefined;
  if (settings?.anthropic_key_ciphertext) {
    apiKey = decryptSecret(settings.anthropic_key_ciphertext);
  } else {
    apiKey = process.env.ANTHROPIC_API_KEY;
  }

  if (!apiKey) {
    throw new Error(
      "Anthropic key missing. Set it via /settings or ANTHROPIC_API_KEY.",
    );
  }

  return new Anthropic({ apiKey });
}

// Pinned for the chat editor. Matches the generation pipeline.
export const SLIDE_EDITOR_MODEL = "claude-opus-4-7";
