import { logger, schedules, tasks } from "@trigger.dev/sdk/v3";
import { getSupabase } from "../lib/supabase.js";

// Twice a week at 06:00 Asia/Jerusalem (Sun + Wed). Picks up to 2 random
// available topics and batch-triggers manualGenerate. The batch children
// run independently — one Apify failure does not block the other.
//
// Cron is opt-out: app_settings.cron_paused = true skips the whole tick.
// We log a "no eligible topics" warning rather than failing — that's a
// content-pipeline signal for the operator, not a system fault.

const CLIENT_ID = process.env.CLIENT_ID;
const TOPICS_PER_RUN = 2;

export const weeklyCron = schedules.task({
  id: "weekly-cron",
  cron: { pattern: "0 6 * * 0,3", timezone: "Asia/Jerusalem" },
  maxDuration: 60,
  run: async () => {
    if (!CLIENT_ID) {
      throw new Error("weeklyCron: CLIENT_ID env var not set");
    }
    const sb = getSupabase();

    // Honour the per-client pause toggle from /settings.
    const { data: settings, error: settingsErr } = await sb
      .from("app_settings")
      .select("cron_paused")
      .eq("client_id", CLIENT_ID)
      .maybeSingle();
    if (settingsErr) {
      logger.warn("weeklyCron: failed to read app_settings, proceeding", {
        message: settingsErr.message,
      });
    }
    if (settings?.cron_paused) {
      logger.info("weeklyCron skipped — cron_paused=true");
      return { skipped: true, reason: "cron_paused" };
    }

    // Random pick: order by random() then take 2. Postgres-side ORDER BY
    // random() is fine at this scale (a few hundred topics max).
    const { data: topics, error: topicsErr } = await sb
      .from("topics")
      .select("id, he_label")
      .eq("client_id", CLIENT_ID)
      .eq("status", "available")
      .order("id", { ascending: false }) // placeholder; randomized below
      .limit(200);
    if (topicsErr) {
      throw new Error(`weeklyCron: failed to load topics: ${topicsErr.message}`);
    }

    const eligible = topics ?? [];
    if (eligible.length === 0) {
      logger.warn("weeklyCron: no available topics — content pool exhausted");
      return { skipped: true, reason: "no_topics" };
    }

    // Shuffle in JS so we don't depend on Postgres random() ordering, which
    // some hosted Postgres versions disallow in combination with limit.
    const picked = shuffle(eligible).slice(0, TOPICS_PER_RUN);
    logger.info("weeklyCron picked topics", {
      count: picked.length,
      labels: picked.map((t) => t.he_label),
    });

    const handle = await tasks.batchTrigger(
      "manual-generate",
      picked.map((t) => ({
        payload: { topicId: t.id, clientId: CLIENT_ID },
      })),
    );

    return {
      triggered: picked.length,
      batchId: (handle as { batchId: string }).batchId,
    };
  },
});

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy;
}
