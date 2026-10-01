# Work Database — StarlynnCare

Running log of shipped work, research, QA, deployments, and infrastructure. Updated weekly by the work-database automation (Sundays 13:00 UTC). Each entry: **date**, **description**, **category**, **status**.

**Status values:** `Shipped` · `In progress` · `Blocked` · `Research complete` · `QA passed` · `Deployed`

**Last updated:** 2026-07-19

---

## Week of 2026-07-13 → 2026-07-19

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-07-19 | **PR #65 merged** — `formatFacilityName()` display formatter (un-invert trailing the/a/an, title-case all-caps); Premium dark panel on facility profiles | Development | Deployed |
| 2026-07-19 | **PR #64 merged** — trim trailing newlines from Stripe env values / Price IDs (checkout was failing on malformed Vercel secrets) | Development | Shipped |
| 2026-07-19 | **PR #62 merged** — derive facility checkout URL from `stateFromCode()` (no `facilities.state_slug` column; fixed 404 on Premium checkout) | Development | Shipped |
| 2026-07-19 | **PR #60 merged** — Facility Watch Premium launch: Stripe checkout ($9/mo, $59/yr), concierge MVP, free per-facility signup closed (410 on `/api/watch`); migrations `0063` + `0064` applied; `FACILITY_WATCH_PAID_ENABLED=1` on production | Development | Deployed |
| 2026-07-19 | Premium offer copy sharpened — headline + hedges on `FacilityWatchPaid` panel | Development | Shipped |
| 2026-07-19 | MEMORY.md updated with Facility Watch launch status and display-name decision | Research | Shipped |
| 2026-07-19 | Weekly state source scan queued — first scheduled run post-PR #54 (migration 0060 ledger) | Infrastructure | In progress |
| 2026-07-18 | Post-ingest baselines OR +4 max=2026-07-17; MN +4 max=2026-07-08 (run 29664571407) | Infrastructure | Shipped |
| 2026-07-18 | **PR #59 merged** — cron probe OR source max 2026-07-17 (+1 AFH), MN insertDate max 2026-07-18 (+5 events) | Infrastructure | Shipped |
| 2026-07-17 | Post-ingest baselines OR +20 max=2026-07-16; MN +13 max=2026-07-08 (run 29619716241) | Infrastructure | Shipped |
| 2026-07-17 | **PR #58 merged** — cron probe OR source max 2026-07-16 (+6), MN insertDate max 2026-07-17 (+27 events) | Infrastructure | Shipped |
| 2026-07-15 | Post-ingest baselines OR +13 max=2026-07-14 (run 29457543361) | Infrastructure | Shipped |
| 2026-07-15 | **PR #57 merged** — cron probe OR source max 2026-07-14 (+2 inspections) | Infrastructure | Shipped |
| 2026-07-14 | Post-ingest baselines OR +4 max=2026-07-12; MN +14 max=2026-07-08 (run 29375112408) | Infrastructure | Shipped |
| 2026-07-14 | **PR #56 merged** — cron probe OR source max 2026-07-12 (+1 AFH), MN insertDate max 2026-07-14 (+16 complaints); restore GHA push trigger on weekly workflow | Infrastructure | Shipped |
| 2026-07-13 | **PR #54 merged** — State Watch automation: `state_scan_runs` ledger, per-source outcomes, area + facility change alerts with subscriber baselines; migration 0060 applied; WA incremental scan; Loops area/facility change templates | Development | Deployed |
| 2026-07-13 | **PR #53 merged** — migration 0062 dedupes 7,168 byte-identical deficiency rows (OR 6,344, PA 780); OR violations + PA PDF backfill idempotency guards | Development | Deployed |
| 2026-07-13 | Orange County watch catch-up — county-scoped CA ingest + recipient-filtered alerts; `ingest_ca()` direct dispatch fix; L5 continue-on-error in county-scoped scan | Development | Shipped |
| 2026-07-13–19 | `validate.yml` on push — **still failing** (7th week): **35/37** checks; remaining — publishable null/zero beds; ≥3-code repeat offender with composite_pct > 55 | QA | Blocked |
| 2026-07-13–19 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before library magnet emails deliver | Deployment | Blocked |
| 2026-07-13–19 | **Facility Watch Premium** — operator-owned: one controlled live $9 purchase → webhook entitlement → welcome email → portal cancel/refund; first Firecrawl concierge fulfillment | QA | In progress |

### Week patterns (2026-07-13 → 2026-07-19)

**Dominant work types:** Development (~45%), Infrastructure (~30%), QA (~10%), Deployment (~15%).

