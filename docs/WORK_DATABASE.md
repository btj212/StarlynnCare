# Work Database — StarlynnCare

Running log of shipped work, research, QA, deployments, and infrastructure. Updated weekly by the work-database automation (Sundays 13:00 UTC). Each entry: **date**, **description**, **category**, **status**.

**Status values:** `Shipped` · `In progress` · `Blocked` · `Research complete` · `QA passed` · `Deployed`

**Last updated:** 2026-06-28

---

## Week of 2026-06-22 → 2026-06-28

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-28 | Post-ingest baselines after run 28304562662 — MN +3 inspections, OR +0 (all 9 states green) | Infrastructure | Shipped |
| 2026-06-27–28 | **First full 9-state ingest success** — run 28304562662: CA, TX, OR, WA, MN, UT, IL, PA, AZ all succeeded; chained validate job (L3 smoke + L5b drift) also green | Deployment | Shipped |
| 2026-06-27 | Evening probe — MN +5 insertDate surveys pending; AZ baseline set to 2026-06-23 | Infrastructure | Shipped |
| 2026-06-27 | Post-ingest baselines OR +3 (max 2026-06-25), MN +6; AZ county hub spot-check slug fix in `production_page_spot_check.py` | Infrastructure | Shipped |
| 2026-06-26 | **AZ deficiency parsing merged** — Playwright DOM scrape for per-deficiency rows (`--mode deficiencies`); re-enables AZ deficiency evaluation after backfill; logged in `MEMORY.md` + `ERRORS.md` | Infrastructure | Shipped |
| 2026-06-26 | Mobile hub UX — grade badge in hero, prominent Browse CTA on state/county hubs, `scroll-mt` clearance on anchored sections | Development | Deployed |
| 2026-06-26 | Cap severity ratio display at 50× to prevent absurd outlier numbers on facility profiles | Development | Shipped |
| 2026-06-26 | Type fix — `stats.facilities` instead of `stats.totalPublishable` on states page | Development | Shipped |
| 2026-06-26 | Ingest pipeline hardening — add AZ to weekly matrix; fix TX skip exit code; skip WA on push; prioritize MN; reduce matrix to `max-parallel: 1` (pooler exhaustion) | Infrastructure | Shipped |
| 2026-06-24–26 | OR/MN baselines advancing — OR through 2026-06-25 (+~10 inspections); MN insertDate surveys through 2026-06-24 (+~30 events); UT +1, PA +1 on Jun 26 run | Infrastructure | Shipped |
| 2026-06-22 | CDSS weekly ingest — scheduled run succeeded | Deployment | Shipped |
| 2026-06-22–28 | `validate.yml` on push — still failing (4th week): `db_invariants.py` allowed-state list missing IL, PA, AZ (2,293 facilities flagged); 34 null beds; 1 repeat-offender ranking contradiction | QA | Blocked |

### Week patterns (2026-06-22 → 2026-06-28)

**Dominant work types:** Infrastructure (~50%), Development (~30%), QA (~20%).

**Themes:**
1. **Ingest pipeline stabilization** — chronic TX failure and pooler exhaustion fixed; matrix now runs 9 states sequentially (`max-parallel: 1`). First all-green run Jun 27–28.
2. **AZ data depth** — deficiency parsing via Playwright (Loop 10); Salesforce Aura guest access blocked, DOM scrape is the viable path. Frontend re-enabled for A.A.C. citations once backfill completes.
3. **Mobile UX polish** — hub browse CTA, grade badge visibility, scroll anchor clearance (continuation of Clarity-driven mobile work from prior weeks).
4. **Validation CI still blocked** — push-triggered `validate.yml` red for 4 weeks; root cause unchanged (`db_invariants.py` stale allowed-state list). Ingest workflow's chained validate job passed when run after full matrix success.
5. **No new PRs merged** — work landed via direct merges (AZ deficiencies) and ingest automation commits.

**Emerging loops:** Deficiency depth backfill (Loop 10) — launch with narrative-only → research endpoint → Playwright backfill → re-enable frontend stats. Validated on AZ Jun 22–26.

**Resolved from prior week:**
- TX weekly ingest job — fixed skip exit code; TX now succeeds (was chronic matrix failure).
- MN baseline commits — merged to `main` (Jun 24–28).

