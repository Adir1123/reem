# Reem Dashboard — On-Site Setup Guide

This guide is for **Adir**, sitting at the **client's computer**, deploying everything from scratch into the **client's accounts** (so all bills + ownership land with the client).

End state: client has a live dashboard at a Vercel URL, a Supabase DB, and a Trigger.dev worker that fires automatically Sun + Wed at 06:00 Asia/Jerusalem.

Estimated time: **60–90 minutes** if all logins work first try.

---

## 0. Before you arrive

Bring (printed or in a password manager):

- A **fresh Anthropic API key** (or have the client create one at console.anthropic.com — they pay).
- A **fresh Apify API token** (or client signs up at apify.com — free tier works).
- This guide.

Confirm in advance the client has accounts for:

- **GitHub** (any free account; only needed to clone the repo).
- **Vercel** (Hobby tier is fine).
- **Supabase** (free tier).
- **Trigger.dev** (free tier).

If they don't, you'll create them together when you arrive. Each takes ~2 minutes.

---

## 1. Install prerequisites on the client's computer

Assume Windows (most common). Mac notes appear in *italics* where commands differ.

### 1.1 Git

- Download: https://git-scm.com/download/win → run installer → accept all defaults.
- Verify: open **PowerShell** (Start → type "PowerShell") → `git --version` → expect `git version 2.x`.
- *Mac: `brew install git` or it ships with Xcode tools.*

### 1.2 Node.js (LTS)

- Download: https://nodejs.org/ → install the **LTS** version (20 or 22).
- Verify: `node --version` → expect `v20.x.x` or higher.
- Verify npm came along: `npm --version` → expect `10.x` or higher.

### 1.3 pnpm

In PowerShell:

```powershell
npm install -g pnpm
```

Verify: `pnpm --version` → expect `9.x` or higher.

### 1.4 Python 3.11+

- Download: https://www.python.org/downloads/ → install Python 3.11 or newer.
- ⚠️ **Check "Add Python to PATH"** in the installer.
- Verify: `python --version` → expect `Python 3.11.x` or higher.
- *Mac: `brew install python@3.12`.*

### 1.5 Vercel CLI

```powershell
npm install -g vercel
```

Verify: `vercel --version`.

### 1.6 (Optional) VS Code

If the client wants to ever read the code or env files in a friendly editor: https://code.visualstudio.com/ → install with defaults.

---

## 2. Clone the repo

In PowerShell, choose where to put the project. Default to the client's home folder:

```powershell
cd $HOME
git clone https://github.com/Adir1123/reem.git
cd reem
```

If GitHub asks Adir to log in (browser pops up), do so with **your** GitHub (Adir1123) — the client doesn't need GitHub access for the repo to work. The code lives in their local folder from now on; GitHub is only for receiving updates.

---

## 3. Create the Supabase project (in client's account)

1. Open https://supabase.com → sign in as the **client**.
2. Click **New project**:
   - Org: client's personal org (default).
   - Name: `reem`.
   - DB password: generate a strong one — **save it in their password manager**.
   - Region: `eu-central-1 (Frankfurt)` (closest to Israel).
   - Plan: **Free**.
3. Wait ~2 min for provisioning.

### 3.1 Run the 3 migrations

In Supabase dashboard → **SQL Editor** → **New query**.

Run each file from `packages/db/supabase/migrations/` **in order**:

1. Open `packages/db/supabase/migrations/0001_init.sql` in VS Code → copy entire contents → paste into SQL Editor → **Run**.
2. Same for `0002_seed_topics.sql`.
3. Same for `0003_topic_reruns.sql`.

After each, you should see `Success. No rows returned` (or row counts for the seed file).

### 3.2 Grab the keys

In Supabase dashboard → **Project Settings** → **API**. Copy these into a temporary notepad:

