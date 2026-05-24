# MEMORY.md — Decision log

Append-only log of durable architectural and data-shape decisions. Read at the start of any non-trivial session. Never contradict a logged decision without flagging it first.

Format per entry: **decision**, why it was made, what was rejected, source. Newest at the top.

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

<!-- New session summaries go above this line -->
