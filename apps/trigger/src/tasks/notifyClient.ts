import { logger, task } from "@trigger.dev/sdk/v3";
import { getSupabase } from "../lib/supabase.js";

// Sends a Hebrew Supabase magic-link email. The link's redirect lands the
// client on /carousels?run=<runId> so they go straight to the freshly
// generated batch. Dedupes via app_settings.last_notified_run_id so a
// retry of the parent task doesn't double-email.

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

interface Payload {
  runId: string;
  clientId: string;
}

export const notifyClient = task({
  id: "notify-client",
  maxDuration: 60,
  retry: { maxAttempts: 3, minTimeoutInMs: 5_000 },
  run: async ({ runId, clientId }: Payload) => {
    const sb = getSupabase();

    // Dedup guard.
    const { data: settings } = await sb
      .from("app_settings")
      .select("last_notified_run_id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (settings?.last_notified_run_id === runId) {
      logger.info("notifyClient skipped — already notified for this run", {
        runId,
      });
      return { skipped: true };
    }

    const { data: client, error: clientErr } = await sb
      .from("clients")
      .select("email, display_name")
      .eq("id", clientId)
      .single();
    if (clientErr || !client) {
      throw new Error(`notifyClient: client not found: ${clientErr?.message}`);
    }

    // Magic-link OTP. Supabase Auth's email template is configured in the
    // dashboard (Auth → Email Templates) with the Hebrew subject + body.
    // We do NOT customize the email body here — only the redirect URL.
    const redirect = `${SITE_URL}/carousels?run=${encodeURIComponent(runId)}`;
    const { error: otpErr } = await sb.auth.signInWithOtp({
      email: client.email,
      options: { emailRedirectTo: redirect, shouldCreateUser: false },
    });
    if (otpErr) {
      throw new Error(`notifyClient: signInWithOtp failed: ${otpErr.message}`);
    }

    // Persist dedup marker — best-effort upsert; never fail the task on this.
    const { error: upErr } = await sb
      .from("app_settings")
      .upsert(
        { client_id: clientId, last_notified_run_id: runId, updated_at: new Date().toISOString() },
        { onConflict: "client_id" },
      );
    if (upErr) {
      logger.warn("notifyClient: failed to update last_notified_run_id", {
        message: upErr.message,
      });
    }

    logger.info("notifyClient sent magic link", { email: client.email, runId });
    return { sent: true, redirect };
  },
});
