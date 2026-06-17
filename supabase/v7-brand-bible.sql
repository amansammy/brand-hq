-- ============================================================
-- Brand HQ — v7: richer, attributed Brand Bible
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- 1. bible_entries: multiple manifestos + taglines, each showing who added it
-- 2. brand_bible.sections: a flexible jsonb bag of clothing-specific context
-- 3. migrates the existing single manifesto + taglines into bible_entries
-- ============================================================

-- ---------- Flexible context bag on the singleton ----------
alter table public.brand_bible add column if not exists sections jsonb not null default '{}'::jsonb;

-- ---------- Attributed multi-entry content ----------
create table if not exists public.bible_entries (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,            -- 'manifesto' | 'tagline'
  content     text not null,
  position    double precision not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists bible_entries_kind_idx on public.bible_entries (kind, position, created_at);

-- ---------- One-time migration of existing content ----------
-- Existing manifesto -> a manifesto entry (only if we haven't already migrated).
insert into public.bible_entries (kind, content, created_by, created_at)
select 'manifesto', b.manifesto, b.updated_by, coalesce(b.updated_at, now())
from public.brand_bible b
where coalesce(btrim(b.manifesto), '') <> ''
  and not exists (select 1 from public.bible_entries where kind = 'manifesto');

-- Existing taglines[] -> tagline entries (only if none migrated yet).
insert into public.bible_entries (kind, content, created_by, position)
select 'tagline', t.value, b.updated_by, t.ord
from public.brand_bible b,
     lateral jsonb_array_elements_text(coalesce(b.taglines, '[]'::jsonb)) with ordinality as t(value, ord)
where coalesce(btrim(t.value), '') <> ''
  and not exists (select 1 from public.bible_entries where kind = 'tagline');

-- ---------- RLS ----------
alter table public.bible_entries enable row level security;
-- Default permissive policy (in case v6 permissions haven't been applied yet).
drop policy if exists "authenticated full access" on public.bible_entries;
create policy "authenticated full access" on public.bible_entries
  for all to authenticated using (true) with check (true);

-- If the v6 permission function exists, enforce per-user rights (brand module).
do $$
begin
  if to_regprocedure('public.app_can(text,text)') is not null then
    execute 'drop policy if exists "authenticated full access" on public.bible_entries';
    execute 'drop policy if exists "perm_select" on public.bible_entries';
    execute 'drop policy if exists "perm_insert" on public.bible_entries';
    execute 'drop policy if exists "perm_update" on public.bible_entries';
    execute 'drop policy if exists "perm_delete" on public.bible_entries';
    execute 'create policy "perm_select" on public.bible_entries for select to authenticated using (true)';
    execute 'create policy "perm_insert" on public.bible_entries for insert to authenticated with check (public.app_can(''brand'',''edit''))';
    execute 'create policy "perm_update" on public.bible_entries for update to authenticated using (public.app_can(''brand'',''edit'')) with check (public.app_can(''brand'',''edit''))';
    execute 'create policy "perm_delete" on public.bible_entries for delete to authenticated using (public.app_can(''brand'',''edit''))';
  end if;
end$$;

-- ---------- Realtime ----------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.bible_entries';
  exception when duplicate_object then null; end;
end$$;

notify pgrst, 'reload schema';
-- Done.
