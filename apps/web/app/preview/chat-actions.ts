"use server";

import { revalidatePath } from "next/cache";
import type Anthropic from "@anthropic-ai/sdk";
import type { Slide, SlidePatch, Language } from "@reem/types";
import { getServiceClient } from "@/lib/supabase-server";
import { getAnthropicClient, SLIDE_EDITOR_MODEL } from "@/lib/anthropic";
import {
  APPLY_SLIDE_EDIT_TOOL,
  buildEditorSystem,
} from "@/lib/prompts/slideEditor";
import {
  SlidePatchSchema,
  mergeSlide,
  validateHebrewText,
  sanitizeHebrewText,
  diffSlideHebrew,
} from "@/lib/slideValidation";

const CLIENT_ID = process.env.CLIENT_ID;
// 6 turns = 12 rows (user + assistant). Bounds the context window cost.
const HISTORY_TURNS = 6;

function requireClientId(): string {
  if (!CLIENT_ID) throw new Error("CLIENT_ID env var not set");
  return CLIENT_ID;
}

export interface ChatRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  patch_json: SlidePatch | null;
  created_at: string;
  // Hebrew labels for the edit-summary chip (e.g. ["כותרת","גודל גוף"]).
  diff_labels: string[] | null;
  // Whether this assistant row is the most recent one with a patch — i.e.
  // the one the "בטל שינוי" button can revert in a single round-trip.
  is_revertable: boolean;
}

interface SlideChatRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  patch_json: SlidePatch | null;
  pre_slide_json: Slide | null;
  created_at: string;
}

function toChatRows(rows: SlideChatRow[]): ChatRow[] {
  // Mark the latest assistant row that carries a patch as revertable.
  let latestRevertableId: string | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.role === "assistant" && r.patch_json && r.pre_slide_json) {
      latestRevertableId = r.id;
      break;
    }
  }
  return rows.map((r) => {
    let diff: string[] | null = null;
    if (r.role === "assistant" && r.patch_json && r.pre_slide_json) {
      const merged = mergeSlide(r.pre_slide_json, r.patch_json);
      diff = diffSlideHebrew(r.pre_slide_json, merged);
    }
    return {
      id: r.id,
      role: r.role,
      content: r.content,
      patch_json: r.patch_json,
      created_at: r.created_at,
      diff_labels: diff,
      is_revertable: r.id === latestRevertableId,
    };
  });
}

// -------------------------------------------------------------------------
// loadSlideChatAction — fetch all rows for the active slide.
// -------------------------------------------------------------------------
export async function loadSlideChatAction(
  carouselId: string,
  slideIdx: number,
  lang: Language,
): Promise<ChatRow[]> {
  const clientId = requireClientId();
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("slide_chats")
    .select("id, role, content, patch_json, pre_slide_json, created_at")
    .eq("client_id", clientId)
    .eq("carousel_id", carouselId)
    .eq("slide_idx", slideIdx)
    .eq("lang", lang)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`loadSlideChatAction: ${error.message}`);
  return toChatRows((data ?? []) as SlideChatRow[]);
}

// -------------------------------------------------------------------------
// editSlideAction — main turn.
// -------------------------------------------------------------------------
export type EditSlideResult =
  | {
      ok: true;
      mergedSlide: Slide;
      newSlidesVersion: number;
      assistantText: string;
      diffLabels: string[];
      cost: { input_tokens: number; output_tokens: number };
    }
  | { ok: false; code: "version_conflict" | "model_refused" | "internal"; message: string };

