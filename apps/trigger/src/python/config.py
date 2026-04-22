"""Env loader for reem-carousel.

Loads from C:/Users/adirg/CC-projects/reem-v2/.env (the project env for reem-v2),
then from a skill-local .env (optional per-skill overrides).

Per global CLAUDE.md: all secrets live in .env, validated on startup via
get_required(key). Never hardcoded.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_SKILL_DIR = Path(__file__).parent
_PROJECT_ENV = Path("C:/Users/adirg/CC-projects/reem-v2/.env")
_LOCAL_ENV = _SKILL_DIR / ".env"

if _PROJECT_ENV.exists():
    load_dotenv(_PROJECT_ENV)
if _LOCAL_ENV.exists():
    # Skill-local .env wins over the project .env so you can override specific
    # keys (e.g. a fresh ANTHROPIC_API_KEY) without touching the project file.
    load_dotenv(_LOCAL_ENV, override=True)


def get_required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(
            f"Missing required env var: {key}. "
            f"Set it in {_PROJECT_ENV} or {_LOCAL_ENV}."
        )
    return val


def get_optional(key: str, default: str) -> str:
    return os.getenv(key, default)


REEM_DOCS_DIR = Path(get_optional(
    "REEM_DOCS_DIR",
    "C:/Users/adirg/CC-projects/reem-v2/reem-docs",
))
APIFY_TRANSCRIPT_ACTOR = get_optional(
    "APIFY_TRANSCRIPT_ACTOR", "pintostudio/youtube-transcript-scraper"
)
CAROUSEL_MODEL = get_optional("CAROUSEL_MODEL", "claude-opus-4-7")
SCHEMA_VERSION = 1


def require_apify_token() -> str:
    return get_required("APIFY_TOKEN")


def require_anthropic_key() -> str:
    return get_required("ANTHROPIC_API_KEY")
