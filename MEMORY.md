# MEMORY.md — Decision log

Append-only log of durable architectural and data-shape decisions. Read at the start of any non-trivial session. Never contradict a logged decision without flagging it first.

Format per entry: **decision**, why it was made, what was rejected, source. Newest at the top.

---

## 2026-05 — Pennsylvania data plane: DHS HSD XLSX + CMS NF overlay

**Decided:**
- PA source of truth for PCH/ALR is the DHS Human Services Provider Directory XLSX bulk export (no auth, one GET, refreshed daily). Filter to `Program Office = 'Office of Long-Term Living'` → 1,057 facilities, 365 with memory care signals.
- PA nursing facilities (657) come from `cms_nh_directory_ingest.py --state PA` — there is zero overlap because DHS export excludes NFs.
- `mc_designation_type` stores the 3-value string from the `Special Care/Secure Dementia Care Unit` column: `null` / `'Secure Dementia Care Unit'` / `'Special Care'`. **Never** use `= true`; always `IS NOT NULL`.
- PA inspection URL ID is `license_number[:-1]` (last check digit stripped): 223010 → id=22301. This is asserted at script startup on 4 known fixtures.
- `memory_care_disclosure_filed` is mirrored from `serves_memory_care` at ingest time so `recompute_publishable.py` needs no per-facility branching.
- Freshness gate: 36 months (matches OR/UT).

**Result (2026-05-24):** 355 publishable PA facilities, 12,774 inspections, 10,601 PDF inventory rows. Reference facilities (Rittenhouse 223010, Serenity Gardens 231010, Cambridge Village 456560) all `publishable=t, mc_review_status='auto_published'`.

**Rejected:** Pre-filtering at scrape time to MC-only facilities (would miss unnamed facilities); using the DOH scraper for PCH/ALR (DOH only covers NFs).

**Source:** `scrapers/pa_hsd_directory_ingest.py`, `supabase/migrations/0044_pa_universe.sql`, `scrapers/pa-memory-care-data-methodology.md`.

---

## 2026-05 — No "Last reviewed [date]" on Star's byline, anywhere

**Decided:** `AuthorByline` renders Star's name, credentials, and verifiable RN license, but **never** a "Last reviewed" date. `lastReviewed` is an optional prop kept for backward compatibility — do not pass it in new code. New guides per `docs/NEW_STATE_PLAYBOOK.md` use `<AuthorByline />` with no date prop.

**Why:** The facility-page usage was sourcing the date from `profile.inspections[0].inspection_date ?? facility.updated_at` — i.e., a regulator inspection date masquerading as an editorial review date. On guides it was tied to `DATE_PUBLISHED`, which becomes a stale-looking timestamp once the article is more than a few months old. A misleading or stale "Last reviewed" date damages E-E-A-T more than the date adds; the RN license number (verifiable at search.dca.ca.gov) is the load-bearing trust signal, not the date.

**Rejected:** Wiring a real per-page editorial-review timestamp (e.g. an `editorial_reviews` table or a const next to `DATE_PUBLISHED`). Defensible, but not worth the operational cost until/unless reviewers actually re-touch pages on a cadence.

**Source:** `src/components/editorial/AuthorByline.tsx`, `docs/NEW_STATE_PLAYBOOK.md`.

---

## 2026-05 — State hubs share one template; per-state config only

**Decided:** All state hubs (CA, OR, WA, MN, TX) compose `StateHubSections` from `src/components/state-hub/` and are driven by a `StateHubConfig` in `src/lib/stateHubConfigs/<slug>.ts`. The `/california` page is a dedicated route only because it predates the unified `[state]` dynamic route; it still uses the shared sections.

**Why:** Five+ states with one-off section markup would be uneditable. The config-driven approach makes "add a state" a checklist (`docs/NEW_STATE_PLAYBOOK.md`), not a design exercise.

**Rejected:** Forking section markup per state. Inlining FAQ / methodology copy into each page.

**Source:** `docs/STATE_HUB_ARCHITECTURE.md`. Live as of May 2026.

---

## 2026-05 — National homepage shipped; `/` is now national, not California

**Decided:** `/` uses `loadNationalHomeData` + `NationalHomeSections`, scoped across all covered states. CA-specific copy moved to `/california`.

**Why:** SEO + brand framing requires a national entry point. CA was 80% of facilities at the time but the directory is no longer single-state.

**Source:** `docs/STATE_HUB_ARCHITECTURE.md`, `src/lib/data/nationalHome.ts`.

---

## 2026-05 — "Pull broad, filter via signals" scraper doctrine

**Decided:** Ingest pulls the full licensed Assisted Living universe per state. Memory-care classification happens downstream via tiered signals (Tier 0 manual / Tier 1 government / Tier 2 directory intersection / etc.). Never prefilter at scrape time.

