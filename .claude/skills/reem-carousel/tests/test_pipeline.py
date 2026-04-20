"""Unit tests for run_pipeline ranking + generate_carousels validation (no network)."""
from __future__ import annotations

import pytest

from scripts.generate_carousels import (
    HEBREW_BANNED,
    _extract_json,
    _validate_carousels,
)
from scripts.run_pipeline import _pick_diverse, _rank_candidates, _slugify


# ------------ slug ------------

def test_slugify_basic():
    assert _slugify("Finance Tips!") == "finance-tips"
    assert _slugify("  חיסכון בכסף  ") == "run"  # non-ASCII collapses
    assert _slugify("") == "run"


# ------------ ranking ------------

def _c(title, ratio, dur=600, date="2026-04-10", channel="x"):
    return {
        "title": title,
        "engagement_ratio": ratio,
        "duration_seconds": dur,
        "upload_date": date,
        "channel": channel,
    }


def test_rank_puts_relevant_titles_first():
    query = "emergency fund basics"
    cands = [
        _c("Pet Training 101", 10.0),
        _c("Emergency Fund Basics Everyone Gets Wrong", 0.5),
        _c("How To Cook Pasta", 5.0),
    ]
    ranked = _rank_candidates(cands, query)
    assert ranked[0]["title"].startswith("Emergency Fund")


def test_diverse_pick_avoids_same_channel():
    cands = [
        _c("a", 5, channel="ch1"),
        _c("b", 4, channel="ch1"),
        _c("c", 3, channel="ch2"),
        _c("d", 2, channel="ch3"),
    ]
    picks = _pick_diverse(cands, 3)
    channels = [p["channel"] for p in picks]
    assert len(set(channels)) == 3


# ------------ JSON extraction ------------

def test_extract_json_unfenced():
    assert _extract_json('{"a": 1}') == {"a": 1}


def test_extract_json_fenced():
    assert _extract_json('```json\n{"a": 1}\n```') == {"a": 1}


# ------------ carousel validation ------------

VALID_REF_POOL = {"1.png", "2.png", "3.png", "4.png", "5.png", "ref.png", "nano_banana_pro.png"}


def _slide(n, role, energy="MEDIUM", ref="1.png", headline="hi", body="b"):
    return {
        "n": n,
        "role": role,
        "visual_energy": energy,
        "headline": headline,
        "body": body,
        "ref_image": ref,
        "visual_direction": "",
    }


def _valid_7(lang="en"):
    roles = ["HOOK", "CONTEXT", "BUILD", "BUILD", "TENSION", "PAYOFF", "CTA"]
    slides = []
    refs = ["1.png", "2.png", "3.png", "4.png", "5.png", "ref.png", None]
    for i, (role, ref) in enumerate(zip(roles, refs), 1):
        headline = "join @personalfinancetips" if role == "CTA" else "alpha"
        slides.append(_slide(i, role, ref=ref, headline=headline))
    return slides


def test_validate_accepts_well_formed_carousel():
    c = {
        "id": "c1",
        "slides_en": _valid_7(),
        "slides_he": _valid_7(),
    }
    warnings: list[str] = []
    _validate_carousels({"carousels": [c]}, VALID_REF_POOL, warnings)


def test_validate_rejects_hebrew_dash():
    slides_he = _valid_7()
    slides_he[2]["body"] = "זה חיסכון - לא השקעה"
    c = {"id": "c1", "slides_en": _valid_7(), "slides_he": slides_he}
    with pytest.raises(ValueError, match="banned dash"):
        _validate_carousels({"carousels": [c]}, VALID_REF_POOL, [])


def test_validate_rejects_hebrew_emdash():
    slides_he = _valid_7()
    slides_he[1]["headline"] = "כסף — חופש"
    c = {"id": "c1", "slides_en": _valid_7(), "slides_he": slides_he}
    with pytest.raises(ValueError, match="banned dash"):
        _validate_carousels({"carousels": [c]}, VALID_REF_POOL, [])


def test_validate_rejects_wrong_slide_count():
    c = {"id": "c1", "slides_en": _valid_7()[:6], "slides_he": _valid_7()}
    with pytest.raises(ValueError, match="exactly 7"):
        _validate_carousels({"carousels": [c]}, VALID_REF_POOL, [])


def test_validate_warns_on_bad_ref_image():
    slides_en = _valid_7()
    slides_en[0]["ref_image"] = "totally-made-up.png"
    c = {"id": "c1", "slides_en": slides_en, "slides_he": _valid_7()}
    warnings: list[str] = []
    _validate_carousels({"carousels": [c]}, VALID_REF_POOL, warnings)
    assert any("not in ref pool" in w for w in warnings)