export async function editSlideAction(input: {
  carouselId: string;
  slideIdx: number;
  lang: Language;
  message: string;
  slidesVersion: number;
}): Promise<EditSlideResult> {
  const clientId = requireClientId();
  if (!input.message.trim()) {
    return { ok: false, code: "internal", message: "הודעה ריקה" };
  }

  const sb = getServiceClient();

  // 1. Load carousel — confirm version + extract current slide
  const slidesCol = input.lang === "he" ? "slides_he" : "slides_en";
  const { data: carousel, error: loadErr } = await sb
    .from("carousels")
    .select(`id, slides_version, slides_he, slides_en`)
    .eq("id", input.carouselId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (loadErr) {
    return { ok: false, code: "internal", message: loadErr.message };
  }
  if (!carousel) {
    return { ok: false, code: "internal", message: "קרוסלה לא נמצאה" };
  }
  if (carousel.slides_version !== input.slidesVersion) {
    return {
      ok: false,
      code: "version_conflict",
      message: "מישהו אחר ערך — רענן והמשך",
    };
  }
  const slides = (carousel[slidesCol] as Slide[]) ?? [];
  const currentSlide = slides[input.slideIdx];
  if (!currentSlide) {
    return { ok: false, code: "internal", message: "שקופית לא נמצאה" };
  }

  // 2. Load last N turns of chat history
  const { data: historyRowsRaw, error: histErr } = await sb
    .from("slide_chats")
    .select("role, content, created_at")
    .eq("client_id", clientId)
    .eq("carousel_id", input.carouselId)
    .eq("slide_idx", input.slideIdx)
    .eq("lang", input.lang)
    .order("created_at", { ascending: false })
    .limit(HISTORY_TURNS * 2);
  if (histErr) {
    return { ok: false, code: "internal", message: histErr.message };
  }
  const history = (historyRowsRaw ?? [])
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }))
    .reverse();

  // 3. Build messages and call Anthropic
  const anthropic = await getAnthropicClient(clientId);
  const system = buildEditorSystem(
    input.lang,
    JSON.stringify(currentSlide, null, 2),
  );
  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: input.message },
  ];

  let toolInput: { message: string; patch?: unknown };
  let usage: { input_tokens: number; output_tokens: number };
  try {
    const resp = await anthropic.messages.create({
      model: SLIDE_EDITOR_MODEL,
      max_tokens: 1024,
      system,
      tools: [APPLY_SLIDE_EDIT_TOOL],
      tool_choice: { type: "tool", name: "apply_slide_edit" },
      messages,
    });
    usage = {
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
    };
    const toolBlock = resp.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolBlock) {
      return {
        ok: false,
        code: "internal",
        message: "המודל לא קרא לכלי. נסה שוב.",
      };
    }
    toolInput = toolBlock.input as { message: string; patch?: unknown };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "internal", message: `שגיאת מודל: ${m}` };
  }

  // 4. Hebrew sanitation on the assistant's chat text. The user must never
  //    see AI-slop Hebrew, so we silently sanitize rather than retry+block.
  let assistantText = toolInput.message ?? "";
  if (validateHebrewText(assistantText).length > 0) {
    assistantText = sanitizeHebrewText(assistantText);
  }

  // 5. Validate + merge the patch (if any).
  let mergedSlide: Slide = currentSlide;
  let patch: SlidePatch | null = null;
  if (toolInput.patch !== undefined && toolInput.patch !== null) {
    const parsed = SlidePatchSchema.safeParse(toolInput.patch);
    if (!parsed.success) {
      // Surface as a refusal — the model gave us garbage, don't apply it.
      const msg =
        assistantText ||
        "לא הצלחתי להחיל את השינוי. נסח את הבקשה אחרת.";
      await persistTurn(sb, clientId, input, msg, null, null, usage);
      revalidatePath("/preview");
      return {
        ok: false,
        code: "model_refused",
        message: msg,
      };
    }
    patch = parsed.data;
    if (input.lang === "he") {
      const textFields: (keyof SlidePatch)[] = [
        "headline",
        "body",
        "eyebrow",
        "headline_italic",
      ];
      for (const f of textFields) {
        const v = patch[f];
        if (typeof v === "string" && validateHebrewText(v).length > 0) {
          (patch as Record<string, unknown>)[f] = sanitizeHebrewText(v);
        }
      }
    }
    mergedSlide = mergeSlide(currentSlide, patch);
  }

  // 6. CAS update — only succeeds if slides_version still matches.
  const nextSlides = [...slides];
  nextSlides[input.slideIdx] = mergedSlide;
  const newVersion = carousel.slides_version + 1;
  const { data: casRows, error: casErr } = await sb
    .from("carousels")
    .update({ [slidesCol]: nextSlides, slides_version: newVersion })
    .eq("id", input.carouselId)
    .eq("client_id", clientId)
    .eq("slides_version", carousel.slides_version)
    .select("id");
  if (casErr) {
    return { ok: false, code: "internal", message: casErr.message };
  }
  if (!casRows || casRows.length === 0) {
    return {
      ok: false,
      code: "version_conflict",
      message: "מישהו אחר ערך — רענן והמשך",
    };
  }

  // 7. Persist user + assistant chat rows
  await persistTurn(
    sb,
    clientId,
    input,
    assistantText,
    patch,
    patch ? currentSlide : null,
    usage,
  );

  revalidatePath("/preview");

  const diffLabels = patch ? diffSlideHebrew(currentSlide, mergedSlide) : [];
  return {
    ok: true,
    mergedSlide,
    newSlidesVersion: newVersion,
    assistantText,
    diffLabels,
    cost: usage,
  };
}

