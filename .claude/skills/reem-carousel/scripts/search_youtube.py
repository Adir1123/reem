#!/usr/bin/env python3
"""YouTube search via yt-dlp.

Two output modes:
  - Default: human-readable divider-separated results (good for Claude Code)
  - --json:  NDJSON on stdout, one video per line (for run_pipeline.py)

Adapted from the yt-search skill (C:/Users/adirg/CC-projects/ai-assistant/
.claude/skills/yt-search/scripts/search.py). Same selection math; new JSON
mode and extra structured fields (engagement_ratio, duration_seconds).
"""
from __future__ import annotations

import io
import json
import shutil
import subprocess
import sys
from datetime import datetime, timedelta


def _force_utf8_streams():
    """Only called when run as __main__ — rewiring stdout at import time breaks pytest capture."""
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


def parse_args(argv):
    args = argv[1:]
    count = 20
    months = 6
    days = None
    json_mode = False
    query_parts = []
    i = 0
    while i < len(args):
        if args[i] == "--count" and i + 1 < len(args):
            count = int(args[i + 1]); i += 2
        elif args[i] == "--months" and i + 1 < len(args):
            months = int(args[i + 1]); i += 2
        elif args[i] == "--days" and i + 1 < len(args):
            days = int(args[i + 1]); i += 2
        elif args[i] == "--no-date-filter":
            months = 0; i += 1
        elif args[i] == "--json":
            json_mode = True; i += 1
        else:
            query_parts.append(args[i]); i += 1
    query = " ".join(query_parts)
    if not query:
        print(
            "Usage: search_youtube.py <query> "
            "[--count N] [--months N] [--days N] [--no-date-filter] [--json]",
            file=sys.stderr,
        )
        sys.exit(1)
    return query, count, months, days, json_mode


def _duration_seconds(info):
    dur = info.get("duration")
    if dur is None:
        return None
    try:
        return int(dur)
    except (TypeError, ValueError):
        return None


def _format_duration(info):
    if info.get("duration_string"):
        return info["duration_string"]
    dur = _duration_seconds(info)
    if dur is None:
        return "N/A"
    h, rem = divmod(dur, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def _format_date(raw):
    if not raw or len(raw) != 8:
        return "N/A"
    try:
        return datetime.strptime(raw, "%Y%m%d").strftime("%b %d, %Y")
    except ValueError:
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"


def _iso_date(raw):
    if not raw or len(raw) != 8:
        return None
    try:
        return datetime.strptime(raw, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        return None


def _format_subs(n):
    if n is None:
        return "N/A"
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}K"
    return str(n)


def _format_views(n):
    return f"{n:,}" if n is not None else "N/A"


def _cutoff(months, days):
    if days is not None:
        if days <= 0:
            return None
        return (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
    if months <= 0:
        return None
    return (datetime.now() - timedelta(days=months * 30)).strftime("%Y%m%d")


def _to_record(info):
    """Normalise a yt-dlp info dict into our structured schema."""
    video_id = info.get("id", "")
    views = info.get("view_count")
    subs = info.get("channel_follower_count")
    engagement = round(views / subs, 4) if (views and subs and subs > 0) else None
    return {
        "url": f"https://youtube.com/watch?v={video_id}" if video_id else None,
        "video_id": video_id,
        "title": info.get("title") or "Unknown Title",
        "channel": info.get("channel") or info.get("uploader") or "Unknown",
        "subscribers": subs,
        "views": views,
        "duration_seconds": _duration_seconds(info),
        "upload_date": _iso_date(info.get("upload_date")),
        "engagement_ratio": engagement,
        "description": (info.get("description") or "")[:500],
    }


def search(query, count=20, months=6, days=None):
    """Return a list of normalised video records. Raises RuntimeError on failure."""
    if not shutil.which("yt-dlp"):
        raise RuntimeError("yt-dlp not found on PATH. pip install yt-dlp.")
    fetch = count * 3 if days is not None else (count * 2 if months > 0 else count)
    cmd = [
        "yt-dlp",
        f"ytsearch{fetch}:{query}",
        "--dump-json",
        "--no-download",
        "--no-warnings",
        "--quiet",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Search timed out after 180 seconds.")
    if result.returncode != 0 and not result.stdout.strip():
        raise RuntimeError(f"yt-dlp failed: {result.stderr.strip()}")

    videos = []
    for line in result.stdout.strip().splitlines():
        if not line.strip():
            continue
        try:
            videos.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    cutoff = _cutoff(months, days)
    if cutoff:
        videos = [v for v in videos if (v.get("upload_date") or "00000000") >= cutoff]

    return [_to_record(v) for v in videos[:count]]


def main():
    _force_utf8_streams()
    query, count, months, days, json_mode = parse_args(sys.argv)

    if json_mode:
        # Programmatic mode — stderr gets progress; stdout gets NDJSON.
        print(f"Searching YouTube for: \"{query}\" (top {count})...", file=sys.stderr)
        try:
            records = search(query, count, months, days)
        except RuntimeError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        if not records:
            print("No results found.", file=sys.stderr)
            sys.exit(0)
        for r in records:
            print(json.dumps(r, ensure_ascii=False))
        return

    # Human-readable mode (Claude Code default).
    label_days = f", last {days} day{'s' if days != 1 else ''}" if days else ""
    label_months = f", last {months} months" if (months > 0 and days is None) else ""
    label = label_days or label_months
    print(f"Searching YouTube for: \"{query}\" (top {count}{label})...\n", file=sys.stderr)

    try:
        records = search(query, count, months, days)
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if not records:
        print("No results found.", file=sys.stderr)
        sys.exit(0)

    divider = "\u2500" * 60
    for i, r in enumerate(records, 1):
        dur_display = (
            f"{r['duration_seconds']//60}:{r['duration_seconds']%60:02d}"
            if r["duration_seconds"] is not None else "N/A"
        )
        meta = (
            f"{r['channel']} ({_format_subs(r['subscribers'])} subs)  \u00b7  "
            f"{_format_views(r['views'])} views  \u00b7  "
            f"{dur_display}  \u00b7  "
            f"{_format_date(r['upload_date'].replace('-', '') if r['upload_date'] else '')}"
        )
        ratio = f"{r['engagement_ratio']:.2f}x" if r["engagement_ratio"] else "N/A"
        print(divider)
        print(f" {i:>2}. {r['title']}")
        print(f"     {meta}")
        if ratio != "N/A":
            print(f"     Engagement: {ratio} views/subs")
        print(f"     {r['url']}")
    print(divider)


if __name__ == "__main__":
    main()