**Open / blocked:**
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- Migrations `0049` + `0052` (Facility Watch monitoring) not applied.
- `validate.yml` — update `db_invariants.py` allowed-state list to include IL, PA, AZ (one-line fix; 2,293 facilities currently flagged).
- AZ deficiency backfill (`--mode deficiencies`) — in progress; frontend changes await completion.

---

## Prior weeks (month context)

### Week of 2026-06-15 → 2026-06-21

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-20 | **PR #37 merged** — AZ data display fixes: `narrative_summary` path for inspection text badge; hide misleading 0-deficiency stats for AZ/IL/UT; per-state regulator labels (not hardcoded CDSS); remove AZ "Severe deficiencies = 0" hub tile; sitemap inner-join on inspections (fixes 29 noindex-in-sitemap Ahrefs errors); AZ static sitemap routes; 14 article title trims + 4 meta description trims | QA | Deployed |
| 2026-06-20 | MN inspection ingest — evening probe +9 complaints; baseline updated to 2026-06-16 after +12 inspections (7/8 state jobs succeeded; TX job failed) | Infrastructure | Shipped |
| 2026-06-19 | OR inspection ingest — probe +3 through 2026-06-18; baseline updated after +14 (Jun 17) and +11 (Jun 18) inspections across two runs | Infrastructure | Shipped |
| 2026-06-18 | **PR #34 merged** — Arizona ADHS ingest pipeline Phase 0–5: ArcGIS directory (2,047 ALFs), AZ Care Check REST API, migration 0053, PDF pipeline scaffold, hub config + two articles | Infrastructure | Shipped |
| 2026-06-18 | OR evening probe — +6 inspections through 2026-06-17 | Infrastructure | Shipped |
| 2026-06-17 | **Arizona full launch** — 1,908 publishable Directed Care facilities, 6,133 inspection records; migrations 0053+0054; AZ added to `COVERED_STATES`; hub, FAQs, methodology FOIA citation, two articles; feature parity with CA/OR/WA (regulator primer, editorial links, StatesWeCoverGrid) | Development | Deployed |
| 2026-06-17 | Offer CTA A/B test wired on launch — per-facility deterministic variant (watch/records/contract/tour); Clarity instrumentation; mobile sticky subnav fix (CTA was desktop-only) | Development | Deployed |
| 2026-06-17 | States page copy update + inspection count fix for large states (pagination-aware total) | Development | Shipped |
| 2026-06-16 | OR baseline updates — +6 inspections through 2026-06-15; baseline refresh from run 27585609851 (+4 source rows) | Infrastructure | Shipped |
| 2026-06-15 | CDSS weekly ingest — scheduled run succeeded | Deployment | Shipped |
| 2026-06-15–21 | Weekly inspection ingest — all 7 scheduled cron runs failed (workflow marked red because TX job fails; CA/OR/WA/MN/UT/IL/PA jobs succeed individually) | Deployment | In progress |
| 2026-06-15–21 | `validate.yml` — failed on every `main` push (now 3 weeks red); root cause identified: `db_invariants.py` allowed-state list stale (missing PA, IL, AZ) + beds-null + repeat-offender checks | QA | Blocked |

### Week patterns (2026-06-15 → 2026-06-21)

**Dominant work types:** Development (~40%), Infrastructure (~35%), QA (~25%).

