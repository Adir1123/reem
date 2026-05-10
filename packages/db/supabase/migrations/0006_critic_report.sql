-- 0006_critic_report.sql
-- Adds a column to persist the critic-pass output (Pass C) of the Hebrew
-- quality overhaul. The critic is a Claude call that scores every Hebrew
-- slide on 7 weighted dimensions (nativeness, voice match, term correctness,
-- bidi correctness, punctuation, pattern fit, specificity) and triggers
-- targeted regeneration of any slide scoring below 8.
--
-- Schema is JSON-flexible because the rubric may evolve. See
-- apps/trigger/src/python/knowledge/qa-rubric-he.md for the contract.
--
-- Additive only — fork-syncs cleanly to the client's database.

alter table public.carousels
  add column if not exists critic_report jsonb;

comment on column public.carousels.critic_report is
  'Output of Pass C (Hebrew quality critic). Shape: { "slides": [{slide_index, hard_fails, scores, weighted_score, recommend, notes}], "carousel_average": float, "carousel_recommend": text }. Null until Pass C runs.';
