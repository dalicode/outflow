alter table public.categories
  drop column if exists archived_at;

alter table public.payees
  drop column if exists archived_at;

alter table public.fixed_expenses
  drop column if exists archived_at;