async function persistTurn(
  sb: ReturnType<typeof getServiceClient>,
  clientId: string,
  input: { carouselId: string; slideIdx: number; lang: Language; message: string },
  assistantText: string,
  patch: SlidePatch | null,
  preSlide: Slide | null,
  usage: { input_tokens: number; output_tokens: number },
): Promise<void> {
  const base = {
    client_id: clientId,
    carousel_id: input.carouselId,
    slide_idx: input.slideIdx,
    lang: input.lang,
  };
  await sb.from("slide_chats").insert([
    { ...base, role: "user", content: input.message },
    {
      ...base,
      role: "assistant",
      content: assistantText,
      patch_json: patch,
      pre_slide_json: preSlide,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    },
  ]);
}

// -------------------------------------------------------------------------
// revertLastSlideEditAction — restores the slide JSON from the latest
// assistant row's pre_slide_json snapshot. No model call.
// -------------------------------------------------------------------------
export async function revertLastSlideEditAction(input: {
  carouselId: string;
  slideIdx: number;
  lang: Language;
  slidesVersion: number;
}): Promise<EditSlideResult> {
  const clientId = requireClientId();
  const sb = getServiceClient();
  const slidesCol = input.lang === "he" ? "slides_he" : "slides_en";

  const { data: latest, error: latestErr } = await sb
    .from("slide_chats")
    .select("id, pre_slide_json")
    .eq("client_id", clientId)
    .eq("carousel_id", input.carouselId)
    .eq("slide_idx", input.slideIdx)
    .eq("lang", input.lang)
    .eq("role", "assistant")
    .not("pre_slide_json", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) {
    return { ok: false, code: "internal", message: latestErr.message };
  }
  if (!latest?.pre_slide_json) {
    return { ok: false, code: "internal", message: "אין שינוי לבטל" };
  }
  const restored = latest.pre_slide_json as Slide;

  const { data: carousel, error: loadErr } = await sb
    .from("carousels")
    .select(`slides_version, slides_he, slides_en`)
    .eq("id", input.carouselId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (loadErr || !carousel) {
    return {
      ok: false,
      code: "internal",
      message: loadErr?.message ?? "קרוסלה לא נמצאה",
    };
  }
  if (carousel.slides_version !== input.slidesVersion) {
    return {
      ok: false,
      code: "version_conflict",
      message: "מישהו אחר ערך — רענן והמשך",
    };
  }
  const slides = (carousel[slidesCol] as Slide[]) ?? [];
  const currentSlide = slides[input.slideIdx];
  const nextSlides = [...slides];
  nextSlides[input.slideIdx] = restored;
  const newVersion = carousel.slides_version + 1;

  const { data: casRows, error: casErr } = await sb
    .from("carousels")
    .update({ [slidesCol]: nextSlides, slides_version: newVersion })
    .eq("id", input.carouselId)
    .eq("client_id", clientId)
    .eq("slides_version", carousel.slides_version)
    .select("id");
  if (casErr) {
    return { ok: false, code: "internal", message: casErr.message };
  }
  if (!casRows || casRows.length === 0) {
    return {
      ok: false,
      code: "version_conflict",
      message: "מישהו אחר ערך — רענן והמשך",
    };
  }

  // Log the revert as an assistant turn so the chat history makes sense.
  // We snapshot the *current* (pre-revert) slide so the user can re-revert
  // (i.e. redo) by clicking בטל שינוי again on this very row.
  const revertText = "בוטל השינוי האחרון.";
  const diff = diffSlideHebrew(currentSlide, restored);
  await sb.from("slide_chats").insert([
    {
      client_id: clientId,
      carousel_id: input.carouselId,
      slide_idx: input.slideIdx,
      lang: input.lang,
      role: "assistant",
      content: revertText,
      patch_json: restored,
      pre_slide_json: currentSlide,
      input_tokens: 0,
      output_tokens: 0,
    },
  ]);

  revalidatePath("/preview");
  return {
    ok: true,
    mergedSlide: restored,
    newSlidesVersion: newVersion,
    assistantText: revertText,
    diffLabels: diff,
    cost: { input_tokens: 0, output_tokens: 0 },
  };
}
