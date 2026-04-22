// Reads old-snapshot.json + pulls the new carousels for NEW_RUN_ID, and
// prints a side-by-side Hebrew comparison of carousel idx=0 and idx=1.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", ".env") });

const NEW_RUN_ID = process.argv[2] ?? "9ab92078-9690-413e-89b8-84cb60b49a27";
const snapPath = resolve(__dirname, "old-snapshot.json");
const snap = JSON.parse(readFileSync(snapPath, "utf8"));

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: newCarousels, error } = await sb
  .from("carousels")
  .select("idx, concept, angle, slides_he, slides_en")
  .eq("run_id", NEW_RUN_ID)
  .order("idx", { ascending: true });
if (error) throw error;

function slideCompact(s) {
  return {
    n: s.n,
    role: s.role,
    eyebrow: s.eyebrow,
    headline: s.headline,
    headline_italic: s.headline_italic,
    body: s.body,
    body_emphasis: s.body_emphasis,
    step_number: s.step_number,
  };
}

const out = {
  topic: snap.topic,
  old_run_id: snap.run.id,
  new_run_id: NEW_RUN_ID,
  carousels: snap.carousels.map((old, i) => ({
    idx: old.idx,
    old: { concept: old.concept, angle: old.angle, slides_he: (old.slides_he || []).map(slideCompact) },
    new: newCarousels[i]
      ? { concept: newCarousels[i].concept, angle: newCarousels[i].angle, slides_he: (newCarousels[i].slides_he || []).map(slideCompact) }
      : null,
  })),
};

const outPath = resolve(__dirname, "comparison.json");
writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(`wrote ${outPath}`);
console.log(JSON.stringify(out, null, 2));
