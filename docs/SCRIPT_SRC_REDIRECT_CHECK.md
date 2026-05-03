# External script `src` redirect check (2026-05-03)

Ahrefs previously flagged ~643 “redirected JavaScript” warnings (April 2026 crawl). Verification:

| URL | Result |
|-----|--------|
| `https://www.googletagmanager.com/gtag/js?id=G-19JKWKER15` | HTTP 200, no redirect |
| `https://analytics.ahrefs.com/analytics.js` | HTTP 200, no redirect |
| `http://www.googletagmanager.com/gtag/js?id=G-19JKWKER15` | HTTP **302** → HTTPS (expected; layout uses HTTPS only) |

**Layout:** [src/app/layout.tsx](../src/app/layout.tsx) — both tags already use `https://`. No URL change required unless a future crawl flags a new endpoint.
