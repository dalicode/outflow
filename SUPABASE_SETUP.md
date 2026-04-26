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
  category    text,
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
  is_deleted  boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table categories enable row level security;
create policy "users own categories" on categories
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- fixed_expenses
create table fixed_expenses (
  id         text primary key,
  user_id    uuid references auth.users not null,
  name       text not null,
  amount     numeric not null,
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
```

## 4. Enable Google OAuth (optional)

In Supabase dashboard → **Authentication → Providers → Google**:
- Enable Google provider
- Add your Google OAuth Client ID and Secret
- Set the redirect URL in Google Cloud Console to:
  `https://your-project.supabase.co/auth/v1/callback`

## 5. Run the app

```bash
npm run dev
```

Without `.env.local`, the app runs fully offline (IndexedDB only) — no login required.
With `.env.local` set, users must sign in and data syncs automatically across devices.
