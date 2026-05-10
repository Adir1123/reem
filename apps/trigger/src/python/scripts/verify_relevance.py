#!/usr/bin/env python3
"""Post-scrape relevance verification via Claude Haiku.

After a transcript is scraped, this script asks Haiku: "does this transcript
actually address {topic}? 1-10". Transcripts scoring < 7 are dropped — the
pipeline picks the next-best candidate.

Why: ranking by title + engagement gets us most of the way, but occasionally
a high-engagement video has a misleading title or covers the topic only
tangentially. A single Haiku call (~$0.0005) protects the rest of the
pipeline from feeding garbage to Pass A.

Usage (CLI):
  echo "topic text" | python verify_relevance.py "401k contribution limits"
  → prints {"score": 8, "reason": "..."} on stdout

Usage (import):
  from scripts.verify_relevance import verify
  result = verify(transcript, topic)  # returns {"score": int, "reason": str}
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import require_anthropic_key  # noqa: E402

VERIFY_MODEL = "claude-haiku-4-5"

_SYSTEM = (
    "You are a relevance auditor for a personal-finance content research "
    "pipeline. Given a topic and a transcript excerpt, score 1-10 how well "
    "the transcript actually addresses that topic.\n\n"
    "Scoring:\n"
    "  10 = the transcript IS about the topic, in depth\n"
    "  8-9 = the transcript covers the topic substantially\n"
    "  6-7 = topic is mentioned but most of the content is adjacent\n"
    "  3-5 = brief tangential mention only\n"
    "  1-2 = does not cover the topic at all\n\n"
    "You are forced to call the `verdict` tool — do not write prose."
)

_TOOL = {
    "name": "verdict",
    "description": "Return relevance score 1-10 plus one-sentence reason.",
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["score", "reason"],
        "properties": {
            "score": {"type": "integer", "minimum": 1, "maximum": 10},
            "reason": {"type": "string"},
        },
    },
}

# Truncate transcripts before sending — first 6000 chars is ample for relevance.
_MAX_TRANSCRIPT_CHARS = 6000


def _force_utf8_streams():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


def verify(transcript: str, topic: str) -> dict:
    """Returns {"score": int 1-10, "reason": str}. On any failure, returns
    {"score": 8, "reason": "verifier_unavailable"} — caller's pipeline keeps
    working (better to ship potentially-irrelevant than to crash)."""
    if not transcript or not transcript.strip():
        return {"score": 1, "reason": "empty transcript"}
    if not topic or not topic.strip():
        return {"score": 8, "reason": "no topic provided"}

    excerpt = transcript[:_MAX_TRANSCRIPT_CHARS]

    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=require_anthropic_key())
        resp = client.messages.create(
            model=VERIFY_MODEL,
            max_tokens=300,
            system=_SYSTEM,
            tools=[_TOOL],
            tool_choice={"type": "tool", "name": "verdict"},
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Topic: {topic}\n\n"
                        f"Transcript excerpt (first {len(excerpt)} chars):\n\n"
                        f"{excerpt}"
                    ),
                }
            ],
        )
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == "verdict":
                inp = getattr(block, "input", None) or {}
                score = int(inp.get("score") or 0)
                reason = str(inp.get("reason") or "")
                return {"score": max(1, min(10, score)), "reason": reason}
        return {"score": 8, "reason": "no_tool_call_returned"}
    except Exception as e:  # noqa: BLE001
        return {"score": 8, "reason": f"verifier_unavailable: {e}"}


def main():
    _force_utf8_streams()
    if len(sys.argv) < 2:
        print('Usage: echo "<transcript>" | verify_relevance.py "<topic>"', file=sys.stderr)
        sys.exit(1)
    topic = sys.argv[1]
    transcript = sys.stdin.read()
    result = verify(transcript, topic)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
