# Supabase Setup

## 1. Create a Supabase project

Go to https://supabase.com, create a new project, and note your **Project URL** and **anon public key**.

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run the SQL schema

In the Supabase dashboard → **SQL Editor**, run the following:

```sql
-- expenses
create table expenses (
  id          text primary key,
  user_id     uuid references auth.users not null,
  date        text not null,
  category_id text,
  payee_id    text,
  description text,
  amount      numeric not null,
  updated_at  timestamptz default now()
);
alter table expenses enable row level security;
create policy "users own expenses" on expenses
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- categories
create table categories (
  id          text primary key,
  user_id     uuid references auth.users not null,
  name        text not null,
  is_archived boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table categories enable row level security;
create policy "users own categories" on categories
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- payees
create table payees (
  id          text primary key,
  user_id     uuid references auth.users not null,
  name        text not null,
  is_archived boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table payees enable row level security;
create policy "users own payees" on payees
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- fixed_expenses
create table fixed_expenses (
  id         text primary key,
  user_id    uuid references auth.users not null,
  name       text not null,
  amount     numeric not null,
  is_archived boolean default false,
  archived_at timestamptz,
  updated_at timestamptz default now()
);
alter table fixed_expenses enable row level security;
create policy "users own fixed_expenses" on fixed_expenses
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- fixed_expense_snapshots (historical record — never mutated after insert)
create table fixed_expense_snapshots (
  id                 text primary key,
  user_id            uuid references auth.users not null,
  fixed_expense_id   text not null,
  name_snapshot      text not null,
  amount_snapshot    numeric not null,
  month              int not null,  -- 1-12
  year               int not null,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique (user_id, fixed_expense_id, year, month)
);
alter table fixed_expense_snapshots enable row level security;
create policy "users own fixed_expense_snapshots" on fixed_expense_snapshots
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- income_snapshots (historical record — synced across devices)
create table income_snapshots (
  id              text primary key,
  user_id         uuid references auth.users not null,
  year            int not null,
  month           int not null,
  amount_snapshot numeric not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (user_id, year, month)
);
alter table income_snapshots enable row level security;
create policy "users own income_snapshots" on income_snapshots
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- savings_snapshots (historical record — synced across devices)
create table savings_snapshots (
  id            text primary key,
  user_id       uuid references auth.users not null,
  year          int not null,
  month         int not null,
  rate_snapshot numeric not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (user_id, year, month)
);
alter table savings_snapshots enable row level security;
create policy "users own savings_snapshots" on savings_snapshots
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- schedules (synced so future changes stay consistent across devices)
create table schedules (
  id              text primary key,
  user_id         uuid references auth.users not null,
  type            text not null,
  target_id       text,
  effective_year  int not null,
  effective_month int not null,
  new_value       numeric not null,
  previous_value  numeric,
  materialized_at timestamptz,
  is_active       int not null default 1,
  note            text,
  day             int,
  category_id     text,
  payee_id        text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table schedules enable row level security;
create policy "users own schedules" on schedules
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- merge history tables (synced so cross-device merges stay consistent)
create table category_merge_history (
  id                  text primary key,
  user_id             uuid references auth.users not null,
  source_category_id  text not null,
  target_category_id  text not null,
  affected_expense_ids int[] not null default '{}',
  created_at          timestamptz not null,
  reverted_at         timestamptz,
  updated_at          timestamptz default now()
);
alter table category_merge_history enable row level security;
create policy "users own category_merge_history" on category_merge_history
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table payee_merge_history (
  id                text primary key,
  user_id           uuid references auth.users not null,
  source_payee_id   text not null,
  target_payee_id   text not null,
  affected_expense_ids int[] not null default '{}',
  created_at        timestamptz not null,
  reverted_at       timestamptz,
  updated_at        timestamptz default now()
);
alter table payee_merge_history enable row level security;
create policy "users own payee_merge_history" on payee_merge_history
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- settings
create table settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  key        text not null,
  value      text not null,
  updated_at timestamptz default now(),
  unique (user_id, key)
);
alter table settings enable row level security;
create policy "users own settings" on settings
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profiles (theme sync + backup password storage)
create table profiles (
  id              uuid primary key references auth.users on delete cascade,
  selected_theme  text,
  backup_password text,
  updated_at      timestamptz default now()
);
alter table profiles enable row level security;
create policy "users own profile" on profiles
  using (auth.uid() = id) with check (auth.uid() = id);

-- auto-create profile row on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 4. Sync contract notes

The Supabase schema above matches the current cloud-sync layer.

### Sync methods

| Method | Tables |
|--------|--------|
| **Sync queue** (last-write-wins via `updated_at`) | `expenses`, `categories`, `payees`, `fixed_expenses`, `fixed_expense_snapshots`, `income_snapshots`, `savings_snapshots`, `schedules`, `category_merge_history`, `payee_merge_history`, `settings` |
| **Direct read/write** (via Supabase client) | `profiles` |
| **Device-local only** | `syncQueue` |

Important notes:
- Supabase row IDs are stored as `text`, but the app normalizes them back to local numeric IDs when pulling data down.
- `settings.value` is stored as text in Supabase (string-to-string, no JSON serialization).
- `profiles` is a single-row-per-user table — it is read and written directly by the Supabase client, not through the sync queue. The `handle_new_user()` trigger creates the row on signup.

## 5. Profiles table

The `profiles` table stores:
- `selected_theme` — synced visual theme preference across devices
- `backup_password` — optional password for encrypted `.ofb` backup files (stored in plaintext; the user must trust their Supabase instance)

## 6. Enable Google OAuth (optional)

In Supabase dashboard → **Authentication → Providers → Google**:
- Enable Google provider
- Add your Google OAuth Client ID and Secret
- Set the redirect URL in Google Cloud Console to:
  `https://your-project.supabase.co/auth/v1/callback`

## 7. Run the app

```bash
npm run dev
```

Without `.env.local`, the app runs fully offline (IndexedDB only) — no login required.
With `.env.local` set, users must sign in and data syncs automatically across devices.
