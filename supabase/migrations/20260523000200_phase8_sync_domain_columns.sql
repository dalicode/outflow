-- Phase 8 follow-up: add domain-specific sync columns that the offline-first client now uploads.
-- This is intentionally forward-only so environments that already ran earlier phase 8 migrations
-- can be brought up to date without rewriting migration history.

alter table public.categories
  add column if not exists normalized_name text;

update public.categories
set normalized_name = lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
where normalized_name is null
  and name is not null;

alter table public.payees
  add column if not exists normalized_name text;

update public.payees
set normalized_name = lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
where normalized_name is null
  and name is not null;

alter table public.expenses
  add column if not exists category_name_snapshot text,
  add column if not exists payee_name_snapshot text;

alter table public.settings
  add column if not exists deleted_at timestamptz,
  add column if not exists device_id text;