**Themes:**
1. **Arizona state launch** — full Loop 1 execution in one week: probe → ingest (1,908 facilities, 6,133 inspections) → frontend → deploy → post-launch YMYL QA (PR #37). Ninth covered state; ~3,800+ publishable facilities site-wide.
2. **Post-launch data honesty** — AZ surfaced CA-specific deficiency terminology and zero-stat tiles on a state without row-level deficiency data. Fixed before Ahrefs health score audit.
3. **Multi-state ingest keeps running** — OR and MN baselines advanced daily via freshness probe + matrix workflow; per-state jobs healthy except TX (chronic single-state failure marks whole workflow red).
4. **Validation CI drift** — `validate.yml` failures now traced to stale invariant config (`state_code NOT IN (...)` missing PA/IL/AZ), not data corruption. Third consecutive week red.
5. **Offer CTA experiment live** — deterministic per-facility variant with Clarity tags; mobile sticky nav fix shipped alongside AZ launch.

**Emerging loops:** Post-launch YMYL QA loop (Loop 9) — ship state → Ahrefs/sitemap audit → fix misleading stats/copy → redeploy. Validated on AZ this week.

**Open / blocked:**
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- Migrations `0049` + `0052` (Facility Watch monitoring) not applied.
- `validate.yml` — update `db_invariants.py` allowed-state list to include PA, IL, AZ (one-line fix).
- TX weekly ingest job — investigate and either fix or exclude from matrix fail-fast.
- MN baseline commits (Jun 20) on feature branch — merge to `main` when ready.

### Week of 2026-06-08 → 2026-06-14

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-14 | **PR #33 merged** — deterministic per-facility offer CTA A/B test (watch/records/contract/tour) | Development | Deployed |
| 2026-06-13 | **PR #31 merged** — buy-side journey instrumentation Phase 1: intent column on `facility_watchers`, placement attestation UI, Records Pull reframe, crisis playbook, Contract Decoder | Development | Deployed |
| 2026-06-13 | **PR #30 merged** — hub differentiation: `region_hub_stats()` RPC + `HubDifferentiators`; CA/UT/IL memory-care licensing editorial pages | Development | Deployed |
| 2026-06-13 | Ingest hardening — cap parallel matrix jobs to 3 (Supabase pooler exhaustion); propagate MN ingest failures; update MN baseline to 2026-06-03 | Infrastructure | Shipped |
| 2026-06-13 | GovernanceBar copy simplified to single buy-side sentence | Development | Deployed |
| 2026-06-12 | Phase 1 SEO pass — hub reframe, pillar page, schema fixes, facility photos, dead hub cleanup | Development | Shipped |
| 2026-06-12 | Source-only inspection freshness probe (`probe_inspection_freshness.py`) for nightly automation | Infrastructure | Shipped |
| 2026-06-12 | Weekly inspection ingest scheduled runs succeeded (Jun 9–12); Jun 13–14 runs failed (pooler + MN propagation fixes landed same day) | Deployment | Shipped |
| 2026-06-10 | Facility Watch welcome email copy fix — state-agnostic, drop duplicate license/beds | Development | Shipped |
| 2026-06-09 | Facility Watch monitoring — email alerts when a watched facility's inspection record changes | Development | In progress |
| 2026-06-09 | SEO tier 1–2 — "Reviews" in facility title/meta hook; 3 PA editorial articles + illustrations | Development | Deployed |
| 2026-06-09 | Weekly inspection ingest parallelized per-state matrix (8 states); IL runner signature fix, `pdfplumber` dep, skip CA on push, WA timeout extended | Infrastructure | Shipped |
| 2026-06-08 | Weekly multi-state inspection check + ingest pipeline (`weekly-inspection-ingest.yml`, daily 23:00 UTC) | Infrastructure | Shipped |
| 2026-06-08 | CI: weekly inspection ingest triggers on orchestrator file changes | Infrastructure | Shipped |

### Week of 2026-06-01 → 2026-06-08

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-08 | Hub content bulk-publish script + GitHub Actions workflow; first manual run succeeded | Infrastructure | Shipped |
| 2026-06-08 | Mobile facility profile engagement pass — CSS `order` reorder, compressed Snapshot, jump-to-facts chips (Clarity-driven) | Development | Shipped |
| 2026-06-08 | Mobile hero simplification, sub-nav chip truncation fix, methodology byline below findings | Development | Shipped |
| 2026-06-07 | Hub content pipeline Phase 1 — checkpoints 1–5: migration 0047, generator, loader, admin review tool, drift audit | Development | In progress |
| 2026-06-07 | City-first hub strategy pivot logged in `MEMORY.md` | Research | Research complete |
| 2026-06-07 | Ahrefs audit regression fixes — broken links, sitemap gaps, meta trim | QA | Shipped |
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
| 2026-05-22 | Mobile chrome redesign + UX/UI 12-item polish pass | Development | Deployed |
| 2026-05-18 | **PR #23 merged** — Utah wiring + nav/label UI cleanup | Development | Deployed |

### Week of 2026-05-11 → 2026-05-17

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-16 | **PR #22 merged** — Washington full data rebuild + California truth fixes | Infrastructure | Deployed |
| 2026-05-14 | **PR #20 merged** — 5-layer automated validation and self-healing | Infrastructure | Shipped |
| 2026-05-13 | **PR #16 merged** — Stage 6 analyses (7 data stories) | Research | Shipped |
| 2026-05-11 | Firecrawl pilot v1 — 3 scrapers, honest verdicts | Research | Research complete |

### Week of 2026-05-04 → 2026-05-10

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-10 | **PRs #1–9 merged** — national homepage, state hubs, facility profile redesign, Watch conversion | Development | Deployed |
| 2026-05-09 | Phase 0 SEO recovery + Texas editorial library | Development | Deployed |

---

## Month-level progress and learning (May → late June 2026)

| Metric | Start (May 4) | End (Jun 28) |
|--------|---------------|--------------|
| States with frontend | CA + partial OR/WA/MN/TX | CA, OR, WA, MN, UT, IL, PA, **AZ** (TX hidden) |
| Merged PRs | — | 33 total (#1–#37, gaps at #27–29, #32, #35–36); no new PRs Jun 22–28 |
| Publishable facilities | ~850 (CA-heavy) | ~3,865 (AZ adds 1,908 Directed Care) |
| Validation layers | 0 | 5 (L1–L2 in CI, L3 smoke in ingest workflow, L5 post-ingest, L5b hub drift) |
| Scheduled ingest workflows | 1 (CA-only) | 2 (CA weekly + **9-state** daily inspection matrix) |
| Email provider | Resend | Loops (audience + transactional + Watch alerts) |

**Key learnings logged (cumulative):**
- Pull broad, filter via signals — never prefilter at scrape (`SCRAPER_MODEL.md`).
- Physical city from Census Geocoder, not directory CSV city field.
- TipTap drops `data-stat` spans — HTML-source editor only for hub content.
- City-first hub strategy beats county replication (Ahrefs: zero county query volume).
- Supabase session pooler caps parallel CI matrix jobs — `max-parallel: 1` required at 9 states (was 3 at 8).
- **(Jun 17):** AZ Care Check REST API is viable for inspection ingest; ArcGIS Layer 12 is clean directory source (2,047 ALFs). Directed Care authorization = memory care gate.
- **(Jun 20):** States without row-level deficiency data must not show CA-specific "Type-A/B" stats — hide or relabel per-state. `inspectionHasRealNarrative` must check state-specific narrative fields (`narrative_summary` for AZ).
- **(Jun 21):** `validate.yml` red for weeks — not always data bugs; invariant config drifts when new states ship (`db_invariants.py` allowed-state list must be updated with each launch).
- **New (Jun 22):** Salesforce Experience Cloud blocks guest Aura API access for AZ deficiency details — Playwright DOM scrape is the viable path (`--mode deficiencies`).
- **New (Jun 26):** TX ingest failure was an exit-code bug in skip logic, not missing data — fix unblocked full 9-state matrix.
- **New (Jun 28):** Chained validate job (L3 + L5b) passes when run after ingest workflow; push-triggered `validate.yml` still fails on stale L1/L2 invariants.

**Week-over-week trajectory:**
- **Jun 1–8:** Content automation (hub pipeline) + PA ship + mobile engagement.
- **Jun 8–14:** Ingest automation at scale + hub differentiation + buy-side journey instrumentation.
- **Jun 15–21:** Ninth state launch (AZ) + post-launch YMYL QA + ingest baselines advancing. Shift from "build pipelines" to "run pipelines + ship states fast."
- **Jun 22–28:** Pipeline stabilization (9-state all-green) + AZ deficiency depth + mobile hub polish. Shift from "ship states" to "deepen state data + keep pipelines green."

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

**Last run:** Arizona — probe Jun 16, data+frontend Jun 17, YMYL fixes Jun 20 (PR #37). Fastest launch yet (~1 week probe-to-deploy). **Automation opportunity:** scaffold script from nearest state config; auto-update `db_invariants.py` allowed-state list on launch.

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

**Last run:** Scheduled success Jun 22. **Automation opportunity:** chain `post_ingest_check.py` in CDSS workflow; alert on failure.

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
| L1+L2 validation CI | No | Yes | `validate.yml` on push — failing 4 weeks (config drift); ingest workflow validate job passed Jun 28 |
| L3 smoke tests | Yes | No | Requires live URL |
| External audit (Ahrefs/Clarity) | Yes | No | Jun 20: 14 title/meta + sitemap fixes (PR #37) |

**Last run:** AZ deficiency merge + mobile UX fixes deployed Jun 26. **Automation opportunity:** post-deploy `smoke_test.py` in GitHub Actions; auto-update invariant allowed-state list on new state merge.

---

### Loop 5 — SEO/analytics audit remediation

```
Ahrefs or Clarity audit → triage findings → fix → validate → deploy → re-audit
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Audit execution | Yes | Partial | Ahrefs script in repo; Clarity passive |
| Triage + prioritize | Yes | No | Jun 20: AZ launch regressions + health score |
| Fix + PR | Yes | No | PR #37: 14 titles, 4 metas, sitemap join |
| Re-audit | Yes | No | |

**Last run:** Jun 20 PR #37 (Ahrefs health score + AZ YMYL fixes). **Automation opportunity:** scheduled sitemap/meta diff script.

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

**Last run:** AZ deficiency endpoint research Jun 22 (Aura blocked → Playwright ship Jun 26). Firecrawl v2 May 23.

---

### Loop 7 — Multi-state weekly inspection ingest

```
probe_inspection_freshness.py → weekly-inspection-ingest.yml (per-state matrix)
  → post_ingest_check.py (L5) → baseline commit on main
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Source freshness probe | No | Yes | Read-only; no DB writes |
| Per-state ingest | No | Yes | Matrix: CA, TX, OR, WA, MN, UT, IL, PA, **AZ**; daily 23:00 UTC |
| Post-ingest validation (L5) | No | Partial | Chained per-state (`|| true`) |
| Baseline commit | No | Partial | Auto-commit on delta |
| Pooler-aware parallelism | No | Yes | `max-parallel: 1` (sequential; pooler exhaustion at 3+) |

**Last run:** Run 28304562662 Jun 27–28 — **first all-9-states-green**; OR through 2026-06-25, MN through 2026-06-24. TX skip exit fixed Jun 26. **Automation opportunity:** alert on per-state failure; auto-tune parallelism from pooler metrics.

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

### Loop 9 — Post-launch YMYL QA *(validated Jun 20)*

```
new state deploy → spot-check facility + hub pages → Ahrefs/sitemap audit
  → fix misleading stats/copy/schema → PR → redeploy
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Spot-check facility profiles | Yes | No | AZ: "text not parsed" badge, 0-deficiency tiles |
| Ahrefs health score / sitemap diff | Yes | Partial | `sitemap_diff.py`, Ahrefs crawl |
| Fix state-specific stat labels | Yes | No | Hide CA terminology for non-CA states |
| Update `db_invariants.py` allowed states | Yes | No | **Missed on AZ launch — caused validate.yml red** |
| PR + redeploy | Yes | Partial | PR #37 same week as launch |

**Last run:** Arizona Jun 17 launch → Jun 20 PR #37 fixes; AZ county hub spot-check slug fix Jun 27. **Automation opportunity:** post-launch checklist script that diffs state config vs invariant allowed list; auto-run sitemap_diff after COVERED_STATES change.

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

**Last run:** Arizona Jun 22–26 — Aura guest access blocked; Playwright DOM scrape shipped. Backfill in progress. **Automation opportunity:** generic Playwright deficiency scaffold; auto-detect "no deficien" fast-path.

---

## Automation priority backlog

| Priority | Loop | Gap | Effort |
|----------|------|-----|--------|
| P0 | Loop 4 | Fix `validate.yml` — add IL, PA, AZ to `db_invariants.py` allowed-state list (2,293 facilities flagged) | Trivial |
| P0 | Loop 3 | Apply migration 0047 in Supabase SQL editor | Owner action |
| P0 | Loop 8 | Apply migrations 0049 + 0052; probe OR signal before enabling cron | Owner + Small |
| P1 | Loop 10 | Complete AZ deficiency backfill (`--mode deficiencies`) | Medium (running) |
| P1 | Loop 7 | Alert on per-state ingest job failure (Slack/email) | Small |
| P1 | Loop 9 | Post-launch checklist: invariant list + sitemap_diff on COVERED_STATES change | Small |
| P1 | Loop 2 | Chain `post_ingest_check.py` after CDSS ingest | Small |
| P1 | Loop 4 | Post-deploy `smoke_test.py` in GitHub Actions | Medium |
| P2 | Loop 1 | New-state scaffold generator from playbook | Medium |
| P2 | Loop 10 | Generic Playwright deficiency scaffold for Salesforce Experience Cloud states | Medium |
| P2 | Loop 3 | Auto-trigger hub draft generation for drifted cities post-ingest | Medium |
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
