"use server";

import { tasks } from "@trigger.dev/sdk/v3";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase-server";

const CLIENT_ID = process.env.CLIENT_ID;
const TASK_ID = "manual-generate";

// Server action: re-runs the generator for a rejected carousel's topic. The
// topic must already be back in 'available' (the dedup trigger handles that
// when the last sibling carousel is rejected). If not, the CAS in the lock
// step below will silently no-op and the page will simply re-render unchanged.
export async function regenerateAction(formData: FormData) {
  const carouselId = formData.get("carouselId");
  if (typeof carouselId !== "string" || !carouselId) {
    throw new Error("regenerateAction: carouselId missing");
  }
  if (!CLIENT_ID) {
    throw new Error("CLIENT_ID env var not set");
  }

  const sb = getServiceClient();
  const { data: carousel, error: lookupErr } = await sb
    .from("carousels")
    .select("id, run_id, runs!inner(topic_id)")
    .eq("id", carouselId)
    .eq("client_id", CLIENT_ID)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`regenerateAction lookup failed: ${lookupErr.message}`);
  }
  const topicId = (
    carousel?.runs as { topic_id: string } | { topic_id: string }[] | null
  );
  const resolvedTopicId = Array.isArray(topicId)
    ? topicId[0]?.topic_id
    : topicId?.topic_id;
  if (!resolvedTopicId) {
    throw new Error("regenerateAction: could not resolve topic for carousel");
  }

  // Same CAS lock as triggerGenerationAction — only flip if topic is currently
  // 'available'. If it isn't (still pending_review with siblings, or already
  // generating), bail without triggering a duplicate task.
  const { data: locked, error: lockErr } = await sb
    .from("topics")
    .update({ status: "generating" })
    .eq("id", resolvedTopicId)
    .eq("client_id", CLIENT_ID)
    .eq("status", "available")
    .select("id")
    .maybeSingle();
  if (lockErr) {
    throw new Error(`regenerateAction lock failed: ${lockErr.message}`);
  }
  if (!locked) {
    revalidatePath("/carousels");
    return;
  }

  await tasks.trigger(TASK_ID, { topicId: resolvedTopicId, clientId: CLIENT_ID });

  revalidatePath("/carousels");
  revalidatePath("/topics");
}
