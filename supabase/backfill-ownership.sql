-- Reassign content that lost its owner (after the old user was deleted)
-- to your current account. Safe to run while you're the only user.
-- Change the email below if needed.

do $$
declare uid uuid;
begin
  select id into uid from auth.users where email = 'amansammy98@gmail.com';
  if uid is null then raise exception 'No user found for that email'; end if;

  update public.activity        set actor       = uid where actor       is null;
  update public.tasks           set created_by  = uid where created_by  is null;
  update public.milestones      set created_by  = uid where created_by  is null;
  update public.files           set created_by  = uid where created_by  is null;
  update public.file_versions   set uploaded_by = uid where uploaded_by is null;
  update public.notes           set updated_by  = uid where updated_by  is null;
  update public.moodboard_items set created_by  = uid where created_by  is null;
  update public.comments        set created_by  = uid where created_by  is null;
end$$;
