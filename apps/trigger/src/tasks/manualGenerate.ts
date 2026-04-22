import { logger, task, tasks } from "@trigger.dev/sdk/v3";
import { python } from "@trigger.dev/python";
import type { PipelineOutput } from "@reem/types";
import { getSupabase } from "../lib/supabase.js";
import { resolvePipelineKeys } from "../lib/pipelineKeys.js";
import { deriveCaption, type CaptionPair } from "../lib/caption.js";

interface Payload {
  topicId: string;
  clientId: string;
}

export const manualGenerate = task({
  id: "manual-generate",
  maxDuration: 600,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: Payload, { ctx }) => {
    const { topicId, clientId } = payload;
    const triggerRunId = ctx.run.id;
    const sb = getSupabase();

    logger.info("manualGenerate start", { topicId, clientId, triggerRunId });

    // 1. Load topic.
    const { data: topic, error: topicErr } = await sb
      .from("topics")
      .select("id, en_query, he_label, status")
      .eq("id", topicId)
      .eq("client_id", clientId)
      .single();
    if (topicErr || !topic) {
      throw new Error(`Topic not found: ${topicId} (${topicErr?.message})`);
    }
    // The web action /topics/actions.ts does the atomic lock (eq status=available
    // before flipping to generating). By the time we get here, the topic should
    // already be 'generating' — we just confirm it isn't in a terminal state.
    if (topic.status !== "available" && topic.status !== "generating") {
      throw new Error(
        `Topic ${topicId} is not available (current status: ${topic.status}).`,
      );
    }

    // Idempotent reserve: ensure status is 'generating' even if the action
    // didn't pre-flip (e.g. if this task was triggered directly by cron).
    if (topic.status === "available") {
      const { error: lockErr } = await sb
        .from("topics")
        .update({ status: "generating" })
        .eq("id", topicId);
      if (lockErr) throw new Error(`Failed to reserve topic: ${lockErr.message}`);
    }

    const startedAt = new Date().toISOString();
    const { data: run, error: runErr } = await sb
      .from("runs")
      .insert({
        client_id: clientId,
        topic_id: topicId,
        triggered_by: "manual",
        status: "running",
        started_at: startedAt,
        trigger_run_id: triggerRunId,
      })
      .select("id")
      .single();
    if (runErr || !run) {
      await revertTopic(sb, topicId);
      throw new Error(`Failed to open run row: ${runErr?.message}`);
    }
    const runId = run.id;
    logger.info("run row opened", { runId });

    try {
      // 3. Run the Python pipeline.
      const keys = await resolvePipelineKeys(clientId);

      // Re-run support: collect video_ids already used for this topic so the
      // Python pipeline can skip them and pull fresh tips from new videos.
      const { data: priorSources } = await sb
        .from("sources")
        .select("video_id, runs!inner(topic_id)")
        .eq("client_id", clientId)
        .eq("runs.topic_id", topicId);
      const excludeIds = (priorSources ?? [])
        .map((r: { video_id: string | null }) => r.video_id)
        .filter((id): id is string => Boolean(id));

      logger.info("invoking python pipeline", {
        query: topic.en_query,
        excludeCount: excludeIds.length,
      });

      const args = [
        "--query", topic.en_query,
        "--videos", "3",
        "--carousels", "2",
      ];
      if (excludeIds.length > 0) {
        args.push("--exclude-video-ids", excludeIds.join(","));
      }

      const result = await python.runScript(
        "src/python/scripts/run_pipeline.py",
        args,
        { env: { ...process.env, ...keys } },
      );

      if (result.exitCode !== 0) {
        throw new Error(
          `Python pipeline exited ${result.exitCode}. stderr: ${result.stderr.slice(-2000)}`,
        );
      }

      // Topic-exhausted is a structured stdout payload, NOT a process error —
      // the run is closed cleanly and the topic is parked rather than failed.
      const exhausted = parseExhaustedPayload(result.stdout);
      if (exhausted) {
        logger.warn("topic exhausted; no fresh videos remain", exhausted);
        await sb
          .from("runs")
          .update({
            status: "success",
            finished_at: new Date().toISOString(),
            warnings: ["topic_exhausted"],
            raw_json: exhausted,
          })
          .eq("id", runId);
        await sb
          .from("topics")
          .update({ status: "exhausted" })
          .eq("id", topicId);
        return {
          runId,
          carouselsProduced: 0,
          sources: 0,
          warnings: ["topic_exhausted"],
        };
      }

      const parsed = parsePipelineStdout(result.stdout);
      logger.info("pipeline produced output", {
        carousels: parsed.run_stats.carousels_produced,
        sources: parsed.run_stats.videos_succeeded,
        warnings: parsed.warnings?.length ?? 0,
      });

      // 4. Persist sources.
      if (parsed.sources.length > 0) {
        const sourceRows = parsed.sources.map((s) => ({
          client_id: clientId,
          run_id: runId,
          video_url: s.url,
          video_id: s.video_id,
          title: s.title,
          channel: s.channel,
          views: s.views,
          subscribers: s.subscribers,
          engagement_ratio: s.engagement_ratio,
          duration_seconds: s.duration_seconds,
          upload_date: s.upload_date,
          transcript_chars: s.transcript_chars,
          key_points: s.key_points,
        }));
        const { error: srcErr } = await sb.from("sources").insert(sourceRows);
        if (srcErr) throw new Error(`Failed to insert sources: ${srcErr.message}`);
      }

      // 5. Derive HE+EN captions per carousel via Haiku. Independent calls
      //    in parallel; one failure doesn't kill the others or the run.
      const captionResults = await Promise.allSettled(
        parsed.carousels.map((c) =>
          deriveCaption({
            apiKey: keys.ANTHROPIC_API_KEY,
            concept: c.concept,
            slidesHe: c.slides_he,
            slidesEn: c.slides_en,
            log: (msg, ctx) => logger.info(`caption: ${msg}`, ctx),
          }),
        ),
      );
      const captionWarnings: string[] = [];
      const captions: (CaptionPair | null)[] = captionResults.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        const w = `caption-failed[carousel ${i}]: ${msg}`;
        logger.warn(w);
        captionWarnings.push(w);
        return null;
      });

      // 6. Persist carousels (pending_review).
      const carouselRows = parsed.carousels.map((c, idx) => ({
        client_id: clientId,
        run_id: runId,
        idx,
        concept: c.concept,
        angle: c.angle,
        slides_he: c.slides_he,
        slides_en: c.slides_en,
        caption_he: captions[idx]?.caption_he ?? null,
        caption_en: captions[idx]?.caption_en ?? null,
        status: "pending_review" as const,
      }));
      const { error: carErr } = await sb.from("carousels").insert(carouselRows);
      if (carErr) throw new Error(`Failed to insert carousels: ${carErr.message}`);

      // 7. Close run + flip topic to pending_review.
      const allWarnings = [...(parsed.warnings ?? []), ...captionWarnings];
      await sb
        .from("runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          raw_json: parsed,
          warnings: allWarnings.length > 0 ? allWarnings : null,
        })
        .eq("id", runId);

      await sb.from("topics").update({ status: "pending_review" }).eq("id", topicId);

      logger.info("manualGenerate success", {
        runId,
        carousels: carouselRows.length,
        captions_failed: captionWarnings.length,
      });

      // Fire-and-forget notification. Failure to enqueue does not roll back
      // the generation — the carousels are already in pending_review and the
      // operator can re-notify manually if needed.
      try {
        await tasks.trigger("notify-client", { runId, clientId });
      } catch (notifyErr) {
        const m = notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
        logger.warn("manualGenerate: failed to enqueue notify-client", { message: m });
      }

      return {
        runId,
        carouselsProduced: carouselRows.length,
        sources: parsed.sources.length,
        warnings: allWarnings,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("manualGenerate failed", { runId, message });
      await sb
        .from("runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: message.slice(0, 4000),
        })
        .eq("id", runId);
      await revertTopic(sb, topicId);
      throw err;
    }
  },
});

async function revertTopic(
  sb: ReturnType<typeof getSupabase>,
  topicId: string,
): Promise<void> {
  await sb.from("topics").update({ status: "available" }).eq("id", topicId);
}

function parseExhaustedPayload(
  stdout: string,
): { error: "topic_exhausted"; query: string; total_candidates: number; excluded: number } | null {
  const start = stdout.indexOf("{");
  if (start === -1) return null;
  try {
    const obj = JSON.parse(stdout.slice(start));
    return obj?.error === "topic_exhausted" ? obj : null;
  } catch {
    return null;
  }
}

function parsePipelineStdout(stdout: string): PipelineOutput {
  // run_pipeline.py echoes the full JSON object to stdout. Stderr carries the
  // human-readable progress log. We locate the first '{' to be defensive
  // against any leading noise.
  const start = stdout.indexOf("{");
  if (start === -1) {
    throw new Error(`Pipeline produced no JSON on stdout. Got: ${stdout.slice(0, 500)}`);
  }
  const json = stdout.slice(start);
  try {
    return JSON.parse(json) as PipelineOutput;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to parse pipeline JSON: ${msg}. First 500 chars: ${json.slice(0, 500)}`);
  }
}
