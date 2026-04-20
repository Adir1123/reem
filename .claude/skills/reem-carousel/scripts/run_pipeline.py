#!/usr/bin/env python3
"""End-to-end carousel generation pipeline.

    query  ──►  search_youtube (yt-dlp)
           ──►  auto-select top N
           ──►  scrape_transcripts (Apify)
           ──►  generate_carousels (Anthropic Opus 4.7)
           ──►  JSON on disk

This is the single entrypoint a dashboard/cron should call. SKILL.md documents the
equivalent interactive flow for Claude Code.

Usage:
  python run_pipeline.py --query "finance tips"
  python run_pipeline.py --query "debt payoff" --videos 3 --carousels 2 \
      --output ./output/debt-payoff.json --keep-intermediates
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import SCHEMA_VERSION  # noqa: E402
from scripts.search_youtube import search  # noqa: E402
from scripts.scrape_transcripts import scrape_many  # noqa: E402
from scripts.generate_carousels import generate  # noqa: E402


def _force_utf8_streams():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return s[:60] or "run"


def _rank_candidates(candidates, query):
    """Score and sort candidates. Priority: relevance → engagement → recency → depth → diversity."""
    q_terms = [t.lower() for t in re.findall(r"[A-Za-z\u0590-\u05FFA-Za-z0-9]+", query) if len(t) > 2]

    def relevance(c):
        title = (c.get("title") or "").lower()
        return sum(1 for t in q_terms if t in title)

    def engagement(c):
        return c.get("engagement_ratio") or 0.0

    def recency(c):
        d = c.get("upload_date")
        if not d:
            return 0
        try:
            return (datetime.now() - datetime.strptime(d, "%Y-%m-%d")).days * -1
        except ValueError:
            return 0

    def depth(c):
        dur = c.get("duration_seconds") or 0
        return 1 if dur >= 8 * 60 else 0

    scored = sorted(
        candidates,
        key=lambda c: (relevance(c), engagement(c), depth(c), recency(c)),
        reverse=True,
    )
    return scored


def _pick_diverse(scored, n):
    """Take top N while avoiding duplicate channels where possible."""
    picks = []
    seen_channels = set()
    for c in scored:
        ch = c.get("channel")
        if ch in seen_channels:
            continue
        picks.append(c)
        seen_channels.add(ch)
        if len(picks) >= n:
            return picks
    # If we couldn't fill via unique channels, fill from the rest.
    for c in scored:
        if c in picks:
            continue
        picks.append(c)
        if len(picks) >= n:
            return picks
    return picks


def run(query, n_videos=3, n_carousels=2, *, months=6, keep_intermediates=False, hebrew_strict=True):
    t0 = time.time()
    warnings = []

    # 1. Search — over-fetch so we have room to filter for diversity/depth.
    print(f"[1/4] Searching YouTube for: {query!r}", file=sys.stderr)
    candidates = search(query, count=max(10, n_videos * 4), months=months)
    # Evergreen finance content is often older than 6 months; fall back once.
    if not candidates:
        print("       no results in window, retrying with no date filter", file=sys.stderr)
        warnings.append(f"No results within {months} months; fell back to all-time.")
        candidates = search(query, count=max(10, n_videos * 4), months=0)
    if not candidates:
        raise RuntimeError(f"No YouTube results for {query!r}")
    print(f"       got {len(candidates)} candidates", file=sys.stderr)

    # 2. Rank + select.
    print(f"[2/4] Auto-selecting top {n_videos} videos", file=sys.stderr)
    scored = _rank_candidates(candidates, query)
    selected = _pick_diverse(scored, n_videos)
    for i, v in enumerate(selected, 1):
        ratio = v.get("engagement_ratio")
        ratio_s = f"{ratio:.2f}x" if ratio else "N/A"
        print(
            f"       {i}. [{ratio_s}] {v['title']}  —  {v['channel']}",
            file=sys.stderr,
        )

    # 3. Scrape.
    print(f"[3/4] Scraping transcripts via Apify", file=sys.stderr)
    scraped, failures = scrape_many([v["url"] for v in selected])
    if failures:
        warnings.extend(f"Transcript failed: {f['url']} ({f['error']})" for f in failures)
    if not scraped:
        raise RuntimeError("All transcript scrapes failed — nothing to feed the model.")
    # Merge scraped transcript into the selected metadata (by URL).
    by_url = {t["url"]: t for t in scraped}
    transcripts = []
    for v in selected:
        t = by_url.get(v["url"])
        if not t:
            continue
        transcripts.append({**v, **t})

    # 4. Generate — two-pass: EN first, then HE re-author.
    print(
        f"[4/4] Calling Opus 4.7 — two-pass (EN then HE re-author). "
        f"{n_carousels} carousel(s). hebrew_strict={hebrew_strict}",
        file=sys.stderr,
    )
    result = generate(transcripts, query, n_carousels, hebrew_strict=hebrew_strict)
    result["run_stats"]["videos_requested"] = n_videos
    result["run_stats"]["videos_succeeded"] = len(transcripts)
    if warnings:
        existing = result.get("warnings", [])
        result["warnings"] = existing + warnings

    result["run_stats"]["total_pipeline_seconds"] = round(time.time() - t0, 1)
    return result


def _default_output_path(query, out_dir):
    slug = _slugify(query)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    return out_dir / f"{slug}-{stamp}.json"


def main():
    _force_utf8_streams()
    p = argparse.ArgumentParser(description="Research YouTube → carousels (EN+HE) JSON.")
    p.add_argument("--query", required=True, help="Topic, e.g. 'finance tips'.")
    p.add_argument("--videos", type=int, default=3, help="Videos to scrape (default 3).")
    p.add_argument("--carousels", type=int, default=2, help="Carousels to produce (default 2).")
    p.add_argument("--months", type=int, default=6, help="Date filter window in months.")
    p.add_argument("--output", default=None, help="Explicit output path; else ./output/<slug>-<ts>.json.")
    p.add_argument(
        "--keep-intermediates", action="store_true",
        help="Write search + transcript intermediates next to the final output.",
    )
    p.add_argument(
        "--hebrew-strict", dest="hebrew_strict", action="store_true", default=True,
        help="Treat Hebrew calque patterns as hard fails with one retry (default).",
    )
    p.add_argument(
        "--no-hebrew-strict", dest="hebrew_strict", action="store_false",
        help="Demote calque patterns to warnings (still hard-fails on הנה/dashes).",
    )
    args = p.parse_args()

    if not 1 <= args.carousels <= 4:
        p.error("--carousels must be between 1 and 4.")
    if not 1 <= args.videos <= 10:
        p.error("--videos must be between 1 and 10.")

    skill_root = Path(__file__).resolve().parent.parent
    default_out_dir = skill_root / "output"
    default_out_dir.mkdir(exist_ok=True)
    output_path = Path(args.output) if args.output else _default_output_path(args.query, default_out_dir)

    try:
        result = run(
            args.query,
            n_videos=args.videos,
            n_carousels=args.carousels,
            months=args.months,
            hebrew_strict=args.hebrew_strict,
        )
    except Exception as e:  # noqa: BLE001
        print(f"PIPELINE FAILED: {e}", file=sys.stderr)
        sys.exit(1)

    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {output_path}", file=sys.stderr)
    print(
        f"  schema_version={result['schema_version']}  "
        f"carousels={result['run_stats']['carousels_produced']}  "
        f"sources={result['run_stats']['videos_succeeded']}  "
        f"duration={result['run_stats'].get('total_pipeline_seconds','?')}s",
        file=sys.stderr,
    )
    if result.get("warnings"):
        print(f"  warnings: {len(result['warnings'])}", file=sys.stderr)
        for w in result["warnings"]:
            print(f"    - {w}", file=sys.stderr)

    # Echo the full JSON to stdout so a subprocess caller can just capture it if it wants to.
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
