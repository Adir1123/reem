"""Env loader for reem-carousel.

Resolves paths relative to this file so the same code works on a Windows
laptop and a Linux Trigger.dev worker. Per CLAUDE.md: secrets from .env,
validated at startup via get_required(key). Never hardcoded.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_SKILL_DIR = Path(__file__).resolve().parent
_LOCAL_ENV = _SKILL_DIR / ".env"

# When running locally the dev may have a project-wide .env at the repo root;
# load it if present, but never depend on it (the deployed worker won't have it).
_PROJECT_ENV_CANDIDATE = _SKILL_DIR.parents[3] / ".env" if len(_SKILL_DIR.parents) >= 4 else None
if _PROJECT_ENV_CANDIDATE and _PROJECT_ENV_CANDIDATE.exists():
    load_dotenv(_PROJECT_ENV_CANDIDATE)
if _LOCAL_ENV.exists():
    # Skill-local .env wins over the project .env so you can override specific
    # keys (e.g. a fresh ANTHROPIC_API_KEY) without touching the project file.
    load_dotenv(_LOCAL_ENV, override=True)


def get_required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"Missing required env var: {key}.")
    return val


def get_optional(key: str, default: str) -> str:
    return os.getenv(key, default)


# reem-docs ships inside the python skill folder; resolve relative so it works
# in the deployed Linux container as well as on Windows.
REEM_DOCS_DIR = Path(get_optional(
    "REEM_DOCS_DIR",
    str(_SKILL_DIR / "reem-docs"),
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