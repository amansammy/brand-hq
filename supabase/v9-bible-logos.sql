-- ============================================================
-- Brand HQ — v9: uploadable brand logos in the Brand Bible
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- Multiple labelled marks (main logo, emblem, seal, wordmark…) uploaded directly
-- in the Brand Bible and shown in the exported PDF.
-- ============================================================

create table if not exists public.bible_logos (
  id           uuid primary key default gen_random_uuid(),
  label        text not null default 'Logo',
  url          text not null,
  storage_path text,
  position     double precision not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.bible_logos enable row level security;
drop policy if exists "authenticated full access" on public.bible_logos;
create policy "authenticated full access" on public.bible_logos
  for all to authenticated using (true) with check (true);

-- Enforce per-user rights (brand module) if v6 permissions are installed.
do $$
begin
  if to_regprocedure('public.app_can(text,text)') is not null then
    execute 'drop policy if exists "authenticated full access" on public.bible_logos';
    execute 'drop policy if exists "perm_select" on public.bible_logos';
    execute 'drop policy if exists "perm_insert" on public.bible_logos';
    execute 'drop policy if exists "perm_update" on public.bible_logos';
    execute 'drop policy if exists "perm_delete" on public.bible_logos';
    execute 'create policy "perm_select" on public.bible_logos for select to authenticated using (true)';
    execute 'create policy "perm_insert" on public.bible_logos for insert to authenticated with check (public.app_can(''brand'',''edit''))';
    execute 'create policy "perm_update" on public.bible_logos for update to authenticated using (public.app_can(''brand'',''edit'')) with check (public.app_can(''brand'',''edit''))';
    execute 'create policy "perm_delete" on public.bible_logos for delete to authenticated using (public.app_can(''brand'',''edit''))';
  end if;
end$$;

-- ---------- Realtime ----------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.bible_logos';
  exception when duplicate_object then null; end;
end$$;

notify pgrst, 'reload schema';
-- Done.
