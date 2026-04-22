import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", ".env") });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from("carousels").select("idx, slides_he").eq("run_id", "9ab92078-9690-413e-89b8-84cb60b49a27").order("idx");
for (const c of data) {
  console.log(`idx=${c.idx}:`, c.slides_he.map(s => ({n: s.n, role: s.role, ref: s.ref_image})));
}
