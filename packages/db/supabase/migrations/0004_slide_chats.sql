-- 0004 — Per-slide AI chat editor.
--
-- Why:
--   The carousel preview is becoming editable: a side drawer lets the client
--   chat with Opus 4.7 about a single slide ("תגדיל את הכותרת", "תקצר את הגוף"),
--   the model returns a structured slide patch, and the slide JSON updates
--   in place. We need (a) a conversation log per slide and (b) optimistic
--   concurrency on the carousel so two browser tabs editing the same slide
--   don't silently clobber each other.
--
--   The Slide JSON itself does not change — slides_he/slides_en are JSONB,
--   so the additive `style` field rides for free. Only the chat history table
--   and the version counter are new.

-- ---------------------------------------------------------------------------
-- carousels — optimistic-concurrency token for slide edits
-- ---------------------------------------------------------------------------
alter table carousels
  add column if not exists slides_version int not null default 0;

-- ---------------------------------------------------------------------------
-- slide_chats — append-only chat log, scoped to (carousel, slide_idx, lang)
-- ---------------------------------------------------------------------------
create table slide_chats (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  carousel_id     uuid not null references carousels(id) on delete cascade,
  slide_idx       int  not null,
  lang            text not null check (lang in ('he','en')),
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  -- Non-null only on assistant rows where the model produced a slide edit.
  -- Refusals / out-of-scope replies stay text-only.
  patch_json      jsonb,
  -- Snapshot of the slide BEFORE the patch was applied. Lets the "בטל שינוי"
  -- button restore in one round-trip without a model call.
  pre_slide_json  jsonb,
  -- Token-cost telemetry for the cost badge in the drawer footer.
  input_tokens    int,
  output_tokens   int,
  created_at      timestamptz not null default now()
);

create index slide_chats_lookup_idx
  on slide_chats (carousel_id, slide_idx, lang, created_at);

-- ---------------------------------------------------------------------------
-- RLS — same model as the rest of the schema. The server actions use the
-- service role and enforce client_id explicitly in the WHERE clause; this
-- policy covers the auth-cookie path that lands with magic-link login.
-- ---------------------------------------------------------------------------
alter table slide_chats enable row level security;

create policy slide_chats_self on slide_chats
  for all using (client_id = auth.uid())
  with check (client_id = auth.uid());
