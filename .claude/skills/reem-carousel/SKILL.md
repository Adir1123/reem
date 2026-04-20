---
name: reem-carousel
description: End-to-end Instagram carousel pipeline for the Personal Finance Tips brand — researches YouTube, scrapes transcripts with Apify, then produces strict-JSON carousels in English + natural native-speaker Hebrew (no AI-slop, no dashes) following the 7-slide framework. Use this skill whenever the user asks to "make a carousel", "generate Hebrew carousels", "research a topic and turn it into Instagram content", "build carousel JSON for the dashboard", or anything along the lines of "take topic X and give me reem-style carousels". Also trigger on Hebrew phrasing like "תכין קרוסלות על", "מחקר לקרוסלה", "קרוסלה לאינסטגרם". This skill outputs JSON only — no PNG rendering, no dashboard code. If the user asks for rendered slides or dashboard pages, produce the JSON and hand it off.
---

# reem-carousel

Takes a topic, researches YouTube, scrapes transcripts via Apify, and produces a JSON file
containing 1–4 Instagram carousels in English + native-speaker Hebrew. Every carousel
follows the 7-slide framework in `reem-docs/carousel-framework.md` exactly.

## Two ways to run

**Interactive (default for Claude Code sessions, including this one):** follow the 6 steps
below. You (the assistant) do the research and generation yourself using your own tools —
Bash for search/scrape, Read for brand docs, vision for ref images, then write the JSON
directly. Faster feedback loop; human can course-correct mid-run.

**Headless (for the dashboard / cron):** the operator runs
`python scripts/run_pipeline.py --query "<topic>"` which does all six steps in one process
and writes the JSON to `./output/`. Same output contract.

The rest of this document describes the interactive flow.

## Pre-flight — once per session

Ensure these tools/paths exist. One Bash call:

```
python -c "import yt_dlp, apify_client, anthropic, dotenv; print('ok')"
```

If that fails, tell the user to run:

```
pip install -r "C:/Users/adirg/CC-projects/reem-v2/.claude/skills/reem-carousel/requirements.txt"
```

Then stop until they confirm.

## Step 1 — Parse intent

Extract the topic from the user's message. Examples:

- "make carousels about emergency funds" → `emergency fund`
- "תכין קרוסלות על חיסכון" → `saving money` (craft the actual YouTube search query in
  whichever language is likelier to return high-quality finance content — usually English
  even for Hebrew output, because finance YouTube is English-dominant)
- "research high-yield savings accounts for the dashboard" → `high-yield savings accounts`

Pick sensible defaults unless the user overrides:

- `n_videos = 3` — enough for cross-source validation, cheap on Apify credits
- `n_carousels = 2` — one hook-driven, one practical. A/B surface for the dashboard user

