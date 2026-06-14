-- ============================================================
-- Brand HQ — v2 migration
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
-- Adds: Drop planner, Logo Arena, Brand Bible, palette, task upgrades.
-- ============================================================

-- ---------- Task upgrades ----------
alter table public.tasks add column if not exists priority text not null default 'med';
alter table public.tasks add column if not exists labels   jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists subtasks jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.tasks add constraint tasks_priority_chk check (priority in ('low','med','high'));
exception when duplicate_object then null; end $$;

-- ---------- Collections / Drops ----------
create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  theme       text,
  status      text not null default 'planning' check (status in ('planning','production','launched')),
  launch_date date,
  cover_url   text,
  cover_path  text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.garments (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid references public.collections(id) on delete cascade,
  name          text not null,
  category      text,
  stage         text not null default 'idea'
                  check (stage in ('idea','sketch','sample','approved','production','done')),
  image_url     text,
  image_path    text,
  notes         text,
  price         numeric,
  position      double precision not null default 0,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists garments_collection_idx on public.garments (collection_id);

-- ---------- Logo Arena ----------
create table if not exists public.arenas (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.arena_candidates (
  id          uuid primary key default gen_random_uuid(),
  arena_id    uuid references public.arenas(id) on delete cascade,
  label       text,
  rationale   text,
  image_url   text,
  image_path  text,
  is_winner   boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists candidates_arena_idx on public.arena_candidates (arena_id);

-- ---------- Brand Bible (singleton) ----------
create table if not exists public.brand_bible (
  id         int primary key default 1 check (id = 1),
  manifesto  text default '',
  voice_do   jsonb default '[]'::jsonb,
  voice_dont jsonb default '[]'::jsonb,
  typography text default '',
  taglines   jsonb default '[]'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now()
);
insert into public.brand_bible (id) values (1) on conflict (id) do nothing;

create table if not exists public.palette_colors (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  hex        text not null default '#000000',
  code       text,
  position   double precision not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- RLS: authenticated full access ----------
do $$
declare t text;
begin
  foreach t in array array[
    'collections','garments','arenas','arena_candidates','brand_bible','palette_colors'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "authenticated full access" on public.%I;', t);
    execute format('create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end$$;

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array[
    'collections','garments','arenas','arena_candidates','brand_bible','palette_colors'
  ]
  loop
    begin execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null; end;
  end loop;
end$$;

-- ---------- Storage: public 'brand' bucket (covers, sketches, logos) ----------
insert into storage.buckets (id, name, public) values ('brand', 'brand', true)
on conflict (id) do nothing;

drop policy if exists "auth write brand" on storage.objects;
create policy "auth write brand" on storage.objects
  for insert to authenticated with check (bucket_id = 'brand');
drop policy if exists "auth update brand" on storage.objects;
create policy "auth update brand" on storage.objects
  for update to authenticated using (bucket_id = 'brand');
drop policy if exists "auth delete brand" on storage.objects;
create policy "auth delete brand" on storage.objects
  for delete to authenticated using (bucket_id = 'brand');
drop policy if exists "public read brand" on storage.objects;
create policy "public read brand" on storage.objects
  for select to public using (bucket_id = 'brand');

-- Done.
