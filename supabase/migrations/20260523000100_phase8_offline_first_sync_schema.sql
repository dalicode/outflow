-- Phase 8: offline-first sync schema standardization for Supabase.
-- This migration intentionally keeps `settings` uniqueness on (user_id, key).
-- Legacy bridge note:
-- We can safely infer server-side `local_id` only from the prior server-side `id`.
-- If a client has already generated unrelated local IDs that were never uploaded,
-- SQL alone cannot infer those mappings; client reconciliation remains required.

create extension if not exists pgcrypto;

do $$
declare
  synced_tables text[] := array[
    'categories',
    'payees',
    'fixed_expenses',
    'expenses',
    'fixed_expense_snapshots',
    'income_snapshots',
    'savings_snapshots',
    'schedules',
    'category_merge_history',
    'payee_merge_history'
  ];
  tbl text;
  id_data_type text;
  fk_name text;
  uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  foreach tbl in array synced_tables
  loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('alter table public.%I add column if not exists local_id text', tbl);
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', tbl);
    execute format('alter table public.%I add column if not exists device_id text', tbl);
    execute format('alter table public.%I add column if not exists created_at timestamptz', tbl);
    execute format('alter table public.%I add column if not exists updated_at timestamptz', tbl);
    execute format('alter table public.%I add column if not exists legacy_id text', tbl);

    execute format(
      'update public.%I set legacy_id = coalesce(legacy_id, id::text)',
      tbl
    );
    execute format(
      'update public.%I set local_id = coalesce(local_id, legacy_id, id::text) where local_id is null',
      tbl
    );
    execute format(
      'update public.%I set created_at = coalesce(created_at, updated_at, now()) where created_at is null',
      tbl
    );
    execute format(
      'update public.%I set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null',
      tbl
    );

    select c.data_type
    into id_data_type
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = tbl
      and c.column_name = 'id';

    execute format('alter table public.%I add column if not exists new_uuid_id uuid', tbl);

    if id_data_type is distinct from 'uuid' then
      execute format(
        $sql$
        update public.%1$I
        set new_uuid_id = case
          when legacy_id ~* %2$L then legacy_id::uuid
          else gen_random_uuid()
        end
        where new_uuid_id is null
        $sql$,
        tbl,
        uuid_pattern
      );
    else
      execute format(
        'update public.%I set new_uuid_id = coalesce(new_uuid_id, id) where new_uuid_id is null',
        tbl
      );
    end if;
  end loop;

  if to_regclass('public.categories') is not null then
    update public.expenses as expenses
    set category_id = categories.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.categories
    ) as categories
    where expenses.category_id = categories.legacy_id
      and expenses.category_id is distinct from categories.mapped_id::text;

    update public.categories as categories
    set merged_into_category_id = mapped_categories.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.categories
    ) as mapped_categories
    where categories.merged_into_category_id = mapped_categories.legacy_id
      and categories.merged_into_category_id is distinct from mapped_categories.mapped_id::text;

    update public.category_merge_history as history
    set source_category_id = categories.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.categories
    ) as categories
    where history.source_category_id = categories.legacy_id
      and history.source_category_id is distinct from categories.mapped_id::text;

    update public.category_merge_history as history
    set target_category_id = categories.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.categories
    ) as categories
    where history.target_category_id = categories.legacy_id
      and history.target_category_id is distinct from categories.mapped_id::text;

    update public.schedules as schedules
    set category_id = categories.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.categories
    ) as categories
    where schedules.category_id = categories.legacy_id
      and schedules.category_id is distinct from categories.mapped_id::text;
  end if;

  if to_regclass('public.payees') is not null then
    update public.expenses as expenses
    set payee_id = payees.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.payees
    ) as payees
    where expenses.payee_id = payees.legacy_id
      and expenses.payee_id is distinct from payees.mapped_id::text;

    update public.payees as payees
    set merged_into_payee_id = mapped_payees.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.payees
    ) as mapped_payees
    where payees.merged_into_payee_id = mapped_payees.legacy_id
      and payees.merged_into_payee_id is distinct from mapped_payees.mapped_id::text;

    update public.payee_merge_history as history
    set source_payee_id = payees.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.payees
    ) as payees
    where history.source_payee_id = payees.legacy_id
      and history.source_payee_id is distinct from payees.mapped_id::text;

    update public.payee_merge_history as history
    set target_payee_id = payees.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.payees
    ) as payees
    where history.target_payee_id = payees.legacy_id
      and history.target_payee_id is distinct from payees.mapped_id::text;

    update public.schedules as schedules
    set payee_id = payees.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.payees
    ) as payees
    where schedules.payee_id = payees.legacy_id
      and schedules.payee_id is distinct from payees.mapped_id::text;
  end if;

  if to_regclass('public.fixed_expenses') is not null then
    update public.fixed_expense_snapshots as snapshots
    set fixed_expense_id = fixed_expenses.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.fixed_expenses
    ) as fixed_expenses
    where snapshots.fixed_expense_id = fixed_expenses.legacy_id
      and snapshots.fixed_expense_id is distinct from fixed_expenses.mapped_id::text;

    update public.schedules as schedules
    set target_id = fixed_expenses.mapped_id::text
    from (
      select legacy_id, new_uuid_id as mapped_id
      from public.fixed_expenses
    ) as fixed_expenses
    where schedules.target_id = fixed_expenses.legacy_id
      and schedules.target_id is distinct from fixed_expenses.mapped_id::text;
  end if;

  foreach tbl in array synced_tables
  loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    select c.data_type
    into id_data_type
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = tbl
      and c.column_name = 'id';

    if id_data_type is distinct from 'uuid' then
      execute format('alter table public.%I drop constraint if exists %I', tbl, tbl || '_pkey');
      execute format('alter table public.%I drop column if exists id', tbl);
      execute format('alter table public.%I rename column new_uuid_id to id', tbl);
      execute format('alter table public.%I alter column id set not null', tbl);
      execute format('alter table public.%I alter column id set default gen_random_uuid()', tbl);
      execute format('alter table public.%I add constraint %I primary key (id)', tbl, tbl || '_pkey');
    else
      execute format('alter table public.%I alter column id set default gen_random_uuid()', tbl);
      execute format('alter table public.%I drop column if exists new_uuid_id', tbl);
    end if;

    execute format(
      'update public.%I set local_id = coalesce(local_id, legacy_id, id::text, gen_random_uuid()::text) where local_id is null',
      tbl
    );

    execute format('alter table public.%I alter column user_id set not null', tbl);
    execute format('alter table public.%I alter column local_id set not null', tbl);
    execute format('alter table public.%I alter column updated_at set not null', tbl);
    execute format('alter table public.%I alter column created_at set default now()', tbl);
    execute format('alter table public.%I alter column updated_at set default now()', tbl);

    for fk_name in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      join unnest(con.conkey) with ordinality as k(attnum, ord) on true
      join pg_attribute att on att.attrelid = rel.oid and att.attnum = k.attnum
      where nsp.nspname = 'public'
        and rel.relname = tbl
        and con.contype = 'f'
        and att.attname = 'user_id'
    loop
      execute format('alter table public.%I drop constraint if exists %I', tbl, fk_name);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
      tbl,
      tbl || '_user_id_fkey'
    );

    execute format(
      'create unique index if not exists %I on public.%I (user_id, local_id)',
      tbl || '_user_id_local_id_key',
      tbl
    );
  end loop;
