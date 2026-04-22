"""Standalone Apify token + actor diagnostic.

Run from apps/trigger/ via .venv:
  cd apps/trigger
  .venv\\Scripts\\python.exe src/python/scripts/debug_apify.py

Prints exactly which layer fails so we can fix the right thing.
"""
from __future__ import annotations
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import APIFY_TRANSCRIPT_ACTOR, require_apify_token  # noqa: E402

print("=" * 60)
print("APIFY DIAGNOSTIC")
print("=" * 60)

# 1. Token loaded?
try:
    token = require_apify_token()
    print(f"[1] Token loaded OK. First 12 chars: {token[:12]} | length: {len(token)}")
except Exception as e:
    print(f"[1] FAILED to load token: {e}")
    sys.exit(1)

# 2. Token validates against Apify /users/me?
try:
    from apify_client import ApifyClient
    client = ApifyClient(token)
    me = client.user("me").get()
    print(f"[2] Token validates. Apify username: {me.get('username')!r} | id: {me.get('id')!r}")
except Exception as e:
    print(f"[2] FAILED /users/me: {type(e).__name__}: {e}")
    traceback.print_exc()
    sys.exit(1)

# 3. Can we look up the actor?
try:
    actor_info = client.actor(APIFY_TRANSCRIPT_ACTOR).get()
    if actor_info:
        print(f"[3] Actor found: {actor_info.get('name')} | id: {actor_info.get('id')}")
    else:
        print(f"[3] Actor lookup returned None for {APIFY_TRANSCRIPT_ACTOR}")
        sys.exit(1)
except Exception as e:
    print(f"[3] FAILED actor lookup ({APIFY_TRANSCRIPT_ACTOR}): {type(e).__name__}: {e}")
    traceback.print_exc()
    sys.exit(1)

# 4. Call the actor with one URL
test_url = "https://youtube.com/watch?v=m_8FLZwcpRc"
print(f"[4] Calling actor with URL: {test_url} ...")
try:
    run = client.actor(APIFY_TRANSCRIPT_ACTOR).call(
        run_input={"videoUrl": test_url}, timeout_secs=180
    )
    print(f"[4] Run status: {run.get('status')!r}, datasetId: {run.get('defaultDatasetId')!r}")
    if run.get("defaultDatasetId"):
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        print(f"[4] Got {len(items)} items. First item keys: {list(items[0].keys()) if items else 'empty'}")
except Exception as e:
    print(f"[4] FAILED actor.call: {type(e).__name__}: {e}")
    traceback.print_exc()
    sys.exit(1)

print("=" * 60)
print("ALL CHECKS PASSED")
