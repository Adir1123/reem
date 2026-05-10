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
import os
import re
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Force line-buffered stderr/stdout so [phase] log lines stream live to
# Trigger.dev's run viewer instead of sitting in a pipe buffer until the
# subprocess exits. Without this, `MAX_DURATION_EXCEEDED` kills the script
# with the buffered logs lost — making hangs indistinguishable from slowness.
try:
    sys.stdout.reconfigure(line_buffering=True)  # type: ignore[attr-defined]
    sys.stderr.reconfigure(line_buffering=True)  # type: ignore[attr-defined]
except Exception:
    # Fallback for older Python or wrapped streams
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True,
    )
    sys.stderr = io.TextIOWrapper(
        sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True,
    )

from config import SCHEMA_VERSION  # noqa: E402
from scripts.search_youtube import search  # noqa: E402
from scripts.scrape_transcripts import scrape_many, scrape_one  # noqa: E402
from scripts.generate_carousels import generate  # noqa: E402
from scripts.expand_query import expand as expand_query  # noqa: E402
from scripts.verify_relevance import verify as verify_relevance  # noqa: E402


def _force_utf8_streams():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return s[:60] or "run"


_CHANNELS_PATH = Path(__file__).resolve().parent.parent / "data" / "channels.json"


def _load_channel_lists():
    """Load curated allowlist + blocklist of YouTube finance channels.
    Returns (allowlist, blocklist) as lowercase string sets. Graceful fallback
    to empty sets if the file is missing — pipeline still runs."""
    try:
        data = json.loads(_CHANNELS_PATH.read_text(encoding="utf-8"))
        return (
            {s.lower() for s in data.get("allowlist", [])},
            {s.lower() for s in data.get("blocklist", [])},
        )
    except (FileNotFoundError, json.JSONDecodeError):
        return set(), set()


def _channel_match(channel, names):
    """Case-insensitive substring match — `BiggerPockets Money` matches `BiggerPockets`."""
    if not channel:
        return False
    ch = channel.lower()
    return any(n in ch for n in names)


