#!/usr/bin/env python3
"""Generate Instagram carousels (EN + HE) from YouTube transcripts.

This is the HEADLESS path — it calls the Anthropic API directly so a dashboard or
cron can invoke it without a Claude Code session. The INTERACTIVE path (a Claude
Code user running the skill) does the same reasoning inline via SKILL.md.

Pipeline:
  transcripts.json + brand docs + ref images
      ──► Claude Opus 4.7 (with prompt caching on the stable system content)
      ──► strict JSON carousel output
      ──► schema-validated, Hebrew-banned-character checked
      ──► written to output file

Usage:
  python generate_carousels.py \
      --transcripts transcripts.json \
      --query "finance tips" \
      --carousels 2 \
      --output out.json
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import mimetypes
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import (  # noqa: E402
    CAROUSEL_MODEL,
    REEM_DOCS_DIR,
    SCHEMA_VERSION,
    require_anthropic_key,
)


def _force_utf8_streams():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


HEBREW_BANNED = re.compile(r"[-\u2010-\u2015]")  # hyphen + hyphen/dash block (incl. non-breaking)
# Hard-fail opener: `הנה` as a sentence opener is the single strongest AI-slop
# marker for Hebrew finance copy. Warnings alone didn't stop Opus from shipping
# it in iteration 2, so it's now a ValueError (triggers a retry in strict mode).
HEBREW_HINE_OPENER = re.compile(r"(^|\n|\s)הנה\b")
# Soft slop openers — warn, don't fail. These are less consistently AI-flavoured.
HEBREW_SLOP_OPENERS = (
    re.compile(r"(^|\n)\s*אז\b"),
    re.compile(r"\bבעצם\b"),
    re.compile(r"(^|\n)\s*למעשה\b"),
    re.compile(r"(^|\n)\s*בסופו של דבר\b"),
    re.compile(r"(^|\n)\s*לכן\b"),
)
# Calque patterns — direct structural translations from English. Warnings by
# default; become hard-fails when `--hebrew-strict` is on (the default).
HEBREW_CALQUE_PATTERNS = (
    # "it's not about X, it's about Y" lifted whole from English
    re.compile(r"זה לא עניין של .{0,40}? זה עניין של"),
    # parallel passive-suffix pairs — "X נזרקים. Y נזרקות." style
    re.compile(r"\S+נזרקים\S*\s*[.!?]\s*\S+נזרקות"),
    re.compile(r"\S+מוחלפים\S*\s*[.!?]\s*\S+מוחלפות"),
)
# `באמת` inside a *headline* is almost always the English "really" leaking
# through — in body copy it's legitimate. Enforced by context, not regex.
HEBREW_CALQUE_HEADLINE_QUALIFIER = re.compile(r"\bבאמת\b")

# Markdown emphasis that occasionally leaks from Opus despite the plain-text
# JSON contract (e.g. `*Verdict*` or `**$5,000**`). The renderer prints these
# literally on the carousel, so strip the markers and propagate the captured
# spans to body_emphasis / headline_italic. Order matters — longest marker
# first so `**` is consumed before `*`, same for `__` vs `_`.
_MD_EMPHASIS_PATTERNS = (
    re.compile(r"\*\*(.+?)\*\*"),
    re.compile(r"__(.+?)__"),
    re.compile(r"\*(.+?)\*"),
    re.compile(r"_(.+?)_"),
)


def _strip_md(text: str) -> tuple[str, list[str]]:
    """Remove markdown emphasis markers; return (cleaned_text, captured_spans)."""
    captured: list[str] = []
    for pat in _MD_EMPHASIS_PATTERNS:
        def _grab(m, store=captured):
            store.append(m.group(1))
            return m.group(1)
        text = pat.sub(_grab, text)
    return text, captured


def _strip_markdown_emphasis(slide: dict) -> int:
    """Strip markdown emphasis from slide string fields. Propagate captured
    spans into body_emphasis (every span) and headline_italic (first span,
    only if not already set). Returns the number of stripped spans."""
    count = 0
    headline = slide.get("headline")
    if isinstance(headline, str):
        cleaned, captured = _strip_md(headline)
        if cleaned != headline:
            slide["headline"] = cleaned
            count += len(captured)
            if captured and not slide.get("headline_italic"):
                slide["headline_italic"] = captured[0]
    body = slide.get("body")
    if isinstance(body, str):
        cleaned, captured = _strip_md(body)
        if cleaned != body:
            slide["body"] = cleaned
            count += len(captured)
            existing = list(slide.get("body_emphasis") or [])
            for span in captured:
                if span not in existing:
                    existing.append(span)
            slide["body_emphasis"] = existing
    eyebrow = slide.get("eyebrow")
    if isinstance(eyebrow, str):
        cleaned, captured = _strip_md(eyebrow)
        if cleaned != eyebrow:
            slide["eyebrow"] = cleaned
            count += len(captured)
    return count


VALID_ROLES = ["HOOK", "TIP", "TIP", "TIP", "TIP", "TIP", "CTA"]
VALID_ENERGY = {"HIGH", "MEDIUM", "LOW"}


def _load_docs():
    """Return (brand, framework, typography, hook) as strings."""
    brand = (REEM_DOCS_DIR / "Brand_Prompt_for_AI.md").read_text(encoding="utf-8")
    framework = (REEM_DOCS_DIR / "carousel-framework.md").read_text(encoding="utf-8")
    typography = (REEM_DOCS_DIR / "hebrew-typography.md").read_text(encoding="utf-8")
    hook = (REEM_DOCS_DIR / "hook-framework.md").read_text(encoding="utf-8")
    return brand, framework, typography, hook


_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"


def _load_knowledge():
    """Load the Hebrew quality framework files. Returns a dict mapping the
    file's logical name to its contents. These are mounted as cached system
    blocks for both Pass B (Hebrew authoring) and Pass C (critic).

    See apps/trigger/src/python/knowledge/ — ported and adapted from the
    Adir1123/adir-carousels project, niche-shifted to Personal Finance Tips.
    """
    if not _KNOWLEDGE_DIR.is_dir():
        return {}  # graceful degrade — pipeline still runs without the framework
    out = {}
    for name in [
        "brand-voice-he.md",
        "copy-patterns-he.md",
        "punctuation-he.md",
        "bidi-rules.md",
        "hook.md",
        "english-terms-whitelist.json",
        "qa-rubric-he.md",
    ]:
        p = _KNOWLEDGE_DIR / name
        if p.exists():
            out[name] = p.read_text(encoding="utf-8")
    return out


def _knowledge_to_system_blocks(knowledge: dict, include_rubric: bool = False):
    """Convert the knowledge dict into Anthropic system blocks. Pass B doesn't
    need the QA rubric (the critic uses that in Pass C); set include_rubric=True
    only for the Pass C call.
    """
    keys = [
        "brand-voice-he.md",
        "copy-patterns-he.md",
        "punctuation-he.md",
        "bidi-rules.md",
        "hook.md",
        "english-terms-whitelist.json",
    ]
    if include_rubric:
        keys.append("qa-rubric-he.md")
    blocks = []
    for k in keys:
        if k in knowledge:
            blocks.append({"type": "text", "text": f"# {k}\n\n{knowledge[k]}"})
    return blocks


def _load_images_from(dir_name: str):
    """Return [(filename, media_type, base64_data), ...] for every PNG in
    reem-docs/<dir_name>/, sorted by filename. Used for both the `ref/` style
    pool and the `output-referance/` exemplar carousel."""
    dir_path = REEM_DOCS_DIR / dir_name
    out = []
    if not dir_path.is_dir():
        return out
    for p in sorted(dir_path.glob("*.png")):
        mt, _ = mimetypes.guess_type(p.name)
        data = base64.standard_b64encode(p.read_bytes()).decode("ascii")
        out.append((p.name, mt or "image/png", data))
    return out


def _load_ref_images():
    """Style-pool images — Opus picks one per slide as the `ref_image`."""
    return _load_images_from("ref")


def _load_exemplar_images():
    """Fully rendered target English carousel — the design-language target Opus
    must match for Pass A. NOT a pool for per-slide assignment; shown only to
    anchor style."""
    return _load_images_from("output-referance")


def _load_hebrew_exemplar_images():
    """Fully rendered target Hebrew carousel — the voice target for Pass B.
    Opus reads native-Hebrew copy straight off the images to anchor register
    before authoring `slides_he` from the English insight."""
    return _load_images_from("hebrew-output-referances")


def _load_prompt_template():
    template_path = Path(__file__).resolve().parent.parent / "references" / "carousel-prompt-template.md"
    return template_path.read_text(encoding="utf-8")


def _load_hebrew_reauthor_template():
    template_path = Path(__file__).resolve().parent.parent / "references" / "hebrew-reauthor-prompt.md"
    return template_path.read_text(encoding="utf-8")


def _build_system_blocks(brand, framework, typography, hook, knowledge=None):
    """System text blocks. Anthropic's `system` param accepts TEXT blocks only —
    images must live in the user message. Cache on the last block so the whole
    stable payload (brand + framework + typography + knowledge) gets prompt-cached.

    The `knowledge` dict (from _load_knowledge()) injects the Hebrew quality
    framework — brand-voice, copy-patterns, punctuation, bidi, hook archetypes,
    and the english-terms whitelist. Pass B and Pass C both see this material
    so the writer and the critic agree on the rules.
    """
    blocks = [
        {
            "type": "text",
            "text": (
                "You are a senior Instagram carousel designer for @personalfinancetips. "
                "You output strict JSON only, following the contract the user will specify. "
                "You never paste source-transcript sentences verbatim. "
                "You treat Hebrew output as native re-authoring, not translation."
            ),
        },
        {"type": "text", "text": "# Brand_Prompt_for_AI.md\n\n" + brand},
        {"type": "text", "text": "# carousel-framework.md\n\n" + framework},
        {"type": "text", "text": "# hook-framework.md (apply to Slide 0 / HOOK)\n\n" + hook},
        {"type": "text", "text": "# hebrew-typography.md\n\n" + typography},
    ]
    if knowledge:
        blocks.extend(_knowledge_to_system_blocks(knowledge, include_rubric=False))
    blocks[-1] = {**blocks[-1], "cache_control": {"type": "ephemeral"}}
    return blocks


def _build_user_content(
    prompt_template, transcripts, n_carousels, ref_images, exemplar_images
):
    """User message content: exemplars first (design target), then the style
    pool (per-slide pickable backgrounds), then the prompt text. Images all
    live in the user message — Anthropic's `system` param rejects image blocks."""
    content = []

    # Section A: exemplars — the rendered carousel Opus should emulate.
    if exemplar_images:
        content.append({
            "type": "text",
            "text": (
                "=== EXEMPLAR CAROUSEL — DESIGN TARGET ===\n"
                "The images below are seven slides of a FULLY RENDERED reference "
                "carousel. They are the exact visual target. Study:\n"
                "  • Eyebrow labels (small gold all-caps above the headline)\n"
                "  • Exactly ONE italic + gold emphasis word per headline\n"
                "  • Corner chrome (PFT top-right, @personalfinancetips bottom-left, slide counter bottom-right)\n"
                "  • Headline rhythm (\"X isn't Y. It's Z.\" / \"Most people ___ backwards.\")\n"
                "  • Body: one sentence or a tight list, never a paragraph\n"
                "Your JSON, once rendered, must pass for these."
            ),
        })
        for fname, media_type, data in exemplar_images:
            content.append({"type": "text", "text": f"[Exemplar: {fname}]"})
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": data},
            })

    # Section B: ref/*.png — the style pool Opus assigns per slide.
    content.append({
        "type": "text",
        "text": (
            "=== STYLE POOL — per-slide `ref_image` assignments ===\n"
            "Pick ONE filename from this pool for each non-CTA slide's "
            "`ref_image`. These are mood/style references for the slide's "
            "background. Don't reuse the same file twice within a carousel."
        ),
    })
    for fname, media_type, data in ref_images:
        content.append({"type": "text", "text": f"[Pool: {fname}]"})
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": data},
        })
    # Cache through the last image so this whole stable block is reusable.
    if len(content) > 1:
        content[-1] = {**content[-1], "cache_control": {"type": "ephemeral"}}

    tx_slim = [
        {
            "url": t["url"],
            "title": t.get("title"),
            "channel": t.get("channel"),
            "transcript": t["transcript"][:20000],
        }
        for t in transcripts
    ]
    filled = (
        prompt_template
        .replace("{N_CAROUSELS}", str(n_carousels))
        .replace("{TRANSCRIPTS_JSON}", json.dumps(tx_slim, ensure_ascii=False, indent=2))
    )
    content.append({"type": "text", "text": filled})
    return content


