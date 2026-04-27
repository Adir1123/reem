#!/usr/bin/env python3
"""YouTube search via Apify (replaces yt-dlp-based search).

Why Apify: yt-dlp is blocked from datacenter IPs by YouTube's bot challenge,
which kills the pipeline when run on Trigger.dev workers. Apify's
streamers/youtube-scraper handles proxying and bot-detection upstream.

Drop-in replacement for the previous yt-dlp version: same `search()` signature,
same output schema. run_pipeline.py is untouched.

Two output modes:
  - Default: human-readable divider-separated results
  - --json:  NDJSON on stdout, one video per line
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
from datetime import datetime, timedelta

from apify_client import ApifyClient


YOUTUBE_SCRAPER_ACTOR = "streamers/youtube-scraper"


def _force_utf8_streams():
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


# ---------- helpers (mostly unchanged from yt-dlp version) ----------

def _format_duration_seconds(seconds):
    if seconds is None:
        return "N/A"
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


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


def _format_date_iso(iso):
    if not iso:
        return "N/A"
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%b %d, %Y")
    except ValueError:
        return iso


# ---------- Apify-specific parsing ----------

def _parse_duration_str(s):
    """Apify returns duration like '12:34' or '1:02:33' or sometimes seconds."""
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return int(s)
    if isinstance(s, str):
        s = s.strip()
        if s.isdigit():
            return int(s)
        parts = s.split(":")
        try:
            parts = [int(p) for p in parts]
        except ValueError:
            return None
        if len(parts) == 3:
            h, m, sec = parts
            return h * 3600 + m * 60 + sec
        if len(parts) == 2:
            m, sec = parts
            return m * 60 + sec
        if len(parts) == 1:
            return parts[0]
    return None


def _parse_iso_date(s):
    """Apify date can be '2024-09-15', '2024-09-15T...', or relative like '3 weeks ago'.
    Return YYYY-MM-DD or None."""
    if not s:
        return None
    if isinstance(s, str):
        # Absolute ISO date.
        m = re.match(r"^(\d{4}-\d{2}-\d{2})", s)
        if m:
            return m.group(1)
        # Relative (e.g. '3 weeks ago')
        m = re.match(r"^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago", s.lower())
        if m:
            n, unit = int(m.group(1)), m.group(2)
            multipliers = {
                "second": 1 / 86400, "minute": 1 / 1440, "hour": 1 / 24,
                "day": 1, "week": 7, "month": 30, "year": 365,
            }
            days_ago = n * multipliers[unit]
            return (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
    return None


def _months_to_date_filter(months, days):
    """Map our months/days filter to streamers/youtube-scraper's `dateFilter` enum.
    Valid values: 'hour', 'today', 'week', 'month', 'year', or None (no filter)."""
    if days is not None:
        if days <= 0:
            return None
        if days <= 1:
            return "today"
        if days <= 7:
            return "week"
        if days <= 31:
            return "month"
        return "year"
    if months <= 0:
        return None
    if months <= 1:
        return "month"
    if months <= 12:
        return "year"
    return None


def _to_record(item):
    """Normalise an Apify YouTube Scraper dataset item into our schema."""
    video_id = item.get("id") or ""
    if not video_id and item.get("url"):
        m = re.search(r"[?&]v=([\w-]+)", item["url"])
        if m:
            video_id = m.group(1)

    views = item.get("viewCount") or item.get("views")
    subs = item.get("numberOfSubscribers") or item.get("channelSubscribers")
    try:
        views = int(views) if views is not None else None
    except (TypeError, ValueError):
        views = None
    try:
        subs = int(subs) if subs is not None else None
    except (TypeError, ValueError):
        subs = None

    engagement = round(views / subs, 4) if (views and subs and subs > 0) else None

    duration = _parse_duration_str(item.get("duration"))
    upload_date = _parse_iso_date(item.get("date") or item.get("uploadDate"))
    channel = item.get("channelName") or item.get("channel") or "Unknown"

    url = item.get("url")
    if not url and video_id:
        url = f"https://youtube.com/watch?v={video_id}"

    return {
        "url": url,
        "video_id": video_id,
        "title": item.get("title") or "Unknown Title",
        "channel": channel,
        "subscribers": subs,
        "views": views,
        "duration_seconds": duration,
        "upload_date": upload_date,
        "engagement_ratio": engagement,
        "description": (item.get("text") or item.get("description") or "")[:500],
    }


# ---------- main entrypoint ----------

def search(query, count=20, months=6, days=None):
    """Return a list of normalised video records. Raises RuntimeError on failure."""
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        raise RuntimeError("APIFY_TOKEN env var is not set.")

    # Over-fetch: Apify's date filtering is bucketed (week/month/year), so we
    # need extra headroom to apply our own precise day-level cutoff afterwards.
    fetch = count * 3 if days is not None else (count * 2 if months > 0 else count)

    run_input = {
        "searchKeywords": query,
        "maxResults": fetch,
        "maxResultsShorts": 0,
        "maxResultStreams": 0,
        "proxyConfiguration": {"useApifyProxy": True},
    }
    date_filter = _months_to_date_filter(months, days)
    if date_filter:
        run_input["dateFilter"] = date_filter

    try:
        client = ApifyClient(token)
        actor_run = client.actor(YOUTUBE_SCRAPER_ACTOR).call(
            run_input=run_input, timeout_secs=300
        )
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Apify YouTube Scraper failed: {e}")

    if not actor_run or not actor_run.get("defaultDatasetId"):
        raise RuntimeError("Apify run finished without a dataset.")

    items = client.dataset(actor_run["defaultDatasetId"]).list_items().items

    records = [_to_record(it) for it in items if it]

    # Precise day-level cutoff (Apify's filter is week/month/year-bucketed).
    if days is not None and days > 0:
        cutoff_iso = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        records = [r for r in records if (r.get("upload_date") or "0000-00-00") >= cutoff_iso]
    elif months > 0:
        cutoff_iso = (datetime.now() - timedelta(days=months * 30)).strftime("%Y-%m-%d")
        records = [r for r in records if (r.get("upload_date") or "0000-00-00") >= cutoff_iso]

    # Drop any without a video_id — they're useless downstream.
    records = [r for r in records if r.get("video_id")]

    return records[:count]


def main():
    _force_utf8_streams()
    query, count, months, days, json_mode = parse_args(sys.argv)

    if json_mode:
        print(f"Searching YouTube for: \"{query}\" (top {count}) via Apify...", file=sys.stderr)
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

    label_days = f", last {days} day{'s' if days != 1 else ''}" if days else ""
    label_months = f", last {months} months" if (months > 0 and days is None) else ""
    label = label_days or label_months
    print(f"Searching YouTube for: \"{query}\" (top {count}{label}) via Apify...\n", file=sys.stderr)

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
        dur_display = _format_duration_seconds(r["duration_seconds"])
        meta = (
            f"{r['channel']} ({_format_subs(r['subscribers'])} subs)  \u00b7  "
            f"{_format_views(r['views'])} views  \u00b7  "
            f"{dur_display}  \u00b7  "
            f"{_format_date_iso(r['upload_date'])}"
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