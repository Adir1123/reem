// Validation, merge, diff, and Hebrew sanitization for the per-slide chat
// editor. The Hebrew rules mirror those enforced in the Python pipeline at
// apps/trigger/src/python/scripts/generate_carousels.py — keep both in sync.

import { z } from "zod";
import type { Slide, SlidePatch, SlideStyle } from "@reem/types";

// ---------------------------------------------------------------------------
// Schemas — strict shape used to validate the model's tool input.
// ---------------------------------------------------------------------------

export const SlideStyleSchema = z
  .object({
    headline_size: z.enum(["sm", "md", "lg", "xl"]).optional(),
    body_size: z.enum(["sm", "md", "lg"]).optional(),
    eyebrow_size: z.enum(["sm", "md"]).optional(),
    headline_align: z.enum(["start", "center", "end"]).optional(),
    body_align: z.enum(["start", "center", "end"]).optional(),
    hide_eyebrow: z.boolean().optional(),
    hide_step_number: z.boolean().optional(),
  })
  .strict();

export const SlidePatchSchema = z
  .object({
    headline: z.string().min(1).optional(),
    headline_italic: z.string().nullable().optional(),
    body: z.string().optional(),
    body_emphasis: z.array(z.string()).optional(),
    eyebrow: z.string().nullable().optional(),
    step_number: z.string().nullable().optional(),
    style: SlideStyleSchema.optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Hebrew rules — keep aligned with HEBREW_* constants in
// apps/trigger/src/python/scripts/generate_carousels.py.
// ---------------------------------------------------------------------------

// Hyphen-minus (U+002D) + the U+2010..U+2015 dash block (hyphen, non-breaking
// hyphen, figure dash, en/em dash, horizontal bar). Python equivalent:
// re.compile(r"[-‐-―]")
const HEBREW_BANNED = /[-‐-―]/;

// `הנה` as a sentence opener (start, after newline, or after whitespace).
// Python: re.compile(r"(^|\n|\s)הנה\b")
const HEBREW_HINE_OPENER = /(^|\n|\s)הנה\b/;

// Calque words that almost always indicate machine-translated Hebrew. The
// generation pipeline treats these as warnings; in the live editor we treat
// them as hard fails on the assistant's reply because the user will see them
// immediately.
const HEBREW_CALQUE_WORDS = [
  "אופטימיזציה",
  "מקסימיזציה",
  "מינימיזציה",
  "טכנולוגיות מתקדמות",
  "פורץ דרך",
  "מהפכני",
];

export interface HebrewIssue {
  rule: "dash" | "hine_opener" | "calque";
  detail: string;
}

export function validateHebrewText(text: string): HebrewIssue[] {
  const issues: HebrewIssue[] = [];
  if (HEBREW_BANNED.test(text)) {
    issues.push({ rule: "dash", detail: "מקף או קו מפריד אסור" });
  }
  if (HEBREW_HINE_OPENER.test(text)) {
    issues.push({ rule: "hine_opener", detail: "פתיחה ב`הנה`" });
  }
  for (const w of HEBREW_CALQUE_WORDS) {
    if (text.includes(w)) {
      issues.push({ rule: "calque", detail: `קלקה: ${w}` });
    }
  }
  return issues;
}

// Best-effort cleanup used as a final fallback when the model fails the
// validator twice. Strips dashes, drops a leading `הנה`, and trims. Calques
// are not auto-fixable — we let them through with a warning rather than
// blocking the user.
export function sanitizeHebrewText(text: string): string {
  let out = text;
  // Replace any hyphen/dash with a space, then collapse runs.
  out = out.replace(/[-‐-―]/g, " ").replace(/\s{2,}/g, " ");
  // (Same character class as HEBREW_BANNED — kept inline because regex
  // literals don't compose ergonomically across .test/.replace.)
  // Drop a leading `הנה ` (or `הנה,` etc.)
  out = out.replace(/^[\s]*הנה[\s,.:]+/u, "");
  return out.trim();
}

// ---------------------------------------------------------------------------
// Merge — take the existing slide and apply the patch shallowly. The `style`
// sub-object is merged key-by-key so a partial style update doesn't drop
// previously set overrides.
// ---------------------------------------------------------------------------

export function mergeSlide(existing: Slide, patch: SlidePatch): Slide {
  const next: Slide = { ...existing };
  if (patch.headline !== undefined) next.headline = patch.headline;
  if (patch.headline_italic !== undefined) {
    next.headline_italic = patch.headline_italic;
  }
  if (patch.body !== undefined) next.body = patch.body;
  if (patch.body_emphasis !== undefined) {
    next.body_emphasis = patch.body_emphasis;
  }
  if (patch.eyebrow !== undefined) next.eyebrow = patch.eyebrow;
  if (patch.step_number !== undefined) next.step_number = patch.step_number;
  if (patch.style !== undefined) {
    next.style = { ...(existing.style ?? {}), ...patch.style };
  }
  return next;
}

// ---------------------------------------------------------------------------
// Diff — produce the Hebrew change-summary chip shown on each assistant edit
// bubble (e.g. "שיניתי: כותרת, גודל גוף").
// ---------------------------------------------------------------------------

const FIELD_LABELS_HE: Record<string, string> = {
  headline: "כותרת",
  headline_italic: "מילה מודגשת בכותרת",
  body: "גוף",
  body_emphasis: "הדגשות בגוף",
  eyebrow: "eyebrow",
  step_number: "מספר שלב",
};

const STYLE_LABELS_HE: Record<keyof SlideStyle, string> = {
  headline_size: "גודל כותרת",
  body_size: "גודל גוף",
  eyebrow_size: "גודל eyebrow",
  headline_align: "יישור כותרת",
  body_align: "יישור גוף",
  hide_eyebrow: "הסתרת eyebrow",
  hide_step_number: "הסתרת מספר שלב",
};

export function diffSlideHebrew(pre: Slide, post: Slide): string[] {
  const out: string[] = [];
  for (const k of Object.keys(FIELD_LABELS_HE) as (keyof typeof FIELD_LABELS_HE)[]) {
    const a = (pre as unknown as Record<string, unknown>)[k];
    const b = (post as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(FIELD_LABELS_HE[k]);
  }
  const preStyle = pre.style ?? {};
  const postStyle = post.style ?? {};
  for (const k of Object.keys(STYLE_LABELS_HE) as (keyof SlideStyle)[]) {
    if (JSON.stringify(preStyle[k]) !== JSON.stringify(postStyle[k])) {
      out.push(STYLE_LABELS_HE[k]);
    }
  }
  return out;
}
