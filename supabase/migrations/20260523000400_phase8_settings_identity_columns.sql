-- Phase 8 follow-up: finish offline-first sync metadata on settings rows.
-- The client sync layer treats settings like other synced entities and expects
-- local identity plus full tombstone metadata to exist server-side.

alter table public.settings
  add column if not exists local_id text,
  add column if not exists created_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists device_id text;

update public.settings
set local_id = coalesce(local_id, key, id::text)
where local_id is null;

update public.settings
set created_at = coalesce(created_at, updated_at, now())
where created_at is null;

update public.settings
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.settings
  alter column local_id set not null;

alter table public.settings
  alter column created_at set default now();

alter table public.settings
  alter column updated_at set default now();

create unique index if not exists settings_user_id_local_id_key
  on public.settings (user_id, local_id);
