# StarlynnCare — Content Calendar

Single tracker for editorial pieces, city page rewrites, and outreach pushes.
Status: `Drafting` / `Edit` / `Live` / `Blocked`

Check weekly. Gate Phase 2 SEO audit items on completion of relevant pieces.

---

## Editorial Pieces

Publish order is intentional: shortest production time → highest SEO leverage.
All pieces live at `/editorial/[slug]` once the editorial route ships (Phase 2 task #17).

- **CA Regulator Primer** — "How memory care is regulated in California"
  - Target ship: May 2026 · 14 min read · ~1,800 words
  - Data dependencies: None — all CDSS regulatory facts are publicly available
  - Status: `Drafting`

- **Type-A vs. Type-B explainer** — "Type-A vs. Type-B deficiencies, explained"
  - Target ship: May 2026 · 6 min read · ~900 words
  - Data dependencies: None — terminology already in our methodology page
  - Status: `Drafting`

- **Tour checklist** — "37 questions to ask on a memory care tour"
  - Target ship: June 2026 · Printable PDF + web version · ~1,200 words
  - Data dependencies: Existing FAQ structure on facility pages
  - Status: `Pending`

- **Memory care cost in CA** — "What memory care actually costs in California, by region"
  - Target ship: Q3 2026 · 9 min read · ~2,000 words
  - Data dependencies: Cost ingest pipeline (unbuilt — see Phase 2 tracker)
  - Status: `Blocked` (awaiting cost data)

- **Medicare/Medicaid coverage** — "Does Medicare cover memory care? (Mostly, no.)"
  - Target ship: Q3 2026 · 11 min read · ~2,200 words
  - Data dependencies: None — federal policy facts
  - Status: `Pending`

- **Annual State of Memory Care in CA** — "The State of Memory Care in California — 2026"
  - Target ship: Q4 2026 · ~8,000-word report + PDF download
  - Data dependencies: Full CA data run + cost data + county breakdowns
  - Status: `Blocked` (awaiting full dataset)
  - Note: This is the citation magnet — pitch to KQED, CalMatters, SF Chronicle, AARP CA, UCSF/Stanford gerontology programs after publication.

---

## City Page Rewrites

Target: 1,200–1,800 words per city page by lifting word count from the 5-block template.
Phase 1 ships the structural skeleton (~1,000–1,300 words live data). The items below
track the remaining prose blocks that need real localized copy (blocks 2 and 3).

Bay Area cities with >10 facilities (priority order by facility count):

- Oakland — Block 2 (cost band) + Block 3 prose depth — Target: May 2026 — Status: `Pending`
- San Jose — Block 2 + Block 3 — Target: May 2026 — Status: `Pending`
- Fremont — Block 2 + Block 3 — Target: June 2026 — Status: `Pending`
- Walnut Creek — Block 2 + Block 3 — Target: June 2026 — Status: `Pending`
- Concord — Block 2 + Block 3 — Target: June 2026 — Status: `Pending`
- San Mateo — Block 2 + Block 3 — Target: June 2026 — Status: `Pending`
- Richmond — Block 2 + Block 3 — Target: July 2026 — Status: `Pending`
- San Leandro — Block 2 + Block 3 — Target: July 2026 — Status: `Pending`
- Hayward — Block 2 + Block 3 — Target: July 2026 — Status: `Pending`

Note: "Block 2" = real cost-band copy (requires cost ingest). "Block 3" = expanded regulator
primer with city-specific findings (can be written from existing data now).

---

## Phase 2 Engineering Tasks (from SEO audit)

- **Audit #16** — `/california` state hub page — Target: May 2026
- **Audit #17** — `/editorial/[slug]` route (MDX or DB-backed) — Target: May 2026
- **Audit #18** — `/california/[city]/compare` side-by-side view — Target: Q3 2026
- **Audit #19** — Sitemap index split (required before next 10 counties) — Target: May 2026
- **Audit #20** — Search Console + Bing Webmaster Tools verification — Target: ASAP
- **Audit #22** — Schema contract test (`tests/schema.contract.test.ts`) — Target: June 2026
- **Cost ingest pipeline** — unlocks cost-band blocks for all city pages + Cost editorial piece — Target: Q3 2026

---

## Outreach Pushes

Target: 15 high-quality backlinks by end of Q3 2026. Anchor on the Annual Report once live.

- Bay Area NPR / KQED — pitch: Annual Report 2026 data on CA memory care deficiency rates — Status: `Pending`
- CalMatters — pitch: investigative angle on Type-A facilities still operating — Status: `Pending`
- SF Chronicle — pitch: Bay Area-specific memory care cost + quality story — Status: `Pending`
- AARP California — pitch: consumer guide angle on "no paid placement" directory — Status: `Pending`
- UCSF Gerontology program — pitch: Dataset as a research resource — Status: `Pending`
- Stanford Aging program — pitch: Dataset citation — Status: `Pending`
- CA State Ombudsman offices (4 Bay Area counties) — establish contact, share data — Status: `Pending`
- Local senior advocacy groups (Alameda, Contra Costa) — link exchange / resource listing — Status: `Pending`
- Memory care operator associations (CALCAL) — editorial commentary visibility — Status: `Pending`

---

_Last updated: 2026-04-26_
