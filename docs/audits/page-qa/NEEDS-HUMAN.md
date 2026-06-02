# NEEDS-HUMAN — judgment items from hardening pass

One line each: URL or path + issue + why it needs a human.

---

- `/california/alameda-county` — Analytics audit flagged indexed soft-404 / weak hub; verify live render and decide populate vs noindex (F1).
- `/oregon/sweet-home` — Same as above; known offender from May 2026 audit.
- `/{state}/guides` (states with empty `stateArticles`) — Page copy says "Guides for {state} are coming soon" (`src/app/[state]/guides/page.tsx`); editorial decision whether to noindex until articles ship.
- Thin city hubs (1 facility) — See `docs/audits/soft404-report.md` for list; weak ItemList may not merit index (SEO strategy).
- `clipMetaDescription` limit — Code uses 160 chars; older brief used 155; pick canonical limit (D4).
- Live validation gates — Agent sandbox cannot reach production; run `scripts/validate/*.py --env production` locally or on preview deploy to close A/C/D gates.
- Google Rich Results Test — A3 requires manual validator pass on 10 facility + 10 hub URLs after preview deploy.
