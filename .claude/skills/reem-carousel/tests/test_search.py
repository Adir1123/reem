"""Unit tests for search_youtube._to_record (structural only — no network)."""
from __future__ import annotations

from scripts.search_youtube import _to_record, _cutoff


def test_to_record_handles_full_payload():
    info = {
        "id": "abc123",
        "title": "Budget Basics",
        "channel": "FinanceChannel",
        "channel_follower_count": 120_000,
        "view_count": 480_000,
        "duration": 845,
        "upload_date": "20260315",
        "description": "A short description.",
    }
    r = _to_record(info)
    assert r["url"] == "https://youtube.com/watch?v=abc123"
    assert r["video_id"] == "abc123"
    assert r["title"] == "Budget Basics"
    assert r["channel"] == "FinanceChannel"
    assert r["subscribers"] == 120_000
    assert r["views"] == 480_000
    assert r["duration_seconds"] == 845
    assert r["upload_date"] == "2026-03-15"
    assert r["engagement_ratio"] == 4.0
    assert r["description"] == "A short description."


def test_to_record_handles_missing_fields():
    r = _to_record({"id": "x", "title": "T"})
    assert r["url"] == "https://youtube.com/watch?v=x"
    assert r["subscribers"] is None
    assert r["views"] is None
    assert r["duration_seconds"] is None
    assert r["upload_date"] is None
    assert r["engagement_ratio"] is None


def test_to_record_handles_zero_subs():
    r = _to_record({"id": "x", "title": "T", "view_count": 100, "channel_follower_count": 0})
    assert r["engagement_ratio"] is None


def test_cutoff_none_when_no_filter():
    assert _cutoff(0, None) is None
    assert _cutoff(3, 0) is None


def test_cutoff_returns_yyyymmdd_string():
    c = _cutoff(6, None)
    assert c is not None
    assert len(c) == 8 and c.isdigit()