end
$$;

do $$
declare
  fk_name text;
begin
  if to_regclass('public.settings') is null then
    return;
  end if;

  alter table public.settings alter column user_id set not null;
  update public.settings set updated_at = coalesce(updated_at, now()) where updated_at is null;
  alter table public.settings alter column updated_at set not null;
  alter table public.settings alter column updated_at set default now();

  for fk_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join unnest(con.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = k.attnum
    where nsp.nspname = 'public'
      and rel.relname = 'settings'
      and con.contype = 'f'
      and att.attname = 'user_id'
  loop
    execute format('alter table public.settings drop constraint if exists %I', fk_name);
  end loop;

  alter table public.settings
    add constraint settings_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'settings'
      and con.contype = 'u'
      and con.conname = 'settings_user_id_key_key'
  ) then
    alter table public.settings
      add constraint settings_user_id_key_key unique (user_id, key);
  end if;
end
$$;

do $$
declare
  policy_tables text[] := array[
    'expenses',
    'categories',
    'payees',
    'fixed_expenses',
    'fixed_expense_snapshots',
    'income_snapshots',
    'savings_snapshots',
    'schedules',
    'category_merge_history',
    'payee_merge_history',
    'settings'
  ];
  tbl text;
  policy_name text;
begin
  foreach tbl in array policy_tables
  loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    for policy_name in
      select p.policyname
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = tbl
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, tbl);
    end loop;

    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      tbl || '_owner_select',
      tbl
    );
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      tbl || '_owner_insert',
      tbl
    );
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      tbl || '_owner_update',
      tbl
    );
  end loop;
end
$$;
