-- ============================================================
-- Brand HQ — v8: per-garment specs
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- Fit / fabric / sizing / construction vary piece to piece, so they live on
-- each garment (in Drops), not generalised in the Brand Bible.
-- ============================================================

alter table public.garments add column if not exists fabric       text;
alter table public.garments add column if not exists fit          text;
alter table public.garments add column if not exists sizes        text;
alter table public.garments add column if not exists construction text;

notify pgrst, 'reload schema';
-- Done.
