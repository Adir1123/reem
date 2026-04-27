# Reem Dashboard — Complete Client Onboarding Runbook

This is **Adir's** runbook for setting up a brand-new client from absolute zero, working entirely from his own laptop. The client never installs developer tools, never opens a terminal, and never copies a repo. This document is written so detailed that future-Adir can follow it without remembering anything from past setups.

**End state after following this:** the client owns all their accounts (their bills, their data), code auto-deploys from GitHub to both Vercel (web app) and Trigger.dev (worker) every time Adir pushes a change. Adir maintains the codebase remotely, no more on-site visits to update code.

**Estimated total time:** 90–120 minutes the first time you onboard a client. Maybe 60 minutes after you've done it twice.

---

## Section 0 — Mental model (read once, never get confused again)

Before you do anything, internalize this. It saves hours of confusion later.

### The three places "the code" lives

| Where | What it is | Who controls it |
|---|---|---|
| `Adir1123/reem` (your GitHub) | Your master template. Source of truth. | You. |
| `<client_user>/reem` (client's GitHub fork) | The client's deployed copy. Auto-deploys to Vercel + Trigger.dev. | You (using client's login). |
| Your laptop (folder `reem-v2/`) | Working copy where you edit code. | You. |

### The three places "the code" runs

| Where | What runs there | Triggered by |
|---|---|---|
| **Vercel** | The web dashboard (Next.js) | Push to client's GitHub fork → auto-deploys |
| **Trigger.dev** | The worker (Python pipeline) | Push to client's GitHub fork → auto-deploys |
| **Supabase** | The database (Postgres) | Migrations run once manually at setup |

### The three categories of "things"

| Category | Examples | Where it lives | Same for every client? |
|---|---|---|---|
| **Code** | TypeScript, Python, SQL migrations | Git repo | ✅ Yes, same code for everyone |
| **Configuration** | URLs, IDs, API keys, encryption keys | Environment variables in Vercel + Trigger.dev + your local files | ❌ No, unique per client |
| **Data** | Topics, runs, carousels, the client's row in `clients` table | Each client's Supabase database | ❌ No, lives only in their DB |

### The golden rule

> Code in Git is generic and shared.
> Configuration in env vars is per-client.
> Data is in their Supabase only.
> **Never** put a UUID, email, brand name, or API key directly in the Git code.

If you ever feel tempted to hardcode a value, stop. It belongs in env vars instead.

---

## Section 1 — One-time setup on your laptop

You only do this once ever, not per client. **If you've already done it, skip this whole section.**

### 1.1 Install Git

1. Open browser → go to **https://git-scm.com/download/win**
2. The download starts automatically
3. Run the installer → click **Next** through every screen, accept all defaults
4. Open **PowerShell** (Start menu → type "PowerShell" → Enter)
5. Type: `git --version` → press Enter
6. Should show something like `git version 2.x.x`. If yes, ✅ done.

### 1.2 Install Node.js (LTS)

1. Browser → **https://nodejs.org/**
2. Click the green **LTS** button (currently v20 or v22)
3. Run installer → defaults are fine → click through
4. PowerShell: `node --version` → should show `v20.x.x` or higher
5. PowerShell: `npm --version` → should show `10.x.x` or higher

### 1.3 Install pnpm

1. PowerShell: `npm install -g pnpm`
2. Wait for it to finish (~30 sec)
3. `pnpm --version` → should show `9.x.x` or higher

### 1.4 Install Python 3.11+

1. Browser → **https://www.python.org/downloads/**
2. Click the yellow **Download Python 3.x** button
3. Run installer
4. ⚠️ **CHECK THE BOX** that says "Add Python to PATH" at the bottom of the first screen. Easy to miss.
5. Click **Install Now**
6. PowerShell: `python --version` → should show `Python 3.11.x` or higher

### 1.5 Install Vercel CLI (used only for very first deploy)

1. PowerShell: `npm install -g vercel`
2. `vercel --version` → should show a number

### 1.6 Clone your master template repo

This is your permanent working folder. You'll reuse it for every client. You don't re-clone per client.

1. PowerShell: `cd $HOME` (goes to your user folder)
2. Or `cd C:\Users\adirg\CC-projects` (or wherever you want it)
3. `git clone https://github.com/Adir1123/reem.git reem-v2`
4. `cd reem-v2`
5. `pnpm install` — wait ~3 minutes the first time

That's your master working copy. From here, every client is added as a separate "remote" later.

### 1.7 Confirm the Trigger.dev CLI works

1. PowerShell (still in the `reem-v2` folder): `npx trigger.dev@latest --version`
2. Should print a version. If yes, ✅ done.
3. No login needed yet — that comes later, per client.

---

## Section 2 — Things to prepare before you start with the client

Whether you're sitting next to the client or doing this remotely (recommended), you need login credentials for **seven** accounts. Either:

* The client gives you their existing logins, OR
* You create the accounts during a screen-share / video call and they save the passwords in their password manager

**The seven accounts (in order of creation):**

1. **Google account** — used to log into everything else fast (Vercel, Supabase, Trigger.dev all support "Sign in with Google")
2. **GitHub** — for the code fork
3. **Vercel** — for the web app
4. **Supabase** — for the database
5. **Trigger.dev** — for the background worker
6. **Apify** — for YouTube scraping
7. **Anthropic** — for the Claude AI API

**You also need:**

* **A credit card on file with Anthropic** (the client's, ideally) — costs ~$5–20 per month
* **A credit card on file with Apify Starter plan** — $29 per month (needed for residential proxies, otherwise YouTube scraping fails)

If you're creating accounts for the client, use a unique strong password per account, save them all in the client's password manager, and have them confirm verification emails on their device.

---

## Section 3 — Create the client's GitHub fork

The goal: end up with `https://github.com/<client_user>/reem` as a public fork of `Adir1123/reem`.

### 3.1 Sign out of YOUR GitHub first

If you're logged into your `Adir1123` account, sign out so you don't accidentally fork to the wrong account.

1. Browser → **https://github.com**
2. Top-right → click your avatar → **Sign out**

### 3.2 Sign in (or sign up) as the client

* If they already have a GitHub account: sign in with their email and password
* If they don't: click **Sign up** at the top of github.com, create a new account using the client's email
* **Username convention**: pick something memorable like `<brand>carousel` or `<client>finance`. No special characters except hyphens. Save the username in the client's password manager.

### 3.3 Fork the master repo to the client's account

1. Browser (logged in as client) → **https://github.com/Adir1123/reem**
2. Top-right corner → click the **Fork** button
3. **Owner** dropdown → select the client's username (it should be the only option)
4. **Repository name** → leave as `reem`
5. ✅ **Make sure "Copy the master branch only" is checked** (it's the default)
6. Click the green **Create fork** button
7. Wait ~5 seconds. You'll be redirected to `https://github.com/<client_user>/reem`

✅ The client's fork now exists.

### 3.4 Sign out of the client's GitHub

1. Top-right → avatar → **Sign out**

You're done with GitHub for now. We'll come back to it later in Section 13 when wiring up auto-deploy.

---

## Section 4 — Create the client's Supabase project + run migrations

### 4.1 Sign in to Supabase as the client

1. Browser → **https://supabase.com**
2. Top-right → **Sign in**
3. Click **Continue with GitHub** → enter the client's GitHub credentials → authorize
4. If first time, complete the onboarding (Organization name = client's brand name, e.g. `Personal Finance Tips`)

### 4.2 Create the Supabase project

1. Top-right → **New project**
2. **Organization**: pick the client's org (default)
3. **Project name**: `reem`
4. **Database password**: click the **Generate a password** button → it auto-generates a strong one
5. ⚠️ **IMPORTANT: copy that password right now and save it in the client's password manager** with the label "Supabase DB password". You will not be able to see it again later.
6. **Region**: select `eu-central-1 (Frankfurt)` — closest to Israel
7. **Pricing plan**: **Free**
8. Click **Create new project**
9. Wait ~2 minutes while Supabase provisions the database. The dashboard will go from "Setting up project" to "Project API" when ready.

### 4.3 Get the API keys (save them in your notepad)

1. Left sidebar → click the **gear icon** at the bottom → **Project Settings**
2. Click **API** in the left sub-menu
3. You'll see a page titled "Project API". Copy these to a temporary notepad:

| Save in your notepad as | What to copy from the page |
|---|---|
| `SUPABASE_URL` | The "Project URL" at the top (starts with `https://` and ends with `.supabase.co`) |
| `SUPABASE_ANON_KEY` | The `anon` `public` key (long string starting with `eyJ...`) — click "Reveal" if hidden, then click "Copy" |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` `secret` key (also `eyJ...`) — click "Reveal" then "Copy" |

⚠️ The `service_role` key bypasses Row Level Security. Never paste it anywhere public.

### 4.4 Get the database connection string (save in notepad)

1. Still in **Project Settings** → click **Database** in the sub-menu
2. Find the section called **Connection string**
3. Click the **URI** tab
4. Copy the long string (starts with `postgresql://postgres:...`)
5. Replace `[YOUR-PASSWORD]` in the string with the actual DB password from step 4.2
6. Save in your notepad as `SUPABASE_DB_URL`

### 4.5 Run the database migrations

There are 3 SQL files in your local repo that need to run in this client's Supabase, in order. Run them one at a time.

1. Supabase dashboard → left sidebar → click **SQL Editor**
2. Click **New query** (top-right)

Now from your laptop, in VS Code (or any text editor), open the first migration file:

`C:\Users\adirg\CC-projects\reem-v2\packages\db\supabase\migrations\0001_init.sql`

3. **Select all** (Ctrl+A) → **Copy** (Ctrl+C)
4. Switch to Supabase's SQL Editor → paste (Ctrl+V) into the big text area
5. Click the green **Run** button (or press Ctrl+Enter)
6. Wait. You should see "Success. No rows returned" at the bottom.

Repeat for the second migration:

7. SQL Editor → click **New query** (or just clear the existing one)
8. Open `0002_seed_topics.sql` → copy → paste → **Run**
9. ⚠️ This one might insert 0 rows (because there's no `clients` row yet). That's expected — we'll re-run it in Section 6.

And the third:

10. SQL Editor → **New query**
11. Open `0003_topic_reruns.sql` → copy → paste → **Run**

✅ Migrations done. The database tables now exist.

---

## Section 5 — Create the client's Trigger.dev project

### 5.1 Sign in to Trigger.dev as the client

1. Browser → **https://cloud.trigger.dev**
2. Click **Continue with GitHub** → use client's GitHub
3. Skip any "let's deploy a sample project" wizard if it appears

### 5.2 Create the organization and project

1. Top-left → click the org dropdown → **New Organization**
2. Name: client's brand name (e.g. `Personal Finance Tips`)
3. Click **Continue**
4. New project prompt appears → name it `reem`
5. Click **Create**

### 5.3 Switch to the Production environment

⚠️ Trigger.dev defaults you into the **Dev** environment. **You always deploy to Prod.** Switch now to avoid confusion.

1. Top-left of the Trigger.dev dashboard, just under the project name → there's an environment switcher (looks like `Dev ▾`)
2. Click it → select **Prod**
3. The whole dashboard now reflects the Prod environment.

### 5.4 Get the Project ref (save in notepad)

1. Left sidebar → **Project Settings** (gear icon at bottom-left)
2. Find **Project ref** — looks like `proj_xxxxxxxxxxxxxxxx`
3. Save in notepad as `TRIGGER_PROJECT_REF`

### 5.5 Get the Prod secret key (save in notepad)

1. Still in Project Settings → click **API Keys** in the sub-menu
2. Make sure you're viewing keys for the **Prod** environment (top of page should say `Production`)
3. Find the **Secret key** — starts with `tr_prod_...`
4. Click the copy icon
5. Save in notepad as `TRIGGER_SECRET_KEY`

⚠️ The key MUST start with `tr_prod_`. If it starts with `tr_dev_`, you're still in Dev — go back to step 5.3.

---

## Section 6 — Generate IDs and insert the client row in Supabase

This is where we create the unique values for this client and insert their first row into the database. This is the ONE place where client-specific data legitimately gets stored — and it goes in the database, not in the code.

### 6.1 Generate a fresh CLIENT_ID (a random UUID)

1. PowerShell on your laptop, in your `reem-v2` folder
2. Run: `node -e "console.log(require('crypto').randomUUID())"`
3. Press Enter
4. It prints something like `1b5ed006-7991-4055-a15a-538002289f4b`
5. Copy that output → save in notepad as `CLIENT_ID`

### 6.2 Generate a fresh MASTER_ENCRYPTION_KEY

1. PowerShell: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
2. Press Enter
3. It prints something like `vK9xLp2mQ5sT7wYnA3...==`
4. Copy → save in notepad as `MASTER_ENCRYPTION_KEY`
5. ⚠️ **Save this in the client's password manager too**. If it's ever lost, the client has to re-paste their Anthropic + Apify keys via the dashboard.

### 6.3 Insert the client row in Supabase

This step uses a special SQL file that lives in the repo at `packages/db/supabase/onboarding/insert_client.sql`. **It's not a migration** — it's a per-client template you fill in once.

1. On your laptop, open `C:\Users\adirg\CC-projects\reem-v2\packages\db\supabase\onboarding\insert_client.sql` in VS Code (or any editor)
2. Select all → copy
3. Paste into Supabase → SQL Editor → New query
4. ⚠️ Find the three placeholders that look like `<<...>>` and replace them:
   - `<<PASTE_CLIENT_ID_HERE>>` → paste the `CLIENT_ID` from step 6.1
   - `<<paste_client_email@example.com>>` → the client's email
   - `<<Brand Name Here>>` → the client's brand name (e.g. `Personal Finance Tips`)
5. ⚠️ Make sure both placeholders for `CLIENT_ID` get replaced (there are 2 in the file — one for `clients`, one for `app_settings`)
6. Click **Run**
7. Should see "Success" with row counts

### 6.4 Re-run 0002_seed_topics.sql (now that the client row exists)

1. Supabase → SQL Editor → New query
2. From your laptop, open `packages/db/supabase/migrations/0002_seed_topics.sql` again
3. Copy → paste → **Run**
4. This time it should insert 40 rows (the 40 topics across 5 themes)

### 6.5 Verify everything is in place

1. Supabase → left sidebar → **Table Editor**
2. Click `clients` → should show 1 row (the one you just inserted)
3. Click `app_settings` → should show 1 row
4. Click `topics` → should show 40 rows

If anything is missing, re-run the relevant SQL. All migrations use `on conflict do nothing` so they're safe to run multiple times.

---

## Section 7 — Get the AI + scraping API keys

### 7.1 Anthropic API key (Claude AI)

1. Browser → **https://console.anthropic.com**
2. Sign in (use the client's account; the client adds their payment method)
3. Left sidebar → **Settings** (gear icon)
4. Click **API Keys** in the sub-menu
5. Click **Create Key**
6. Name it: `reem-prod`
7. Workspace: leave as default
8. Click **Create Key**
9. ⚠️ Copy the `sk-ant-...` key **immediately** — it's only shown once
10. Save in notepad as `ANTHROPIC_API_KEY`

Add billing:

11. Left sidebar → **Plans & Billing**
12. Add a payment method (the client's credit card)
13. Add ~$10 of starting credit

### 7.2 Apify token

1. Browser → **https://apify.com**
2. Sign in (client's account)
3. ⚠️ If first time, you must subscribe to the **Starter plan** ($29/mo) — it's required for residential proxies, which YouTube scraping needs
4. Top-right → click avatar → **Settings**
5. Click **Integrations** in the sub-menu
6. Find **API tokens** section → click the **default** token → **Show**
7. Copy the token
8. Save in notepad as `APIFY_TOKEN`

⚠️ These two keys (`ANTHROPIC_API_KEY` and `APIFY_TOKEN`) **don't go in env files**. They get pasted into the dashboard's `/settings` page later (Section 11), where they get encrypted at rest and stored in Supabase. This way the client can rotate them later via the UI without touching infrastructure.

---

## Section 8 — Notepad checkpoint

Before you continue, your notepad should have all of these. Pause and verify, no typos:

```
=== Account info ===
Client email                = ...
Client brand name           = ...   (e.g. "Personal Finance Tips")

=== Generated values ===
CLIENT_ID                   = (UUID from §6.1, format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
MASTER_ENCRYPTION_KEY       = (base64 from §6.2, ends with ==)

=== Supabase ===
SUPABASE_URL                = https://xxxxx.supabase.co
SUPABASE_ANON_KEY           = eyJ...
SUPABASE_SERVICE_ROLE_KEY   = eyJ...
SUPABASE_DB_URL             = postgresql://postgres:...

=== Trigger.dev ===
TRIGGER_PROJECT_REF         = proj_xxxxxxxxxxxx
TRIGGER_SECRET_KEY          = tr_prod_xxxxxxxxxxxx   (must start with tr_prod_)

=== Third-party APIs ===
ANTHROPIC_API_KEY           = sk-ant-xxxx
APIFY_TOKEN                 = apify_api_xxxx
```

If anything's missing, go back to the relevant section. Don't proceed until you have all 11 values.

---

## Section 9 — First-time deploy of the Trigger.dev worker

The very first deploy is manual from your laptop. After this section, GitHub auto-deploys take over (Section 13) and you never run `pnpm deploy` again for this client.

### 9.1 Add the client's fork as a Git remote on your laptop

A "remote" is a labeled URL that Git can push to. We're going to add the client's fork as a new remote called something like `pft` (for Personal Finance Tips) or `acme` — pick a memorable short nickname.

1. PowerShell, in your `reem-v2` folder
2. Replace `<nickname>` with the short name and `<client_user>` with the client's GitHub username:
```powershell
git remote add <nickname> https://github.com/<client_user>/reem.git
```
3. Verify: `git remote -v`
4. You should see at least:
```
origin    https://github.com/Adir1123/reem.git (fetch)
origin    https://github.com/Adir1123/reem.git (push)
<nickname>  https://github.com/<client_user>/reem.git (fetch)
<nickname>  https://github.com/<client_user>/reem.git (push)
```

From now on, this client is `<nickname>` in all your Git commands.

### 9.2 Update apps/trigger/.env on your laptop with this client's values

This file is git-ignored (never committed), and it changes per client. Open it, paste the right values.

1. VS Code → open `apps/trigger/.env`
   * If the file doesn't exist, create it (right-click `apps/trigger/` → New File → name it `.env` exactly, including the leading dot)
2. Replace its contents with these lines, filling in the values from your notepad:

```
SUPABASE_URL=...                    # from §4.3
SUPABASE_SERVICE_ROLE_KEY=...       # from §4.3
CLIENT_ID=...                       # from §6.1
MASTER_ENCRYPTION_KEY=...           # from §6.2
TRIGGER_SECRET_KEY=tr_prod_...      # from §5.5 (must be prod, not dev)
PROJECT_REF=proj_...                # from §5.4
```

3. Save the file (Ctrl+S)

### 9.3 Deploy the worker

1. PowerShell, in the `reem-v2` folder root (not inside any subfolder)
2. `pnpm install` (only needed if you haven't run it for a while; safe to re-run)
3. `pnpm --filter trigger run deploy`
4. The first deploy takes ~3–5 minutes. You'll see it building a Docker image
5. If prompted to log in, log in with the client's Trigger.dev account
6. Wait for the message: `✓ Successfully deployed`

### 9.4 Verify the deploy in the Trigger.dev dashboard

1. Browser → Trigger.dev dashboard → client's `reem` project
2. Top-left → make sure environment is **Prod**
3. Left sidebar → **Tasks** → should list `manual-generate` and `weekly-cron`
4. Left sidebar → **Schedules** → should list `weekly-cron` with cron `0 6 * * 0,3` and timezone `Asia/Jerusalem`

If anything is missing, re-run `pnpm --filter trigger run deploy`.

### 9.5 Add Trigger.dev's Prod runtime environment variables

These are read by the worker when tasks run.

1. Trigger.dev dashboard → client's `reem` project → confirm **Prod** environment
2. Left sidebar → **Environment Variables**
3. Click **New variable** and add each of these one by one:

| Key | Value |
|---|---|
| `SUPABASE_URL` | from §4.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from §4.3 |
| `CLIENT_ID` | from §6.1 |
| `MASTER_ENCRYPTION_KEY` | from §6.2 |
| `ANTHROPIC_API_KEY` | from §7.1 |
| `APIFY_TOKEN` | from §7.2 |
| `SITE_URL` | leave blank for now — fill in after Section 10 |

### 9.6 Add the BUILD-time env var so future auto-deploys know which project to deploy to

This is critical for auto-deploy in Section 13. Trigger.dev's GitHub auto-deploy needs to know the project ref *before* the build runs. The convention: env var names that start with `TRIGGER_BUILD_` are exposed to the build step (with the prefix stripped).

1. Same Environment Variables page → click **New variable**
2. Key: `TRIGGER_BUILD_PROJECT_REF`
3. Value: same `proj_...` from §5.4
4. Save

When the build runs, Trigger.dev will expose this as `process.env.PROJECT_REF` (prefix stripped), which is what `trigger.config.ts` reads.

---

## Section 10 — First-time deploy of the Vercel web app

### 10.1 Sign in to Vercel as the client

1. Browser → **https://vercel.com**
2. Click **Continue with GitHub** → use client's GitHub credentials
3. If first time, complete the Vercel onboarding

### 10.2 Make sure Vercel can see the client's fork

1. Top-right → click avatar → **Account Settings**
2. Left sidebar → **Login Connections** (or **Integrations** depending on plan)
3. Find the GitHub integration → click **Manage** (or **Configure**)
4. This opens GitHub. Find the Vercel app → **Configure**
5. Under **Repository access**:
   * **All repositories** (easiest), OR
   * **Only select repositories** → click the dropdown → search for `reem` → tick `<client_user>/reem`
6. Click **Save** at the bottom

### 10.3 Import the project

1. Vercel dashboard (top-left logo to go home) → top-right **Add New** → **Project**
2. The list shows GitHub repos you have access to
3. Find `<client_user>/reem` → click **Import**
4. ⚠️ **Triple-check you're importing the client's fork**, not `Adir1123/reem`

### 10.4 Configure the build settings (BEFORE clicking Deploy)

A configuration page appears. Fill in carefully:

1. **Project Name**: `reem` (or `<brand>-reem`)
2. **Framework Preset**: Next.js (auto-detected — leave alone)
3. **Root Directory**: click **Edit** → type `apps/web` → click outside the box to confirm
4. **Build & Development Settings** → click to expand:
   * **Install Command** → toggle the **Override** switch ON → type: `pnpm install --no-frozen-lockfile`
   * Leave Build Command and Output Directory at their defaults
5. **Don't click Deploy yet** — we need env vars first

### 10.5 Add the production environment variables

Scroll down on the same page to **Environment Variables**.

For EACH variable below: type the Key, paste the Value, leave all three environment checkboxes (Production / Preview / Development) ticked, click **Add**.

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from §4.3 (same as `SUPABASE_URL`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from §4.3 |
| `SUPABASE_URL` | from §4.3 |
| `SUPABASE_ANON_KEY` | from §4.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from §4.3 |
| `SUPABASE_DB_URL` | from §4.4 |
| `CLIENT_ID` | from §6.1 |
| `MASTER_ENCRYPTION_KEY` | from §6.2 |
| `TRIGGER_SECRET_KEY` | from §5.5 (the same `tr_prod_...` you set in Trigger.dev's env) |
| `TRIGGER_PROJECT_REF` | from §5.4 |

⚠️ Critical pitfalls:
- `MASTER_ENCRYPTION_KEY` must be **byte-identical** between Vercel and Trigger.dev. Copy from one source. If they differ, the web UI can't decrypt what the worker encrypted.
- `CLIENT_ID` must be byte-identical too — same reason.
- All Production / Preview / Development boxes ticked. If you mark a var "Sensitive" in Vercel, it still needs the env scope checkboxes ticked — Sensitive only changes display, not scope.

### 10.6 Click Deploy

1. Click the big **Deploy** button at the bottom
2. Wait ~2–4 minutes for the build
3. When done, you get a URL like `https://reem-xxxxxx.vercel.app`
4. Copy that URL → save in notepad as `SITE_URL`

### 10.7 Add SITE_URL to Trigger.dev's Prod env

1. Trigger.dev → client's project → Prod → Environment Variables
2. Find `SITE_URL` (you added it as blank in §9.5) → click → set value to the Vercel URL from §10.6
3. ⚠️ **No trailing slash** at the end (use `https://reem-xxx.vercel.app`, not `https://reem-xxx.vercel.app/`)
4. Save

---

## Section 11 — Paste the API keys via the dashboard

These two keys live encrypted in Supabase, not in env vars, so the client can rotate them later without touching infra.

1. Browser → open the Vercel URL from §10.6
2. The Hebrew dashboard loads
3. Top nav → click **הגדרות** (Settings)
4. There are two input fields. Paste:
   * `ANTHROPIC_API_KEY` (from §7.1) into the Anthropic field
   * `APIFY_TOKEN` (from §7.2) into the Apify field
5. Click **שמור מפתחות** (Save Keys)
6. Reload the page (Ctrl+R)
7. Both badges should flip from **· חסר** (missing) to **· מוגדר** (configured)

---

## Section 12 — Smoke test the full pipeline

### 12.1 Generate a carousel manually

1. Vercel URL → click **נושאים** (Topics) in the top nav
2. Pick any green/yellow topic (status = "available")
3. Click the **הפק קרוסלה** (Generate Carousel) button
4. The topic flips to "מייצר…" (generating) within ~3 seconds
5. Switch to Trigger.dev dashboard → make sure environment is **Prod** → left sidebar → **Runs**
6. You should see a new `manual-generate` run appear within ~5 seconds, status `Executing`
7. Wait 5–8 minutes for the full pipeline:
   * Step 1: Search YouTube via Apify
   * Step 2: Auto-rank candidates
   * Step 3: Scrape transcripts via Apify
   * Step 4: Call Claude (two-pass: English then Hebrew re-author)
8. When done, the run shows status `Completed`

### 12.2 Confirm the carousel appears in the dashboard

1. Vercel URL → click **קרוסלות** (Carousels)
2. A new card with status **ממתין לאישור** (pending review) should appear
3. Click it → preview page shows iPhone frame + 5–7 slides + Hebrew caption + ZIP download button

### 12.3 Verify the cron will fire

1. Trigger.dev → **Schedules** → click `weekly-cron`
2. Click **Trigger now** (manual fire button)
3. Wait 30 seconds → **Runs** → confirm it picked 2 random topics and kicked off `manual-generate` for each

If 12.1–12.3 all work, the system is fully functional. If something fails, see Section 16 — Troubleshooting.

---

## Section 13 — Set up auto-deploy (no more manual deploys)

This section eliminates the need to ever run `pnpm --filter trigger run deploy` from your laptop again. Every push to the client's fork will trigger a fresh deploy automatically.

### 13.1 Connect Trigger.dev's GitHub integration to the client's fork

1. Trigger.dev dashboard → client's `reem` project → bottom-left **Project Settings** (gear icon)
2. Look for **GitHub** in the left sub-menu (might be called "Integrations" or similar)
3. Click **Connect GitHub** or **Install GitHub App**
4. A GitHub authorization screen pops up — log in as the **client** if asked
5. Authorize the Trigger.dev app for the client's account
6. Pick repository: `<client_user>/reem`
7. After connecting, you'll see a Git settings page showing:
   * **Production**: `master` branch ✅
   * **Staging**: `none` (leave alone)
   * **Preview**: off (leave alone)
8. Click **Save** if there's a save button

### 13.2 Configure the build settings for auto-deploy

Still on the Trigger.dev GitHub integration page, scroll down to **Build settings**:

1. **Trigger config file**: type `apps/trigger/trigger.config.ts` (the path inside the repo to the config — it's not at the root, it's in `apps/trigger/`)
2. **Install command**: type `pnpm install --no-frozen-lockfile`
3. **Pre-build command**: leave empty
4. Click **Save**

### 13.3 Vercel auto-deploy is already set up

Vercel auto-deploy was activated the moment you imported the project in §10.3. No action needed. Every push to master triggers a Vercel rebuild.

### 13.4 Test that auto-deploy works

The cleanest test: make a tiny harmless edit on GitHub and watch both services build.

1. Browser → `https://github.com/<client_user>/reem` (logged in as the client)
2. Click any file (e.g. `HANDOFF.md`)
3. Click the pencil icon (top-right of file content) to edit
4. Add a single space somewhere harmless and remove it
5. Scroll to bottom → **Commit changes** → in the dialog, leave "Commit directly to master" selected → **Commit changes**

Within ~30 seconds:

* Vercel dashboard → **Deployments** → new "Building…" entry appears
* Trigger.dev dashboard → **Deployments** → new build appears

If both fire, ✅ auto-deploy works end-to-end. From now on, your only command is `git push`.

---

## Section 14 — Hand off to the client

Walk them through (ideally on a screen-share, in their language):

* **Daily/weekly**: open the Vercel URL → check **קרוסלות** for items in **ממתין לאישור** (pending review) → click each → **אישור** (approve) or **דחיה** (reject)
* **Posting**: approved carousels → click **הורד ZIP** (download ZIP) → upload manually to Instagram (auto-posting is out of scope)
* **Settings**: rotate API keys via the Settings page if needed
* **Cron pause**: there's a toggle in Settings to pause the auto-cron if they're going on vacation

Save into the client's password manager:

* Google account email + password
* GitHub email + password (and the Personal Access Token if you ever made one)
* Vercel email + password
* Supabase email + password + DB password from §4.2
* Trigger.dev email + password
* Anthropic email + password
* Apify email + password
* `MASTER_ENCRYPTION_KEY` — critical, lose this and they re-paste API keys
* `CLIENT_ID` — informational

---

## Section 15 — Your ongoing workflow

This is the part that didn't exist in the original HANDOFF. Once a client is set up, your workflow becomes radically simple.

### 15.1 To improve the code

1. Edit files locally in `C:\Users\adirg\CC-projects\reem-v2`
2. Test locally if needed
3. Commit:
```powershell
git add .
git commit -m "what changed"
```

### 15.2 To roll out to your master template

```powershell
git push origin master
```

`Adir1123/reem` is now updated. Future clients fork from this latest version.

### 15.3 To roll out to a specific existing client

There are two ways. Pick whichever you prefer.

**Way A — Direct push** (fastest, requires git remote setup from §9.1):

```powershell
git push <nickname> master
```

**Way B — GitHub Sync fork button** (no terminal needed, browser only):

1. Browser → `https://github.com/<client_user>/reem` (logged in as client)
2. Below the green Code button, you'll see "This branch is X commits behind Adir1123:master"
3. Click **Sync fork** → **Update branch**
4. GitHub merges your latest master into the client's fork

Either way, Vercel and Trigger.dev fire auto-deploys within seconds.

### 15.4 To roll out a fix to ALL clients at once

```powershell
git push origin master
git push <nickname1> master
git push <nickname2> master
git push <nickname3> master
```

(For >5 clients there are git tricks to push to multiple remotes with one command. Not necessary for now.)

### 15.5 If you ever need to manually deploy from your laptop

You shouldn't need to after auto-deploy is set up. But if you do (e.g. testing a change before pushing):

1. Update `apps/trigger/.env` with the right client's values from §9.2
2. `pnpm --filter trigger run deploy`

The trick is that `.env` differs per client. Easiest pattern: keep per-client copies like `apps/trigger/.env.pft`, `apps/trigger/.env.acme`, and copy the right one to `.env` before deploying.

### 15.6 Onboarding client #2 (and beyond)

Repeat sections 2–13 with the new client. Should take ~60 minutes the second time. The only new step is `git remote add <nickname2> ...` on your laptop so you can push to them.

---

## Section 16 — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Click "הפק קרוסלה" → topic shows "מייצר…" forever | Vercel can't reach Trigger.dev | Check `TRIGGER_SECRET_KEY` is set in Vercel env vars, **Production** scope ticked, and starts with `tr_prod_` not `tr_dev_`. Redeploy with **Use existing Build Cache UNCHECKED**. |
| Pipeline fails with "Sign in to confirm you're not a bot" | yt-dlp blocked from datacenter IP | Already fixed — `search_youtube.py` uses Apify. If the error returns, check `APIFY_TOKEN` is set in Trigger.dev Prod env. |
| Pipeline fails with `No such file or directory: 'C:/Users/adirg/...'` | Hardcoded Windows path | Already fixed. If returns, search code for `C:/Users` and replace with paths relative to `Path(__file__).resolve().parent.parent`. |
| Deploy fails: "PROJECT_REF env var is not set" | Build-time env var missing | Trigger.dev → Prod env → Environment Variables → confirm `TRIGGER_BUILD_PROJECT_REF` is set with value `proj_...`. |
| `pnpm install` errors on peer deps | Default in this monorepo | Safe to ignore — `auto-install-peers=true` is on. If it actually blocks, run `pnpm install --no-frozen-lockfile`. |
| `pnpm --filter trigger run deploy` fails on Python | Python version mismatch | Check `python --version` ≥ 3.11. Delete `apps/trigger/.venv` folder and re-create. |
| Web build fails on Vercel: "CLIENT_ID env var not set" | Env var missing or wrong scope | Vercel → Settings → Env Vars → ensure **Production** scope is ticked. Redeploy. |
| Settings dashboard badges always say "· חסר" (missing) | `MASTER_ENCRYPTION_KEY` mismatch | The value MUST be byte-identical in Vercel env + Trigger.dev Prod env + your local `apps/trigger/.env`. Copy from one source to all three. |
| Cron doesn't fire on Sunday | Schedule disabled | Trigger.dev → Schedules → enable. Also check Settings → cron-pause toggle in dashboard. |
| Carousel generation fails with Apify quota error | Apify free tier exhausted | Upgrade to Starter plan ($29/mo) — needed for residential proxies anyway. |
| `git push` rejected: "updates were rejected" | Remote has commits you don't | First `git pull <remote> master --rebase`, then `git push <remote> master` again. |
| Sync fork on GitHub fails with conflict | Both your master and client fork edited the same file | GitHub will offer to open a Pull Request. Click "Open pull request" → resolve manually → merge. |

---

## Section 17 — Quick reference: where every secret goes

| Secret / value | apps/trigger/.env (laptop) | apps/web/.env.local (laptop) | Trigger.dev Prod env | Vercel env | Supabase /settings UI |
|---|---|---|---|---|---|
| `SUPABASE_URL` | ✅ | also as `NEXT_PUBLIC_SUPABASE_URL` | ✅ | also as `NEXT_PUBLIC_SUPABASE_URL` | — |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ | ✅ | — |
| `SUPABASE_ANON_KEY` | — | as `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | as `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — |
| `SUPABASE_DB_URL` | — | — | — | ✅ | — |
| `CLIENT_ID` | ✅ | ✅ | ✅ | ✅ | — |
| `MASTER_ENCRYPTION_KEY` | ✅ | ✅ | ✅ | ✅ | — |
| `TRIGGER_SECRET_KEY` | ✅ | — | — (it IS the project's key) | ✅ | — |
| `PROJECT_REF` (laptop) | ✅ | — | — | — | — |
| `TRIGGER_PROJECT_REF` (Vercel) | — | — | — | ✅ | — |
| `TRIGGER_BUILD_PROJECT_REF` | — | — | ✅ (build-time) | — | — |
| `SITE_URL` | — | — | ✅ (Vercel URL) | — | — |
| `ANTHROPIC_API_KEY` | — | — | ✅ | — | ✅ (also pasted here) |
| `APIFY_TOKEN` | — | — | ✅ | — | ✅ (also pasted here) |

Note on `PROJECT_REF` vs `TRIGGER_BUILD_PROJECT_REF`: Trigger.dev's GitHub auto-deploy strips the `TRIGGER_BUILD_` prefix during builds. So set `TRIGGER_BUILD_PROJECT_REF=proj_...` in the dashboard, and `trigger.config.ts` reads it as `process.env.PROJECT_REF`. For local manual deploys, set `PROJECT_REF=proj_...` in `apps/trigger/.env` directly (no prefix needed).

---

## Section 18 — Lessons learned (don't repeat these mistakes)

These are real mistakes from previous deploys. Reading these once will save you hours later.

1. **Sensitive env vars in Vercel still need an environment scope ticked.** Marking a value "Sensitive" doesn't replace selecting Production / Preview / Development. If no scope is ticked, the value doesn't exist at runtime in any environment. Always confirm Production is ticked.

2. **Adding env vars to Vercel doesn't apply them retroactively.** Env vars only take effect for builds *after* they were added. If you add `TRIGGER_SECRET_KEY` then click "Redeploy" with "Use existing Build Cache" checked, the new var still doesn't apply. **Always redeploy with cache OFF after adding env vars.**

3. **`tr_prod_` and `tr_dev_` keys are not interchangeable.** A worker deployed to Trigger.dev's Prod environment can only be triggered by a `tr_prod_` key, and vice versa. Mixing them = silent "task not found" failures.

4. **Server Actions in Next.js don't show as POST requests in the Vercel logs page.** They appear under **Function** logs (separate filter). If you click a button and see no errors, switch the log filter to Function.

5. **yt-dlp is dead from datacenter IPs.** YouTube blocks it. Anything running on Trigger.dev / AWS / Fly.io / GitHub Actions / Vercel cannot use yt-dlp directly. We replaced it with Apify (which handles residential proxying).

6. **Hardcoded absolute paths break Linux deploys.** `C:/Users/adirg/...` works on your laptop and nowhere else. Always resolve paths via `Path(__file__).resolve().parent` or env vars.

7. **Migrations should never contain client-specific data.** No UUIDs, no emails, no brand names hardcoded in `0002_seed_topics.sql` or any other migration. Client data goes into `onboarding/insert_client.sql` (a per-client template) that's run manually in §6.3.

8. **Vercel deploys from the client's GitHub fork, not your laptop.** If you change code locally and don't push it to the client's fork, Vercel never sees the change. Same for Trigger.dev once auto-deploy is set up. Always push.

9. **The `Sync fork` button on GitHub is one click but easy to forget.** Set up `git remote add <nickname>` on your laptop and push directly — no Sync click needed.

10. **The `apps/trigger/.env` file is laptop-only and changes per client.** Don't commit it (it's git-ignored). Don't expect it to be on the client's machine — it never is.

11. **Trigger.dev's `trigger.config.ts` `project` field reads from `process.env.PROJECT_REF`.** This means the same code works for every client without modification. The build-time env var needs the `TRIGGER_BUILD_` prefix when set in the dashboard.

12. **The diagnostic `console.log("[DIAG]…")` block in `actions.ts` was a debugging temporary.** It can stay (harmless) or be removed when you're confident everything works. If removing, do it in a clean separate commit so you can find/restore it later if needed.

---

End of runbook. If anything here is wrong or unclear when you next onboard a client, **fix this file and commit it back** so future-you doesn't trip on the same thing.