-- Outflow initial Supabase schema

-- expenses
create table if not exists public.expenses (
  id text primary key,
  user_id uuid references auth.users not null,
  date text not null,
  category_id text,
  payee_id text,
  description text,
  amount numeric not null,
  updated_at timestamptz default now()
);
alter table public.expenses enable row level security;
drop policy if exists "users own expenses" on public.expenses;
create policy "users own expenses" on public.expenses
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- categories
create table if not exists public.categories (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  is_archived boolean default false,
  archived_at timestamptz,
  merged_into_category_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, name)
);
alter table public.categories enable row level security;
drop policy if exists "users own categories" on public.categories;
create policy "users own categories" on public.categories
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- payees
create table if not exists public.payees (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  is_archived boolean default false,
  archived_at timestamptz,
  merged_into_payee_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, name)
);
alter table public.payees enable row level security;
drop policy if exists "users own payees" on public.payees;
create policy "users own payees" on public.payees
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- fixed_expenses
create table if not exists public.fixed_expenses (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  amount numeric not null,
  is_archived boolean default false,
  archived_at timestamptz,
  updated_at timestamptz default now()
);
alter table public.fixed_expenses enable row level security;
drop policy if exists "users own fixed_expenses" on public.fixed_expenses;
create policy "users own fixed_expenses" on public.fixed_expenses
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- fixed_expense_snapshots
create table if not exists public.fixed_expense_snapshots (
  id text primary key,
  user_id uuid references auth.users not null,
  fixed_expense_id text not null,
  name_snapshot text not null,
  amount_snapshot numeric not null,
  month int not null,
  year int not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, fixed_expense_id, year, month)
);
alter table public.fixed_expense_snapshots enable row level security;
drop policy if exists "users own fixed_expense_snapshots" on public.fixed_expense_snapshots;
create policy "users own fixed_expense_snapshots" on public.fixed_expense_snapshots
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- income_snapshots
create table if not exists public.income_snapshots (
  id text primary key,
  user_id uuid references auth.users not null,
  year int not null,
  month int not null,
  amount_snapshot numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, year, month)
);
alter table public.income_snapshots enable row level security;
drop policy if exists "users own income_snapshots" on public.income_snapshots;
create policy "users own income_snapshots" on public.income_snapshots
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- savings_snapshots
create table if not exists public.savings_snapshots (
  id text primary key,
  user_id uuid references auth.users not null,
  year int not null,
  month int not null,
  rate_snapshot numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, year, month)
);
alter table public.savings_snapshots enable row level security;
drop policy if exists "users own savings_snapshots" on public.savings_snapshots;
create policy "users own savings_snapshots" on public.savings_snapshots
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- schedules
create table if not exists public.schedules (
  id text primary key,
  user_id uuid references auth.users not null,
  type text not null,
  target_id text,
  effective_year int not null,
  effective_month int not null,
  new_value numeric not null,
  previous_value numeric,
  materialized_at timestamptz,
  is_active int not null default 1,
  note text,
  day int,
  category_id text,
  payee_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.schedules enable row level security;
drop policy if exists "users own schedules" on public.schedules;
create policy "users own schedules" on public.schedules
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- category_merge_history
create table if not exists public.category_merge_history (
  id text primary key,
  user_id uuid references auth.users not null,
  source_category_id text not null,
  target_category_id text not null,
  affected_expense_ids int[] not null default '{}',
  created_at timestamptz not null,
  reverted_at timestamptz,
  updated_at timestamptz default now()
);
alter table public.category_merge_history enable row level security;
drop policy if exists "users own category_merge_history" on public.category_merge_history;
create policy "users own category_merge_history" on public.category_merge_history
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- payee_merge_history
create table if not exists public.payee_merge_history (
  id text primary key,
  user_id uuid references auth.users not null,
  source_payee_id text not null,
  target_payee_id text not null,
  affected_expense_ids int[] not null default '{}',
  created_at timestamptz not null,
  reverted_at timestamptz,
  updated_at timestamptz default now()
);
alter table public.payee_merge_history enable row level security;
drop policy if exists "users own payee_merge_history" on public.payee_merge_history;
create policy "users own payee_merge_history" on public.payee_merge_history
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- settings
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  key text not null,
  value text not null,
  updated_at timestamptz default now(),
  unique (user_id, key)
);
alter table public.settings enable row level security;
drop policy if exists "users own settings" on public.settings;
create policy "users own settings" on public.settings
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  selected_theme text,
  backup_password text,
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "users own profile" on public.profiles;
create policy "users own profile" on public.profiles
  using (auth.uid() = id) with check (auth.uid() = id);

-- auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
