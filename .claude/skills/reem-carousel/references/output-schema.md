# Output JSON schema — v1

This is the contract between the `reem-carousel` skill and any downstream consumer
(dashboard, QA tool, Instagram scheduler). The skill produces one JSON file per run.

## Top-level

| Field                             | Type                | Notes |
|-----------------------------------|---------------------|-------|
| `schema_version`                  | `int`               | Always `1` for this version. Bump on breaking changes. |
| `query`                           | `string`            | The user-supplied topic, verbatim. |
| `generated_at`                    | `string (ISO-8601)` | UTC timestamp with offset. |
| `model`                           | `string`            | e.g. `claude-opus-4-7`. |
| `sources`                         | `Source[]`          | The scraped YouTube videos used as research. |
| `carousels`                       | `Carousel[]`        | 1–4 carousels, each with EN + HE slides. |
| `recommendations_for_dashboard`   | `Recommendations`   | Advisory hints for renderer/operator. |
| `run_stats`                       | `RunStats`          | Counts + timing for observability. |

## Source

```jsonc
{
  "url": "https://youtube.com/watch?v=...",
  "video_id": "dQw4w9WgXcQ",
  "title": "...",
  "channel": "...",
  "subscribers": 450000,          // nullable
  "views": 1200000,               // nullable
  "duration_seconds": 842,        // nullable
  "upload_date": "2026-03-15",    // YYYY-MM-DD, nullable
  "engagement_ratio": 2.67,       // views/subs, nullable
  "transcript_chars": 14203,
  "language": "en",               // best-effort, nullable
  "key_points": ["...", "...", "..."]  // 3-5 model-extracted bullets
}
```

## Carousel

```jsonc
{
  "id": "c1",
  "concept": "One-line theme",
  "angle": "hook-driven | practical | counter-frame | story | data",
  "source_urls": ["https://..."],
  "slides_en": Slide[7],
  "slides_he": Slide[7]
}
```

Every carousel has **exactly 7 slides** in each language, in the framework order:
HOOK → CONTEXT → BUILD → BUILD → TENSION → PAYOFF → CTA.

## Slide

```jsonc
{
  "n": 1,                          // 1..7
  "role": "HOOK",                  // HOOK | CONTEXT | BUILD | TENSION | PAYOFF | CTA
  "visual_energy": "HIGH",         // HIGH | MEDIUM | LOW
  "eyebrow": "A BETTER APPROACH",  // small gold all-caps label; null on CTA
  "headline": "Most people invest backwards.",
  "headline_italic": "backwards.", // exact substring of headline to render italic-gold (EN)
                                   //   or gold + heaviest weight (HE — no true italic);
                                   //   null on CTA
  "body": "Here's the order that actually works.",
  "body_emphasis": [],             // optional list of words/phrases inside body to gold-highlight
  "step_number": null,             // "01".."07" for numbered-progression slides, else null
  "ref_image": "1.png",            // filename from reem-docs/ref/; null only for CTA
  "visual_direction": "short note for renderer"
}
```

Field notes:
- `eyebrow`: 2–4 uppercase words. Required on every non-CTA slide, `null` on CTA.
- `headline_italic`: MUST be an exact substring of `headline` (the renderer splits on it).
  `null` on CTA. This is the signature focal-emphasis move — one italic-gold phrase per headline.
- `body_emphasis`: empty list if nothing to emphasise. Any listed phrase must appear verbatim in `body`.
- `step_number`: populate only for numbered-progression carousels (e.g., "STEP ONE" / "01" overlay).

CTA slide (n=7) additionally:
- `"ref_image": null`
- `"eyebrow": null`, `"headline_italic": null`, `"step_number": null`
- English headline or body ends with ` @personalfinancetips`
- Hebrew headline or body also ends with ` @personalfinancetips`

The new fields (`eyebrow`, `headline_italic`, `body_emphasis`, `step_number`) are additive —
`schema_version` stays at `1`. Consumers that don't read them get the same v1 shape they
always did.

## Recommendations

```jsonc
{
  "rendering_notes": "Fonts: Fraunces+Inter (EN), Frank Ruhl Libre+Assistant (HE). Canvas 1080x1350.",
  "ref_images_dir": "C:/Users/adirg/CC-projects/reem-v2/reem-docs/ref",
  "brand_handle": "@personalfinancetips",
  "next_carousels_run_suggestion": "Try a counter-framing angle next — e.g., 'debt isn't the villain'."
}
```

## RunStats

```jsonc
{
  "videos_requested": 3,
  "videos_succeeded": 3,
  "carousels_requested": 2,
  "carousels_produced": 2,
  "duration_seconds": 42.1,
  "input_tokens": 31240,
  "output_tokens": 4820,
  "cache_read_tokens": 28120
}
```

## Hebrew text guarantees

For every slide in `slides_he`:
- No `-` (ASCII hyphen-minus).
- No `—` (em-dash) or `–` (en-dash).
- Punctuation placed left of the enclosed text in RTL.
- Numbers in body/headlines use Latin digits when inline.

A downstream validator can sanity-check these with a single regex: `[-\u2010-\u2015]`
(covers U+2010 hyphen through U+2015 horizontal bar, including the non-breaking hyphen U+2011).

## Error / partial modes

If the pipeline partially failed (e.g., 2/3 transcripts succeeded), the run still
produces output with whatever it had. `run_stats.videos_succeeded` tells the dashboard
how much research was actually used. A `warnings: string[]` field appears at top level if
any step was degraded.

## File location

Default path: `./output/<query-slug>-<YYYY-MM-DD-HHMMSS>.json` relative to the skill
root. Callers can override with `--output <path>`.