def _build_user_content_he(he_exemplar_images, carousels_en, he_prompt_template):
    """Pass B user message: Hebrew voice-target images, then the Pass A English
    carousels as input, then the re-author prompt. System blocks are shared
    with Pass A so the cache hits.

    carousels_en: the list of carousel dicts from Pass A, each with `slides_en`
    populated. Serialised into the prompt as the idea-source (not copy)."""
    content = []
    if he_exemplar_images:
        content.append({
            "type": "text",
            "text": (
                "=== HEBREW VOICE TARGET ===\n"
                "The seven images below are a fully rendered Hebrew carousel in "
                "the exact native-speaker voice and register you must author in. "
                "Read every headline and body line off the images. Note the "
                "short clauses, the active voice, the Israeli rhythm, and the "
                "absence of any opener or calque. Your `slides_he` output must "
                "read like these — not like a translation of the English below."
            ),
        })
        for fname, media_type, data in he_exemplar_images:
            content.append({"type": "text", "text": f"[Hebrew exemplar: {fname}]"})
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": data},
            })
        content[-1] = {**content[-1], "cache_control": {"type": "ephemeral"}}

    en_payload = json.dumps({"carousels": carousels_en}, ensure_ascii=False, indent=2)
    filled = he_prompt_template.replace("{EN_CAROUSELS_JSON}", en_payload)
    content.append({"type": "text", "text": filled})
    return content


