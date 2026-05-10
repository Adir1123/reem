-- 0007_updated_at_triggers.sql
-- Adds updated_at audit columns to topics, runs, and carousels with a
-- standard BEFORE UPDATE trigger so every row mutation refreshes the
-- timestamp without app-layer code.
--
-- Why: existing tables have created_at but no updated_at. Without it there's
-- no way to answer "when did this row last change" without scanning audit
-- logs we don't have. updated_at is the cheapest audit primitive.
--
-- Additive only — fork-syncs cleanly to the client's database.

-- One shared trigger function — refreshes updated_at on UPDATE.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Topics
alter table public.topics
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists topics_touch_updated_at on public.topics;
create trigger topics_touch_updated_at
  before update on public.topics
  for each row
  execute function public.touch_updated_at();

-- Runs
alter table public.runs
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists runs_touch_updated_at on public.runs;
create trigger runs_touch_updated_at
  before update on public.runs
  for each row
  execute function public.touch_updated_at();

-- Carousels
alter table public.carousels
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists carousels_touch_updated_at on public.carousels;
create trigger carousels_touch_updated_at
  before update on public.carousels
  for each row
  execute function public.touch_updated_at();
