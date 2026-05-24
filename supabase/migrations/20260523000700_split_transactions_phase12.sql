create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  date text not null,
  payee_id text,
  payee_name_snapshot text,
  description text,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  device_id text
);

alter table public.expense_splits enable row level security;

drop policy if exists expense_splits_owner_select on public.expense_splits;
create policy expense_splits_owner_select on public.expense_splits
  for select using (auth.uid() = user_id);

drop policy if exists expense_splits_owner_insert on public.expense_splits;
create policy expense_splits_owner_insert on public.expense_splits
  for insert with check (auth.uid() = user_id);

drop policy if exists expense_splits_owner_update on public.expense_splits;
create policy expense_splits_owner_update on public.expense_splits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists expense_splits_owner_delete on public.expense_splits;
create policy expense_splits_owner_delete on public.expense_splits
  for delete using (auth.uid() = user_id);

create unique index if not exists expense_splits_user_id_local_id_key
  on public.expense_splits (user_id, local_id);

create index if not exists expense_splits_user_id_updated_at_idx
  on public.expense_splits (user_id, updated_at);

create index if not exists expense_splits_user_id_deleted_at_idx
  on public.expense_splits (user_id, deleted_at);

alter table public.expenses
  add column if not exists split_id text;

create index if not exists expenses_user_id_split_id_idx
  on public.expenses (user_id, split_id);
