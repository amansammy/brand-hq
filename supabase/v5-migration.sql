-- ============================================================
-- Brand HQ — v5 migration
-- Run in SQL Editor, then: NOTIFY pgrst, 'reload schema';
-- Adds: mood boards + freeform fields, suppliers + samples, task dependencies.
-- ============================================================

-- ---------- Mood: multiple boards + freeform canvas + tags ----------
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.moodboard_items add column if not exists board_id uuid references public.boards(id) on delete set null;
alter table public.moodboard_items add column if not exists x     double precision;
alter table public.moodboard_items add column if not exists y     double precision;
alter table public.moodboard_items add column if not exists w     double precision;
alter table public.moodboard_items add column if not exists tags  jsonb not null default '[]'::jsonb;

-- ---------- Suppliers + Sample tracker ----------
create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text default 'manufacturer',  -- fabric | manufacturer | printer | trims | other
  contact     text,
  location    text,
  moq         text,
  lead_time   text,
  rating      int,                            -- 1..5
  url         text,
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.samples (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  supplier_id  uuid references public.suppliers(id) on delete set null,
  garment_id   uuid references public.garments(id) on delete set null,
  status       text not null default 'requested'
                 check (status in ('requested','received','approved','rejected')),
  round        int not null default 1,
  notes        text,
  image_url    text,
  image_path   text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists samples_supplier_idx on public.samples (supplier_id);

-- ---------- Task dependencies ----------
alter table public.tasks add column if not exists depends_on jsonb not null default '[]'::jsonb;

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['boards','suppliers','samples']
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
  foreach t in array array['boards','suppliers','samples']
  loop
    begin execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null; end;
  end loop;
end$$;

notify pgrst, 'reload schema';
