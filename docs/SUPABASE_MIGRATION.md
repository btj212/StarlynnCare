# Run the StarlynnCare database migration (Sprint 1)

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. **Region:** choose **US East (N. Virginia)** — `us-east-1`.
3. Save the **Project URL**, **anon public** key, and **service_role** key (Settings → API).

## 2. Add keys locally

Copy `.env.local.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never commit `.env.local`.

## 3. Run the SQL migration

1. Open the Supabase dashboard → **SQL Editor** → **New query**.
2. Open [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) in this repo.
3. Copy **the entire file** into the editor and click **Run**.

You should see success with no errors. This creates six tables, seeds **50 states**, enables RLS, and adds public read policies for `states`, `facilities`, `inspections`, and `deficiencies`.

## 4. Quick verification in SQL Editor

```sql
SELECT count(*) FROM states;   -- expect 50
SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN (
    'states','facilities','inspections','deficiencies','scrape_runs','content_runs'
  )
ORDER BY tablename;
```

## 5. Verify from your machine

```bash
npm run verify-schema
```

This confirms anon access to the four public tables and (if `SUPABASE_SERVICE_ROLE_KEY` is set) service access to `scrape_runs` and `content_runs`.

## 6. Vercel

In the Vercel project → **Settings → Environment Variables**, add the same three Supabase variables for **Production** (and Preview if you want previews to hit the DB).