def _extract_json(raw: str) -> dict:
    """Be resilient if the model wraps JSON in a ```json fence despite the instruction."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return json.loads(raw)


def _validate_slide_shape(c_id, lang_key, slides, ref_image_names, warnings):
    """Common per-slide shape checks: role order, energy, ref_image pool, and
    the design-language fields (eyebrow, headline_italic substring,
    body_emphasis list). Pure warnings — does not raise."""
    for idx, s in enumerate(slides):
        expected_role = VALID_ROLES[idx]
        if s.get("role") != expected_role:
            warnings.append(
                f"{c_id}.{lang_key}[{idx}].role={s.get('role')} expected {expected_role}"
            )
        if s.get("visual_energy") not in VALID_ENERGY:
            warnings.append(f"{c_id}.{lang_key}[{idx}] invalid visual_energy")
        ri = s.get("ref_image")
        if expected_role == "CTA":
            if ri is not None:
                warnings.append(f"{c_id}.{lang_key} CTA slide must have null ref_image")
        else:
            # Non-CTA slides MUST have a real ref_image from the pool. Null
            # here is a model slip (misreading "text-only" as "no image") and
            # the renderer will produce a blank slide — hard fail so the
            # retry loop takes another swing.
            if ri is None:
                raise ValueError(
                    f"{c_id}.{lang_key}[{idx}] non-CTA slide has null ref_image. "
                    f"Every slide 1-6 needs a background from the style pool. "
                    f"Hard fail — regenerate."
                )
            if ri not in ref_image_names:
                warnings.append(
                    f"{c_id}.{lang_key}[{idx}] ref_image {ri!r} not in ref pool"
                )
        headline = s.get("headline", "") or ""
        if expected_role != "CTA":
            eyebrow = s.get("eyebrow")
            if not eyebrow or not isinstance(eyebrow, str):
                warnings.append(f"{c_id}.{lang_key}[{idx}] missing eyebrow")
            it = s.get("headline_italic")
            if not it or not isinstance(it, str):
                warnings.append(f"{c_id}.{lang_key}[{idx}] missing headline_italic")
            elif it not in headline:
                warnings.append(
                    f"{c_id}.{lang_key}[{idx}] headline_italic {it!r} "
                    f"not a substring of headline {headline!r}"
                )
        be = s.get("body_emphasis")
        if be:
            if not isinstance(be, list):
                warnings.append(f"{c_id}.{lang_key}[{idx}] body_emphasis must be a list")
            else:
                # Case-insensitive check: the model sometimes lower-cases the
                # emphasis word while the body keeps sentence-capitalisation
                # (e.g. "Dining out goes." + emphasis 'dining out'). The
                # renderer does a case-insensitive match too.
                body_lower = (s.get("body", "") or "").lower()
                for w in be:
                    if isinstance(w, str) and w.lower() not in body_lower:
                        warnings.append(
                            f"{c_id}.{lang_key}[{idx}] body_emphasis {w!r} not found in body"
                        )


def _validate_hebrew_text(c_id, slides_he, warnings, strict):
    """Hebrew-specific text checks. Raises ValueError on hard fails:
      - dash/hyphen characters (always)
      - `הנה` sentence opener (always — was a warning in v2, now hard fail)
      - calque patterns + `באמת` in headlines (only when `strict=True`)
    All other slop openers stay as warnings.
    """
    for idx, s in enumerate(slides_he):
        headline = s.get("headline", "") or ""
        body = s.get("body", "") or ""
        for field, txt in (("headline", headline), ("body", body)):
            if HEBREW_BANNED.search(txt):
                raise ValueError(
                    f"{c_id}.slides_he[{idx}].{field} contains banned dash "
                    f"character. Hard fail — regenerate."
                )
            if HEBREW_HINE_OPENER.search(txt):
                raise ValueError(
                    f"{c_id}.slides_he[{idx}].{field} opens with `הנה` — "
                    f"AI-slop marker. Hard fail — regenerate. text={txt!r}"
                )
            for pat in HEBREW_SLOP_OPENERS:
                if pat.search(txt):
                    warnings.append(
                        f"{c_id}.slides_he[{idx}].{field} matches slop pattern "
                        f"{pat.pattern!r}"
                    )
            for pat in HEBREW_CALQUE_PATTERNS:
                if pat.search(txt):
                    msg = (
                        f"{c_id}.slides_he[{idx}].{field} matches calque pattern "
                        f"{pat.pattern!r}"
                    )
                    if strict:
                        raise ValueError(msg + " (strict mode).")
                    warnings.append(msg)
        # `באמת` qualifier only matters inside a (short) headline
        if HEBREW_CALQUE_HEADLINE_QUALIFIER.search(headline):
            msg = (
                f"{c_id}.slides_he[{idx}].headline contains `באמת` — typically the "
                f"English 'really' calque in a short headline. text={headline!r}"
            )
            if strict:
                raise ValueError(msg + " (strict mode).")
            warnings.append(msg)


def _validate_carousels(data, ref_image_names, warnings, lang_keys=("slides_en", "slides_he"), strict=False):
    """Raises ValueError on structural problems and Hebrew hard-fails; appends
    soft issues to warnings.

    `lang_keys` lets callers validate only one side: Pass A uses ('slides_en',);
    post-merge validation uses both. `strict` escalates Hebrew calque patterns
    from warnings to ValueErrors (used under --hebrew-strict).
    """
    if "carousels" not in data or not isinstance(data["carousels"], list):
        raise ValueError("Response missing 'carousels' array.")
    for c in data["carousels"]:
        c_id = c.get("id", "?")
        for lang_key in lang_keys:
            slides = c.get(lang_key)
            if not isinstance(slides, list) or len(slides) != 7:
                raise ValueError(f"{c_id}.{lang_key} must have exactly 7 slides.")
            _validate_slide_shape(c_id, lang_key, slides, ref_image_names, warnings)
        if "slides_he" in lang_keys:
            _validate_hebrew_text(c_id, c.get("slides_he", []), warnings, strict)
        # CTA handle check — accept the handle in either headline or body.
        handle = "@personalfinancetips"
        for lang_key in lang_keys:
            cta = c.get(lang_key, [None] * 7)[6]
            if not cta:
                continue
            text = (cta.get("headline", "") or "") + "\n" + (cta.get("body", "") or "")
            if handle not in text:
                warnings.append(f"{c_id}.{lang_key} CTA slide missing handle")


def _extract_key_points_from_transcript(t):
    """Cheap heuristic for source.key_points when the model didn't fill any.
    Takes the first 3 non-trivial lines."""
    lines = [ln.strip() for ln in t.get("transcript", "").splitlines() if ln.strip()]
    return lines[:3]


def _call_anthropic(client, model, system_blocks, user_content, max_tokens=8000):
    """One API call → (raw_text, usage, duration_seconds)."""
    t0 = time.time()
    resp = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_blocks,
        messages=[{"role": "user", "content": user_content}],
    )
    duration = round(time.time() - t0, 1)
    raw = "".join(
        block.text for block in resp.content if getattr(block, "type", None) == "text"
    )
    return raw, getattr(resp, "usage", None), duration


def _pass_a_english(client, transcripts, n_carousels, model, ref_images, exemplar_images, system_blocks):
    """Pass A — author English carousels only. Returns (data, usage, duration).
    `data["carousels"]` will have `slides_en` populated; `slides_he` is absent."""
    user_content = _build_user_content(
        _load_prompt_template(), transcripts, n_carousels, ref_images, exemplar_images,
    )
    print(
        f"[Pass A / EN] Calling {model} — {len(transcripts)} transcript(s), "
        f"{len(ref_images)} style ref(s), {len(exemplar_images)} exemplar(s), "
        f"{n_carousels} carousel(s) requested.",
        file=sys.stderr,
    )
    raw, usage, duration = _call_anthropic(client, model, system_blocks, user_content)
    data = _extract_json(raw)
    return data, usage, duration


CRITIC_MODEL = "claude-sonnet-4-6"


def _pass_c_critic(client, carousels, knowledge, model=CRITIC_MODEL):
    """Pass C — Hebrew quality critic. Scores every Hebrew slide on the 7
    weighted dimensions defined in qa-rubric-he.md and returns a structured
    report.

    Performance: one Sonnet call per carousel scoring all 7 slides at once,
    with carousels critiqued in parallel. The persisted `critic_report` shape
    is identical to the per-slide-call version (each slide still becomes one
    entry in `slides[]` with the same fields).

    Returns (critic_report, usage, duration). `critic_report` shape:
      {
        "carousels": [
          {
            "carousel_id": str,
            "slides": [{slide_index, hard_fails, scores, weighted_score, recommend, notes}],
            "carousel_average": float,
            "carousel_recommend": "ship" | "regenerate"
          }
        ],
        "any_regenerate": bool,    # convenience flag for the loop
      }
    """
    if not knowledge:
        # No knowledge files = critic has nothing to score against. Skip.
        return {"carousels": [], "any_regenerate": False, "skipped": "no knowledge dir"}, None, 0

    critic_system = [
        {
            "type": "text",
            "text": (
                "You are a senior Hebrew copy editor for Israeli Instagram. Your job is to "
                "score every Hebrew slide on a 1-10 scale across 7 weighted dimensions, "
                "applying the rubric exactly as written. Be honest and specific. "
                "You are forced to call the `score_slides_batch` tool — do not write prose."
            ),
        },
    ]
    # Mount the entire knowledge framework so the critic shares the writer's rules.
    critic_system.extend(_knowledge_to_system_blocks(knowledge, include_rubric=True))
    critic_system[-1] = {**critic_system[-1], "cache_control": {"type": "ephemeral"}}

    # Per-slide score shape — identical to the original `score_slide` tool's
    # input_schema so the persisted critic_report stays unchanged downstream.
    slide_schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["slide_index", "hard_fails", "scores", "weighted_score", "recommend"],
        "properties": {
            "slide_index": {"type": "integer", "minimum": 0, "maximum": 6},
            "hard_fails": {"type": "array", "items": {"type": "string"}},
            "scores": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "nativeness", "voice_match", "term_correctness",
                    "bidi_correctness", "punctuation_correctness", "pattern_fit",
                    "specificity",
                ],
                "properties": {
                    "nativeness": {"type": "number", "minimum": 0, "maximum": 10},
                    "voice_match": {"type": "number", "minimum": 0, "maximum": 10},
                    "term_correctness": {"type": "number", "minimum": 0, "maximum": 10},
                    "bidi_correctness": {"type": "number", "minimum": 0, "maximum": 10},
                    "punctuation_correctness": {"type": "number", "minimum": 0, "maximum": 10},
                    "pattern_fit": {"type": "number", "minimum": 0, "maximum": 10},
                    "specificity": {"type": "number", "minimum": 0, "maximum": 10},
                },
            },
            "weighted_score": {"type": "number", "minimum": 0, "maximum": 10},
            "recommend": {"enum": ["ship", "consider_regenerate", "regenerate"]},
            "notes": {"type": "string"},
        },
    }
    batched_tool = {
        "name": "score_slides_batch",
        "description": (
            "Apply the qa-rubric-he.md rubric to ALL slides of one Hebrew "
            "carousel at once and return an array of per-slide scores."
        ),
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["slides"],
            "properties": {
                "slides": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 7,
                    "items": slide_schema,
                },
            },
        },
    }

    def _critic_one(c):
        """One batched critic call for one carousel.
        Returns (carousel_id, slide_reports, in_tokens, out_tokens, any_regen)."""
        slides_he = c.get("slides_he", []) or []
        slides_en = c.get("slides_en", []) or []
        n = min(len(slides_he), 7)
        if n == 0:
            return c.get("id", "?"), [], 0, 0, False
        pairs = [
            {
                "slide_index": i,
                "english": slides_en[i] if i < len(slides_en) else {},
                "hebrew": slides_he[i],
            }
            for i in range(n)
        ]
        user_content = [{
            "type": "text",
            "text": (
                f"Score every Hebrew slide in this carousel against qa-rubric-he.md. "
                f"Call `score_slides_batch` ONCE with an array of {n} entries, one "
                f"per slide_index. Apply hard-fail checks first per slide; if any "
                f"trigger, set hard_fails non-empty, weighted_score=0, "
                f"recommend=regenerate.\n\n"
                f"=== SLIDES (slide_index, english brief, hebrew output) ===\n"
                f"{json.dumps(pairs, ensure_ascii=False, indent=2)}"
            ),
        }]
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=4000,
                system=critic_system,
                tools=[batched_tool],
                tool_choice={"type": "tool", "name": "score_slides_batch"},
                messages=[{"role": "user", "content": user_content}],
            )
            tool_input = None
            for block in resp.content:
                if (
                    getattr(block, "type", None) == "tool_use"
                    and getattr(block, "name", None) == "score_slides_batch"
                ):
                    tool_input = getattr(block, "input", None)
                    break
            u = getattr(resp, "usage", None)
            in_tok = (getattr(u, "input_tokens", 0) or 0) if u else 0
            out_tok = (getattr(u, "output_tokens", 0) or 0) if u else 0
            if tool_input is None or not isinstance(tool_input.get("slides"), list):
                # Synthesise per-slide failure entries so the report still
                # surfaces the issue (and triggers any_regen) rather than
                # silently dropping the carousel.
                slide_reports = [
                    {
                        "slide_index": i,
                        "hard_fails": ["critic_no_tool_call"],
                        "scores": {},
                        "weighted_score": 0,
                        "recommend": "regenerate",
                        "notes": "Critic LLM did not call score_slides_batch.",
                    }
                    for i in range(n)
                ]
                return c.get("id", "?"), slide_reports, in_tok, out_tok, True
            slide_reports = list(tool_input["slides"])
            any_regen = any(s.get("recommend") != "ship" for s in slide_reports)
            return c.get("id", "?"), slide_reports, in_tok, out_tok, any_regen
        except Exception as e:  # noqa: BLE001 — never let critic crash the run
            slide_reports = [
                {
                    "slide_index": i,
                    "hard_fails": [f"critic_exception: {e}"],
                    "scores": {},
                    "weighted_score": 0,
                    "recommend": "regenerate",
                    "notes": str(e),
                }
                for i in range(n)
            ]
            return c.get("id", "?"), slide_reports, 0, 0, True

    out_carousels = []
    any_regen = False
    total_in = 0
    total_out = 0
    t0 = time.time()

    if carousels:
        with ThreadPoolExecutor(max_workers=len(carousels)) as ex:
            futs = {ex.submit(_critic_one, c): c for c in carousels}
            critic_results = {futs[f]: f.result() for f in as_completed(futs)}
        for c in carousels:  # stable carousel order in output
            cid, slide_reports, in_tok, out_tok, regen = critic_results[c]
            total_in += in_tok
            total_out += out_tok
            if regen:
                any_regen = True
            scored = [s for s in slide_reports if isinstance(s.get("weighted_score"), (int, float))]
            avg = sum(s["weighted_score"] for s in scored) / len(scored) if scored else 0
            out_carousels.append({
                "carousel_id": cid,
                "slides": slide_reports,
                "carousel_average": round(avg, 2),
                "carousel_recommend": "ship" if avg >= 8 and not any(s.get("recommend") == "regenerate" for s in slide_reports) else "regenerate",
            })

    duration = round(time.time() - t0, 1)
    return (
        {"carousels": out_carousels, "any_regenerate": any_regen},
        {"input_tokens": total_in, "output_tokens": total_out},
        duration,
    )


def _pass_b_hebrew(client, carousels_en, model, he_exemplar_images, system_blocks):
    """Pass B — author Hebrew from the English insight, not translation.
    Returns (slides_he_by_id, usage, duration). Caller merges back into the
    carousels."""
    user_content = _build_user_content_he(
        he_exemplar_images, carousels_en, _load_hebrew_reauthor_template(),
    )
    print(
        f"[Pass B / HE] Calling {model} — {len(carousels_en)} English carousel(s) "
        f"as idea source, {len(he_exemplar_images)} Hebrew voice exemplar(s).",
        file=sys.stderr,
    )
    raw, usage, duration = _call_anthropic(client, model, system_blocks, user_content)
    data = _extract_json(raw)
    by_id = {c.get("id"): c.get("slides_he", []) for c in data.get("carousels", [])}
    return by_id, usage, duration


def _format_critic_feedback(critic_report: dict) -> str:
    """Render the critic report into a markdown block the writer can read on
    its second Pass B attempt. We only surface flagged slides — slides that
    shipped don't need to be rewritten."""
    lines = ["# Critic feedback (qa-rubric-he.md)\n"]
    for c in critic_report.get("carousels", []):
        cid = c.get("carousel_id", "?")
        for s in c.get("slides", []):
            if s.get("recommend") == "ship":
                continue
            idx = s.get("slide_index")
            score = s.get("weighted_score", 0)
            hard_fails = s.get("hard_fails") or []
            notes = s.get("notes", "")
            lines.append(f"## {cid} / slide {idx} — score {score} — recommend {s.get('recommend')}")
            if hard_fails:
                lines.append(f"**Hard fails**: {', '.join(hard_fails)}")
            scores = s.get("scores", {})
            if scores:
                weak = [f"{k}={v}" for k, v in scores.items() if isinstance(v, (int, float)) and v < 8]
                if weak:
                    lines.append(f"**Weak dimensions**: {', '.join(weak)}")
            if notes:
                lines.append(f"**Notes**: {notes}")
            lines.append("")
    return "\n".join(lines)


