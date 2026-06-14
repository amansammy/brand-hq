-- ============================================================
-- Brand HQ — v4 migration
-- Run in SQL Editor, then run:  NOTIFY pgrst, 'reload schema';
-- Adds: notifications, budget (expenses + allocations), mood link previews.
-- ============================================================

-- ---------- Notifications ----------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade, -- recipient
  actor       uuid references public.profiles(id) on delete set null,
  type        text not null,            -- 'mention' | 'assigned' | 'comment' | 'decision' | 'post'
  body        text,
  link        text,                     -- in-app route to open
  entity_type text,
  entity_id   uuid,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);

-- ---------- Budget ----------
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  amount     numeric not null default 0,
  category   text,
  paid_by    uuid references public.profiles(id) on delete set null,
  spent_on   date not null default current_date,
  note       text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_allocations (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  amount     numeric not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Mood board link previews ----------
alter table public.moodboard_items add column if not exists title         text;
alter table public.moodboard_items add column if not exists preview_image text;

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['notifications','expenses','budget_allocations']
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
  foreach t in array array['notifications','expenses','budget_allocations']
  loop
    begin execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null; end;
  end loop;
end$$;

notify pgrst, 'reload schema';
