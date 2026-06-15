-- ============================================================
-- Brand HQ — v6: granular per-user permissions
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- Adds role + permissions to profiles and ENFORCES them at the database
-- level: a teammate without (say) files.delete physically cannot delete a
-- file, regardless of the UI. SELECT stays open to all signed-in founders;
-- only writes are gated. The owner can never be locked out.
-- ============================================================

-- ---------- Columns ----------
alter table public.profiles add column if not exists role text not null default 'viewer';
alter table public.profiles add column if not exists permissions jsonb not null default '{}'::jsonb;

-- Existing teammates keep full access; new sign-ups start as 'viewer'.
update public.profiles set role = 'full' where role is null or role = 'viewer';

-- Make the configured admin email the owner.
update public.profiles p set role = 'owner'
  from auth.users u
  where u.id = p.id and lower(u.email) = 'amansammy98@gmail.com';

-- ---------- Permission check (used by every policy) ----------
-- Returns true if the calling user may perform p_action on p_module.
--   owner            -> everything (incl. managing permissions)
--   full             -> everything EXCEPT managing permissions ('__admin')
--   anyone else      -> only what's listed in their permissions json
create or replace function public.app_can(p_module text, p_action text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select case
      when pr.role = 'owner' then true
      when p_module = '__admin' then false
      when pr.role = 'full' then true
      when pr.permissions -> p_module ? p_action then true
      else false
    end
    from public.profiles pr
    where pr.id = auth.uid()
  ), false);
$$;

-- ---------- Guard: only the owner can change roles/permissions ----------
create or replace function public.guard_profile_perms()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.permissions is distinct from old.permissions)
     and not public.app_can('__admin', 'manage') then
    raise exception 'Only the owner can change roles or permissions';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_perms on public.profiles;
create trigger guard_profile_perms
  before update on public.profiles
  for each row execute function public.guard_profile_perms();

-- ---------- Profiles RLS (read open; role/permissions guarded by trigger) ----------
do $$
begin
  execute 'drop policy if exists "authenticated full access" on public.profiles';
  execute 'drop policy if exists "profiles_select" on public.profiles';
  execute 'drop policy if exists "profiles_insert" on public.profiles';
  execute 'drop policy if exists "profiles_update" on public.profiles';
  execute 'drop policy if exists "profiles_delete" on public.profiles';
  execute 'create policy "profiles_select" on public.profiles for select to authenticated using (true)';
  execute 'create policy "profiles_insert" on public.profiles for insert to authenticated with check (true)';
  execute 'create policy "profiles_update" on public.profiles for update to authenticated using (true) with check (true)';
  execute 'create policy "profiles_delete" on public.profiles for delete to authenticated using (public.app_can(''__admin'',''manage''))';
end$$;

-- ---------- Data tables: SELECT open, writes gated per module/action ----------
do $$
declare r record;
begin
  for r in
    select * from (values
      ('tasks',            'tasks',     'create', 'edit', 'delete'),
      ('milestones',       'tasks',     'create', 'edit', 'delete'),
      ('files',            'files',     'upload', 'edit', 'delete'),
      ('file_versions',    'files',     'upload', 'edit', 'delete'),
      ('notes',            'notes',     'create', 'edit', 'delete'),
      ('moodboard_items',  'mood',      'add',    'add',  'delete'),
      ('boards',           'mood',      'add',    'add',  'delete'),
      ('collections',      'drops',     'create', 'edit', 'delete'),
      ('garments',         'drops',     'create', 'edit', 'delete'),
      ('arenas',           'arena',     'create', 'edit', 'delete'),
      ('arena_candidates', 'arena',     'create', 'vote', 'delete'),
      ('brand_bible',      'brand',     'edit',   'edit', 'edit'),
      ('palette_colors',   'brand',     'edit',   'edit', 'edit'),
      ('expenses',         'budget',    'edit',   'edit', 'edit'),
      ('budget_allocations','budget',   'edit',   'edit', 'edit'),
      ('suppliers',        'suppliers', 'create', 'edit', 'delete'),
      ('samples',          'suppliers', 'create', 'edit', 'delete'),
      ('activity',         'feed',      'post',   'moderate', 'moderate')
    ) as t(tbl, modkey, ins, upd, del)
  loop
    -- table may not exist if an earlier migration was skipped; ignore those.
    if to_regclass('public.' || r.tbl) is null then continue; end if;
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('drop policy if exists "authenticated full access" on public.%I', r.tbl);
    execute format('drop policy if exists "perm_select" on public.%I', r.tbl);
    execute format('drop policy if exists "perm_insert" on public.%I', r.tbl);
    execute format('drop policy if exists "perm_update" on public.%I', r.tbl);
    execute format('drop policy if exists "perm_delete" on public.%I', r.tbl);
    execute format('create policy "perm_select" on public.%I for select to authenticated using (true)', r.tbl);
    execute format('create policy "perm_insert" on public.%I for insert to authenticated with check (public.app_can(%L,%L))', r.tbl, r.modkey, r.ins);
    execute format('create policy "perm_update" on public.%I for update to authenticated using (public.app_can(%L,%L)) with check (public.app_can(%L,%L))', r.tbl, r.modkey, r.upd, r.modkey, r.upd);
    execute format('create policy "perm_delete" on public.%I for delete to authenticated using (public.app_can(%L,%L))', r.tbl, r.modkey, r.del);
  end loop;
end$$;

-- comments, reactions, links, notifications stay open to all signed-in founders
-- (anyone with view access can discuss). They keep their "authenticated full access" policy.

-- ---------- Realtime: push permission changes live ----------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.profiles';
  exception when duplicate_object then null; end;
end$$;

notify pgrst, 'reload schema';
-- Done.
