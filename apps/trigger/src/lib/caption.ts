// Derives Hebrew + English Instagram captions for a single carousel by
// calling Claude Haiku 4.5. One model call returns both languages so they
// stay tonally aligned. Cheap (~$0.001/carousel).
//
// Hebrew validation mirrors the Python pipeline's strict rules:
//   - no hyphens / dashes (the brand voice forbids them)
//   - no "הנה" sentence opener (top AI-slop marker for Hebrew finance copy)
// One retry on validation failure with stricter instructions; if still bad,
// post-process to scrub dashes and persist anyway. We never block carousel
// creation on caption derivation.

import Anthropic from "@anthropic-ai/sdk";
import type { Slide } from "@reem/types";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 600;

const HE_HINE = /(?:^|\n|\s)הנה\b/;
const HE_DASH = /[-\u2010-\u2015]/;

const HASHTAGS_HE = "#personalfinance #money #investing #כסף #השקעות #פיננסים";
const HASHTAGS_EN = "#personalfinance #money #investing #financialfreedom #savings";

export interface CaptionPair {
  caption_he: string;
  caption_en: string;
}

export interface DeriveCaptionInput {
  apiKey: string;
  concept: string;
  slidesHe: Slide[];
  slidesEn: Slide[];
  /** Optional logger; falls back to console. */
  log?: (msg: string, ctx?: Record<string, unknown>) => void;
}

export async function deriveCaption(input: DeriveCaptionInput): Promise<CaptionPair> {
  const { apiKey, concept, slidesHe, slidesEn } = input;
  const log = input.log ?? ((msg, ctx) => console.log(`[caption] ${msg}`, ctx ?? ""));

  const firstHe = slidesHe[0];
  const firstEn = slidesEn[0];
  if (!firstHe || !firstEn) {
    throw new Error("deriveCaption: both slidesHe and slidesEn must be non-empty");
  }

  const client = new Anthropic({ apiKey });

  const carouselSummary = buildCarouselSummary(concept, slidesHe, slidesEn);

  const baseSystem = systemPrompt(/* strict */ false);
  const firstAttempt = await callHaiku(client, baseSystem, carouselSummary);
  const firstParsed = safeParseJson(firstAttempt);

  if (firstParsed && isValidPair(firstParsed)) {
    return finalize(firstParsed);
  }

  // Retry once with stricter instructions if Hebrew failed validation.
  const reason = !firstParsed
    ? "non-JSON response"
    : !HE_HINE.test(firstParsed.caption_he) && !HE_DASH.test(firstParsed.caption_he)
      ? "valid"
      : HE_HINE.test(firstParsed.caption_he)
        ? "starts with הנה"
        : "contains dashes";

  log("caption first attempt invalid, retrying", { reason });

  const strictSystem = systemPrompt(/* strict */ true);
  const secondAttempt = await callHaiku(client, strictSystem, carouselSummary);
  const secondParsed = safeParseJson(secondAttempt);

  if (secondParsed && isValidPair(secondParsed)) {
    return finalize(secondParsed);
  }

  // Persist whatever we got — sanitize Hebrew dashes/הנה rather than block
  // the whole pipeline. Caller logs this as a warning.
  log("caption retry still invalid — sanitizing and persisting", {
    reason: secondParsed
      ? HE_HINE.test(secondParsed.caption_he)
        ? "still starts with הנה"
        : "still contains dashes"
      : "non-JSON on retry",
  });

  const fallback = secondParsed ??
    firstParsed ?? {
      caption_he: `${firstHe.headline}\n\n${firstHe.body}`,
      caption_en: `${firstEn.headline}\n\n${firstEn.body}`,
    };
  return finalize(sanitize(fallback));
}