| Label in dashboard | Save as |
|---|---|
| Project URL | `SUPABASE_URL` |
| `anon` `public` key | `SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

⚠️ The `service_role` key bypasses RLS. Never paste it anywhere public.

---

## 4. Create the Trigger.dev project (in client's account)

1. Open https://cloud.trigger.dev → sign up / log in as the **client**.
2. Create new org: `client-name`.
3. Create new project: `reem`.
4. After creation, copy the **Project ref** (looks like `proj_xxxxxxxxxxxx`).
5. Go to **API Keys** → copy the **`tr_dev_...`** key (you'll switch to `tr_prod_...` later for production deploy).

Save these in your notepad:

- `TRIGGER_PROJECT_REF` = `proj_xxxxxxxxxxxx`
- `TRIGGER_SECRET_KEY` = `tr_dev_xxxxxxxxxxxx` (use the prod key after step 8)

### 4.1 Update the project ref in code

Open `apps/trigger/trigger.config.ts` in VS Code → line 5 → replace the existing `proj_lupvykkongpnnozbgzdy` with the **client's** new project ref → save.

This change stays local — don't commit it back to GitHub (the client isn't going to redeploy from your repo anyway).

---

## 5. Get the AI + scraping keys

### 5.1 Anthropic API key

1. https://console.anthropic.com → sign in as **client** (or Adir, whoever pays).
2. **Settings** → **API Keys** → **Create Key** → name it `reem-prod`.
3. Copy the `sk-ant-...` key. Save as `ANTHROPIC_API_KEY`.
4. **Billing** → add a payment method + ~$10 credit.

### 5.2 Apify token

1. https://apify.com → sign in as **client**.
2. **Settings** → **Integrations** → **API tokens** → copy the default token.
3. Save as `APIFY_TOKEN`.

These two **don't go in env files** — they get pasted into the dashboard's `/settings` page later (encrypted at rest).

---

## 6. Generate the two secrets you'll create

### 6.1 `MASTER_ENCRYPTION_KEY` (32 bytes, base64)

In PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output (looks like `vK9x...==`). Save as `MASTER_ENCRYPTION_KEY`.

⚠️ This key encrypts the Anthropic + Apify keys at rest in Supabase. **If you lose it, the client has to re-paste their keys** in `/settings`. Save it in their password manager.

### 6.2 `CLIENT_ID` (UUID)

```powershell
node -e "console.log(require('crypto').randomUUID())"
```

Copy the output (looks like `1b5ed006-7991-4055-a15a-538002289f4b`). Save as `CLIENT_ID`.

### 6.3 Insert the client row in Supabase

Supabase → SQL Editor → run (replace the UUID with the one you just generated):

```sql
INSERT INTO clients (id, brand_name, brand_handle)
VALUES ('PASTE_CLIENT_ID_HERE', 'Personal Finance Tips', '@personalfinancetips');
```

---

## 7. Create the local `.env` files

Both env files stay **on the client's machine only** — they are git-ignored.

### 7.1 `apps/trigger/.env`

Create file `apps/trigger/.env` with:

```env
SUPABASE_URL=...                    # from §3.2
SUPABASE_SERVICE_ROLE_KEY=...       # from §3.2
CLIENT_ID=...                        # from §6.2
MASTER_ENCRYPTION_KEY=...            # from §6.1
TRIGGER_SECRET_KEY=tr_dev_...        # from §4 (dev for now)
```

### 7.2 `apps/web/.env.local`

Create file `apps/web/.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=...         # same as SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...    # from §3.2
SUPABASE_SERVICE_ROLE_KEY=...        # from §3.2
CLIENT_ID=...                         # same as in §7.1
MASTER_ENCRYPTION_KEY=...             # SAME value as in §7.1 (must match)
```

⚠️ `MASTER_ENCRYPTION_KEY` and `CLIENT_ID` **must be identical** in both files. If they differ, the web UI can't decrypt what the trigger encrypted (or vice versa).

---

## 8. Install + deploy the Trigger.dev worker

From the repo root:

```powershell
pnpm install
```

Wait for it to finish (~3 min first time).

Set up the Python venv for local dev (the deployed worker has its own):

```powershell
cd apps/trigger
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r src/python/requirements.txt
deactivate
```

Now deploy the worker to Trigger.dev:

```powershell
pnpm run deploy
```

This will:

1. Open a browser to log into Trigger.dev (use the **client's** account).
2. Build a Docker image with the Python pipeline.
3. Push it to the client's Trigger.dev project.
4. Print "✓ Successfully deployed".

After it finishes, go back to https://cloud.trigger.dev → client's project → **API Keys** → switch to the **`tr_prod_...`** key and update `apps/trigger/.env`'s `TRIGGER_SECRET_KEY` to the prod value (you'll need it for the next step too).

### 8.1 Verify the cron exists

Trigger.dev dashboard → **Schedules**. You should see one entry:

- Task: `weekly-cron`
- Cron: `0 6 * * 0,3` (Sun + Wed 06:00)
- Timezone: `Asia/Jerusalem`

If it's missing, the deploy failed silently — re-run `pnpm run deploy`.

---

## 9. Deploy the web dashboard to Vercel

### 9.1 Link the project

```powershell
cd ../../apps/web
vercel login
```

Browser opens → sign in as the **client**.

```powershell
vercel link
```

Answer the prompts:

- Set up and deploy? **Y**
- Scope (which account)? Select the **client's** account.
- Link to existing project? **N**
- Project name: `reem-dashboard`.
- In which directory? `./` (current).
- Modify settings? **N** (Next.js auto-detected).

It'll start an initial deploy — you can let it finish or Ctrl-C; we still need to set env vars.

### 9.2 Set production env vars on Vercel

Run each of these (it'll prompt for the value — paste from your notepad and pick **Production** when asked):

```powershell
vercel env add CLIENT_ID production
vercel env add MASTER_ENCRYPTION_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

Optional but recommended (also do `preview` and `development` env scopes if the client wants preview deploys to work — for a single-tenant dashboard, production-only is fine).

### 9.3 Production deploy

```powershell
vercel --prod
```

Wait ~2 min. At the end it prints:

```
✓ Production: https://reem-dashboard-xxxxxx.vercel.app
```

Copy this URL.

### 9.4 Tell Trigger.dev where the site lives

