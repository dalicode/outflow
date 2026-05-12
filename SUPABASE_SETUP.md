# Supabase Setup

## Source of truth

The Supabase schema for Outflow is defined in:

`supabase/migrations/20260512000100_initial_schema.sql`

That migration is the source of truth for tables, policies, triggers, and unique constraints. This document explains how to apply it and how the app expects Supabase to be configured.

## Local development

1. Configure your app env vars in `.env.local`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

2. Make sure local auth redirects match your Vite app in [config.toml](/Users/mac/Documents/git/outflow-app/supabase/config.toml):

```toml
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173"]
```

3. Start or reset local Supabase so the migration is applied:

```bash
supabase start
```

If you need a clean local database:

```bash
supabase db reset
```

## Remote project setup

If you are wiring a hosted Supabase project for the first time:

1. Create the Supabase project.
2. Apply the migration in `supabase/migrations/`.
3. Copy the project URL and anon key into `.env.local`.

If the remote database was created manually in the past, bring it back under version control before making more schema changes. The safest path is to pull the live schema into migrations and then review any differences before continuing.

## Sync contract notes

The cloud sync layer depends on these uniqueness rules from the migration:

- `fixed_expense_snapshots`: `unique (user_id, fixed_expense_id, year, month)`
- `income_snapshots`: `unique (user_id, year, month)`
- `savings_snapshots`: `unique (user_id, year, month)`
- `settings`: `unique (user_id, key)`

Those constraints are used by the sync service for `upsert` conflict handling, so schema changes here must stay aligned with [syncService.ts](/Users/mac/Documents/git/outflow-app/src/services/syncService.ts).

## Profiles table

The `profiles` table stores:

- `selected_theme` for synced theme preference
- `backup_password` for optional encrypted backup export/import

It is read and written directly through the Supabase client, not through the normal sync queue.

## Google OAuth

If you enable Google auth in Supabase:

1. Enable the provider in the Supabase dashboard.
2. Add your Google OAuth client ID and secret.
3. Set the Google callback URL to:

```text
https://your-project.supabase.co/auth/v1/callback
```

## App behavior

Without `.env.local`, the app runs fully offline using IndexedDB only.

With Supabase configured, users can sign in and Outflow will sync data across devices.