def _pass_b_hebrew_with_feedback(
    client, carousels_en, model, he_exemplar_images, system_blocks, critic_notes: str
):
    """Pass B retry. Same prompt as the main Pass B but with the critic's
    notes injected at the top of the user message so the writer knows
    exactly what to fix on the second attempt.
    """
    base = _build_user_content_he(
        he_exemplar_images, carousels_en, _load_hebrew_reauthor_template(),
    )
    # Prepend the critic feedback as a text block.
    feedback_block = {
        "type": "text",
        "text": (
            "=== CRITIC FEEDBACK FROM YOUR PREVIOUS ATTEMPT ===\n\n"
            + critic_notes
            + "\n\nRewrite the flagged slides to fix every hard_fail and lift "
              "every weak dimension to ≥ 9. Keep slides not mentioned identical."
        ),
    }
    user_content = [feedback_block] + base
    print(
        "[Pass B retry / HE] Calling with critic feedback prepended.",
        file=sys.stderr,
    )
    raw, usage, duration = _call_anthropic(client, model, system_blocks, user_content)
    data = _extract_json(raw)
    by_id = {c.get("id"): c.get("slides_he", []) for c in data.get("carousels", [])}
    return by_id, usage, duration


def generate(transcripts, query, n_carousels, model=CAROUSEL_MODEL, hebrew_strict=True, deadline_at=None):
    """Two-pass generation: EN authored in Pass A, HE re-authored (not
    translated) in Pass B using the Hebrew voice exemplars. Pass A retries up
    to 2 times on hard-fail; Pass B retries up to 2 times on Hebrew hard-fail.

    `deadline_at`: optional monotonic-clock deadline (time.monotonic()-relative).
    Pass C critic is skipped if we're past it. Carousels still ship without
    critic_report — they're complete; the score is just advisory."""
    from anthropic import Anthropic

    # 180s per-call timeout so a single hung API call fails fast instead of
    # eating the entire Trigger.dev 600s task budget.
    client = Anthropic(api_key=require_anthropic_key(), timeout=180.0)
    brand, framework, typography, hook = _load_docs()
    knowledge = _load_knowledge()
    ref_images = _load_ref_images()
    exemplar_images = _load_exemplar_images()
    he_exemplar_images = _load_hebrew_exemplar_images()
    ref_names = set(f for f, _, _ in ref_images)
    system_blocks = _build_system_blocks(brand, framework, typography, hook, knowledge=knowledge)

    warnings: list[str] = []

    # ---- Pass A (up to 2 attempts on hard-fail) ----
    # Retry budget trimmed from 4 to 2 to fit Trigger.dev free-tier 600s cap.
    # Each Opus call costs ~30-90s; 4 retries on bad luck blew past the cap.
    # With prompt caching warmed, attempt-1 success rate is high enough that
    # 2 attempts is plenty.
    PASS_A_MAX_ATTEMPTS = 2
    en_attempts = 0
    en_data = None
    usage_a = None
    dur_a = 0
    while en_attempts < PASS_A_MAX_ATTEMPTS:
        en_attempts += 1
        en_data, usage_a, dur_a = _pass_a_english(
            client, transcripts, n_carousels, model,
            ref_images, exemplar_images, system_blocks,
        )
        # Strip leaked markdown emphasis (`*Verdict*`, `**$5k**`) before
        # validation — markers would otherwise render literally on the carousel.
        md_stripped_a = 0
        for c in en_data.get("carousels", []):
            for s in c.get("slides_en", []):
                md_stripped_a += _strip_markdown_emphasis(s)
        if md_stripped_a:
            warnings.append(
                f"Pass A: stripped {md_stripped_a} markdown emphasis marker(s) "
                f"from English slides (Opus leaked them despite plain-text contract)."
            )
        try:
            _validate_carousels(en_data, ref_names, warnings, lang_keys=("slides_en",))
            break
        except ValueError as e:
            warnings.append(f"Pass A attempt {en_attempts} failed: {e}")
            print(f"[Pass A] attempt {en_attempts} failed: {e}", file=sys.stderr)
            if en_attempts >= PASS_A_MAX_ATTEMPTS:
                raise
    carousels = en_data["carousels"]

    # ---- Pass B Hebrew (per-carousel, parallel, up to 2 attempts each) ----
    # Pass B used to be a single batched call that authored all carousels'
    # Hebrew at once — splitting it per-carousel lets us run carousels
    # concurrently (~2x faster wall time when n_carousels > 1) and gives each
    # call its own 8K max_tokens budget instead of squeezing every carousel's
    # Hebrew under one cap. Retry budget trimmed 5->2 for the same
    # Trigger.dev 600s reason as Pass A. Prompt caching is shared via
    # system_blocks, so the first carousel's call warms the cache for the rest.
    from types import SimpleNamespace
    PASS_B_MAX_ATTEMPTS = 2

    def _pass_b_one_with_retries(c):
        """Pass B for ONE carousel with up to PASS_B_MAX_ATTEMPTS validation
        retries. Returns (slides_he, usage, duration, error, attempt_count,
        local_warnings)."""
        local_warnings: list[str] = []
        last_error: ValueError | None = None
        local_usage = None
        local_duration = 0
        attempt = 0
        for attempt in range(1, PASS_B_MAX_ATTEMPTS + 1):
            try:
                by_id, usage, duration = _pass_b_hebrew(
                    client, [c], model, he_exemplar_images, system_blocks,
                )
                local_usage = usage
                local_duration = duration
                slides_he = by_id.get(c.get("id"), [])
                md_stripped = sum(_strip_markdown_emphasis(s) for s in slides_he)
                if md_stripped:
                    local_warnings.append(
                        f"Pass B ({c.get('id')}): stripped {md_stripped} markdown "
                        f"emphasis marker(s) from Hebrew slides."
                    )
                test = {"carousels": [{**c, "slides_he": slides_he}]}
                _validate_carousels(
                    test, ref_names, local_warnings,
                    lang_keys=("slides_he",), strict=hebrew_strict,
                )
                return slides_he, local_usage, local_duration, None, attempt, local_warnings
            except ValueError as e:
                last_error = e
                local_warnings.append(
                    f"Pass B ({c.get('id')}) attempt {attempt} failed: {e}"
                )
                print(
                    f"[Pass B / {c.get('id')}] attempt {attempt} failed: {e}",
                    file=sys.stderr,
                )
        return None, local_usage, local_duration, last_error, attempt, local_warnings

    usage_b: object | None = None
    dur_b = 0
    attempts = 1
    if carousels:
        with ThreadPoolExecutor(max_workers=len(carousels)) as ex:
            futs = {ex.submit(_pass_b_one_with_retries, c): c for c in carousels}
            b_results = {futs[f]: f.result() for f in as_completed(futs)}
        any_error: ValueError | None = None
        total_in = 0
        total_out = 0
        cache_read = 0
        cache_creation = 0
        max_dur = 0.0
        max_attempts = 0
        # Merge in carousel order (not completion order) for stable output.
        for c in carousels:
            slides_he, usage, duration, err, attempt_count, b_warnings = b_results[c]
            warnings.extend(b_warnings)
            if usage is not None:
                total_in += getattr(usage, "input_tokens", 0) or 0
                total_out += getattr(usage, "output_tokens", 0) or 0
                cache_read += getattr(usage, "cache_read_input_tokens", 0) or 0
                cache_creation += getattr(usage, "cache_creation_input_tokens", 0) or 0
            max_dur = max(max_dur, float(duration or 0))
            max_attempts = max(max_attempts, attempt_count or 0)
            if err is not None and any_error is None:
                any_error = err
            c["slides_he"] = slides_he or []
        usage_b = SimpleNamespace(
            input_tokens=total_in,
            output_tokens=total_out,
            cache_read_input_tokens=cache_read,
            cache_creation_input_tokens=cache_creation,
        )
        dur_b = max_dur
        attempts = max_attempts or 1
        if any_error is not None:
            # Surface the first failing carousel's error so the caller knows
            # the Hebrew is suspect on at least one carousel.
            raise any_error

    # ---- Pass C — Hebrew quality critic (Sonnet 4.6 against qa-rubric) ----
    # Scores every slide on 7 weighted dimensions. Advisory only — no auto-
    # rewrite. Now batched (1 call per carousel) + parallelized across carousels.
    #
    # Soft deadline: if the caller passed `deadline_at` (a monotonic-clock
    # deadline) and we've already burned through it before reaching Pass C,
    # skip critic entirely and append a warning. Carousels still ship with
    # full EN+HE; only the critic_report is missing — that's the safety valve
    # that guarantees we finish under Trigger.dev's 600s task cap.
    critic_report = None
    usage_c_total = {"input_tokens": 0, "output_tokens": 0}
    dur_c_total = 0
    if knowledge and deadline_at is not None and time.monotonic() > deadline_at:
        warnings.append(
            "Pass C critic skipped: pipeline soft-deadline exceeded "
            "(staying within Trigger.dev's 600s task cap). "
            "Carousels shipped without critic scores; review manually."
        )
        print(
            "[Pass C] SKIPPED — past soft deadline; shipping without critic scores.",
            file=sys.stderr,
        )
    elif knowledge:
        critic_report, usage_c, dur_c = _pass_c_critic(client, carousels, knowledge)
        usage_c_total["input_tokens"] += (usage_c or {}).get("input_tokens", 0) or 0
        usage_c_total["output_tokens"] += (usage_c or {}).get("output_tokens", 0) or 0
        dur_c_total += dur_c or 0

        # Critic only — no auto-rewrite. Scores are persisted on every slide
        # so the dashboard can surface weak ones; manual fixes happen via the
        # /preview chat editor. Skipping the rewrite loop keeps the pipeline
        # within Trigger.dev's free-tier 600s maxDuration.
        if critic_report.get("any_regenerate"):
            n_flagged = sum(
                1
                for c in critic_report.get("carousels", [])
                for s in (c.get("slides") or [])
                if s.get("recommend") != "ship"
            )
            print(
                f"[Pass C] {n_flagged} slide(s) scored < 8 — shipping with "
                f"critic_report attached for human review (no auto-rewrite).",
                file=sys.stderr,
            )
            warnings.append(
                f"Pass C flagged {n_flagged} slide(s) for human review. "
                f"See critic_report on the carousel row in DB."
            )
        else:
            print("[Pass C] all slides ≥ 8.0 — shipping clean.", file=sys.stderr)

    # Enrich sources with metadata from the input transcripts.
    sources = []
    for t in transcripts:
        sources.append({
            "url": t["url"],
            "video_id": t.get("video_id"),
            "title": t.get("title"),
            "channel": t.get("channel"),
            "subscribers": t.get("subscribers"),
            "views": t.get("views"),
            "duration_seconds": t.get("duration_seconds"),
            "upload_date": t.get("upload_date"),
            "engagement_ratio": t.get("engagement_ratio"),
            "transcript_chars": t.get("transcript_chars"),
            "language": t.get("language"),
            "key_points": _extract_key_points_from_transcript(t),
        })

    def _u(u, k):
        return getattr(u, k, None) if u is not None else None

    total_duration = (dur_a or 0) + (dur_b or 0)
    result = {
        "schema_version": SCHEMA_VERSION,
        "query": query,
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "model": model,
        "sources": sources,
        "carousels": carousels,
        "recommendations_for_dashboard": {
            "rendering_notes": (
                "Fonts: Fraunces+Inter (EN), Frank Ruhl Libre+Assistant (HE). "
                "Canvas 1080x1350 portrait."
            ),
            "ref_images_dir": str(REEM_DOCS_DIR / "ref"),
            "brand_handle": "@personalfinancetips",
            "next_carousels_run_suggestion": en_data.get(
                "next_carousels_run_suggestion", ""
            ),
        },
        "critic_report": critic_report,
        "run_stats": {
            "videos_requested": len(transcripts),
            "videos_succeeded": len(transcripts),
            "carousels_requested": n_carousels,
            "carousels_produced": len(carousels),
            "duration_seconds": total_duration + (dur_c_total or 0),
            "duration_pass_a_seconds": dur_a,
            "duration_pass_b_seconds": dur_b,
            "duration_pass_c_seconds": dur_c_total,
            "input_tokens": (_u(usage_a, "input_tokens") or 0) + (_u(usage_b, "input_tokens") or 0) + (usage_c_total.get("input_tokens", 0) or 0),
            "output_tokens": (_u(usage_a, "output_tokens") or 0) + (_u(usage_b, "output_tokens") or 0) + (usage_c_total.get("output_tokens", 0) or 0),
            "cache_read_tokens": (_u(usage_a, "cache_read_input_tokens") or 0) + (_u(usage_b, "cache_read_input_tokens") or 0),
            "cache_creation_tokens": (_u(usage_a, "cache_creation_input_tokens") or 0) + (_u(usage_b, "cache_creation_input_tokens") or 0),
            "hebrew_pass_attempts": attempts,
            "hebrew_strict": hebrew_strict,
            "critic_pass_ran": critic_report is not None,
            "critic_triggered_rewrite": (critic_report or {}).get("round_1") is not None,
        },
    }
    if warnings:
        result["warnings"] = warnings
    return result