So `notifyClient` emails / future webhooks point to the right URL:

Trigger.dev dashboard → client's project → **Environment Variables** → **Production** → add:

- `SITE_URL` = `https://reem-dashboard-xxxxxx.vercel.app` (the URL from §9.3, **no trailing slash**).

(All other env vars — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_ID`, `MASTER_ENCRYPTION_KEY` — should already be there, set automatically when you ran `pnpm run deploy` from a folder with `.env`. Verify they all show up. If any are missing, add them via the same UI.)

---

## 10. Paste the Anthropic + Apify keys via the dashboard

1. Open the Vercel URL from §9.3 in a browser.
2. You'll see the Hebrew dashboard. Click **הגדרות** (top nav).
3. Paste the `ANTHROPIC_API_KEY` (from §5.1) and `APIFY_TOKEN` (from §5.2) into the two fields → click **שמור מפתחות**.
4. Reload the page → both badges should flip to **· מוגדר** (configured).

Why this is a separate step: keys are encrypted with `MASTER_ENCRYPTION_KEY` and stored in Supabase, not in env vars. This way the client can rotate them later from the UI without touching Vercel/Trigger config.

---

## 11. Smoke test

### 11.1 Manual carousel generation

1. Dashboard → **נושאים** (Topics).
2. Pick any green/yellow topic → click **הפק קרוסלה**.
3. Wait ~5–8 minutes (the Python pipeline searches YouTube → ranks → transcribes → generates → re-authors in Hebrew).
4. Watch progress: Trigger.dev dashboard → **Runs** — you'll see `manual-generate` running.
5. When done, dashboard → **קרוסלות** → you should see 1–2 new cards with status **ממתין לאישור**.
6. Click one → preview page shows iPhone frame + 5–7 slides + Hebrew caption + ZIP download button.

If this works, the whole pipeline is live.

### 11.2 Verify the cron will fire

Trigger.dev dashboard → **Schedules** → click `weekly-cron` → **Trigger now** (manual fire).

Wait 30 sec → check **Runs** → confirm it picked 2 random topics and kicked off `manual-generate` for each.

If the cron fires correctly when triggered manually, it will fire automatically on the next Sun/Wed 06:00 IST.

---

## 12. Hand off to the client

Walk them through:

- **Daily/weekly**: open the Vercel URL, check **קרוסלות** for `pending_review` items, click each, **אישור** or **דחיה**.
- **Posting**: approved carousels → click **הורד ZIP** → upload manually to Instagram (auto-posting is out of scope).
- **Settings**: rotate API keys via `/settings` whenever needed.
- **Cron pause**: there's a toggle in `/settings` to pause the auto-cron if they're going on vacation.

Save into the client's password manager:

- Supabase email + password
- Trigger.dev email + password
- Vercel email + password
- Anthropic email + password
- Apify email + password
- `MASTER_ENCRYPTION_KEY` (critical — lose this and they re-paste API keys)
- `CLIENT_ID` (mostly informational, but useful for Supabase queries)
- DB password

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `pnpm install` errors with peer dep warnings | Safe to ignore — `auto-install-peers=true` is on. |
| `pnpm run deploy` fails on Python build | Check `python --version` ≥ 3.11. Delete `apps/trigger/.venv` and re-create. |
| Web build fails on Vercel with "CLIENT_ID env var not set" | Re-run §9.2; double-check **Production** scope was selected. |
| Settings badges always say `· חסר` | `MASTER_ENCRYPTION_KEY` mismatch between web (.env.local / Vercel) and trigger (.env / Trigger dashboard). They must be byte-identical. |
| Cron doesn't fire on Sunday | Check Trigger.dev dashboard → Schedules → ensure the schedule is **enabled**. Also check `/settings` → cron pause toggle. |
| Carousel generation fails partway | Trigger.dev dashboard → Runs → click failed run → expand stack trace. Most common: Apify quota exceeded (free tier = 5 USD/month). |

---

## Quick reference — what goes where

| Secret | apps/trigger/.env (local) | apps/web/.env.local (local) | Trigger.dev env (cloud) | Vercel env (cloud) | Dashboard /settings UI |
|---|:-:|:-:|:-:|:-:|:-:|
| `SUPABASE_URL` | ✅ | also as `NEXT_PUBLIC_SUPABASE_URL` | ✅ | also as `NEXT_PUBLIC_SUPABASE_URL` | — |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ | ✅ | — |
| `SUPABASE_ANON_KEY` | — | as `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | as `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — |
| `CLIENT_ID` | ✅ | ✅ | ✅ | ✅ | — |
| `MASTER_ENCRYPTION_KEY` | ✅ | ✅ | ✅ | ✅ | — |
| `TRIGGER_SECRET_KEY` | ✅ (prod) | — | — | — | — |
| `SITE_URL` | — | — | ✅ (prod URL) | — | — |
| `ANTHROPIC_API_KEY` | — | — | — | — | ✅ |
| `APIFY_TOKEN` | — | — | — | — | ✅ |

Done. The client now owns the entire stack.
