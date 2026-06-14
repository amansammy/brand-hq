-- ============================================================
-- Brand HQ — Supabase schema
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES  (one row per founder, auto-created on signup)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TASKS  +  MILESTONES
-- ============================================================
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  assignee    uuid references public.profiles(id) on delete set null,
  due_date    date,
  position    double precision not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.milestones (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  due_date    date,
  done        boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- FILE VAULT  (a "file" is a logical doc; it has many versions)
-- ============================================================
create table if not exists public.files (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.file_versions (
  id           uuid primary key default gen_random_uuid(),
  file_id      uuid not null references public.files(id) on delete cascade,
  storage_path text not null,
  file_name    text,
  size_bytes   bigint,
  note         text,
  version_no   int not null default 1,
  is_final     boolean not null default false,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- NOTES  (living docs: manifesto, brand voice, etc.)
-- ============================================================
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Untitled',
  content     text not null default '',
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- MOOD BOARD
-- ============================================================
create table if not exists public.moodboard_items (
  id           uuid primary key default gen_random_uuid(),
  type         text not null default 'image' check (type in ('image','link')),
  url          text,            -- for type=link, or public url of uploaded image
  storage_path text,            -- for uploaded images
  caption      text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- COMMENTS + REACTIONS  (polymorphic: attach to anything)
-- ============================================================
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,   -- 'activity' | 'file' | 'note' | 'moodboard' | 'task'
  entity_id    uuid not null,
  body         text not null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.reactions (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  emoji        text not null default '👍',
  user_id      uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (entity_type, entity_id, user_id, emoji)
);

-- ============================================================
-- ACTIVITY FEED  (the spine — every action gets logged here)
-- ============================================================
create table if not exists public.activity (
  id           uuid primary key default gen_random_uuid(),
  actor        uuid references public.profiles(id) on delete set null,
  verb         text not null,        -- 'posted' | 'created' | 'updated' | 'uploaded' | 'completed' ...
  entity_type  text,                 -- 'task' | 'file' | 'note' | 'moodboard' | 'post' ...
  entity_id    uuid,
  summary      text,                 -- human-readable line shown in the feed
  body         text,                 -- optional longer text (used by manual posts)
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists activity_created_idx on public.activity (created_at desc);
create index if not exists comments_entity_idx on public.comments (entity_type, entity_id);
create index if not exists reactions_entity_idx on public.reactions (entity_type, entity_id);
create index if not exists file_versions_file_idx on public.file_versions (file_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Only the 2 logged-in founders use this, and they fully trust
-- each other -> any authenticated user can read/write everything.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','tasks','milestones','files','file_versions',
    'notes','moodboard_items','comments','reactions','activity'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "authenticated full access" on public.%I;', t);
    execute format($p$
      create policy "authenticated full access" on public.%I
        for all to authenticated using (true) with check (true);
    $p$, t);
  end loop;
end$$;

-- ============================================================
-- REALTIME  (live activity feed + live boards)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'activity','tasks','milestones','files','file_versions',
    'notes','moodboard_items','comments','reactions'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end$$;

-- ============================================================
-- STORAGE BUCKETS  (private 'files', public 'moodboard')
-- ============================================================
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('moodboard', 'moodboard', true)
on conflict (id) do nothing;

-- Storage policies: authenticated users can do everything in both buckets
drop policy if exists "auth read files" on storage.objects;
create policy "auth read files" on storage.objects
  for select to authenticated using (bucket_id in ('files','moodboard'));

drop policy if exists "auth write files" on storage.objects;
create policy "auth write files" on storage.objects
  for insert to authenticated with check (bucket_id in ('files','moodboard'));

drop policy if exists "auth update files" on storage.objects;
create policy "auth update files" on storage.objects
  for update to authenticated using (bucket_id in ('files','moodboard'));

drop policy if exists "auth delete files" on storage.objects;
create policy "auth delete files" on storage.objects
  for delete to authenticated using (bucket_id in ('files','moodboard'));

-- Public can read moodboard images (bucket is public)
drop policy if exists "public read moodboard" on storage.objects;
create policy "public read moodboard" on storage.objects
  for select to public using (bucket_id = 'moodboard');

-- Done.
