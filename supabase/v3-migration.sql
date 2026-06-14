-- ============================================================
-- Brand HQ — v3 migration
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Then run:  NOTIFY pgrst, 'reload schema';
-- Adds: universal linking + winning-logo on the Brand Bible.
-- ============================================================

-- ---------- Universal links (polymorphic many-to-many) ----------
create table if not exists public.links (
  id          uuid primary key default gen_random_uuid(),
  from_type   text not null,
  from_id     uuid not null,
  to_type     text not null,
  to_id       uuid not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (from_type, from_id, to_type, to_id)
);
create index if not exists links_from_idx on public.links (from_type, from_id);
create index if not exists links_to_idx   on public.links (to_type, to_id);

-- ---------- Winning logo on the Brand Bible ----------
alter table public.brand_bible add column if not exists logo_url  text;
alter table public.brand_bible add column if not exists logo_path text;

-- ---------- RLS ----------
alter table public.links enable row level security;
drop policy if exists "authenticated full access" on public.links;
create policy "authenticated full access" on public.links
  for all to authenticated using (true) with check (true);

-- ---------- Realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.links;
exception when duplicate_object then null; end $$;

-- Reload the API schema cache so writes work immediately:
notify pgrst, 'reload schema';