**Themes:**
1. **Monetization milestone (Loop 13)** — Facility Watch Premium shipped (PR #60) with Stripe + Loops paid templates; free per-facility enrollment closed; legacy watchers preserved via `alerts_eligible`. Three launch hotfixes (#62 state slug, #64 Stripe trim, #65 display names).
2. **State Watch reliability (Loop 8 upgraded)** — PR #54 turns weekly ingest into scan-ledger-driven alert dispatch; subscriber baselines prevent historical backfill noise; WA incremental scan; Orange County scoped catch-up proves county-filtered path.
3. **Data quality hardening** — PR #53 removes 7,168 duplicate deficiency rows and patches OR/PA re-ingest idempotency (root cause of OR monthly full-CSV re-inserts).
4. **Ingest ops steady** — daily probes PRs #56–#59; OR through 2026-07-17; MN insertDate through 2026-07-18 (+27 batch Jul 17); GHA push trigger restored on weekly workflow.
5. **Validation CI stuck** — 7th week red at 35/37; PR #53 cleaned duplicates but repeat-offender invariant still failing; null-bed count unchanged.

**Emerging loops:** Loop 13 — Paid Facility Watch launch (concierge MVP). Loop 8 substantially upgraded — supersedes prior facility-watch-only design.

**Resolved from prior week:**
- Migration 0060 (State Watch) applied in production.
- Migrations 0063 + 0064 (Paid Facility Watch) applied in production.
- OR deficiency duplicate root cause identified and patched (PR #53).
- GHA push trigger on weekly inspection workflow restored (PR #56).

**Open / blocked:**
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- `validate.yml` — fix null-bed publishable facilities; investigate repeat-offender composite rank invariant.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress.
- MO SOD remaining backfill — 7,987/11,820 deficiencies still rule-text only.
- Facility Watch Premium — controlled live purchase + concierge fulfillment (operator QA).
- First scheduled State Watch Sunday scan — confirm dispatch after run 29682009610 completes.

---

## Week of 2026-07-06 → 2026-07-12

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-07-12 | **PR #51 merged** — parallelize MO SOD OCR across CPU cores (`ProcessPoolExecutor`, `--workers` flag; ~2× throughput on statewide backfill) | Infrastructure | Shipped |
| 2026-07-12 | **PR #50 merged** — migration 0061 re-derives MO deficiency severity from `COALESCE(inspector_narrative, description)`; applied to prod (3,833 narrative-backed rows; 267/267 MO snapshots refreshed) | Development | Deployed |
| 2026-07-12 | Post-ingest baselines OR +9 max=2026-07-10; MN +3; AZ +4 (run 29171558204) | Infrastructure | Shipped |
| 2026-07-11–12 | Full 10-state ingest run 29171558204 — all states green; chained L5b self-healing drift audit + L3 smoke passed | Deployment | Shipped |
| 2026-07-11 | Cron probe — OR source max 2026-07-10 (+3), MN insertDate max 2026-07-11 (+9) | Infrastructure | Shipped |
| 2026-07-10 | Post-ingest baselines OR +25 max=2026-07-09 (run 29129361408) | Infrastructure | Shipped |
| 2026-07-10 | Cron probe — OR source max 2026-07-09 (+1 AFH inspection) | Infrastructure | Shipped |
| 2026-07-09 | **Hub content drift audit self-healing** — patches `<span data-stat>` in place with materiality guard; ends re-approval treadmill (first live run: 59 audited, 16 repaired, 5 guard-blocked) | Infrastructure | Shipped |
| 2026-07-09 | Post-ingest baselines MN +3 (run 29056324608); max=2026-06-30 unchanged | Infrastructure | Shipped |
| 2026-07-09 | Cron probe — MN insertDate max 2026-07-09 (+4 survey findings) | Infrastructure | Shipped |
| 2026-07-09 | Post-ingest baselines OR +13 max=2026-07-06; MN +5; UT +1; AZ +6 (run 28981794558) | Infrastructure | Shipped |
| 2026-07-08 | Cron probe — OR source max 2026-07-06, MN insertDate max 2026-07-08 | Infrastructure | Shipped |
| 2026-07-07–11 | Weekly inspection ingest — 6/7 scheduled cron runs green; Jul 11 WA failed transiently (`psycopg.errors.AdminShutdown` on pooler during baseline read, not missing data) | Infrastructure | Shipped |
| 2026-07-06 | CDSS weekly ingest — scheduled run succeeded | Deployment | Shipped |
| 2026-07-06 | **PR #46 merged** — emotionally-matched CTAs on all 7 library articles + `sendMagnetEmail` (6 magnet types); MJML Loops wrappers + admin-alert labels for digest/magnet/shortlist | Development | Deployed |
| 2026-07-06 | Loops setup docs restructured — separate live facility emails from new magnet templates (`OFFER_EMAIL_SETUP.md`) | Research | Shipped |
| 2026-07-06–12 | `validate.yml` on push — **still failing** (6th week): narrowed to **35/37** checks; remaining — 34/4,207 publishable missing beds; 1 repeat-offender contradiction (Marquis Oregon City Post Acute Rehab, OR) | QA | Blocked |
| 2026-07-06–12 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before magnet emails deliver (code merged; falls back silently until templates live) | Deployment | Blocked |

### Week patterns (2026-07-06 → 2026-07-12)

**Dominant work types:** Infrastructure (~45%), Development (~30%), QA (~15%), Deployment (~10%).

**Themes:**
1. **Missouri narrative depth completed (Loop 12)** — prod load landed 3,833 inspector narratives; severity re-derived from narrative (PR #50); OCR parallelized for remaining backfill (PR #51). MO profiles now show real findings where SOD PDFs exist.
2. **Hub content ops breakthrough (Loop 3)** — self-healing drift audit ends the re-approval treadmill; 16 city hubs auto-repaired on first post-ship ingest. Materiality guard preserves human review when prose context could invalidate.
3. **Ingest ops mature** — OR large batch (+25 Jul 10, +9 Jul 12); MN insertDate surveys advancing daily (+4 to +9 events/probe); first full 10-state run with self-healing L5b green.
4. **Buy-side conversion code complete (Loop 11)** — PR #46 merged; all 7 library articles have emotion-matched CTAs. Blocked only on Loops template setup (owner action).
5. **Validation CI narrowing** — down from multi-check failures to 2 residual invariants (null beds, 1 repeat-offender); freshness list for AZ/PA/IL/MO no longer failing.

**Emerging loops:** None new — Loop 12 validated end-to-end; Loop 3 upgraded in place with self-healing repair step.

**Resolved from prior week:**
- PR #46 library magnet CTAs — merged and deployed.
- MO SOD OCR prod load — 3,833/11,820 deficiencies now have inspector narratives.
- Hub content drift treadmill — self-healing audit shipped Jul 9.

**Open / blocked:**
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- Migrations `0049` + `0052` (Facility Watch monitoring) not applied.
- `validate.yml` — fix 34 null-bed publishable facilities; review Marquis Oregon City repeat-offender ranking.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress from prior week.
- Jul 11 WA scheduled ingest — transient pooler shutdown; retry on next cron.

---

## Week of 2026-06-29 → 2026-07-05

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-07-04 | Post-ingest baselines MN +4 insertDate=2026-07-03; AZ +3 inspections (run 28722515007) | Infrastructure | Shipped |
| 2026-07-04 | Cron probe — MN +6 insertDate (max 2026-07-04); all other 9 states no new source data | Infrastructure | Shipped |
| 2026-07-03 | Post-ingest baselines OR/AZ max=2026-07-01; MN insertDate=2026-07-02 (run 28627138554) | Infrastructure | Shipped |
| 2026-07-03 | Cron probe — MN +7 insertDate (max 2026-07-03) | Infrastructure | Shipped |
| 2026-07-02 | Post-ingest baselines OR max=2026-06-30, MN max=2026-06-24; MO spot-check hub path fix in `production_page_spot_check.py` | Infrastructure | Shipped |
| 2026-07-02 | Cron probe — OR +2 (max 2026-07-01), MN +9 insertDate (max 2026-07-02) | Infrastructure | Shipped |
| 2026-07-01 | Cron probe — OR +3, MN +5/+9 insertDate; baselines from run 28483922249 (AZ +5, PA +3, OR +15); **MO added to probe + spot-check** (10-state matrix) | Infrastructure | Shipped |
| 2026-07-01 | **PR #45 merged** — shareable shortlist link (`?shortlist=slug1,slug2`) + `ShortlistSharePanel` (localStorage sync, Web Share API) | Development | Deployed |
| 2026-07-01 | **PR #44 merged** — `LibraryOfferCta` on 4 high-dwell library pages (crisis playbook, tour checklist, deficiency guide, cost guide) | Development | Deployed |
| 2026-07-01 | Press kit + 9 pitch email drafts + `CONTENT_CALENDAR` update | Research | Shipped |
| 2026-06-29 | **PR #41 merged** — Missouri full buildout (10th state): DHSS Socrata directory + FOIA inspections ingest, hub/guides/articles, sitemap routes; 587-license probe 100% join; AZ perf fixes (`React.cache`, rail de-fan-out, migration 0055 snapshot cache); broken link fix (HubDifferentiators `city_slug` via migration 0056); Ahrefs audit A1–A6, B1–B8 | Development | Deployed |
| 2026-06-29 | Fix severity inflation + size-normalize hero severity callout; remove letter grade from mobile facility hero | Development | Shipped |
| 2026-06-29 | `db_invariants.py` — add AZ, PA, IL, **MO** to allowed `state_code` set (resolves prior-week 2,293+ facility flag) | QA | Shipped |
| 2026-06-29 | CDSS weekly ingest — scheduled run succeeded | Deployment | Shipped |
| 2026-06-29–07-05 | `validate.yml` on push — **still failing** (5th week): allowed-state fix shipped; remaining failures — null beds, repeat-offender contradictions, scraper freshness list still missing AZ/PA/IL/MO | QA | Blocked |
| 2026-07-02–05 | **PR #46 in progress** — emotionally-matched CTAs + 6 Loops magnet emails on all 7 library articles (`sendMagnetEmail`); validation CI failing on PR | Development | In progress |
| 2026-07-05 | **PR #47 open** — nightly cron 2026-07-04 MN +4, AZ +3 ingest; spot-check 153/153 pass | Infrastructure | In progress |
| 2026-06-29 | MO SOD/POC OCR pipeline researched — Playwright crawl + Tesseract OCR + fuzzy requirement match; end-to-end verified on Fremont Senior Living; **load not yet run against prod** | Research | Research complete |

### Week patterns (2026-06-29 → 2026-07-05)

**Dominant work types:** Development (~40%), Infrastructure (~35%), QA (~15%), Research (~10%).

**Themes:**
1. **Missouri state launch (10th state)** — full Loop 1 in one PR (#41): ingest + frontend + Ahrefs fixes + AZ perf regression fix bundled. Site headline now "Ten states."
2. **Buy-side conversion deepening** — library offer CTAs (#44), shareable shortlist (#45), magnet-email CTAs on all 7 articles (#46 in progress). Shift from instrumentation (Jun) to conversion surface area.
3. **Ingest pipeline stable** — all 7 scheduled daily cron runs green; MN insertDate surveys advancing daily; MO wired into probe + spot-check Jul 1. First week with zero matrix-level failures since stabilization.
4. **Validation CI partially unblocked** — `db_invariants.py` allowed-state list fixed Jun 29; push-triggered `validate.yml` still red on residual checks (null beds, repeat-offender, stale freshness list).
5. **Press/outreach prep** — press kit + 9 pitch drafts logged; no sends yet.

**Emerging loops:** Library buy-side conversion funnel (Loop 11) — contextual library CTA → Loops magnet email → watch/offer capture → shortlist share. Validated in pieces via PRs #44–#46.

**Resolved from prior week:**
- `db_invariants.py` allowed-state list — IL, PA, AZ, MO added (was P0 backlog item).
- AZ perf regression — `React.cache()` + rail de-fan-out shipped in PR #41.
- HubDifferentiators broken links — `city_slug` in RPC (migration 0056).

**Open / blocked:**
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- Migrations `0049` + `0052` (Facility Watch monitoring) not applied.
- `validate.yml` — extend scraper freshness list to AZ/PA/IL/MO; fix null beds + repeat-offender contradictions.
- PR #46 — needs 6 Loops transactional templates (`LOOPS_MAGNET_*` env vars) before magnet emails go live.
- MO SOD OCR load — `mo_sod_ingest.py load` not run against prod (inspector narratives still rule-only on MO profiles).
- AZ deficiency backfill (`--mode deficiencies`) — still in progress from prior week.

---

## Prior weeks (month context)

### Week of 2026-06-22 → 2026-06-28

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-28 | Post-ingest baselines after run 28304562662 — MN +3 inspections, OR +0 (all 9 states green) | Infrastructure | Shipped |
| 2026-06-27–28 | **First full 9-state ingest success** — run 28304562662: CA, TX, OR, WA, MN, UT, IL, PA, AZ all succeeded; chained validate job (L3 smoke + L5b drift) also green | Deployment | Shipped |
| 2026-06-27 | Evening probe — MN +5 insertDate surveys pending; AZ baseline set to 2026-06-23 | Infrastructure | Shipped |
| 2026-06-27 | Post-ingest baselines OR +3 (max 2026-06-25), MN +6; AZ county hub spot-check slug fix in `production_page_spot_check.py` | Infrastructure | Shipped |
| 2026-06-26 | **AZ deficiency parsing merged** — Playwright DOM scrape for per-deficiency rows (`--mode deficiencies`); re-enables AZ deficiency evaluation after backfill | Infrastructure | Shipped |
| 2026-06-26 | Mobile hub UX — grade badge in hero, prominent Browse CTA on state/county hubs, `scroll-mt` clearance on anchored sections | Development | Deployed |
| 2026-06-26 | Cap severity ratio display at 50× to prevent absurd outlier numbers on facility profiles | Development | Shipped |
| 2026-06-26 | Ingest pipeline hardening — add AZ to weekly matrix; fix TX skip exit code; skip WA on push; reduce matrix to `max-parallel: 1` | Infrastructure | Shipped |
| 2026-06-24–26 | OR/MN baselines advancing — OR through 2026-06-25; MN insertDate surveys through 2026-06-24 | Infrastructure | Shipped |
| 2026-06-22 | CDSS weekly ingest — scheduled run succeeded | Deployment | Shipped |
| 2026-06-22–28 | `validate.yml` on push — failing (4th week): `db_invariants.py` allowed-state list missing IL, PA, AZ | QA | Blocked |

**Key pattern:** Ingest stabilization + AZ deficiency depth. TX skip exit fixed; first all-green 9-state matrix.

### Week of 2026-06-15 → 2026-06-21

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-20 | **PR #37 merged** — AZ data display fixes: narrative badge path, hide 0-deficiency stats, per-state regulator labels, sitemap inner-join, 14 title + 4 meta trims | QA | Deployed |
| 2026-06-18 | **PR #34 merged** — Arizona ADHS ingest pipeline Phase 0–5 | Infrastructure | Shipped |
| 2026-06-17 | **Arizona full launch** — 1,908 publishable Directed Care facilities, 6,133 inspections; ninth covered state | Development | Deployed |
| 2026-06-15–21 | Weekly inspection ingest — TX chronic failure marked whole workflow red | Deployment | In progress |
| 2026-06-15–21 | `validate.yml` — failed on every `main` push (3 weeks red) | QA | Blocked |

**Key pattern:** Arizona launch + post-launch YMYL QA (Loop 9 validated).

### Week of 2026-06-08 → 2026-06-14

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-14 | **PR #33 merged** — deterministic per-facility offer CTA A/B test | Development | Deployed |
| 2026-06-13 | **PR #31 merged** — buy-side journey instrumentation Phase 1 | Development | Deployed |
| 2026-06-13 | **PR #30 merged** — hub differentiation RPC + CA/UT/IL regulatory pages | Development | Deployed |
| 2026-06-12 | Source-only inspection freshness probe + weekly ingest automation | Infrastructure | Shipped |
| 2026-06-09 | Facility Watch monitoring — email alerts on inspection changes | Development | In progress |
| 2026-06-08 | Weekly multi-state inspection check + ingest pipeline (8 states) | Infrastructure | Shipped |

**Key pattern:** Ingest automation at scale + buy-side journey instrumentation.

### Week of 2026-06-01 → 2026-06-08

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-08 | Hub content bulk-publish script + workflow; mobile facility profile engagement pass | Development | Shipped |
| 2026-06-07 | Hub content pipeline Phase 1 — migration 0047, generator, admin review, drift audit | Development | In progress |
| 2026-06-06 | **PR #26 merged** — Pennsylvania frontend launch | Development | Deployed |
| 2026-06-01 | **PR #25 merged** — proximity-based scale interactions | Development | Deployed |

### Week of 2026-05-25 → 2026-05-31

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-31 | May 31 analytics audit remediation — all 10 todos | QA | Shipped |
| 2026-05-25 | **PR #24 merged** — Utah audit fixes (7 issues) across all states | QA | Deployed |
| 2026-05-24 | Pennsylvania data-ingest pipeline — DHS HSD + CMS NF overlay (355 facilities) | Infrastructure | Shipped |

### Week of 2026-05-18 → 2026-05-24

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-23 | Firecrawl pilot v2 — news monitor + pricing triangulation | Research | Research complete |
| 2026-05-18 | **PR #23 merged** — Utah wiring + nav/label UI cleanup | Development | Deployed |

### Week of 2026-05-11 → 2026-05-17

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-16 | **PR #22 merged** — Washington full data rebuild + California truth fixes | Infrastructure | Deployed |
| 2026-05-14 | **PR #20 merged** — 5-layer automated validation and self-healing | Infrastructure | Shipped |
| 2026-05-13 | **PR #16 merged** — Stage 6 analyses (7 data stories) | Research | Shipped |

### Week of 2026-05-04 → 2026-05-10

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-10 | **PRs #1–9 merged** — national homepage, state hubs, facility profile redesign, Watch conversion | Development | Deployed |
| 2026-05-09 | Phase 0 SEO recovery + Texas editorial library | Development | Deployed |

---

## Month-level progress and learning (May → early July 2026)

| Metric | Start (May 4) | End (Jul 19) |
|--------|---------------|--------------|
| States with frontend | CA + partial OR/WA/MN/TX | CA, OR, WA, MN, UT, IL, PA, AZ, **MO** (TX hidden) — **10 covered** |
| Merged PRs | — | 44 total (#1–#65, gaps at #27–29, #32, #35–36, #38–40, #42–43, #47–49, #52, #55, #61, #63) |
| Publishable facilities | ~850 (CA-heavy) | ~4,450+ (MO 267 publishable; AZ 1,908 Directed Care) |
| MO inspector narratives | 0 | 3,833 / 11,820 deficiencies (32%) |
| Validation layers | 0 | 5 (L1–L2 in CI, L3 smoke in ingest workflow, L5 post-ingest, L5b hub drift **+ self-healing repair**) |
| Scheduled ingest workflows | 1 (CA-only) | 2 (CA weekly + **10-state** daily inspection matrix + **State Watch dispatch**) |
| Email provider | Resend | Loops (audience + transactional + Watch alerts + **paid watch** + magnet emails — magnets pending) |
| Revenue products | 0 | **Facility Watch Premium** ($9/mo, $59/yr) — concierge MVP live |

**Key learnings logged (cumulative):**
- Pull broad, filter via signals — never prefilter at scrape (`SCRAPER_MODEL.md`).
- Physical city from Census Geocoder, not directory CSV city field.
- City-first hub strategy beats county replication (Ahrefs: zero county query volume).
- Supabase session pooler caps parallel CI matrix jobs — `max-parallel: 1` required at 9+ states.
- **(Jun 17):** AZ Care Check REST API viable for inspection ingest; Directed Care = memory care gate.
- **(Jun 20):** States without row-level deficiency data must not show CA-specific Type-A/B stats.
- **(Jun 21):** `validate.yml` red for weeks — invariant config drifts when new states ship.
- **(Jun 22):** Salesforce Experience Cloud blocks guest Aura API — Playwright DOM scrape for AZ deficiencies.
- **(Jun 26):** TX ingest failure was exit-code bug in skip logic, not missing data.
- **(Jun 28):** Chained validate job passes after ingest workflow; push-triggered `validate.yml` fails on stale L1/L2 invariants.
- **New (Jun 29):** MO FOIA Excel is TAG-level only — rule text in `description`, not inspector finding; real narratives live in ShowMeLTC SOD/POC PDFs (OCR pipeline).
- **New (Jun 29):** AZ perf regression root cause — deficiency backfill enlarged peer corpus + ~60 live `facility_snapshot` RPCs per page; fix = `React.cache()` + strip RPC from discovery rails.
- **New (Jun 29):** `facilityProfilePath(state, city, facility)` is canonical for 3-segment facility URLs — prevents HubDifferentiators-style broken links.
- **New (Jul 1):** Buy-side conversion surfaces expanding beyond facility pages — library articles are high-dwell capture points.
- **New (Jul 9):** Hub drift self-healing — repair `data-stat` spans at audit time (not render time); materiality guard for prose-invalidating metric moves; supersedes set-only drift design.
- **New (Jul 12):** MO severity from narrative — keyword match on inspector prose comparable to rule-text rate (6.75% vs 7.77% severity 4); no runaway inflation.
- **New (Jul 12):** MO SOD OCR parallelization — `ProcessPoolExecutor` with `OMP_THREAD_LIMIT=1`; ~2× throughput (memory-bandwidth bound, not linear with cores).
- **New (Jul 13):** OR violations ingest had zero idempotency — monthly full-CSV re-runs re-inserted every row; fix = `(inspection_id, description)` guard when `code IS NULL`.
- **New (Jul 13):** State Watch alerts are scan-ledger gated — partial/failed scans send no family-facing email; subscriber `baseline_at` prevents historical noise.
- **New (Jul 19):** Premium replaces free per-facility watch — `alerts_eligible` gates dispatch; display names formatted at render, never mutated in DB (slug stability).
- **New (Jul 19):** Stripe Price IDs with trailing newlines in Vercel env silently break checkout — trim on read.

**Week-over-week trajectory:**
- **Jun 1–8:** Content automation (hub pipeline) + PA ship + mobile engagement.
- **Jun 8–14:** Ingest automation at scale + hub differentiation + buy-side journey instrumentation.
- **Jun 15–21:** Ninth state launch (AZ) + post-launch YMYL QA. Shift to "run pipelines + ship states fast."
- **Jun 22–28:** Pipeline stabilization (9-state all-green) + AZ deficiency depth + mobile hub polish.
- **Jun 29–Jul 5:** Tenth state (MO) + buy-side conversion surfaces + stable ingest ops. Shift to "ship states + grow conversion + deepen narratives."
- **Jul 6–12:** MO narrative completion + hub content self-healing + ingest ops at scale. Shift to "deepen data quality + reduce manual ops overhead."
- **Jul 13–19:** State Watch reliability + Facility Watch Premium monetization. Shift to "ship revenue product + harden alert infrastructure."

---

## Repeatable loops

### Loop 1 — New state launch

```
scrape universe → parity audit → recompute_publishable → frontend config
  → county/city hubs + articles → PR + Vercel preview → merge → smoke test
  → [post-launch] YMYL QA (Loop 9)
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Scrape licensed universe | Trigger | Partial | Per-state Python ingest scripts |
| Parity audit vs playbook | Yes | No | `docs/NEW_STATE_PLAYBOOK.md` checklist |
| `recompute_publishable.py` | Trigger | Yes | Manual `--apply` |
| Frontend config + hubs + articles | Yes | No | ~15 files per state |
| PR + preview deploy | Yes | Partial | Vercel auto-preview on PR |
| Post-deploy smoke test | Yes | No | `smoke_test.py` — manual, not in CI |
| Post-launch YMYL QA | Yes | Partial | Ahrefs + sitemap diff; see Loop 9 |

**Last run:** Missouri — ingest + frontend Jun 28–29 (PR #41); Ahrefs A1–B8 bundled same PR. Tenth state; ~587 licenses probed. **Automation opportunity:** scaffold script from nearest state config; auto-update `db_invariants.py` allowed-state + freshness lists on launch.

---

### Loop 2 — Weekly data ingest (California)

```
cdss-weekly-ingest.yml (Mon 10:00 UTC) → ccld_citations_ingest → hub_content_drift_check
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| CDSS citation scrape | No | Yes | Cron + `workflow_dispatch` |
| Post-ingest validation (L5) | No | Partial | `post_ingest_check.py` not yet chained in CDSS workflow |
| Hub content drift audit (L5b) | No | Yes | Flags `drift_detected`; hides stale content |

**Last run:** Scheduled success Jun 29. **Automation opportunity:** chain `post_ingest_check.py` in CDSS workflow; alert on failure.

---

### Loop 3 — Hub content generation → publish *(upgraded Jul 9: self-healing drift)*

```
generate_hub_content.py → admin review (/admin/hub-content) → approve → publish
  → [next ingest] drift_check → auto-repair data-stat spans OR flag+suppress if material
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Draft generation | Trigger | Yes | `generate-hub-content.yml` (manual dispatch) |
| Stats verification gate | No | Yes | `verifyHubStats` / `verify_stats` — deterministic |
| Human prose review + edit | Yes | No | HTML-source editor |
| Approve + publish | Yes | Partial | Admin UI; `bulk_publish_hub_content.py` + workflow |
| Drift re-audit | No | Yes | Runs on every CDSS + weekly ingest |
| **Auto-repair minor drift** | No | Yes | **New Jul 9:** patches `<span data-stat>` in place; refreshes `stats_snapshot` |
| **Materiality guard → re-approve** | Yes | Partial | Zero-crossing, 50% line, >25pt pct move, >2× count change → flag-and-suppress |

**Last run:** Jul 9 shipped self-healing; Jul 11–12 ingest run 29171558204 — L5b green (16 hubs auto-repaired on first live run Jul 9). **Blocked:** migration 0047 not applied in prod SQL editor.

---

### Loop 4 — Deploy QA

```
merge to main → Vercel production deploy → smoke_test.py → Ahrefs/Clarity audit → fix regressions
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Merge + deploy | Yes | Yes | `main` auto-deploys to production |
| L1+L2 validation CI | No | Yes | `validate.yml` on push — failing 7 weeks; **35/37** (null beds + repeat-offender composite rank) |
| L3 smoke tests | No | Partial | Chained in ingest workflow — green on recent runs |
| External audit (Ahrefs/Clarity) | Yes | No | No new audit this week |

**Last run:** PRs #60–#65 deployed Jul 19 (Facility Watch Premium + hotfixes). **Automation opportunity:** post-deploy `smoke_test.py` in GitHub Actions; auto-update invariant lists on new state merge.

---

### Loop 5 — SEO/analytics audit remediation

```
Ahrefs or Clarity audit → triage findings → fix → validate → deploy → re-audit
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Audit execution | Yes | Partial | Ahrefs script in repo; Clarity passive |
| Triage + prioritize | Yes | No | Jun 29: MO launch + AZ perf regression |
| Fix + PR | Yes | No | PR #41: A1–A6, B1–B8 |
| Re-audit | Yes | No | |

**Last run:** Jun 29 PR #41 (Ahrefs fixes + AZ perf + MO launch). **Automation opportunity:** scheduled sitemap/meta diff script.

---

### Loop 6 — Research pilot → ship or kill

```
hypothesis → pilot script → honest results doc → MEMORY.md decision → ship or archive
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Pilot run | Trigger | Partial | Firecrawl pilots (news, pricing) |
| Results documentation | Yes | No | `FIRECRAWL_PILOT_RESULTS.md` |
| Go/no-go decision | Yes | No | Pricing killed; news v2 at 96% |
| Production integration | Yes | No | None shipped to prod yet |

**Last run:** MO SOD OCR pipeline Jun 29 — Playwright + Tesseract verified on Fremont Senior Living; load pending. Firecrawl v2 May 23.

---

### Loop 7 — Multi-state weekly inspection ingest

```
probe_inspection_freshness.py → weekly-inspection-ingest.yml (per-state matrix)
  → post_ingest_check.py (L5) → baseline commit on main
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Source freshness probe | No | Yes | Read-only; no DB writes |
| Per-state ingest | No | Yes | Matrix: CA, TX, OR, WA, MN, UT, IL, PA, AZ, **MO**; daily 23:00 UTC |
| Post-ingest validation (L5) | No | Partial | Chained per-state (`|| true`) |
| Baseline commit | No | Partial | Auto-commit on delta |
| Pooler-aware parallelism | No | Yes | `max-parallel: 1` (sequential) |

**Last run:** Jul 13–19 — daily probes PRs #56–#59; OR through 2026-07-17 (+20 batch Jul 17); MN insertDate through 2026-07-18; post-PR-#54 weekly scan now writes `state_scan_runs` ledger and chains alert dispatch. **Automation opportunity:** alert on per-state failure; retry on `AdminShutdown`; auto-tune parallelism from pooler metrics.

---

### Loop 8 — State + Facility Watch alerts *(upgraded Jul 13: scan-ledger driven)*

```
weekly-inspection-ingest.yml → state_scan_runs ledger → dispatch_watch_alerts.py
  → Loops area/facility change templates (baseline-gated, deduplicated)
  → [facility] Premium checkout (Loop 13) or legacy free watcher (alerts_eligible)
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Weekly state scan | No | Yes | Consolidated workflow; CA included; TX manual-fail |
| Per-source outcome ledger | No | Yes | `state_scan_sources` — migration 0060 |
| Facility/public-record fingerprints | No | Yes | `state_scan_facility_deltas` |
| Alert dispatch (area + facility) | No | Yes | Only on `completed` scan; `watch_alert_deliveries` dedupe |
| Subscriber baseline at signup | No | Yes | No historical backfill noise |
| County-scoped ingest (OC catch-up) | Trigger | Partial | `ingest_ca()` direct dispatch; recipient-filtered alerts |
| Legacy free facility watch | No | Yes | `alerts_eligible=true` rows still dispatch |
| Paid Premium path | Yes | Partial | See Loop 13 — concierge fulfillment manual |

**Last run:** Jul 13 PR #54 (State Watch) + OC catch-up; Jul 19 PR #60 (Premium replaces new free signup). Migration 0060 applied. First scheduled Sunday scan queued Jul 19. **Automation opportunity:** auto-retry partial scans; county-scoped dispatch generalization.

---

### Loop 9 — Post-launch YMYL QA *(validated Jun 20, Jun 29)*

```
new state deploy → spot-check facility + hub pages → Ahrefs/sitemap audit
  → fix misleading stats/copy/schema → PR → redeploy
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Spot-check facility profiles | Yes | No | AZ Jun 20; MO `deficiencyTextIsRuleOnly` flag |
| Ahrefs health score / sitemap diff | Yes | Partial | `sitemap_diff.py`, Ahrefs crawl |
| Fix state-specific stat labels | Yes | No | MO: "Regulation cited" vs "Verbatim citation text" |
| Update `db_invariants.py` allowed states | Yes | No | Fixed Jun 29 for MO; freshness list still stale |
| PR + redeploy | Yes | Partial | PR #41 bundled launch + fixes |

**Last run:** Missouri Jun 29 (PR #41) — Ahrefs A1–B8 + AZ perf + broken links fixed same PR. **Automation opportunity:** post-launch checklist script that diffs state config vs invariant allowed + freshness lists.

---

### Loop 10 — State deficiency depth backfill *(validated Jun 22–26)*

```
launch with narrative-only → research API/DOM endpoint → Playwright or API backfill
  → re-enable frontend deficiency stats → post-launch YMYL QA (Loop 9)
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Endpoint research (API vs DOM) | Yes | Partial | Browser agent, Aura probe, bundle grep |
| Playwright scrape mode | Trigger | Yes | `--mode deficiencies`; ThreadPoolExecutor workers |
| Per-inspection delete-replace | No | Yes | Resumable via `NOT EXISTS` + `--offset` |
| Frontend re-enable | Yes | No | `HAS_DEFICIENCY_TABLE`, severity tags, copy |
| Backfill run | Trigger | Partial | Long-running; 3 concurrent Playwright workers |

**Last run:** Arizona Jun 22–26 — Playwright DOM scrape shipped; backfill still in progress. **Automation opportunity:** generic Playwright deficiency scaffold.

---

### Loop 11 — Library buy-side conversion *(emerging Jul 1)*

```
identify high-dwell library article → contextual CTA (emotion-matched)
  → Loops magnet email or offer capture → watch/shortlist → share link
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Article selection (dwell time / intent) | Yes | Partial | Clarity session replay |
| CTA copy + placement | Yes | No | PR #46: 7 articles, 6 magnet types |
| Loops template setup | Yes | No | 6 `LOOPS_MAGNET_*` env vars needed |
| Capture endpoint | No | Yes | `/api/watch/digest` with `magnet` field |
| Shortlist share | No | Yes | PR #45: `?shortlist=` + `ShortlistSharePanel` |
| A/B measurement | No | Partial | Clarity tags from Phase 1 instrumentation |

**Last run:** Jul 6 — PR #46 merged; all 7 articles have emotion-matched CTAs + magnet capture endpoint. **Blocked:** 6 `LOOPS_MAGNET_*` env vars + Loops templates (owner action). **Automation opportunity:** dwell-time report → auto-suggest next article for CTA; Loops template scaffold from HTML files.

---

### Loop 12 — MO SOD/POC narrative backfill *(validated Jun 29, completed Jul 12)*

```
FOIA tag-level ingest (rule text only) → research real narrative source
  → Playwright crawl ShowMeLTC → Tesseract OCR → fuzzy-match to deficiency rows → load
  → [optional] re-derive severity from narrative
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Portal crawl (WebForms) | Trigger | Yes | `mo_sod_ingest.py crawl` — Playwright required |
| PDF OCR + parse | Trigger | Yes | Tesseract; `token_set_ratio` fuzzy match; **parallelized PR #51** |
| DB load | Trigger | Yes | `mo_sod_ingest.py load` — sets `inspector_narrative` |
| Severity re-derive | Trigger | Yes | Migration 0061 + `load()` keyword check (PR #50) |
| UI relabel until loaded | No | Yes | `deficiencyTextIsRuleOnly` flag in MO profile config |
| Remaining backfill | Trigger | Partial | 7,987/11,820 still rule-text only (pre-2019 or unmatched) |

**Last run:** Jul 12 — prod load complete (3,833 narratives); severity re-derived (PR #50); OCR parallelized (PR #51, ~2× throughput). **Automation opportunity:** nightly crawl for new SOD PDFs post-ingest; auto-trigger load + severity after OCR.

---

### Loop 13 — Paid Facility Watch launch *(new Jul 19)*

```
feature flag on → Stripe checkout → webhook entitlement → Loops paid welcome
  → [manual] Firecrawl monitor setup + curated alert forwarding (concierge MVP)
  → [deferred] automated Firecrawl provision + signed webhooks (~5–10 subscribers)
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Stripe Products + Prices | Yes | No | $9/mo, $59/yr; trim env values on read |
| Checkout + webhook sync | No | Yes | `facility_watch_subscriptions` (migration 0063) |
| Close free per-facility signup | No | Yes | 410 on `/api/watch`; Premium CTA only |
| Legacy watcher preservation | No | Yes | `alerts_eligible` (migration 0064) |
| Paid welcome email | No | Yes | Loops paid-watch template |
| Concierge Firecrawl setup | Yes | No | Operator creates monitors; see `FACILITY_WATCH_CONCIERGE.md` |
| Curated alert forwarding | Yes | No | Phase 1 promise: "usually within a day" |
| Controlled live purchase QA | Yes | No | Owner: $9 purchase → entitlement → cancel/refund |
| TX/MO exclusion | No | Yes | No paid CTA until official scans dependable |

**Last run:** Jul 19 — PR #60 merged; `FACILITY_WATCH_PAID_ENABLED=1` on production; hotfixes #62–#65. **Blocked:** operator QA (one live purchase + first concierge fulfillment). **Automation opportunity:** Firecrawl provision script after webhook; delivery ledger (Phase 2).

---

## Automation priority backlog

| Priority | Loop | Gap | Effort |
|----------|------|-----|--------|
| P0 | Loop 13 | Operator QA — one controlled live $9 purchase → webhook → welcome → cancel/refund; first concierge fulfillment | Owner action |
| P0 | Loop 4 | Fix remaining `validate.yml` failures — publishable null/zero beds; repeat-offender composite rank invariant | Small |
| P0 | Loop 3 | Apply migration 0047 in Supabase SQL editor | Owner action |
| P0 | Loop 8 | Confirm first scheduled State Watch Sunday scan dispatches correctly (run 29682009610) | Small |
| P1 | Loop 11 | Create 6 Loops magnet templates + Vercel env vars (PR #46 merged; emails blocked until live) | Owner + Small |
| P1 | Loop 13 | Firecrawl concierge playbook automation (provision monitors from webhook) | Medium |
| P1 | Loop 12 | Expand MO SOD crawl beyond loaded facilities; nightly auto-crawl post-ingest | Medium |
| P1 | Loop 10 | Complete AZ deficiency backfill (`--mode deficiencies`) | Medium (running) |
| P1 | Loop 7 | Alert on per-state ingest job failure; retry on transient `AdminShutdown` | Small |
| P1 | Loop 9 | Post-launch checklist: invariant allowed + freshness lists on COVERED_STATES change | Small |
| P1 | Loop 2 | Chain `post_ingest_check.py` after CDSS ingest | Small |
| P1 | Loop 4 | Post-deploy `smoke_test.py` in GitHub Actions | Medium |
| P2 | Loop 3 | Auto-trigger hub draft generation for guard-blocked drift rows (5 cities on first run) | Medium |
| P2 | Loop 1 | New-state scaffold generator from playbook | Medium |
| P2 | Loop 10 | Generic Playwright deficiency scaffold for Salesforce Experience Cloud states | Medium |
| P2 | Loop 11 | Dwell-time → CTA placement recommender | Medium |
| P3 | Loop 5 | Scheduled sitemap/meta diff script | Medium |

---

## How to update this file

The weekly automation (cron `0 13 * * 0`) should:

1. Pull merged PRs, closed issues, and `git log --since="7 days ago"` on `main`.
2. Check GitHub Actions runs for ingest, validation, hub-content, and deploy events.
3. Append new rows to the current week table (dedupe by description).
4. Roll the prior week table into "Prior weeks" on first run of a new week.
5. Refresh loop "Last run" notes and automation backlog if status changed.
6. Update the month-level progress table and "Last updated" date.
