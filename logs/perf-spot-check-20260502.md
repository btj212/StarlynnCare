# Performance spot-check — 2026-05-02 (P0.8)

## Scope

Manual Lighthouse-style review (DevTools + heuristic) on representative routes after v3 ship:

- `/california/oakland` (city hub + FAQ)
- `/california/los-angeles-county` (county hub)
- Facility profile with `photo_url` (dynamic image host)
- Homepage desktop hero

## Findings

1. **Facility profile hero** — Current facility template emphasizes map thumbnail + QuickFacts; listing cards elsewhere use `<img>` for operator-supplied exterior photos with `loading="lazy"`. No single oversized hero `<img>` emerged as an obvious LCP bottleneck on the sampled template.

2. **Third-party map tiles** — Mapbox static images add TLS latency on first paint; acceptable tradeoff for geo context; consider priority only above-the-fold if LCP regresses.

3. **City / county hubs** — Server-rendered lists dominate payload; FAQ sections are static markup — no heavy JS cost observed.

4. **Homepage** — Editorial cards now link to live routes (smaller orphan surface); monitor Total Blocking Time if analytics scripts added later.

## Follow-up

- If Ahrefs or Field data flag **LCP > 2.5s** on facility URLs with large exterior JPEGs, migrate listing/detail imagery to `next/image` with explicit `sizes` and remotePatterns for the CDN host.

- Re-run Lighthouse after next deploy on the same four URLs and attach traces if regressions appear.

## Status

**No mandatory `next/image` swap** this pass — bottleneck not isolated to facility hero on audited template.
