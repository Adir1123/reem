-- 0003 — Topic re-runs and cancel support.
--
-- Why:
--   1. The original dedup trigger (0001) flipped a topic to status='posted'
--      forever after the FIRST posted carousel. Each topic actually has ~12
--      candidate YouTube videos but only 3 are pulled per run — there's value
--      left to mine. We now keep the topic 'available', track times_posted,
--      and the application layer skips already-used video_ids on the next run.
--   2. Need a 'cancelled' run status so the cancel button can mark in-flight
--      runs without re-using 'failed'.
--   3. Need an 'exhausted' topic status for when the candidate-skip logic
--      runs out of fresh videos.

-- ---------------------------------------------------------------------------
-- topics — add times_posted counter and 'exhausted' status
-- ---------------------------------------------------------------------------
alter table topics add column if not exists times_posted int not null default 0;

alter table topics drop constraint if exists topics_status_check;
alter table topics add constraint topics_status_check
  check (status in ('available','generating','pending_review','posted','archived','exhausted'));

-- ---------------------------------------------------------------------------
-- runs — add 'cancelled' status
-- ---------------------------------------------------------------------------
alter table runs drop constraint if exists runs_status_check;
alter table runs add constraint runs_status_check
  check (status in ('pending','running','success','failed','cancelled'));

-- ---------------------------------------------------------------------------
-- Replace dedup trigger function:
--   - posted   → increment times_posted + used_at=now(); status returns to
--                'available' so the topic is re-runnable next cycle
--   - rejected → existing logic (return to 'available' if no siblings still
--                in flight; siblings now include 'posted' since posted leaves
--                the topic available, so adjust the sibling check accordingly)
-- ---------------------------------------------------------------------------
create or replace function carousel_status_dedup() returns trigger
language plpgsql as $$
declare
  v_topic_id uuid;
  v_other_active int;
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
       set times_posted = times_posted + 1,
           used_at = now(),
           status = case
             -- Only flip back to available if no siblings are still
             -- pending_review (avoid releasing the topic mid-review).
             when not exists (
               select 1 from carousels c
                 join runs r on r.id = c.run_id
                where r.topic_id = v_topic_id
                  and c.id <> new.id
                  and c.status = 'pending_review'
             ) then 'available'
             else status
           end
     where id = v_topic_id;
    return new;
  end if;

  if new.status = 'rejected' then
    select count(*) into v_other_active
      from carousels c
      join runs r on r.id = c.run_id
     where r.topic_id = v_topic_id
       and c.id <> new.id
       and c.status in ('approved','pending_review');

    if v_other_active = 0 then
      update topics
         set status = 'available'
       where id = v_topic_id
         and status <> 'exhausted';  -- don't resurrect an exhausted topic
    end if;
  end if;

  return new;
end;
$$;
