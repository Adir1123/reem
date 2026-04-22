// One-off helper for the framework restructure A/B test.
// 1. Grabs the old slides_he for the most recent successful carousel
//    on a given topic and saves them to scripts/old-snapshot.json so we
//    can show them side-by-side after regenerating with the new framework.
// 2. Resets the topic from pending_review back to available so the
//    manual-generate task will accept it.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", ".env") });

const RUN_ID = process.argv[2] ?? "5388399f-5295-435a-b5df-11a9bcb6c05f";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: run, error: runErr } = await sb
  .from("runs")
  .select("id, topic_id, status")
  .eq("id", RUN_ID)
  .maybeSingle();
if (runErr) throw runErr;
if (!run) throw new Error(`run ${RUN_ID} not found`);

const { data: carousels, error: carErr } = await sb
  .from("carousels")
  .select("id, idx, concept, angle, slides_he, slides_en, status")
  .eq("run_id", RUN_ID)
  .order("idx", { ascending: true });
if (carErr) throw carErr;

const { data: topic, error: topicErr } = await sb
  .from("topics")
  .select("id, he_label, en_query, status")
  .eq("id", run.topic_id)
  .maybeSingle();
if (topicErr) throw topicErr;

const snapshot = { run, topic, carousels, snapped_at: new Date().toISOString() };
const out = resolve(__dirname, "old-snapshot.json");
writeFileSync(out, JSON.stringify(snapshot, null, 2), "utf8");
console.log(`snapshot written -> ${out}`);
console.log(`topic: ${topic.he_label} (${topic.en_query}) status=${topic.status}`);
console.log(`carousels: ${carousels.length}`);

// Reset topic to available so the regen can run on the same en_query.
const { error: updErr } = await sb
  .from("topics")
  .update({ status: "available" })
  .eq("id", topic.id);
if (updErr) throw updErr;
console.log(`topic ${topic.id} -> available`);
