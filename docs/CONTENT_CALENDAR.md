# StarlynnCare — Content Calendar

Single tracker for editorial pieces, city page rewrites, and outreach pushes.
Status: `Drafting` / `Edit` / `Live` / `Blocked` / `Draft Ready` (written, not sent)

Check weekly. Gate Phase 2 SEO audit items on completion of relevant pieces.

---

## Research Pages (live on main)

These shipped before the calendar was updated. All are live on `main`.

- **CA Cost vs Quality** — "In California memory care, price is no guarantee of quality"
  - URL: `/research/california-cost-vs-quality`
  - Published: May 11, 2026 · 484-facility cross-section · r = 0.27 price-severity correlation
  - Status: `Live`

- **CA Geographic Equity** — "High-income California ZIPs do not have better memory care records"
  - URL: `/research/california-geographic-equity`
  - Published: May 11, 2026 · r = 0.23 income-deficiency correlation · Bay Area ZIP analysis
  - Status: `Live`

- **CA Inspection Seasonality** — "Do California memory care inspections follow a seasonal pattern?"
  - URL: `/research/california-inspection-seasonality`
  - Status: `Live`

- **CA Memory Care Violations** — "Facilities operating as memory care without endorsement in California"
  - URL: `/research/california-memory-care-violations`
  - Status: `Live`

---

## Editorial Pieces

Publish order is intentional: shortest production time → highest SEO leverage.
All pieces live at `/library/[slug]` (route ships in CONTENT_CALENDAR Phase 2 task #17).

- **Type-A vs. Type-B explainer** — "Type-A vs. Type-B deficiencies, explained"
  - URL: `/library/type-a-vs-type-b-deficiencies-explained`
  - Status: `Live`

- **Medi-Cal & Memory Care guide** — "Medi-Cal and memory care in California — what it actually covers"
  - URL: `/library/medi-cal-and-memory-care`
  - Status: `Live` · Mid-article offer CTA added 2026-07-01

- **37 Tour Questions** — "37 questions to ask on a memory care tour"
  - URL: `/library/37-questions-to-ask-on-a-memory-care-tour`
  - Status: `Live` · Offer CTA added 2026-07-01

- **Memory care vs. nursing home** — "Memory care vs. nursing home — what's actually different"
  - URL: `/library/memory-care-vs-nursing-home`
  - Status: `Live` · Offer CTA added 2026-07-01

- **When is it time** — "When is it time for memory care?"
  - URL: `/library/when-is-it-time-for-memory-care`
  - Status: `Live` · Digest email CTA added 2026-07-01

- **CA Regulator Primer** — "How memory care is regulated in California"
  - Target ship: Q3 2026 · 14 min read · ~1,800 words
  - Data dependencies: None — all CDSS regulatory facts are publicly available
  - Status: `Drafting`

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

## City Page Rewrites (Hub Content Pipeline)

The hub content generator (`scrapers/generate_hub_content.py`) is ready to run.
0047 migration applied. Run locally with DATABASE_URL + ANTHROPIC_API_KEY.

Priority cities (GSC-validated demand, positions 20–50):

```bash
# CA cities with GSC impression volume at positions 20-50
python scrapers/generate_hub_content.py --state CA --city-slug riverside
python scrapers/generate_hub_content.py --state CA --city-slug san-diego
python scrapers/generate_hub_content.py --state CA --city-slug san-francisco
python scrapers/generate_hub_content.py --state CA --city-slug oakland
python scrapers/generate_hub_content.py --state CA --city-slug union-city

# Other states with GSC impression volume
python scrapers/generate_hub_content.py --state OR --city-slug portland
python scrapers/generate_hub_content.py --state MN --city-slug bloomington

# Review + approve in /admin/hub-content after generation
```

All generated content is DRAFT until approved in `/admin/hub-content`.

Bay Area cities with >10 facilities (lower priority, blocked on cost data for Block 2):

- Oakland — Block 3 prose depth — Target: Q3 2026 — Status: `Pending`
- San Jose — Block 3 — Target: Q3 2026 — Status: `Pending`
- Fremont — Block 3 — Target: Q3 2026 — Status: `Pending`
- Walnut Creek — Block 3 — Target: Q3 2026 — Status: `Pending`

---

## Phase 2 Engineering Tasks (from SEO audit)

- **Audit #16** — `/california` state hub page — Status: `Live`
- **Audit #17** — `/editorial/[slug]` route (MDX or DB-backed) — Status: `Pending`
- **Audit #18** — `/california/[city]/compare` side-by-side view — Target: Q3 2026
- **Audit #19** — Sitemap index split (required before next 10 counties) — Status: `Pending`
- **Audit #20** — Search Console + Bing Webmaster Tools verification — Status: `Pending`
- **Audit #22** — Schema contract test (`tests/schema.contract.test.ts`) — Status: `Pending`
- **Shareable shortlist** — `/shortlist/shared?ids=` share URL — Status: `Live` (PR #45, 2026-07-01)

---

## Outreach Pushes

Target: 15 high-quality backlinks by end of Q3 2026.
**Pitch kit:** `docs/press/press-kit.md`  
**Pitch email drafts:** `docs/press/pitch-emails.md` (personalize [bracketed text] before sending)

The two live research pages are the pitchable assets. Send is a calendar-block task.

| Contact | Asset to pitch | Status |
|---------|---------------|--------|
| Bay Area NPR / KQED | Cost-vs-quality + geographic equity research | `Draft Ready` |
| CalMatters | Cost-vs-quality research — consumer protection angle | `Draft Ready` |
| SF Chronicle | Geographic equity — Bay Area ZIP angle | `Draft Ready` |
| AARP California | Directory + Medi-Cal guide | `Draft Ready` |
| UCSF Gerontology program | Dataset citation / research collaboration | `Draft Ready` |
| Stanford Aging program | Dataset citation | `Draft Ready` |
| CA State Ombudsman offices (Bay Area) | Resource listing | `Draft Ready` |
| Local senior advocacy groups (Alameda, Contra Costa) | Resource listing | `Draft Ready` |
| Memory care operator associations (CALCAL) | Type-A/B explainer + transparency framing | `Draft Ready` |

---

_Last updated: 2026-07-01_
