"use server";

import { runs as triggerRuns, tasks } from "@trigger.dev/sdk/v3";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase-server";

const CLIENT_ID = process.env.CLIENT_ID;
const TASK_ID = "manual-generate";

// Server action: triggers a generation run for the given topic. Called from
// the <form action={...}> on each topic row in /topics/page.tsx. No auth yet —
// magic-link login lands at the end of Phase 3 once the rest of the dashboard
// is verified visually.
export async function triggerGenerationAction(formData: FormData) {
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string" || !topicId) {
    throw new Error("triggerGenerationAction: topicId missing");
  }
  if (!CLIENT_ID) {
    throw new Error("CLIENT_ID env var not set");
  }

  // Optimistic UI: flip the topic to 'generating' before the task starts so
  // the badge updates immediately. The task itself sets it to 'pending_review'
  // (or back to 'available' on failure).
  const sb = getServiceClient();
  const { error: lockErr } = await sb
    .from("topics")
    .update({ status: "generating" })
    .eq("id", topicId)
    .eq("client_id", CLIENT_ID)
    .eq("status", "available");
  if (lockErr) throw new Error(`failed to lock topic: ${lockErr.message}`);

  await tasks.trigger(TASK_ID, { topicId, clientId: CLIENT_ID });

  revalidatePath("/topics");
}

// Cancel an in-flight generation. Looks up the latest 'running' run for the
// topic, calls Trigger.dev's cancel API, and immediately reverts DB state so
// the UI feels responsive even though the worker may take a beat to abort.
export async function cancelGenerationAction(formData: FormData) {
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string" || !topicId) {
    throw new Error("cancelGenerationAction: topicId missing");
  }
  if (!CLIENT_ID) {
    throw new Error("CLIENT_ID env var not set");
  }

  const sb = getServiceClient();
  const { data: latestRun } = await sb
    .from("runs")
    .select("id, trigger_run_id")
    .eq("topic_id", topicId)
    .eq("client_id", CLIENT_ID)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRun?.trigger_run_id) {
    try {
      await triggerRuns.cancel(latestRun.trigger_run_id);
    } catch (err) {
      // Already finished, already cancelled, or transient API failure — we
      // still want the DB state to reflect the user's intent. Worst case the
      // task completes and writes carousels; the user can reject them.
      console.warn(
        `cancelGenerationAction: triggerRuns.cancel failed for ${latestRun.trigger_run_id}`,
        err,
      );
    }
    await sb
      .from("runs")
      .update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        error: "Cancelled by user",
      })
      .eq("id", latestRun.id);
  }

  await sb
    .from("topics")
    .update({ status: "available" })
    .eq("id", topicId)
    .eq("client_id", CLIENT_ID);

  revalidatePath("/topics");
}