Only ask a clarifying question if the topic is genuinely unparseable (e.g. "make me some
carousels"). Otherwise proceed.

## Step 2 — Search YouTube

Run:

```
python C:/Users/adirg/CC-projects/reem-v2/.claude/skills/reem-carousel/scripts/search_youtube.py "<query>" --count 10
```

Show the full results to the user. They came to you for research — they should see what
was found before you narrow it down.

If zero results, retry with `--no-date-filter` or a broader query, one retry only.

## Step 3 — Auto-select the videos (NO USER INPUT)

Immediately pick `n_videos` from the results. Do not ask "which ones?". Rank by:

1. **Relevance** — title/description matches the topic
2. **Engagement ratio** (views÷subs) — outliers = quality signal
3. **Recency** — prefer newer when the rest is comparable
4. **Depth** — prefer ≥ 8 min (richer transcripts)
5. **Channel diversity** — avoid picking two videos from the same channel

Tell the user which ones you picked and why, in 1–2 sentences per pick. Then continue.

## Step 4 — Scrape transcripts with Apify

Run:

```
python C:/Users/adirg/CC-projects/reem-v2/.claude/skills/reem-carousel/scripts/scrape_transcripts.py \
    --urls <url1> <url2> <url3> \
    --output /tmp/reem-transcripts.json
```

If some videos fail, keep going with whatever succeeded. The pipeline only hard-fails if
**zero** transcripts came back.

Tell the user: "Scraped N/M transcripts — M chars total" so they have a feel for how much
research the carousels are actually sitting on.

## Step 5 — Generate the carousels yourself (interactive path — two passes)

This is where you do the thinking. Do NOT shell out to `generate_carousels.py` —
that script is for the headless path. You have better tools here: Read + vision directly.

Mirror the headless pipeline: **Pass A authors English. Pass B re-authors Hebrew
from the idea.** The two-pass split is load-bearing — a single combined pass slides
into translation mode and the Hebrew reads like a translated finance blog, not like
an Israeli talking to a friend. Keep them separate.

### Shared reading (once)

Before either pass, read the brand inputs (Read tool):

- `C:/Users/adirg/CC-projects/reem-v2/reem-docs/Brand_Prompt_for_AI.md`
- `C:/Users/adirg/CC-projects/reem-v2/reem-docs/carousel-framework.md`
- `C:/Users/adirg/CC-projects/reem-v2/reem-docs/hebrew-typography.md`

### Pass A — English

1. **Study the English exemplar carousel** —
   `C:/Users/adirg/CC-projects/reem-v2/reem-docs/output-referance/slide_1.png` through
   `slide_7.png`. Read each with the Read tool so your vision kicks in. This is a
   **fully rendered reference carousel** — the design target. Note the gold all-caps
   eyebrow above each headline, the single italic-gold emphasis phrase in every headline,
   the corner chrome (PFT mark, handle, slide counter), and the gold pill-button CTA on
   slide 7. **These are NOT a pool** — never put `slide_N.png` in a slide's `ref_image`.
2. **Look at every style-pool image** in `C:/Users/adirg/CC-projects/reem-v2/reem-docs/ref/`
   (1.png, 2.png, 3.png, 4.png, 5.png, ref.png, nano_banana_pro.png). Use the Read tool
   on each. This pool is what `ref_image` values pick from, one per non-CTA slide,
   no reuse inside a carousel.
3. **Read the Pass A prompt template** at
   `C:/Users/adirg/CC-projects/reem-v2/.claude/skills/reem-carousel/references/carousel-prompt-template.md`
   — the exact rules, the 7-slide framework table, the design-language spec (eyebrow /
   italic-gold emphasis / body emphasis / step-number fields), and the English output
   contract. Follow it to the letter.
4. **Author each carousel in English only** — build the `slides_en` array (7 slides per
   carousel). Every non-CTA slide needs `eyebrow` + `headline_italic` (with
   `headline_italic` an exact substring of `headline`). Leave `slides_he: []` empty.

### Pass B — Hebrew re-author

Open a **fresh author frame**. You are not translating. You are an Israeli copywriter
in your 30s, raised in Tel Aviv, writing for `@personalfinancetips` — authoring in
Hebrew from the same ideas Pass A captured, the way you'd say it to a friend who just
texted asking about money.

1. **Study the Hebrew voice exemplar carousel** —
   `C:/Users/adirg/CC-projects/reem-v2/reem-docs/hebrew-output-referances/slide_he_1.png`
   through `slide_he_7.png`. Read each with the Read tool. This is the **voice target**:
   short clauses, active voice, Tel Aviv Instagram register, no openers, no calque,
   no formality creep. Your Hebrew slides must read like these — not like translations
   of the English.
2. **Read the Pass B prompt** at
   `C:/Users/adirg/CC-projects/reem-v2/.claude/skills/reem-carousel/references/hebrew-reauthor-prompt.md`
   — persona framing, hard bans (dashes, `הנה` openers, `באמת` headline qualifier,
   calque grammar), and the Hebrew output contract.
3. **Re-author each carousel's Hebrew** from the English insight, not the English text.
   For each slide: copy the design metadata verbatim (`n`, `role`, `visual_energy`,
   `ref_image`, `step_number`, `visual_direction`), then author `eyebrow`, `headline`,
   `headline_italic`, `body`, `body_emphasis` fresh in Hebrew. If a slide can't come
   out native, rewrite the idea more aggressively — a preserved calque is worse than
   an idea pushed harder.
4. **Self-check before writing the JSON**: grep every `slides_he` body/headline for
   the banned list. Any `הנה` at the start of a sentence? Any `-`, `—`, `–`? Any
   `באמת` inside a headline? Any parallel `-ים/-ות` passive pair? If yes, rewrite the
   offending slide before saving.

### Save

Write the combined result as a JSON file at `output/<slug>-<timestamp>.json`
using the schema in `references/output-schema.md`. The final JSON carries both
`slides_en` and the Pass B `slides_he` for each carousel.

### The non-negotiables (summarised — the full list is in the prompt template)

- Exactly 7 slides per carousel, in order: HOOK → CONTEXT → BUILD → BUILD → TENSION → PAYOFF → CTA.
- Each non-CTA slide has a `ref_image` from the **style pool** (`reem-docs/ref/*.png`),
  never from `reem-docs/output-referance/` (those are design targets, not pickable assets).
- No ref image repeated within a single carousel.
- Every non-CTA slide has `eyebrow` (2–4 uppercase words) + `headline_italic`
  (exact substring of `headline`).
- Slide 7 headline or body ends with `@personalfinancetips` (both languages).
- English: 6-word headline max, 3-line body max, plain language.
- Hebrew: **re-authored, not translated** (Pass B). Native speaker register.
  Hard fails: `-` / `—` / `–` of any flavour, `הנה` at the start of any sentence.
  No `אז` / `בעצם` / `למעשה` / `בסופו של דבר` / `לכן` openers. No `באמת` inside a
  headline (it's calqued "really"). No parallel `-ים/-ות` passive pairs. Numbers
  in Latin digits. Punctuation on the left in RTL.
- Never paste transcript sentences verbatim. Synthesise ideas, reframe, compress.

## Step 6 — Hand off

Print:

- The path to the JSON file.
- A one-line summary of each carousel's concept (in English, so the operator can scan).
- The `next_carousels_run_suggestion` — a counter-frame or follow-up angle the operator
  could run next to keep content fresh.

Then tell the user what a downstream dashboard would do with this JSON — see
`references/output-schema.md` for the contract.

## When to use the headless path instead

If the user says anything like:

- "run this as a cron"
- "wire this into the dashboard"
- "I don't want to babysit it"
- "run it in the background"

…use `scripts/run_pipeline.py` instead of the interactive flow. Same output, different entry point.

## Autonomy rules (mirrors yt-pipeline)

- Run the whole pipeline automatically once you've parsed intent.
- Only pause on: (a) truly unparseable topic, (b) preflight failure (missing deps),
  (c) all-videos-failed on scrape.
- Never ask the user to pick videos. That's step 3's job.
- Show progress on stderr: "Searching…", "Scraping 2/3…", "Generating…". No silent gaps.

## Cost + latency rough guide

- yt-dlp: free, ~5s
- Apify pintostudio actor: ~$0.002/video (3 videos ≈ $0.006/run), ~10–30s each
- Claude Opus 4.7: one call per run, with prompt caching on the brand docs + ref images
  (cached read on runs after the first-in-5-min). Typically ~30–60s wall clock.

Total: ~1–2 minutes wall clock, cents in API spend.

## Files in this skill

- `SKILL.md` — you are here
- `config.py` — env loader (APIFY_TOKEN, ANTHROPIC_API_KEY from reem/.env)
- `scripts/search_youtube.py` — yt-dlp search, human + `--json` modes
- `scripts/scrape_transcripts.py` — Apify transcript scraping
- `scripts/generate_carousels.py` — headless Anthropic call (only for run_pipeline.py)
- `scripts/run_pipeline.py` — end-to-end for the dashboard / cron
- `references/carousel-prompt-template.md` — the exact prompt + rules
- `references/output-schema.md` — JSON contract with the dashboard
- `tests/` — unit tests (pytest)
- `evals/evals.json` — skill-creator test prompts

## Dashboard hand-off

The dashboard's backend should:

1. Call `python scripts/run_pipeline.py --query "<customer input>" --videos 3 --carousels 2 --output <dashboard storage path>`
2. Read the resulting JSON.
3. Render PNGs at 1080×1350 using Fraunces+Inter (EN) and Frank Ruhl Libre+Assistant (HE),
   using ref images from `reem-docs/ref/` per slide assignment.
4. Present both language versions; the operator picks.

This skill stays stateless and framework-agnostic. It never touches the dashboard's DB,
UI, auth, or deployment.
