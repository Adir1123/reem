#!/usr/bin/env python3
"""Render a carousel JSON output as a brand-aware HTML preview.

Why: Windows terminals butcher Hebrew, and eyeballing RTL text + the new
design-language fields (eyebrow, italic-gold emphasis, body emphasis,
step-number, corner chrome) only makes sense visually. This writes a
self-contained HTML file (Google Fonts via <link>, no server) and opens it
in the default browser. Each slide renders as a ~270x340 miniature close
enough in spirit to the reference exemplars for a quick sanity check.

This is NOT the production renderer. The future dashboard does the real
1080x1350 output; this file just makes the JSON legible.

Usage:
  python scripts/preview.py                       # preview the newest output
  python scripts/preview.py path/to/output.json   # preview a specific file
"""
from __future__ import annotations

import argparse
import html
import json
import webbrowser
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = SKILL_ROOT / "output"
REF_DIR = Path("C:/Users/adirg/CC-projects/reem-v2/reem-docs/ref")

NAVY = "#0F1B2D"
CREAM = "#F5EFE4"
GOLD = "#C9A34A"
HANDLE = "@personalfinancetips"


def _latest_output() -> Path:
    files = sorted(OUTPUT_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        raise SystemExit(f"No JSON files in {OUTPUT_DIR}")
    return files[0]


def _headline_html(headline: str, italic_span: str | None, lang: str) -> str:
    """Escape headline, then wrap the italic_span substring in a styled span.

    EN: italic + gold. HE: gold + heaviest weight (Frank Ruhl Libre has no
    true italic). italic_span must be an exact substring of headline; if
    it's missing or not found, we fall back to plain escaped text.
    """
    safe_headline = html.escape(headline or "")
    if not italic_span:
        return safe_headline
    safe_span = html.escape(italic_span)
    if safe_span not in safe_headline:
        return safe_headline
    css_class = "hl-emph-he" if lang == "he" else "hl-emph-en"
    replacement = f'<span class="{css_class}">{safe_span}</span>'
    # Replace only the first occurrence — the italic span is a single focal point.
    return safe_headline.replace(safe_span, replacement, 1)


def _body_html(body: str, emphasis: list[str] | None) -> str:
    """Escape body, then wrap each emphasis phrase in a gold span.

    Emphasis phrases that don't appear in the body are silently skipped —
    the validator already warns about those at generation time.
    """
    safe_body = html.escape(body or "")
    if not emphasis:
        return safe_body.replace("\n", "<br>")
    for phrase in emphasis:
        if not phrase:
            continue
        safe_phrase = html.escape(phrase)
        if safe_phrase in safe_body:
            safe_body = safe_body.replace(
                safe_phrase, f'<span class="body-gold">{safe_phrase}</span>', 1
            )
    return safe_body.replace("\n", "<br>")


def _slide_card(slide: dict, slide_total: int, lang: str) -> str:
    n = slide.get("n", "?")
    role = (slide.get("role") or "").upper()
    eyebrow = slide.get("eyebrow")
    headline = slide.get("headline") or ""
    italic_span = slide.get("headline_italic")
    body = slide.get("body") or ""
    emphasis = slide.get("body_emphasis") or []
    step = slide.get("step_number")
    ref = slide.get("ref_image")
    visual = slide.get("visual_direction") or ""

    dir_attr = "rtl" if lang == "he" else "ltr"
    is_cta = role == "CTA"

    # Background: navy by default, layered under ref_image if present.
    bg_layer = ""
    if ref and not is_cta:
        ref_uri = (REF_DIR / ref).as_uri()
        bg_layer = (
            f'<div class="bg-img" style="background-image:url({ref_uri!r});"></div>'
            f'<div class="bg-shade"></div>'
        )

    # Eyebrow: small gold bar + uppercase label. Hidden on CTA.
    eyebrow_html = ""
    if eyebrow and not is_cta:
        eyebrow_html = (
            f'<div class="eyebrow"><span class="bar"></span>'
            f'<span class="eb-text">{html.escape(eyebrow)}</span></div>'
        )

    # Step-number overlay (top-right opposite corner PFT mark).
    step_html = f'<div class="step-num">{html.escape(step)}</div>' if step else ""

    # Headline + body — CTA gets a pill-button treatment.
    if is_cta:
        # CTA headline is the hero line; the pill uses the handle literally.
        headline_html = f'<div class="cta-headline">{html.escape(headline)}</div>'
        body_html = f'<div class="cta-body">{html.escape(body)}</div>' if body else ""
        pill_html = (
            f'<div class="cta-pill">{html.escape("→ " + HANDLE)}</div>'
        )
        inner = f"{headline_html}{body_html}{pill_html}"
    else:
        hl_class = "headline headline-he" if lang == "he" else "headline headline-en"
        hl_inner = _headline_html(headline, italic_span, lang)
        body_inner = _body_html(body, emphasis)
        inner = (
            f'{eyebrow_html}'
            f'<div class="{hl_class}">{hl_inner}</div>'
            f'<div class="body">{body_inner}</div>'
        )

    counter = f"{int(n):02d} / {slide_total:02d}" if isinstance(n, int) else f"{n} / {slide_total:02d}"

    meta = (
        f'<div class="slide-meta">'
        f'<span class="role-pill">{html.escape(role or "—")}</span>'
        f'<span class="energy">{html.escape(slide.get("visual_energy") or "")}</span>'
        f'<span class="ref-name">{html.escape(ref or "no ref")}</span>'
        f'</div>'
    )

    visual_note = (
        f'<div class="visual-note">{html.escape(visual)}</div>' if visual else ""
    )

    return f"""
    <figure class="slide-wrap {'cta' if is_cta else ''}" dir="{dir_attr}">
      <div class="slide slide-{lang}">
        {bg_layer}
        <div class="corner corner-tr">PFT</div>
        {step_html}
        <div class="slide-inner">{inner}</div>
        <div class="corner corner-bl">{html.escape(HANDLE)}</div>
        <div class="corner corner-br">{counter}</div>
      </div>
      {meta}
      {visual_note}
    </figure>
    """


def _carousel_block(c: dict) -> str:
    cid = html.escape(c.get("id", ""))
    concept = html.escape(c.get("concept", ""))
    angle = html.escape(c.get("angle", ""))
    slides_en = c.get("slides_en", []) or []
    slides_he = c.get("slides_he", []) or []
    en = "\n".join(_slide_card(s, len(slides_en), "en") for s in slides_en)
    he = "\n".join(_slide_card(s, len(slides_he), "he") for s in slides_he)
    return f"""
    <section class="carousel">
      <h2><span class="cid">{cid}</span> <span class="concept">{concept}</span>
        <span class="angle">{angle}</span></h2>
      <div class="lang-grid">
        <div class="lang-col">
          <h3>English</h3>
          <div class="slide-row">{en}</div>
        </div>
        <div class="lang-col">
          <h3>עברית</h3>
          <div class="slide-row">{he}</div>
        </div>
      </div>
    </section>
    """


def render(data: dict) -> str:
    query = html.escape(data.get("query", ""))
    model = html.escape(data.get("model", ""))
    stats = data.get("run_stats", {}) or {}
    warnings = data.get("warnings") or []
    warn_html = ""
    if warnings:
        items = "\n".join(f"<li>{html.escape(w)}</li>" for w in warnings)
        warn_html = f'<div class="warnings"><strong>Warnings</strong><ul>{items}</ul></div>'
    carousels = "\n".join(_carousel_block(c) for c in data.get("carousels", []) or [])
    sources = "\n".join(
        f'<li><a href="{html.escape(s["url"])}">{html.escape(s.get("title",""))}</a>'
        f' <span class="src-meta">— {html.escape(s.get("channel",""))}</span></li>'
        for s in data.get("sources", []) or []
    )
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Carousel preview — {query}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;0,9..144,800;1,9..144,700;1,9..144,800&family=Inter:wght@400;500;700&family=Frank+Ruhl+Libre:wght@500;700;900&family=Assistant:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  :root {{
    --navy: {NAVY};
    --cream: {CREAM};
    --gold: {GOLD};
    --slide-w: 270px;
    --slide-h: 340px;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    font-family: Inter, -apple-system, Segoe UI, system-ui, sans-serif;
    background: #efe7d6; color: var(--navy);
    margin: 0; padding: 32px;
  }}
  header {{ border-bottom: 2px solid var(--navy); padding-bottom: 16px; margin-bottom: 24px; }}
  header h1 {{ margin: 0; font-family: Fraunces, serif; font-weight: 800; font-size: 28px; }}
  header .meta {{ color: #555; font-size: 13px; margin-top: 6px; }}
  .warnings {{ background: #fff3cd; border-left: 4px solid #e0a800; padding: 12px 16px; margin: 16px 0; }}
  .warnings ul {{ margin: 6px 0 0 18px; padding: 0; }}

  section.carousel {{ margin: 40px 0; }}
  section.carousel h2 {{
    background: var(--navy); color: var(--cream);
    padding: 12px 20px; margin: 0; border-radius: 6px;
    font-family: Fraunces, serif; font-weight: 700; font-size: 18px;
    display: flex; gap: 14px; align-items: baseline;
  }}
  section.carousel h2 .cid {{ color: var(--gold); font-weight: 800; }}
  section.carousel h2 .angle {{ color: #9db0c8; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-left: auto; }}

  .lang-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px; }}
  .lang-col h3 {{
    margin: 0 0 12px; font-size: 11px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--gold); font-weight: 700;
  }}
  .slide-row {{
    display: flex; gap: 14px; overflow-x: auto;
    padding-bottom: 8px;
  }}
  .slide-row::-webkit-scrollbar {{ height: 8px; }}
  .slide-row::-webkit-scrollbar-thumb {{ background: #c8bfa8; border-radius: 4px; }}

  .slide-wrap {{ margin: 0; flex: 0 0 var(--slide-w); }}
  .slide {{
    position: relative; width: var(--slide-w); height: var(--slide-h);
    background: var(--navy); border-radius: 12px; overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    color: var(--cream);
    display: flex; flex-direction: column;
  }}
  .bg-img {{
    position: absolute; inset: 0;
    background-size: cover; background-position: center;
    filter: saturate(0.85);
    opacity: 0.55;
  }}
  .bg-shade {{
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(15,27,45,0.35) 0%, rgba(15,27,45,0.75) 100%);
  }}

  .corner {{
    position: absolute; font-size: 9px; letter-spacing: 2px;
    color: var(--gold); font-weight: 700;
    text-transform: uppercase; z-index: 2;
  }}
  .corner-tr {{ top: 12px; right: 12px; font-family: Fraunces, serif; font-size: 11px; letter-spacing: 3px; }}
  .corner-bl {{ bottom: 12px; left: 12px; font-family: Inter; font-weight: 600; letter-spacing: 1px; text-transform: none; }}
  .corner-br {{ bottom: 12px; right: 12px; font-family: Inter; font-weight: 600; color: var(--cream); opacity: 0.7; }}
  .slide[dir="rtl"] .corner-bl {{ left: auto; right: 12px; }}
  .slide[dir="rtl"] .corner-br {{ right: auto; left: 12px; }}
  .slide[dir="rtl"] .corner-tr {{ right: auto; left: 12px; }}

  .step-num {{
    position: absolute; top: 36px; right: 14px;
    font-family: Fraunces, serif; font-weight: 800;
    font-size: 44px; color: var(--gold); opacity: 0.85;
    line-height: 1; z-index: 2;
  }}
  .slide[dir="rtl"] .step-num {{ right: auto; left: 14px; }}

  .slide-inner {{
    position: relative; z-index: 2;
    padding: 42px 18px 42px;
    display: flex; flex-direction: column; gap: 10px;
    justify-content: center; flex: 1;
  }}

  .eyebrow {{ display: flex; align-items: center; gap: 8px; font-size: 9px; letter-spacing: 3px; color: var(--gold); font-weight: 700; text-transform: uppercase; }}
  .eyebrow .bar {{ display: inline-block; width: 16px; height: 2px; background: var(--gold); }}

  .headline {{
    font-family: Fraunces, serif;
    font-weight: 800; font-size: 20px; line-height: 1.15;
    color: var(--cream); margin: 2px 0 0;
  }}
  .headline-he {{
    font-family: "Frank Ruhl Libre", serif;
    font-weight: 700; font-size: 21px; line-height: 1.25;
  }}
  .hl-emph-en {{ font-style: italic; color: var(--gold); }}
  .hl-emph-he {{ font-weight: 900; color: var(--gold); font-style: normal; }}

  .body {{
    font-family: Inter, sans-serif; font-weight: 400;
    font-size: 12px; line-height: 1.5; color: var(--cream);
    opacity: 0.92;
  }}
  .slide[dir="rtl"] .body {{ font-family: Assistant, sans-serif; font-size: 13px; }}
  .body-gold {{ color: var(--gold); font-weight: 700; }}

  /* CTA slide — solid navy, gold pill button */
  .slide-wrap.cta .slide .bg-img,
  .slide-wrap.cta .slide .bg-shade {{ display: none; }}
  .cta-headline {{
    font-family: Fraunces, serif; font-weight: 800;
    font-size: 22px; line-height: 1.2; color: var(--cream);
    text-align: center;
  }}
  .slide[dir="rtl"] .cta-headline {{ font-family: "Frank Ruhl Libre", serif; font-weight: 700; }}
  .cta-body {{ font-size: 12px; color: var(--cream); text-align: center; opacity: 0.85; }}
  .cta-pill {{
    margin: 16px auto 0; display: inline-block; align-self: center;
    background: var(--gold); color: var(--navy);
    padding: 9px 16px; border-radius: 999px;
    font-family: Inter, sans-serif; font-weight: 700; font-size: 12px;
    letter-spacing: 0.5px;
  }}

  .slide-meta {{
    display: flex; gap: 8px; margin-top: 8px; font-size: 10px;
    text-transform: uppercase; letter-spacing: 1px; color: #666;
    flex-wrap: wrap;
  }}
  .role-pill {{ color: var(--gold); font-weight: 700; }}
  .ref-name {{ margin-left: auto; color: #888; letter-spacing: 0.5px; text-transform: none; }}
  .slide-wrap[dir="rtl"] .slide-meta {{ direction: ltr; }}
  .visual-note {{
    font-size: 10px; color: #777; font-style: italic;
    margin-top: 4px; line-height: 1.4;
    max-width: var(--slide-w);
  }}
  .slide-wrap[dir="rtl"] .visual-note {{ direction: rtl; text-align: right; }}

  aside.sources {{ background: #fff; padding: 16px 20px; border-radius: 8px; margin-top: 40px; }}
  aside.sources h2 {{ margin-top: 0; font-size: 15px; font-family: Fraunces, serif; }}
  aside.sources ul {{ padding-left: 18px; margin: 0; }}
  aside.sources li {{ margin-bottom: 4px; font-size: 13px; }}
  aside.sources .src-meta {{ color: #777; font-size: 11px; }}
</style>
</head>
<body>
<header>
  <h1>Carousel preview</h1>
  <div class="meta">Query: <strong>{query}</strong>  ·  Model: {model}
    ·  {stats.get('carousels_produced','?')} carousels
    ·  {stats.get('videos_succeeded','?')} sources
    ·  {stats.get('duration_seconds', stats.get('total_pipeline_seconds','?'))}s
  </div>
</header>
{warn_html}
{carousels}
<aside class="sources">
  <h2>Sources</h2>
  <ul>{sources}</ul>
</aside>
</body>
</html>"""


def main():
    p = argparse.ArgumentParser(description="Render a carousel JSON as an HTML preview.")
    p.add_argument("path", nargs="?", help="Path to carousel JSON. Defaults to newest file in output/.")
    p.add_argument("--no-open", action="store_true", help="Just write the HTML file, don't open it.")
    args = p.parse_args()

    json_path = Path(args.path) if args.path else _latest_output()
    data = json.loads(json_path.read_text(encoding="utf-8"))
    html_path = json_path.with_suffix(".html")
    html_path.write_text(render(data), encoding="utf-8")
    print(f"Wrote {html_path}")
    if not args.no_open:
        webbrowser.open(html_path.as_uri())


if __name__ == "__main__":
    main()
