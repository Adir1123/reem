-- 0005 — Per-slide chat editor: cross-slide scope.
--
-- Why:
--   The chat editor (0004) was per-slide only. The client now wants
--   "תגדיל את הגוף בכל השקופיות" to apply a single style patch to all 7
--   slides. We add a scope flag to slide_chats and a snapshot column for
--   carousel-scope reverts.

alter table slide_chats
  add column if not exists scope text not null default 'slide'
    check (scope in ('slide','carousel'));

-- For scope='carousel' rows we snapshot the entire pre-edit slides array
-- (an ordered list of Slide JSONB objects) so the "בטל שינוי" button can
-- restore in one round-trip without a model call. Per-slide rows continue
-- to use the existing pre_slide_json column.
alter table slide_chats
  add column if not exists pre_slides_json jsonb;