function systemPrompt(strict: boolean): string {
  return [
    "You write Instagram captions for @personalfinancetips, an Israeli personal-finance creator.",
    "You will receive one carousel post (concept + slides in Hebrew and English) and produce a caption in BOTH languages.",
    "",
    "VOICE",
    "- Direct, confident, no fluff. Sound like a smart friend texting their advice.",
    "- Hebrew is the primary audience — keep it conversational, no calques from English.",
    "- 2 to 3 short lines per caption (separate sentences with a single newline).",
    "- Last line is the canned hashtag block (provided below).",
    "",
    "HARD RULES — Hebrew",
    "- NEVER start any sentence with `הנה`. This is an AI-slop marker.",
    "- NEVER use a dash (-, –, —). Use a comma, period, or rephrase instead.",
    strict ? "- This is a retry. The previous attempt broke one of these rules. Read every word twice." : "",
    "",
    "HARD RULES — English",
    "- Plain English. No em-dashes (—) or en-dashes (–).",
    "- Avoid 'discover', 'unlock', 'level up' — finance-bro slop.",
    "",
    "STRUCTURE (both langs)",
    "- Line 1: a hook that paraphrases the carousel's main point (don't quote the slide verbatim).",
    "- Line 2-3: 1-2 lines hinting at the value inside without giving away every tip.",
    "- Final line: the hashtag block, exactly as provided. Do NOT add or remove tags.",
    "",
    `HASHTAGS HE: ${HASHTAGS_HE}`,
    `HASHTAGS EN: ${HASHTAGS_EN}`,
    "",
    "RESPONSE FORMAT",
    'Respond with ONE JSON object and nothing else. Shape: {"caption_he": "...", "caption_en": "..."}',
    "Both fields MUST end with the hashtag block on the final line.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCarouselSummary(
  concept: string,
  slidesHe: Slide[],
  slidesEn: Slide[],
): string {
  // Send hook + up to 3 tips per language. CTA slide is not informative for
  // caption derivation. Keeping payload small keeps the call ~500 input tokens.
  const tipsHe = slidesHe
    .filter((s) => s.role === "TIP")
    .slice(0, 3)
    .map((s, i) => `  ${i + 1}. ${s.headline} — ${s.body}`)
    .join("\n");
  const tipsEn = slidesEn
    .filter((s) => s.role === "TIP")
    .slice(0, 3)
    .map((s, i) => `  ${i + 1}. ${s.headline} — ${s.body}`)
    .join("\n");
  const hookHe = slidesHe.find((s) => s.role === "HOOK") ?? slidesHe[0];
  const hookEn = slidesEn.find((s) => s.role === "HOOK") ?? slidesEn[0];
  const hookHeText = hookHe ? `${hookHe.headline} — ${hookHe.body}` : "(none)";
  const hookEnText = hookEn ? `${hookEn.headline} — ${hookEn.body}` : "(none)";

  return [
    `CONCEPT: ${concept}`,
    "",
    "HEBREW CAROUSEL",
    `Hook: ${hookHeText}`,
    "Tips:",
    tipsHe || "  (none)",
    "",
    "ENGLISH CAROUSEL",
    `Hook: ${hookEnText}`,
    "Tips:",
    tipsEn || "  (none)",
  ].join("\n");
}

async function callHaiku(
  client: Anthropic,
  system: string,
  userContent: string,
): Promise<string> {
  const resp = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: userContent }],
  });
  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Haiku returned no text block");
  }
  return textBlock.text.trim();
}

function safeParseJson(raw: string): CaptionPair | null {
  // Tolerate markdown fences like ```json ... ``` even though the prompt
  // forbids them — Haiku occasionally adds them anyway.
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const obj = JSON.parse(stripped);
    if (
      obj &&
      typeof obj === "object" &&
      typeof obj.caption_he === "string" &&
      typeof obj.caption_en === "string"
    ) {
      return { caption_he: obj.caption_he, caption_en: obj.caption_en };
    }
    return null;
  } catch {
    return null;
  }
}

function isValidPair(p: CaptionPair): boolean {
  if (HE_HINE.test(p.caption_he)) return false;
  if (HE_DASH.test(p.caption_he)) return false;
  return true;
}

function sanitize(p: CaptionPair): CaptionPair {
  // Last-resort cleanup so we never persist a known-bad Hebrew caption.
  // Replaces dashes with a comma+space (preserves rhythm) and drops a
  // leading "הנה " if present at the very start of any line.
  const cleanHe = p.caption_he
    .replace(HE_DASH, ", ")
    .replace(/(^|\n)\s*הנה\s+/g, "$1");
  return { caption_he: cleanHe, caption_en: p.caption_en };
}

function finalize(p: CaptionPair): CaptionPair {
  // Guarantee the hashtag block is present even if the model omitted it.
  const he = p.caption_he.includes(HASHTAGS_HE)
    ? p.caption_he
    : `${p.caption_he}\n\n${HASHTAGS_HE}`;
  const en = p.caption_en.includes(HASHTAGS_EN)
    ? p.caption_en
    : `${p.caption_en}\n\n${HASHTAGS_EN}`;
  return { caption_he: he.trim(), caption_en: en.trim() };
}