def _rank_candidates(candidates, query):
    """Score and sort candidates.

    Ranking signals (composite):
      - Title relevance (query keyword overlap)
      - Channel allowlist boost (+10 to relevance for trusted finance channels)
      - Composite engagement: log10(views) * (engagement_ratio + 0.1) * duration_score
        Penalizes Shorts (<3min) and over-long deep-dives (>30min); rewards
        the 8-30min explainer sweet spot.
      - Caption quality (creator-uploaded preferred over auto, when exposed)
      - Recency (newer first)

    Channels on the blocklist are filtered out entirely before scoring.
    """
    import math

    allowlist, blocklist = _load_channel_lists()
    q_terms = [t.lower() for t in re.findall(r"[A-Za-z\u0590-\u05FFA-Za-z0-9]+", query) if len(t) > 2]

    def relevance(c):
        title = (c.get("title") or "").lower()
        score = sum(1 for t in q_terms if t in title)
        if _channel_match(c.get("channel"), allowlist):
            score += 10
        return score

    def engagement_composite(c):
        views = c.get("views") or 0
        ratio = c.get("engagement_ratio") or 0.0
        dur = c.get("duration_seconds") or 0
        if views <= 0:
            return 0.0
        view_score = math.log10(max(views, 10))
        if dur < 60:
            duration_score = 0.2
        elif dur < 3 * 60:
            duration_score = 0.5
        elif dur < 8 * 60:
            duration_score = 0.85
        elif dur <= 30 * 60:
            duration_score = 1.0
        elif dur <= 60 * 60:
            duration_score = 0.85
        else:
            duration_score = 0.7
        return view_score * (ratio + 0.1) * duration_score

    def recency(c):
        d = c.get("upload_date")
        if not d:
            return 0
        try:
            return (datetime.now() - datetime.strptime(d, "%Y-%m-%d")).days * -1
        except ValueError:
            return 0

    def caption_quality(c):
        return 1 if c.get("has_creator_subtitles") is True else 0

    filtered = [c for c in candidates if not _channel_match(c.get("channel"), blocklist)]

    scored = sorted(
        filtered,
        key=lambda c: (
            relevance(c),
            caption_quality(c),
            engagement_composite(c),
            recency(c),
        ),
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


class TopicExhausted(Exception):
    """Raised when all candidate videos for a topic have already been used in
    prior runs. Caller (TS task) catches this and marks the topic exhausted."""

    def __init__(self, query, total_candidates, excluded):
        super().__init__(
            f"All {total_candidates} candidates for {query!r} are in the "
            f"exclusion list ({excluded} ids)."
        )
        self.query = query
        self.total_candidates = total_candidates
        self.excluded = excluded


def run(
    query,
    n_videos=3,
    n_carousels=2,
    *,
    months=6,
    keep_intermediates=False,
    hebrew_strict=True,
    exclude_video_ids=None,
):
    t0 = time.time()
    # Monotonic clock for the soft deadline that Pass C critic checks before
    # running. PIPELINE_DEADLINE_SECONDS defaults to 540s (9 min) to leave a
    # ~60s safety margin under Trigger.dev's free-tier 600s task cap.
    t_mono_start = time.monotonic()
    deadline_at = t_mono_start + float(os.environ.get("PIPELINE_DEADLINE_SECONDS", "540"))
    warnings = []
    exclude_set = set(exclude_video_ids or [])
    # Heartbeat so Trigger.dev's run viewer shows life immediately rather
    # than 10 minutes of silence on a buffered subprocess.
    print(
        f"[pipeline] starting: query={query!r} videos={n_videos} carousels={n_carousels}",
        file=sys.stderr,
        flush=True,
    )

    # 1a. Expand query (Claude Haiku) — turns one topic into 1-2 related
    #     search phrases for broader candidate-pool coverage. Trimmed from 4
    #     to 2 to fit Trigger.dev free-tier 600s maxDuration; each Apify
    #     search costs ~30-60s.
    expanded = expand_query(query, n=2)
    if len(expanded) > 1:
        print(f"[1a/5] Query expansion → {len(expanded)} phrases:", file=sys.stderr)
        for q in expanded:
            print(f"       \u2022 {q}", file=sys.stderr)
    else:
        print(f"[1a/5] Query expansion skipped (using literal query)", file=sys.stderr)

    # 1b. Search each expanded query and merge candidates by video_id.
    #     Parallel fan-out: Apify YouTube searches block ~30-60s each, so
    #     running them concurrently shaves a full search worth of wall-time
    #     off the pipeline (≈30-60s saved per extra expanded query).
    over_fetch = max(10, n_videos * 4) + len(exclude_set)
    candidates_by_id = {}

    def _run_searches(queries, months_window):
        results: dict[str, list | Exception] = {}
        if not queries:
            return results
        with ThreadPoolExecutor(max_workers=len(queries)) as ex:
            futures = {
                ex.submit(search, q, count=over_fetch, months=months_window): q
                for q in queries
            }
            for fut in as_completed(futures):
                q = futures[fut]
                try:
                    results[q] = fut.result()
                except Exception as exc:  # noqa: BLE001
                    results[q] = exc
        return results

    for q, r in _run_searches(expanded, months).items():
        if isinstance(r, Exception):
            warnings.append(f"Search failed for {q!r}: {r}")
            print(f"       search failed for {q!r}: {r}", file=sys.stderr)
            continue
        for rec in r:
            vid = rec.get("video_id")
            if vid and vid not in candidates_by_id:
                candidates_by_id[vid] = rec
    candidates = list(candidates_by_id.values())

    if not candidates:
        print("[1b/5] no results in window, retrying with no date filter", file=sys.stderr)
        warnings.append(f"No results within {months} months; fell back to all-time.")
        for q, r in _run_searches(expanded, 0).items():
            if isinstance(r, Exception):
                continue
            for rec in r:
                vid = rec.get("video_id")
                if vid and vid not in candidates_by_id:
                    candidates_by_id[vid] = rec
        candidates = list(candidates_by_id.values())
    if not candidates:
        raise RuntimeError(f"No YouTube results for {query!r} or its expansions")

    # 1c. Drop already-used video ids (exclusion list from re-runs).
    if exclude_set:
        before = len(candidates)
        candidates = [c for c in candidates if c.get("video_id") not in exclude_set]
        skipped = before - len(candidates)
        print(
            f"[1c/5] {before} candidates merged from {len(expanded)} searches; "
            f"skipped {skipped} previously-used → {len(candidates)} fresh",
            file=sys.stderr,
        )
        if not candidates:
            raise TopicExhausted(query, before, len(exclude_set))
    else:
        print(
            f"[1c/5] {len(candidates)} candidates merged from {len(expanded)} searches",
            file=sys.stderr,
        )

    # 2. Rank with allowlist + composite engagement metric.
    print(f"[2/5] Ranking + selecting (channel allowlist + composite engagement)", file=sys.stderr)
    scored = _rank_candidates(candidates, query)

    # 3+4. Iterative scrape + relevance verify. Walk the ranked list, scrape
    #      each candidate; if scrape fails OR relevance < 7, skip and try
    #      the next. Stop when we have n_videos accepted, or run out of
    #      candidates with channel diversity preference.
    from scripts.scrape_transcripts import scrape_one as _scrape_one
    from apify_client import ApifyClient
    from config import APIFY_TRANSCRIPT_ACTOR, require_apify_token

    apify = ApifyClient(require_apify_token())

    accepted = []
    seen_channels = set()
    failures = []
    relevance_drops = []
    # Pre-scrape the top K candidates in parallel so per-video Apify latency
    # (~30-60s each, blocking) collapses to the slowest video instead of summing.
    # K is sized with slack on top of n_videos so channel-diversity / relevance
    # drops still have alternates without falling back to serial scraping.
    SCRAPE_POOL_SIZE = min(len(scored), n_videos + 3)
    scrape_pool = scored[:SCRAPE_POOL_SIZE]
    print(
        f"[3a/5] Scraping top {len(scrape_pool)} candidates in parallel "
        f"(target {n_videos})",
        file=sys.stderr,
    )
    scrapes_by_url: dict = {}
    if scrape_pool:
        with ThreadPoolExecutor(max_workers=len(scrape_pool)) as _ex:
            _futs = {
                _ex.submit(scrape_one, apify, v["url"], APIFY_TRANSCRIPT_ACTOR): v["url"]
                for v in scrape_pool
            }
            for _fut in as_completed(_futs):
                _url = _futs[_fut]
                try:
                    scrapes_by_url[_url] = _fut.result()
                except Exception as _exc:  # noqa: BLE001
                    scrapes_by_url[_url] = _exc
                    print(
                        f"       scrape failed: {_url} - {_exc}",
                        file=sys.stderr,
                    )
    cursor = 0
    print(f"[3b/5] Selecting accepted videos in rank order", file=sys.stderr)
    while len(accepted) < n_videos and cursor < len(scrape_pool):
        v = scrape_pool[cursor]
        cursor += 1
        ch = (v.get("channel") or "").lower()
        # Channel-diversity preference: skip if we already accepted this channel,
        # but allow on a second pass if we run out of unique channels.
        if ch and ch in seen_channels and len(scrape_pool) - cursor > (n_videos - len(accepted)):
            continue
        url = v["url"]
        ratio = v.get("engagement_ratio")
        ratio_s = f"{ratio:.2f}x" if ratio else "N/A"
        print(
            f"       try [{cursor}/{len(scored)}] [{ratio_s}] {v['title']}  \u2014  {v['channel']}",
            file=sys.stderr,
        )
        try:
            _res = scrapes_by_url.get(url)
            if isinstance(_res, Exception):
                raise _res
            if _res is None:
                raise RuntimeError("no scrape result")
            t = _res
        except Exception as e:  # noqa: BLE001
            print(f"         \u00d7 scrape failed: {e}", file=sys.stderr)
            failures.append({"url": url, "error": str(e)})
            continue
        # Relevance gate (Haiku, ~$0.0005/call) — only verify the first 2
        # scrapes per run to fit the 600s budget. Subsequent scrapes are
        # trusted (ranking + allowlist already filtered hard).
        verify_budget_used = sum(1 for a in accepted if a.get("_relevance", {}).get("score") is not None)
        if verify_budget_used < 2:
            verdict = verify_relevance(t.get("transcript", ""), query)
            v_score = verdict.get("score")
            v_reason = verdict.get("reason")
            if (v_score or 0) < 7:
                print(
                    f"         \u00d7 relevance {v_score} \u2014 {v_reason}",
                    file=sys.stderr,
                )
                relevance_drops.append({
                    "url": url,
                    "score": v_score,
                    "reason": v_reason,
                })
                continue
            merged = {**v, **t, "_relevance": verdict}
            t_chars = t.get("transcript_chars", 0)
            print(
                f"         \u2713 relevance {v_score} \u2014 transcript {t_chars} chars",
                file=sys.stderr,
            )
        else:
            merged = {**v, **t, "_relevance": {"score": None, "reason": "not_verified_budget"}}
            t_chars = t.get("transcript_chars", 0)
            print(
                f"         \u2713 scraped (relevance not verified, budget) \u2014 transcript {t_chars} chars",
                file=sys.stderr,
            )
        accepted.append(merged)
        if ch:
            seen_channels.add(ch)

    # Fallback: if the parallel pool exhausted with too few accepts (rare —
    # e.g. multiple relevance drops), walk the rest of the ranked list
    # serially. Preserves the original TopicExhausted / warnings semantics.
    if len(accepted) < n_videos and len(scored) > len(scrape_pool):
        print(
            f"[3c/5] Pool exhausted with {len(accepted)}/{n_videos} accepts; "
            f"falling back to serial scrape on "
            f"{len(scored) - len(scrape_pool)} remaining candidates",
            file=sys.stderr,
        )
        for v in scored[len(scrape_pool):]:
            if len(accepted) >= n_videos:
                break
            ch = (v.get("channel") or "").lower()
            url = v["url"]
            try:
                t = scrape_one(apify, url, actor=APIFY_TRANSCRIPT_ACTOR)
            except Exception as exc:  # noqa: BLE001
                failures.append({"url": url, "error": str(exc)})
                continue
            merged = {**v, **t, "_relevance": {"score": None, "reason": "not_verified_budget"}}
            accepted.append(merged)
            if ch:
                seen_channels.add(ch)

    if failures:
        warnings.extend(f"Transcript failed: {f['url']} ({f['error']})" for f in failures)
    if relevance_drops:
        warnings.extend(
            f"Relevance dropped: {d['url']} (score {d['score']}: {d['reason']})"
            for d in relevance_drops
        )
    if not accepted:
        raise RuntimeError(
            "No candidates passed scrape + relevance verification. "
            f"Tried {cursor}/{len(scored)} candidates."
        )
    if len(accepted) < n_videos:
        warnings.append(
            f"Only {len(accepted)}/{n_videos} candidates passed scrape + verify; "
            f"proceeding with what we have."
        )
    transcripts = accepted

    # 5. Generate — three-pass: EN, HE re-author, HE critic.
    print(
        f"[5/5] Generating carousels \u2014 Pass A (EN) + Pass B (HE) + Pass C (critic). "
        f"{n_carousels} carousel(s). hebrew_strict={hebrew_strict}",
        file=sys.stderr,
    )
    result = generate(
        transcripts, query, n_carousels,
        hebrew_strict=hebrew_strict, deadline_at=deadline_at,
    )
    result["run_stats"]["videos_requested"] = n_videos
    result["run_stats"]["videos_succeeded"] = len(transcripts)
    result["run_stats"]["query_expansions"] = len(expanded)
    result["run_stats"]["scrape_failures"] = len(failures)
    result["run_stats"]["relevance_drops"] = len(relevance_drops)
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
    p.add_argument(
        "--exclude-video-ids", default="",
        help="Comma-separated YouTube video_ids to skip (used by re-runs to "
             "avoid pulling tips from videos that already produced carousels).",
    )
    args = p.parse_args()
    exclude_video_ids = [
        v.strip() for v in args.exclude_video_ids.split(",") if v.strip()
    ]

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
            exclude_video_ids=exclude_video_ids,
        )
    except TopicExhausted as e:
        # Structured signal — TS task catches this from stdout JSON and marks
        # the topic as 'exhausted' rather than a generic failure.
        payload = {
            "error": "topic_exhausted",
            "query": e.query,
            "total_candidates": e.total_candidates,
            "excluded": e.excluded,
        }
        print(f"PIPELINE EXHAUSTED: {e}", file=sys.stderr)
        print(json.dumps(payload, ensure_ascii=False))
        sys.exit(0)
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