def test_hebrew_banned_regex():
    assert HEBREW_BANNED.search("ok - no")
    assert HEBREW_BANNED.search("ok \u2013 no")
    assert HEBREW_BANNED.search("ok \u2014 no")
    assert not HEBREW_BANNED.search("שלום עולם")


def test_validate_rejects_hine_opener_as_hard_fail():
    # `הנה` at sentence-start is the strongest AI-slop marker for Hebrew
    # finance copy. In v2 it was only a warning; v3 promotes it to a
    # ValueError so the Pass B retry loop gets triggered.
    slides_he = _valid_7()
    slides_he[0]["body"] = "הנה ארבעת הצעדים שמשנים את זה."
    c = {"id": "c1", "slides_en": _valid_7(), "slides_he": slides_he}
    with pytest.raises(ValueError, match="הנה"):
        _validate_carousels({"carousels": [c]}, VALID_REF_POOL, [])


def test_validate_strict_rejects_calque_pattern():
    # "זה לא עניין של X, זה עניין של Y" is lifted whole from the English
    # "it's not about X, it's about Y." Under strict mode this hard-fails;
    # under non-strict it's a warning (false-positive risk).
    slides_he = _valid_7()
    slides_he[3]["body"] = "זה לא עניין של כסף, זה עניין של חופש."
    c = {"id": "c1", "slides_en": _valid_7(), "slides_he": slides_he}

    with pytest.raises(ValueError, match="calque pattern"):
        _validate_carousels({"carousels": [c]}, VALID_REF_POOL, [], strict=True)

    warnings: list[str] = []
    _validate_carousels({"carousels": [c]}, VALID_REF_POOL, warnings, strict=False)
    assert any("calque pattern" in w for w in warnings)


def test_validate_pass_a_english_only_skips_hebrew_checks():
    # Pass A returns carousels with `slides_en` only (`slides_he: []`). The
    # validator must accept that shape when called with lang_keys=('slides_en',)
    # — otherwise Pass A would always fail before Pass B gets a chance to run.
    c = {"id": "c1", "slides_en": _valid_7(), "slides_he": []}
    warnings: list[str] = []
    _validate_carousels(
        {"carousels": [c]}, VALID_REF_POOL, warnings, lang_keys=("slides_en",)
    )


def test_validate_rejects_null_ref_image_on_non_cta():
    # Opus occasionally drops `ref_image: null` on CONTEXT slides, misreading
    # the framework's "clean, text-only, breathing room" as "no background
    # image." This is a rendering-breaking mistake — the renderer produces a
    # blank slide. Hard fail so the retry loop takes another swing.
    slides_en = _valid_7()
    slides_en[1]["ref_image"] = None  # CONTEXT slide, not CTA
    c = {"id": "c1", "slides_en": slides_en, "slides_he": _valid_7()}
    with pytest.raises(ValueError, match="null ref_image"):
        _validate_carousels({"carousels": [c]}, VALID_REF_POOL, [])


def test_validate_body_emphasis_is_case_insensitive():
    # A lower-case emphasis word should match a title-cased body occurrence
    # (e.g., body starts with "Dining out goes." and emphasis is "dining out").
    # The renderer matches case-insensitively too; the validator should too.
    slides_en = _valid_7()
    slides_en[3]["body"] = "Dining out goes. Gifts go."
    slides_en[3]["body_emphasis"] = ["dining out", "gifts"]
    slides_en[3]["eyebrow"] = "TRADEOFFS"
    slides_en[3]["headline_italic"] = "alpha"
    c = {"id": "c1", "slides_en": slides_en, "slides_he": _valid_7()}
    warnings: list[str] = []
    _validate_carousels({"carousels": [c]}, VALID_REF_POOL, warnings)
    assert not any("body_emphasis" in w for w in warnings)


def test_validate_warns_when_headline_italic_not_substring():
    # Build a slide where headline_italic is nowhere to be found in headline.
    # This is the signature design-language check: the renderer splits the
    # headline on this span to apply the italic-gold style, so a bad value
    # silently produces a flat headline.
    slides_en = _valid_7()
    slides_en[0]["headline"] = "Most people invest backwards."
    slides_en[0]["headline_italic"] = "sideways."   # not in headline
    slides_en[0]["eyebrow"] = "A BETTER APPROACH"
    c = {"id": "c1", "slides_en": slides_en, "slides_he": _valid_7()}
    warnings: list[str] = []
    _validate_carousels({"carousels": [c]}, VALID_REF_POOL, warnings)
    assert any("not a substring of headline" in w for w in warnings)
