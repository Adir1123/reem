#!/usr/bin/env python3
"""Query expansion via Claude — turns a single user topic into 3-5 related
YouTube search phrases for parallel searching.

The pipeline calls `expand("401k")` → `["401k for beginners", "401k vs Roth
IRA", "401k contribution limits 2025", "401k employer match strategies",
"401k early withdrawal"]`. Each gets searched independently; results are
merged + deduped by video_id before ranking.

Why: a single literal search misses adjacent angles ("retirement accounts",
"tax-advantaged investing"). Expansion improves candidate-pool breadth
without compromising relevance — Claude knows what's semantically close to
the user's topic.

Cost: one Haiku call per pipeline run (~$0.001). Cheap.

Usage (CLI):
  python expand_query.py "401k for self-employed"
  → prints one expanded query per line on stdout

Usage (import):
  from scripts.expand_query import expand
  queries = expand("401k for self-employed", n=4)
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import require_anthropic_key  # noqa: E402

EXPANSION_MODEL = "claude-haiku-4-5"

_SYSTEM = (
    "You are a search-strategy assistant for a personal-finance content "
    "research pipeline. Given one user topic, produce N related YouTube "
    "search phrases that would each surface high-quality finance videos "
    "adjacent to the topic. Each phrase must:\n"
    "- Be a natural search query a real user might type\n"
    "- Stay within personal finance / investing / retirement / debt domain\n"
    "- Cover a DIFFERENT angle (definition, comparison, mistakes, mechanics, audience)\n"
    "- Be 2-7 words\n"
    "- Be in English (YouTube search works best in English)\n\n"
    "Return JSON: {\"queries\": [\"...\", \"...\", ...]}. No prose."
)


def _force_utf8_streams():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


def expand(topic: str, n: int = 4) -> list[str]:
    """Return [original_topic, ...n-1 related queries]. Falls back to just
    the original on any failure — caller's pipeline keeps working."""
    if not topic or not topic.strip():
        return []
    topic = topic.strip()
    fallback = [topic]
    if n <= 1:
        return fallback

    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=require_anthropic_key())
        resp = client.messages.create(
            model=EXPANSION_MODEL,
            max_tokens=500,
            system=_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Topic: {topic}\n\n"
                        f"Produce {n - 1} related search phrases that cover "
                        f"different angles (the original topic is already "
                        f"in the search set, do not repeat it). Return JSON only."
                    ),
                }
            ],
        )
        raw = "".join(
            b.text for b in resp.content if getattr(b, "type", None) == "text"
        ).strip()
        # Strip code fences if Claude wrapped the JSON.
        if raw.startswith("```"):
            raw = raw.strip("`").lstrip("json").strip()
        data = json.loads(raw)
        queries = data.get("queries", [])
        if not isinstance(queries, list):
            return fallback
        # Normalize + dedupe (case-insensitive) keeping the topic first.
        out = [topic]
        seen = {topic.lower()}
        for q in queries:
            if not isinstance(q, str):
                continue
            q = q.strip()
            if not q or q.lower() in seen:
                continue
            out.append(q)
            seen.add(q.lower())
            if len(out) >= n:
                break
        return out
    except Exception as e:  # noqa: BLE001 — never fail the pipeline on expansion
        print(f"[expand_query] failed ({e}); falling back to original only", file=sys.stderr)
        return fallback


def main():
    _force_utf8_streams()
    if len(sys.argv) < 2:
        print("Usage: expand_query.py <topic> [n=4]", file=sys.stderr)
        sys.exit(1)
    topic = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    for q in expand(topic, n=n):
        print(q)


if __name__ == "__main__":
    main()