**Why:** Generically-named facilities (e.g. "Maplewood Senior Living") still serve memory care residents. Prefiltering at the scrape layer permanently loses them. Also keeps the audit trail complete for future research features.

**Rejected:** Name-regex prefiltering at scrape. Trusting any single signal alone (except Tier 0/1).

**Source:** `docs/SCRAPER_MODEL.md`.

---

## 2026-05 — `memory_care_disclosure_filed` is the unified Tier-1 signal column

**Decided:** Every state writes its government-issued credential into both its native column (e.g. `or_memory_care_endorsed`, `tx_alzheimer_certified`) **and** the unified `memory_care_disclosure_filed`. `recompute_publishable.py` reads only the unified column.

**Why:** Avoids per-state branching in publish logic. Adding a new state means writing one mirrored column at ingest, not editing the recompute script.

**Rejected:** State-by-state conditionals inside `recompute_publishable.py`.

**Source:** `docs/SCRAPER_MODEL.md`, `scrapers/backfill_disclosure_from_state_flags.py`.

---

## 2026-05 — Warning flags never promote `serves_memory_care`

**Decided:** Any `*_violation` or statute-violation editorial flag (e.g. `unendorsed_mc_violation`) is read-only context for the profile page. It does not factor into `serves_memory_care` or `publishable`.

**Why:** A facility violating "Memory Care" naming rules without endorsement is the opposite of evidence they should be listed as memory care. Wiring it as a Tier-1 signal previously caused 116 unendorsed OR facilities to publish.

**Rejected:** Treating any `*_violation` flag as a positive signal.

**Source:** OR pipeline learnings #7 (`docs/OR_PIPELINE_LEARNINGS.md`).

---

## 2026-05 — Per-state freshness gates (months since last inspection)

| State | Months | Notes |
|---|---|---|
| CA | none | no freshness gate — CCL coverage assumed continuous |
| OR | 36 | matches OR DHS publication cadence |
| UT | 36 | matches OR; UT ingest still WIP |
| IL | 36 | FOIA window is Jan 2024 – May 2026 |
| TX | 48 | HHSC PIA fulfilment cadence |
| MN | 48 | MDH ALDC coverage |
| WA | 48 | DSHS coverage |

**Why:** Stale records misinform families. CA is exempted only because of continuous coverage assumption — revisit if CDSS data becomes lumpy.

**Source:** `scrapers/recompute_publishable.py` `_FRESHNESS_MONTHS`.

---

## 2026-05 — `mc_review_status` default is `auto_published` for every row

**Decided:** The column is `NOT NULL`. Every facility — including non-memory-care ones — gets `auto_published` at ingest. The actual publishable gate is `serves_memory_care`, not this field. `mc_review_status` only blocks publication when set to `reviewed_reject`.

**Why:** Avoids spurious "needs review" backlogs for facilities that were never memory care candidates.

**Source:** OR pipeline learnings #6.

---

## 2026-05 — WA `serves_memory_care` is OR of three independent signals

**Decided:** `wa_memory_care_certified` OR `wa_earc_sdc_contracted` OR `wa_dementia_specialty`. Any one is sufficient.

**Why:** WA fragments memory care credentials across three separate DSHS programs. Requiring all three would miss the majority of legitimately dementia-capable facilities.

**Rejected:** AND-ing the three signals. Picking one as primary.

**Source:** `docs/WA_PIPELINE_V2.md`, `docs/SCRAPER_MODEL.md`.

---

## 2026-05 — psycopg savepoints, not bare transactions, in all ingest scripts

**Decided:** Every row's writes are wrapped in `SAVEPOINT sp / ROLLBACK TO SAVEPOINT sp / RELEASE SAVEPOINT sp`. A failure on one row never poisons the rest of the batch.

**Why:** Inside `with conn:`, a failed execute aborts the whole transaction. Without savepoints, one bad row kills the run silently after the first error.

**Source:** OR pipeline learnings #4.

---

## 2026-05 — Facility profile is loader-driven, section components are pure

**Decided:** `loadFacilityProfile()` returns a fully normalized `FacilityProfile`. All Supabase calls happen there. Section components (`FacilityHero`, `FacilitySnapshot`, `FacilityPeerRank`, etc.) accept the profile and render — no DB calls in section components.

**Why:** Each section needs partial overlapping data (peer rank, snapshot, deficiencies). Per-section fetching produces N+1 queries and breaks Server Component caching.

**Rejected:** Section-level `await supabase.from(...)` calls.

**Source:** `docs/FACILITY_PROFILE_ARCHITECTURE.md`.

---

## 2026-05 — Next-state priority order

