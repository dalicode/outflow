create table if not exists public.tag_merge_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  source_tag_id text not null,
  target_tag_id text not null,
  affected_expense_tag_ids int[] not null default '{}',
  duplicate_expense_tag_ids int[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reverted_at timestamptz,
  deleted_at timestamptz,
  device_id text,
  unique(user_id, local_id)
);

create index if not exists idx_tag_merge_history_user_updated_at
  on public.tag_merge_history(user_id, updated_at desc);
create index if not exists idx_tag_merge_history_user_deleted_at
  on public.tag_merge_history(user_id, deleted_at);
create index if not exists idx_tag_merge_history_source_tag_id
  on public.tag_merge_history(user_id, source_tag_id);
create index if not exists idx_tag_merge_history_target_tag_id
  on public.tag_merge_history(user_id, target_tag_id);

alter table public.tag_merge_history enable row level security;

drop policy if exists "Users can view own tag merge history" on public.tag_merge_history;
drop policy if exists "Users can insert own tag merge history" on public.tag_merge_history;
drop policy if exists "Users can update own tag merge history" on public.tag_merge_history;
drop policy if exists "Users can delete own tag merge history" on public.tag_merge_history;

create policy "Users can view own tag merge history" on public.tag_merge_history
for select using (auth.uid() = user_id);
create policy "Users can insert own tag merge history" on public.tag_merge_history
for insert with check (auth.uid() = user_id);
create policy "Users can update own tag merge history" on public.tag_merge_history
for update using (auth.uid() = user_id);
create policy "Users can delete own tag merge history" on public.tag_merge_history
for delete using (auth.uid() = user_id);
