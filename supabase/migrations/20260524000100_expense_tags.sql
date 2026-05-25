create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  name text not null,
  normalized_name text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  device_id text,
  unique(user_id, name),
  unique(user_id, local_id)
);

create table if not exists public.expense_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  expense_id text not null,
  tag_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  device_id text,
  unique(user_id, local_id)
);

create index if not exists idx_tags_user_updated_at on public.tags(user_id, updated_at desc);
create index if not exists idx_tags_user_deleted_at on public.tags(user_id, deleted_at);
create index if not exists idx_expense_tags_user_updated_at on public.expense_tags(user_id, updated_at desc);
create index if not exists idx_expense_tags_user_deleted_at on public.expense_tags(user_id, deleted_at);
create index if not exists idx_expense_tags_expense_id on public.expense_tags(user_id, expense_id);
create index if not exists idx_expense_tags_tag_id on public.expense_tags(user_id, tag_id);

alter table public.tags enable row level security;
alter table public.expense_tags enable row level security;

drop policy if exists "Users can view own tags" on public.tags;
drop policy if exists "Users can insert own tags" on public.tags;
drop policy if exists "Users can update own tags" on public.tags;
drop policy if exists "Users can delete own tags" on public.tags;

create policy "Users can view own tags" on public.tags
for select using (auth.uid() = user_id);
create policy "Users can insert own tags" on public.tags
for insert with check (auth.uid() = user_id);
create policy "Users can update own tags" on public.tags
for update using (auth.uid() = user_id);
create policy "Users can delete own tags" on public.tags
for delete using (auth.uid() = user_id);

drop policy if exists "Users can view own expense tags" on public.expense_tags;
drop policy if exists "Users can insert own expense tags" on public.expense_tags;
drop policy if exists "Users can update own expense tags" on public.expense_tags;
drop policy if exists "Users can delete own expense tags" on public.expense_tags;

create policy "Users can view own expense tags" on public.expense_tags
for select using (auth.uid() = user_id);
create policy "Users can insert own expense tags" on public.expense_tags
for insert with check (auth.uid() = user_id);
create policy "Users can update own expense tags" on public.expense_tags
for update using (auth.uid() = user_id);
create policy "Users can delete own expense tags" on public.expense_tags
for delete using (auth.uid() = user_id);
