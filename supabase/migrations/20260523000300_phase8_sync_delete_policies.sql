do $$
declare
  policy_tables text[] := array[
    'expenses',
    'categories',
    'payees',
    'fixed_expenses',
    'expense_splits',
    'fixed_expense_snapshots',
    'income_snapshots',
    'savings_snapshots',
    'schedules',
    'category_merge_history',
    'payee_merge_history',
    'settings'
  ];
  tbl text;
begin
  foreach tbl in array policy_tables
  loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format(
      'drop policy if exists %I on public.%I',
      tbl || '_owner_delete',
      tbl
    );

    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      tbl || '_owner_delete',
      tbl
    );
  end loop;
end
$$;
