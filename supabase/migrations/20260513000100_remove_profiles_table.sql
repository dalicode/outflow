-- Remove app-level dependency on public.profiles.
-- Migrate any remaining profile-owned app settings into public.settings first.

-- Move backup password into synced settings.
insert into public.settings (user_id, key, value, updated_at)
select
  p.id as user_id,
  'backupPassword' as key,
  to_jsonb(p.backup_password)::text as value,
  coalesce(p.updated_at, now()) as updated_at
from public.profiles p
where p.backup_password is not null
on conflict (user_id, key) do update
set
  value = excluded.value,
  updated_at = excluded.updated_at
where public.settings.updated_at is null
   or excluded.updated_at >= public.settings.updated_at;

-- If a user only ever stored theme in profiles, seed uiSettings with that theme.
insert into public.settings (user_id, key, value, updated_at)
select
  p.id as user_id,
  'uiSettings' as key,
  jsonb_build_object('visualTheme', p.selected_theme)::text as value,
  coalesce(p.updated_at, now()) as updated_at
from public.profiles p
where p.selected_theme is not null
  and not exists (
    select 1
    from public.settings s
    where s.user_id = p.id
      and s.key = 'uiSettings'
  );

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop policy if exists "users own profile" on public.profiles;
drop table if exists public.profiles;
