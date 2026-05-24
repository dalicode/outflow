-- Phase 8 cleanup: remove temporary legacy bridge columns after UUID/local_id migration.

do $$
declare
  synced_tables text[] := array[
    'categories',
    'payees',
    'fixed_expenses',
    'expense_splits',
    'expenses',
    'fixed_expense_snapshots',
    'income_snapshots',
    'savings_snapshots',
    'schedules',
    'category_merge_history',
    'payee_merge_history'
  ];
  tbl text;
begin
  foreach tbl in array synced_tables
  loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('alter table public.%I drop column if exists legacy_id', tbl);
  end loop;
end
$$;
