# Work Database — StarlynnCare

Running log of shipped work, research, QA, deployments, and infrastructure. Updated weekly by the work-database automation (Sundays 13:00 UTC). Each entry: **date**, **description**, **category**, **status**.

**Status values:** `Shipped` · `In progress` · `Blocked` · `Research complete` · `QA passed` · `Deployed`

**Last updated:** 2026-07-05

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

| Metric | Start (May 4) | End (Jul 5) |
|--------|---------------|-------------|
| States with frontend | CA + partial OR/WA/MN/TX | CA, OR, WA, MN, UT, IL, PA, AZ, **MO** (TX hidden) — **10 covered** |
| Merged PRs | — | 36 total (#1–#45, gaps at #27–29, #32, #35–36, #38–40, #42–43) |
| Publishable facilities | ~850 (CA-heavy) | ~4,450+ (MO adds ~587 licensed; AZ 1,908 Directed Care) |
| Validation layers | 0 | 5 (L1–L2 in CI, L3 smoke in ingest workflow, L5 post-ingest, L5b hub drift) |
| Scheduled ingest workflows | 1 (CA-only) | 2 (CA weekly + **10-state** daily inspection matrix) |
| Email provider | Resend | Loops (audience + transactional + Watch alerts + magnet emails) |

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

**Week-over-week trajectory:**
- **Jun 1–8:** Content automation (hub pipeline) + PA ship + mobile engagement.
- **Jun 8–14:** Ingest automation at scale + hub differentiation + buy-side journey instrumentation.
- **Jun 15–21:** Ninth state launch (AZ) + post-launch YMYL QA. Shift to "run pipelines + ship states fast."
- **Jun 22–28:** Pipeline stabilization (9-state all-green) + AZ deficiency depth + mobile hub polish.
- **Jun 29–Jul 5:** Tenth state (MO) + buy-side conversion surfaces + stable ingest ops. Shift to "ship states + grow conversion + deepen narratives."

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

### Loop 3 — Hub content generation → publish

```
generate_hub_content.py → admin review (/admin/hub-content) → approve → publish
  → [next ingest] drift_check → regenerate if drifted
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Draft generation | Trigger | Yes | `generate-hub-content.yml` (manual dispatch) |
| Stats verification gate | No | Yes | `verifyHubStats` / `verify_stats` — deterministic |
| Human prose review + edit | Yes | No | HTML-source editor |
| Approve + publish | Yes | Partial | Admin UI; `bulk_publish_hub_content.py` + workflow |
| Drift re-audit | No | Yes | Runs on every CDSS ingest |

**Last run:** Generator + bulk-publish smoke runs Jun 7–8; no new runs this week. **Blocked:** migration 0047 not applied in prod SQL editor.

---

### Loop 4 — Deploy QA

```
merge to main → Vercel production deploy → smoke_test.py → Ahrefs/Clarity audit → fix regressions
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Merge + deploy | Yes | Yes | `main` auto-deploys to production |
| L1+L2 validation CI | No | Yes | `validate.yml` on push — failing 5 weeks (residual invariant checks) |
| L3 smoke tests | Yes | No | Requires live URL; PR #47 spot-check 153/153 pass |
| External audit (Ahrefs/Clarity) | Yes | No | Jun 29: MO launch + AZ perf bundled in PR #41 |

**Last run:** PRs #41, #44, #45 deployed Jun 29–Jul 1. **Automation opportunity:** post-deploy `smoke_test.py` in GitHub Actions; auto-update invariant lists on new state merge.

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

**Last run:** Jul 1–4 — all 7 scheduled cron runs green; MN insertDate advancing daily (+4 to +9 events/probe); AZ +3 inspections Jul 4; OR through 2026-07-01. MO added to probe Jul 1. **Automation opportunity:** alert on per-state failure; auto-tune parallelism from pooler metrics.

---

### Loop 8 — Facility Watch monitoring

```
facility_watch_probe.py (validate signal) → facility_watch_scan.py
  → Loops transactional alert → [weekly] facility-watch-weekly-signals.yml
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Probe (read-only) | Trigger | Yes | No ingest, no snapshots |
| Snapshot + diff scan | Trigger | Partial | Cron commented out |
| Change alert email | No | Yes | Loops `LOOPS_WATCH_CHANGE_ID` |
| Welcome email on signup | No | Yes | Auto-confirm; `LOOPS_WATCH_WELCOME_ID` |
| Apply migrations 0049 + 0052 | Yes | No | Owner action in SQL editor |

**Last run:** Code on `main` since Jun 9–10; no new activity this week. Cron disabled — `workflow_dispatch` only.

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

**Last run:** Jul 1 — PRs #44 (4 library CTAs) and #45 (shortlist share) merged; PR #46 (all 7 articles + magnet emails) in progress. **Automation opportunity:** dwell-time report → auto-suggest next article for CTA; Loops template scaffold from HTML files.

---

### Loop 12 — MO SOD/POC narrative backfill *(validated Jun 29)*

```
FOIA tag-level ingest (rule text only) → research real narrative source
  → Playwright crawl ShowMeLTC → Tesseract OCR → fuzzy-match to deficiency rows → load
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Portal crawl (WebForms) | Trigger | Yes | `mo_sod_ingest.py crawl` — Playwright required |
| PDF OCR + parse | Trigger | Yes | Tesseract; `token_set_ratio` fuzzy match |
| DB load | Trigger | Yes | `mo_sod_ingest.py load` — sets `inspector_narrative` |
| UI relabel until loaded | No | Yes | `deficiencyTextIsRuleOnly` flag in MO profile config |
| Prod load | Yes | No | **Not yet run** — needs `DATABASE_URL` |

**Last run:** Jun 29 — end-to-end verified on Fremont Senior Living (7 SOD PDFs, 2019–2025). Load pending. **Automation opportunity:** nightly crawl for new SOD PDFs post-ingest; auto-trigger load after OCR.

---

## Automation priority backlog

| Priority | Loop | Gap | Effort |
|----------|------|-----|--------|
| P0 | Loop 4 | Fix remaining `validate.yml` failures — extend scraper freshness list to AZ/PA/IL/MO; null beds; repeat-offender contradictions | Small |
| P0 | Loop 3 | Apply migration 0047 in Supabase SQL editor | Owner action |
| P0 | Loop 8 | Apply migrations 0049 + 0052; probe OR signal before enabling cron | Owner + Small |
| P1 | Loop 11 | Create 6 Loops magnet templates + Vercel env vars for PR #46 | Owner + Small |
| P1 | Loop 12 | Run `mo_sod_ingest.py load` against prod; expand crawl beyond pilot facility | Medium |
| P1 | Loop 10 | Complete AZ deficiency backfill (`--mode deficiencies`) | Medium (running) |
| P1 | Loop 7 | Alert on per-state ingest job failure (Slack/email) | Small |
| P1 | Loop 9 | Post-launch checklist: invariant allowed + freshness lists on COVERED_STATES change | Small |
| P1 | Loop 2 | Chain `post_ingest_check.py` after CDSS ingest | Small |
| P1 | Loop 4 | Post-deploy `smoke_test.py` in GitHub Actions | Medium |
| P2 | Loop 1 | New-state scaffold generator from playbook | Medium |
| P2 | Loop 10 | Generic Playwright deficiency scaffold for Salesforce Experience Cloud states | Medium |
| P2 | Loop 3 | Auto-trigger hub draft generation for drifted cities post-ingest | Medium |
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
