#!/usr/bin/env python3
"""Scrape YouTube transcripts via Apify.

Default actor: pintostudio/youtube-transcript-scraper (cheap + transcript-only).
Override with env var APIFY_TRANSCRIPT_ACTOR if you want a different actor.

Per-URL error handling: if one video fails, we skip it and continue. Pipeline
succeeds if at least one transcript comes back.

Usage:
  python scrape_transcripts.py --urls URL1 URL2 URL3 [--output transcripts.json]
  python scrape_transcripts.py --urls-file urls.txt --output transcripts.json

stdin mode:
  cat urls.json | python scrape_transcripts.py --stdin --output transcripts.json
  (expects NDJSON records from search_youtube.py --json)
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

# Make this runnable either as a module (python -m scripts.scrape_transcripts)
# or as a script (python scripts/scrape_transcripts.py).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import APIFY_TRANSCRIPT_ACTOR, require_apify_token  # noqa: E402


def _force_utf8_streams():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


def _segments_to_text(items):
    """Normalise transcript data across the common actor output shapes.

    Shapes seen in the wild:
      1. pintostudio (current):  [{"data": [{"text": "...", "start": "...", "dur": "..."}, ...]}]
      2. flat segments:          [{"text": "...", "start": 0, "dur": 2.3}, ...]
      3. single-transcript blob: [{"transcript": "full text ..."}]
      4. captions wrapper:       [{"captions": [{"text": "..."}, ...]}]
    """
    if not items:
        return ""
    # Auto-unwrap the {"data": [...]} envelope.
    flat = []
    for it in items:
        if isinstance(it, dict) and isinstance(it.get("data"), list):
            flat.extend(it["data"])
        else:
            flat.append(it)
    parts = []
    for it in flat:
        if not isinstance(it, dict):
            continue
        if "text" in it and isinstance(it["text"], str):
            parts.append(it["text"])
        elif "transcript" in it and isinstance(it["transcript"], str):
            parts.append(it["transcript"])
        elif "captions" in it and isinstance(it["captions"], list):
            parts.extend(
                c.get("text", "") for c in it["captions"] if isinstance(c, dict)
            )
    return "\n".join(p.strip() for p in parts if p and p.strip())


def scrape_one(client, url, actor=APIFY_TRANSCRIPT_ACTOR):
    """Run the Apify actor for one URL. Returns dict or raises on failure."""
    # pintostudio's documented input key is "videoUrl" (singular).
    run_input = {"videoUrl": url}
    run = client.actor(actor).call(run_input=run_input, timeout_secs=180)
    if not run or not run.get("defaultDatasetId"):
        raise RuntimeError(f"Apify run missing dataset for {url}")
    items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
    transcript = _segments_to_text(items)
    if not transcript:
        raise RuntimeError(f"Empty transcript for {url}")
    # Language hint — check top-level or the "data" envelope
    language = None
    for it in items:
        if not isinstance(it, dict):
            continue
        if it.get("language"):
            language = it["language"]; break
        if it.get("lang"):
            language = it["lang"]; break
    return {
        "url": url,
        "transcript": transcript,
        "transcript_chars": len(transcript),
        "language": language,
        "segment_count": transcript.count("\n") + 1 if transcript else 0,
    }


def scrape_many(urls, actor=APIFY_TRANSCRIPT_ACTOR):
    from apify_client import ApifyClient
    token = require_apify_token()
    client = ApifyClient(token)
    results = []
    failures = []
    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] Scraping: {url}", file=sys.stderr)
        try:
            results.append(scrape_one(client, url, actor))
            print(
                f"  ok — {results[-1]['transcript_chars']} chars",
                file=sys.stderr,
            )
        except Exception as e:  # noqa: BLE001 — want to keep going on per-video errors
            print(f"  FAILED: {e}", file=sys.stderr)
            failures.append({"url": url, "error": str(e)})
    return results, failures


def _read_urls_from_args(args):
    if args.urls:
        return list(args.urls)
    if args.urls_file:
        return [
            line.strip()
            for line in Path(args.urls_file).read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        ]
    if args.stdin:
        urls = []
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                if isinstance(rec, dict) and rec.get("url"):
                    urls.append(rec["url"])
            except json.JSONDecodeError:
                # Fall back to treating the raw line as a URL
                urls.append(line)
        return urls
    return []


def main():
    _force_utf8_streams()
    p = argparse.ArgumentParser(description="Scrape YouTube transcripts via Apify.")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--urls", nargs="+", help="YouTube URLs, space-separated.")
    g.add_argument("--urls-file", help="File with one URL per line.")
    g.add_argument(
        "--stdin", action="store_true",
        help="Read NDJSON or bare URLs from stdin (pipe from search_youtube.py --json).",
    )
    p.add_argument(
        "--output", default=None,
        help="Write results to this JSON file (default: stdout).",
    )
    p.add_argument(
        "--actor", default=APIFY_TRANSCRIPT_ACTOR,
        help=f"Apify actor slug (default: {APIFY_TRANSCRIPT_ACTOR}).",
    )
    args = p.parse_args()

    urls = _read_urls_from_args(args)
    if not urls:
        p.error("No URLs provided. Use --urls, --urls-file, or --stdin.")

    results, failures = scrape_many(urls, actor=args.actor)

    payload = {
        "actor": args.actor,
        "requested": len(urls),
        "succeeded": len(results),
        "failed": len(failures),
        "transcripts": results,
        "failures": failures,
    }

    if args.output:
        Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote {args.output}  ({len(results)}/{len(urls)} succeeded)", file=sys.stderr)
    else:
        print(json.dumps(payload, ensure_ascii=False, indent=2))

    if not results:
        sys.exit(1)


if __name__ == "__main__":
    main()
