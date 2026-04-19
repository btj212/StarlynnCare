# Next.js 16 — routing & data notes (StarlynnCare)

This project uses **Next.js 16 App Router** with **React 19**. Summary of patterns we use:

## Server Components (default)

`page.tsx` files are Server Components unless marked `"use client"`. Data fetching with Supabase runs on the server — no secrets in the browser, no waterfall from client-side `useEffect`.

## ISR / revalidation

Export **`export const revalidate = <seconds>`** from a route segment to cache the page and refresh in the background (stale-while-revalidate). Used on `/florida` and `/facility/[slug]` so Vercel can serve cached HTML and refresh periodically.

## Dynamic routes

`/facility/[slug]` uses `params` as a **Promise** in Next.js 15+ — await `params` in the page component:

```tsx
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
}
```

## Fetch / Supabase

Server Components call Supabase with the **anon** key for public reads. Do not import the **service role** key into Client Components.

## Cache Components

If Cache Components / `"use cache"` are enabled later, consult the current Next.js docs in-repo (`node_modules/next`) — APIs evolve by minor version.
