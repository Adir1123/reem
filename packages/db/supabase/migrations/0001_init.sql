-- Reem Carousel Dashboard — initial schema.
-- Multi-tenant from day one: every domain table carries client_id.
-- RLS scopes reads/writes to the authenticated client; service role bypasses
-- (used by Trigger.dev to write run results).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table clients (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------
create table topics (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  he_label    text not null,
  en_query    text not null,
  theme       text not null check (theme in ('saving','investing','debt','mindset','tools')),
  status      text not null default 'available'
              check (status in ('available','generating','pending_review','posted','archived')),
  source      text not null default 'seed'
              check (source in ('seed','client_added')),
  notes       text,
  created_at  timestamptz not null default now(),
  used_at     timestamptz,
  unique (client_id, en_query)
);

create index topics_client_status_idx on topics (client_id, status);

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------
create table runs (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  topic_id        uuid not null references topics(id) on delete restrict,
  triggered_by    text not null check (triggered_by in ('manual','cron')),
  status          text not null default 'pending'
                  check (status in ('pending','running','success','failed')),
  trigger_run_id  text,
  started_at      timestamptz,
  finished_at     timestamptz,
  raw_json        jsonb,
  warnings        jsonb,
  error           text,
  cost_estimate   numeric(10,4),
  created_at      timestamptz not null default now()
);

create index runs_client_status_idx on runs (client_id, status, created_at desc);
create index runs_topic_idx on runs (topic_id);

-- ---------------------------------------------------------------------------
-- carousels
-- ---------------------------------------------------------------------------
create table carousels (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  run_id       uuid not null references runs(id) on delete cascade,
  idx          int  not null,
  concept      text not null,
  angle        text not null,
  slides_he    jsonb not null,
  slides_en    jsonb not null,
  caption_he   text,
  caption_en   text,
  status       text not null default 'pending_review'
               check (status in ('pending_review','approved','posted','rejected')),
  posted_at    timestamptz,
  posted_via   text,
  created_at   timestamptz not null default now(),
  unique (run_id, idx)
);

create index carousels_client_status_idx on carousels (client_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
create table sources (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  run_id            uuid not null references runs(id) on delete cascade,
  video_url         text not null,
  video_id          text,
  title             text,
  channel           text,
  views             bigint,
  subscribers       bigint,
  engagement_ratio  numeric(10,4),
  duration_seconds  int,
  upload_date       date,
  transcript_chars  int,
  key_points        jsonb,
  created_at        timestamptz not null default now()
);

create index sources_run_idx on sources (run_id);

-- ---------------------------------------------------------------------------
-- app_settings (one row per client)
-- ---------------------------------------------------------------------------
create table app_settings (
  client_id                uuid primary key references clients(id) on delete cascade,
  anthropic_key_ciphertext text,
  apify_key_ciphertext     text,
  cron_paused              boolean not null default false,
  last_notified_run_id     uuid,
  prefs                    jsonb not null default '{}'::jsonb,
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Dedup invariant trigger on carousels.status
--   - posted   → mark the run's topic as posted/used_at=now()
--   - rejected → if no other carousel from the run is posted/approved, return topic to available
-- ---------------------------------------------------------------------------
create or replace function carousel_status_dedup() returns trigger
language plpgsql as $$
declare
  v_topic_id uuid;
  v_other_posted int;
begin
  if new.status = old.status then
    return new;
  end if;

  select topic_id into v_topic_id from runs where id = new.run_id;
  if v_topic_id is null then
    return new;
  end if;

  if new.status = 'posted' then
    update topics
       set status = 'posted', used_at = now()
     where id = v_topic_id;
    return new;
  end if;

  if new.status = 'rejected' then
    select count(*) into v_other_posted
      from carousels c
      join runs r on r.id = c.run_id
     where r.topic_id = v_topic_id
       and c.id <> new.id
       and c.status in ('posted','approved','pending_review');

    if v_other_posted = 0 then
      update topics
         set status = 'available', used_at = null
       where id = v_topic_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger carousel_status_dedup_trg
after update of status on carousels
for each row execute function carousel_status_dedup();

-- ---------------------------------------------------------------------------
-- Row Level Security
--   Assumes clients.id = auth.users.id (set on first sign-in).
--   Service role bypasses RLS automatically.
-- ---------------------------------------------------------------------------
alter table clients      enable row level security;
alter table topics       enable row level security;
alter table runs         enable row level security;
alter table carousels    enable row level security;
alter table sources      enable row level security;
alter table app_settings enable row level security;

create policy clients_self      on clients      for select using (id = auth.uid());
create policy topics_self       on topics       for all using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy runs_self_read    on runs         for select using (client_id = auth.uid());
create policy carousels_self    on carousels    for all using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy sources_self_read on sources      for select using (client_id = auth.uid());
create policy settings_self     on app_settings for all using (client_id = auth.uid()) with check (client_id = auth.uid());