def main():
    _force_utf8_streams()
    p = argparse.ArgumentParser(description="Generate carousels from transcripts.")
    p.add_argument("--transcripts", required=True, help="Path to transcripts JSON.")
    p.add_argument("--query", required=True, help="Original user query / topic.")
    p.add_argument("--carousels", type=int, default=2, help="Number of carousels (1-4).")
    p.add_argument("--output", default=None, help="Output JSON path (default: stdout).")
    p.add_argument("--model", default=CAROUSEL_MODEL, help=f"Model id (default: {CAROUSEL_MODEL}).")
    p.add_argument(
        "--hebrew-strict", dest="hebrew_strict", action="store_true", default=True,
        help="Treat Hebrew calque patterns as hard fails with one retry (default).",
    )
    p.add_argument(
        "--no-hebrew-strict", dest="hebrew_strict", action="store_false",
        help="Demote calque patterns to warnings (still hard-fails on הנה/dashes).",
    )
    args = p.parse_args()

    payload = json.loads(Path(args.transcripts).read_text(encoding="utf-8"))
    transcripts = payload.get("transcripts") if isinstance(payload, dict) else payload
    if not transcripts:
        print("No transcripts in input file.", file=sys.stderr)
        sys.exit(1)

    result = generate(
        transcripts, args.query, args.carousels,
        model=args.model, hebrew_strict=args.hebrew_strict,
    )

    if args.output:
        Path(args.output).write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()