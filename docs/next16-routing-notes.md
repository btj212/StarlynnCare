# Next.js 16 — routing & data notes (StarlynnCare)

This project uses **Next.js 16 App Router** with **React 19**. Summary of patterns we use:

## Server Components (default)

`page.tsx` files are Server Components unless marked `"use client"`. Data fetching with Supabase runs on the server — no secrets in the browser, no waterfall from client-side `useEffect`.

## ISR / revalidation

Export **`export const revalidate = <seconds>`** from a route segment to cache the page and refresh in the background (stale-while-revalidate). Currently we run **`export const dynamic = "force-dynamic"`** on all facility-data routes (`/[state]`, `/[state]/[city]`, `/[state]/[city]/[facility]`) so anonymous public `SELECT`s always hit Postgres fresh and don't go stale before the CDSS ingest runs.

## Dynamic routes

We use nested dynamic segments for facility URLs: `/[state]/[city]/[facility]` — for example `/california/oakland/magnolia-ridge`. `params` is a **Promise** in Next.js 15+ and must be awaited:

```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ state: string; city: string; facility: string }>;
}) {
  const { state, city, facility } = await params;
}
```

State and region (county/city) slugs are validated against `src/lib/states.ts` and `src/lib/regions.ts` — unknown slugs return `notFound()`.

## Fetch / Supabase (@supabase/ssr)

- **Public data (facility lists, profiles):** use **`tryPublicSupabaseClient()`** — plain `createClient` + publishable key, **no cookies**. Same RLS as the browser; reliable on Vercel for anonymous `SELECT`s.
- **Auth / session-aware routes:** use **`createServerSupabaseClient()`** so cookies stay in sync with Supabase Auth (middleware refreshes sessions).

Env: **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** (or legacy **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**).

Do not import **`SUPABASE_SERVICE_ROLE_KEY`** into Client Components.

## Cache Components

If Cache Components / `"use cache"` are enabled later, consult the current Next.js docs in-repo (`node_modules/next`) — APIs evolve by minor version.