**Decided:** **Minnesota first**, then Arizona, then Utah.

**Why:**
- MN: `mn_dementia_care_licensed` column already exists and MN is wired into `_FRESHNESS_MONTHS`. Fastest second-state path. (`docs/MN_DATA_SOURCES.md`)
- AZ: highest market value (Phoenix/Scottsdale density). ADHS issues a formal Memory Care endorsement — clean Tier-1 signal. No DB scaffolding yet.
- UT: smaller market, less structured publication. Ingest path partially scoped (see `scrapers/_ut_detail_probe.py` — no stable detail endpoint surfaced yet).

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` ("State selection notes").

---

## Process decisions (apply to every session)

These are not data decisions but they're durable enough to log here:

- **Branch before large changes.** ≥3 files, new route, new migration, or anything that could break production → feature branch + Vercel preview before merging to `main`. Tiny copy/typo fixes may commit direct. (Source: `CLAUDE.md` Hard Rules.)
- **YMYL — never fabricate.** If a value isn't in Supabase, the page omits it or says "None on record." No invented ratings, percentiles, or `aggregateRating` schema. (Source: `CLAUDE.md` Data Accuracy section, `AGENTS.md` SEO checklist.)
- **Next.js is current, not 14.** Check `node_modules/next/dist/docs/` before assuming an older API. (Source: `AGENTS.md`.)

---

## Session log

Append session summaries here (most recent first). Format: `YYYY-MM-DD — summary`.

---

## 2026-05 — Physical city sourced from Census Geocoder; historical slugs drive 301s

**Decided:**
- `facilities.city` and `facilities.city_slug` must reflect the **physical city** (Census Place) — never the USPS mailing city from the source directory feed.
- Physical city is derived by calling the US Census Geocoder coordinates endpoint (`geocoding.geo.census.gov`) with each facility's lat/lon after geocoding. Prefer Incorporated Places over Census Designated Places.
- When the Census Place differs from the existing slug, `scrapers/recompute_physical_city.py` rewrites `city` + `city_slug` and appends the old slug to `facilities.historical_city_slugs text[]`.
- `loadFacilityProfile` checks `historical_city_slugs` when a `(state, city_slug, facility_slug)` lookup misses and 301-redirects to the canonical path via `permanentRedirect` (true 301, not Next's default 307/308).
- Required step in every state pipeline: run **after** `geocode_facilities.py`, **before** `recompute_publishable.py`.

**Why:**
- UGRC's UT ArcGIS layer silently mis-categorised every SLC-metro suburb (Taylorsville, Murray, West Jordan, etc.) under `salt-lake-city` for ~6 months.
- A YMYL directory where the URL says one city and the page body says another fails Google Quality Rater guidelines for health/medical content. URL/JSON-LD/page text must all agree.

**Rejected:**
- USPS city as truth (silent mis-locate; caused the Utah audit finding).
- Render-time display override only (URL/content canonical mismatch — YMYL trap; described in SEO_GEO_CONVENTIONS.md §3).

**Source:** `supabase/migrations/0045_facility_historical_slugs.sql`, `scrapers/recompute_physical_city.py`, `src/lib/facility/loadFacilityProfile.ts`.

---

## 2026-05 — Hero shows worst sub-metric, not composite, for bottom-half facilities

**Decided:** For facilities in the bottom half of their peer group, `FacilityHero.tsx` (and `buildFacilitySnippet` in `meta.ts`) surfaces the **worst single sub-metric** (severity, frequency, or repeat-citation rate) instead of the composite average, when any sub-metric is ≥ 10 percentile points below the composite. The metric label is shown inline ("bottom 14% on citation severity among Utah peers"). Top-half framing stays as-is.

**Why:** The composite is the average of three metrics; a facility can score 44th composite while severity ranks 14th. Showing composite on a YMYL directory soft-pedals the actual safety signal. The rule "show the worst sub-metric when meaningfully divergent" is the most informative single number a family can act on.

**Source:** `src/components/facility/profile/FacilityHero.tsx`, `src/lib/seo/meta.ts`.

---

## 2026-05 — Per-inspection source labeling (CMS vs. state regulator)

**Decided:** Utah (and potentially other states) stores both federal CMS nursing-home inspections (`source_agency = 'CMS'`) and state ALF inspections (`source_agency = 'UT-CCL'`) in the same facility profile. Every UI that says "DLBC citations" on a CMS-sourced row was wrong. `agencyLabelForInspection(insp, cfg)` in `profileConfig.ts` returns the correct label per row. Applied in `FacilityHero.tsx`, `FacilityRecord.tsx`, `FacilityFullInspections.tsx`.

**Source:** `src/lib/states/profileConfig.ts`, component files above.

<!-- New session summaries go above this line -->
