# Work Database — StarlynnCare

Running log of shipped work, research, QA, deployments, and infrastructure. Updated weekly by the work-database automation (Sundays 13:00 UTC). Each entry: **date**, **description**, **category**, **status**.

**Status values:** `Shipped` · `In progress` · `Blocked` · `Research complete` · `QA passed` · `Deployed`

**Last updated:** 2026-06-14

---

## Week of 2026-06-08 → 2026-06-14

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-13 | **PR #31 merged** — buy-side journey instrumentation Phase 1: intent column on `facility_watchers`, placement attestation UI, Records Pull reframe, crisis playbook (`/library/the-first-72-hours`), Contract Decoder (`/tools/contract-review`), journey-stage plumbing on capture endpoints | Development | Deployed |
| 2026-06-13 | **PR #30 merged** — hub differentiation: `region_hub_stats()` RPC + `HubDifferentiators` on city/county hubs; CA/UT/IL memory-care licensing editorial pages | Development | Deployed |
| 2026-06-13 | Ingest hardening — cap parallel matrix jobs to 3 (Supabase pooler exhaustion); propagate MN ingest failures; update MN baseline to 2026-06-03 | Infrastructure | Shipped |
| 2026-06-13 | GovernanceBar copy simplified to single buy-side sentence | Development | Deployed |
| 2026-06-12 | Phase 1 SEO pass — hub reframe, pillar page, schema fixes, facility photos, dead hub cleanup | Development | Shipped |
| 2026-06-12 | Source-only inspection freshness probe (`probe_inspection_freshness.py`) for nightly automation; wired to trigger weekly ingest after OR/MN freshness check | Infrastructure | Shipped |
| 2026-06-12 | Weekly inspection ingest scheduled runs succeeded (Jun 9–12); Jun 13–14 runs failed (pooler + MN propagation fixes landed same day) | Deployment | In progress |
| 2026-06-10 | Facility Watch welcome email copy fix — state-agnostic, drop duplicate license/beds | Development | Shipped |
| 2026-06-09 | Facility Watch monitoring — email alerts when a watched facility's inspection record changes (`facility_watch_scan.py`, Loops transactional, migration 0049) | Development | In progress |
| 2026-06-09 | SEO tier 1–2 — "Reviews" in facility title/meta hook; 3 PA editorial articles + illustrations | Development | Deployed |
| 2026-06-09 | Weekly inspection ingest parallelized per-state matrix (CA, TX, OR, WA, MN, UT, IL, PA); IL runner signature fix, `pdfplumber` dep, skip CA on push, WA timeout extended | Infrastructure | Shipped |
| 2026-06-08 | Weekly multi-state inspection check + ingest pipeline (`weekly-inspection-ingest.yml`, daily 23:00 UTC) | Infrastructure | Shipped |
| 2026-06-08 | CI: weekly inspection ingest triggers on orchestrator file changes | Infrastructure | Shipped |

### Week patterns (2026-06-08 → 2026-06-14)

**Dominant work types:** Development (~45%), Infrastructure (~40%), Deployment (~15%).

**Themes:**
1. **Multi-state ingest automation** — largest infrastructure push of the week. New daily matrix workflow across 8 states, freshness probe, and iterative hardening after pooler exhaustion (Jun 13).
2. **Hub differentiation + regulatory depth** — Phase 2 shipped computed stats on every city/county hub and three new state licensing explainers (CA/UT/IL).
3. **Buy-side journey** — Phase 1 instrumentation ties Watch, Records Pull, crisis content, and Contract Decoder into a single intent/stage model.
4. **Facility Watch v1** — moved from capture-only to change-detection alerts; probe-first per MEMORY.md (cron still `workflow_dispatch` only).
5. **Validation CI still red** — `validate.yml` failed on every `main` push this week; weekly ingest and CDSS workflows succeed independently.

**Emerging loops:** Multi-state weekly inspection ingest (Loop 7) is the week's main new repeatable workflow. Facility Watch monitoring (Loop 8) extends the existing Watch capture loop.

**Open / blocked:**
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor (admin tool can't write).
- Migration `0049_facility_watch_monitoring.sql` + `0052` intent column — apply before full Watch monitoring goes live.
- `validate.yml` failures on `main` — investigate invariant drift vs `DATABASE_URL` secret (unchanged blocker from prior week).
- Weekly inspection ingest Jun 13–14 failures — fixes merged; next scheduled run will confirm.

---

## Prior weeks (month context)

### Week of 2026-06-01 → 2026-06-08

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-08 | Hub content bulk-publish script + GitHub Actions workflow; first manual run succeeded | Infrastructure | Shipped |
| 2026-06-08 | Mobile facility profile engagement pass — CSS `order` reorder, compressed Snapshot, jump-to-facts chips (Clarity-driven) | Development | Shipped |
| 2026-06-08 | Mobile hero simplification, sub-nav chip truncation fix, methodology byline below findings | Development | Shipped |
| 2026-06-08 | VerdictCard citation styling fix (italicize trailing *s*) | Development | Shipped |
| 2026-06-07 | Hub content pipeline Phase 1 — checkpoints 1–5: migration 0047, generator, loader, admin review tool, drift audit in `cdss-weekly-ingest.yml` | Development | In progress |
| 2026-06-07 | Hub content generator CI (`generate-hub-content.yml`); 3 manual smoke runs succeeded | Infrastructure | Shipped |
| 2026-06-07 | City-first hub strategy pivot logged in `MEMORY.md` | Research | Research complete |
| 2026-06-07 | TipTap rejected for hub editor — HTML-source editor chosen (`ERRORS.md`) | Research | Research complete |
| 2026-06-07 | Ahrefs audit regression fixes — broken links, sitemap gaps, meta trim | QA | Shipped |
| 2026-06-07 | Submissions: all `SubmissionEventType` values + transient insert survival (migration 0048) | Development | Shipped |
| 2026-06-07 | PA inspection editorials merged; insights hero images swapped | Development | Deployed |
| 2026-06-07 | Homepage severe-deficiency stat fixed (6-month RPC count) | Development | Shipped |
| 2026-06-07 | SessionStart hook + package-lock churn fix | Infrastructure | Shipped |
| 2026-06-06 | **PR #26 merged** — Pennsylvania frontend launch | Development | Deployed |
| 2026-06-06 | Homepage hero copy + dynamic state count | Development | Deployed |
| 2026-06-06 | County hub UX — collapsible intro, FAQ HTML link fixes | Development | Deployed |
| 2026-06-01 | **PR #25 merged** — proximity-based scale interactions | Development | Deployed |
| 2026-06-01 | Homepage mobile search — city names in ZIP field | Development | Deployed |

### Week of 2026-05-25 → 2026-05-31

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-31 | May 31 analytics audit remediation — all 10 todos | QA | Shipped |
| 2026-05-31 | Bibliofangirl Pittsburgh memory care report page | Development | Deployed |
| 2026-05-31 | Bibliofangirl: live deficiency data after PA backfill | Development | Shipped |
| 2026-05-25 | **PR #24 merged** — Utah audit fixes (7 issues) across all states | QA | Deployed |
| 2026-05-24 | Pennsylvania data-ingest pipeline — DHS HSD + CMS NF overlay (355 facilities) | Infrastructure | Shipped |
| 2026-05-24 | `pa_pdf_download` session pooler idle-timeout reconnect fix | Infrastructure | Shipped |

### Week of 2026-05-18 → 2026-05-24

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-23 | WA editorial articles (2) + severity ingest bug fixes | Development | Deployed |
| 2026-05-23 | Firecrawl pilot v2 — news monitor + pricing triangulation | Research | Research complete |
| 2026-05-23 | 6 editorial illustrations wired across site | Development | Deployed |
| 2026-05-23 | Clarity UX audit fixes — CLS, dead-click disclosure | QA | Shipped |
| 2026-05-22 | Mobile chrome redesign + UX/UI 12-item polish pass | Development | Deployed |
| 2026-05-22 | Inspections query chunking — PostgREST truncation fix | Development | Shipped |
| 2026-05-19 | Security hardening pass (H1–H8, M1–M6, L1–L5) | Infrastructure | Deployed |
| 2026-05-18 | **PR #23 merged** — Utah wiring + nav/label UI cleanup | Development | Deployed |

### Week of 2026-05-11 → 2026-05-17

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-16 | **PR #22 merged** — Washington full data rebuild + California truth fixes | Infrastructure | Deployed |
| 2026-05-14 | **PR #20 merged** — 5-layer automated validation and self-healing | Infrastructure | Shipped |
| 2026-05-14 | **PR #21 merged** — Phase 5 press pitch | Research | Research complete |
| 2026-05-13 | **PR #16 merged** — Stage 6 analyses (7 data stories) | Research | Shipped |
| 2026-05-13 | **PR #17 merged** — Loops Audience consolidation | Infrastructure | Deployed |
| 2026-05-11 | **PRs #12–15 merged** — thin-page badge, full-history waitlist, WA BHForms, facility 404 fix | Development | Deployed |
| 2026-05-11 | Firecrawl pilot v1 — 3 scrapers, honest verdicts | Research | Research complete |

### Week of 2026-05-04 → 2026-05-10

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-10 | **PRs #1–9 merged** — national homepage, state hubs, facility profile redesign, Watch conversion, OR fixes, cross-state data depth | Development | Deployed |
| 2026-05-10 | Facility Watch v0 — email capture on every facility profile | Development | Deployed |
| 2026-05-09 | Phase 0 SEO recovery + Texas editorial library | Development | Deployed |
| 2026-05-09 | Ahrefs audit issues — meta, titles, schema, OG, broken links | QA | Shipped |

---

## Month-level progress and learning (May → mid-June 2026)

| Metric | Start (May 4) | End (Jun 14) |
|--------|---------------|--------------|
| States with frontend | CA + partial OR/WA/MN/TX | CA, OR, WA, MN, UT, IL, **PA** (TX hidden) |
| Merged PRs | — | 31 total (#1–#31) |
| Validation layers | 0 | 5 (L1–L2 in CI, L3 manual smoke, L5 post-ingest, L5b hub drift) |
| Scheduled ingest workflows | 1 (CA-only) | 2 (CA weekly + 8-state daily inspection matrix) |
| Analysis data stories | 0 | 7 (+ canvas + INDEX) |
| Email provider | Resend | Loops (audience + transactional + Watch alerts) |

**Key learnings logged (cumulative):**
- Pull broad, filter via signals — never prefilter at scrape (`SCRAPER_MODEL.md`).
- Physical city from Census Geocoder, not directory CSV city field.
- TipTap drops `data-stat` spans — HTML-source editor only for hub content.
- Claude Code web can't reach Postgres wire protocol; Python validators run in CI/Cursor only.
- City-first hub strategy beats county replication (Ahrefs: zero county query volume).
- **New (Jun 13):** Supabase session pooler (`pool_size=15`) caps parallel CI matrix jobs — `max-parallel: 3` required for 8-state ingest.
- **New (Jun 12):** Source-only freshness probe decouples "is there new data?" from full ingest — enables conditional nightly runs.
- **New (Jun 13):** Loops MJML uploads require `index.mjml` filename + `{DATA_VARIABLE:name}` syntax (`ERRORS.md`).

**Week-over-week trajectory:**
- **Jun 1–8:** Content automation (hub pipeline) + PA ship + mobile engagement.
- **Jun 8–14:** Ingest automation at scale + hub differentiation + buy-side journey instrumentation. Shift from "build the pipeline" to "run the pipeline across all states."

---

## Repeatable loops

### Loop 1 — New state launch

```
scrape universe → parity audit → recompute_publishable → frontend config
  → county/city hubs + articles → PR + Vercel preview → merge → smoke test
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Scrape licensed universe | Trigger | Partial | Per-state Python ingest scripts |
| Parity audit vs playbook | Yes | No | `docs/NEW_STATE_PLAYBOOK.md` checklist |
| `recompute_publishable.py` | Trigger | Yes | Manual `--apply` |
| Frontend config + hubs + articles | Yes | No | ~15 files per state; PA took ~1 session |
| PR + preview deploy | Yes | Partial | Vercel auto-preview on PR |
| Post-deploy smoke test | Yes | No | `smoke_test.py` — manual, not in CI |

**Last run:** Pennsylvania — data May 24, frontend Jun 6 (PR #26). **Automation opportunity:** scaffold script from nearest state config + playbook checklist.

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

**Last run:** Scheduled success Jun 8. **Automation opportunity:** chain `post_ingest_check.py` in CDSS workflow; alert on failure.

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
| L1+L2 validation CI | No | Yes | `validate.yml` — failing on every push (2 weeks running) |
| L3 smoke tests | Yes | No | Requires live URL |
| External audit (Ahrefs/Clarity) | Yes | No | Jun 7 regression fixes; Jun 8 mobile pass |

**Last run:** PRs #30–#31 deployed Jun 13. **Automation opportunity:** post-deploy `smoke_test.py` in GitHub Actions; fix CI invariant failures.

---

### Loop 5 — SEO/analytics audit remediation

```
Ahrefs or Clarity audit → triage findings → fix → validate → deploy → re-audit
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Audit execution | Yes | Partial | Ahrefs script in repo; Clarity passive |
| Triage + prioritize | Yes | No | May 31: 10 todos; Jun 7: regressions; Jun 12: Phase 1 SEO pass |
| Fix + PR | Yes | No | |
| Re-audit | Yes | No | |

**Last runs:** Jun 12 Phase 1 SEO pass (hub reframe, schema, dead hubs). **Automation opportunity:** scheduled sitemap/meta diff script.

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

**Last run:** Firecrawl v2 May 23.

---

### Loop 7 — Multi-state weekly inspection ingest *(new Jun 8)*

```
probe_inspection_freshness.py → weekly-inspection-ingest.yml (per-state matrix)
  → post_ingest_check.py (L5) → [optional] hub_content_drift_check
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Source freshness probe | No | Yes | Read-only; no DB writes (`probe_inspection_freshness.py`) |
| Per-state ingest | No | Yes | Matrix: CA, TX, OR, WA, MN, UT, IL, PA; daily 23:00 UTC |
| Post-ingest validation (L5) | No | Partial | Chained per-state in workflow (`|| true` — failures don't block) |
| Pooler-aware parallelism | No | Yes | `max-parallel: 3` after Jun 13 pool exhaustion lesson |

**Last run:** Success Jun 9–12; failure Jun 13–14 (pooler + MN propagation — fixes merged same day). **Automation opportunity:** alert on per-state job failure (currently silent except GitHub UI); auto-skip states with no freshness delta.

---

### Loop 8 — Facility Watch monitoring *(new Jun 9)*

```
facility_watch_probe.py (validate signal) → facility_watch_scan.py
  → Loops transactional alert → [weekly] facility-watch-weekly-signals.yml
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Probe (read-only) | Trigger | Yes | `facility_watch_probe.py` — no ingest, no snapshots |
| Snapshot + diff scan | Trigger | Partial | `facility_watch_scan.py`; cron commented out |
| Change alert email | No | Yes | Loops `LOOPS_WATCH_CHANGE_ID` |
| Welcome email on signup | No | Yes | Auto-confirm (no click); `LOOPS_WATCH_WELCOME_ID` |
| Apply migrations 0049 + 0052 | Yes | No | Owner action in SQL editor |

**Last run:** Code on `main` Jun 9–10; probe-first per MEMORY.md. Cron disabled — `workflow_dispatch` only. **Automation opportunity:** enable daily cron after probe validates signal on OR; admin alert on scan failures.

---

## Automation priority backlog

| Priority | Loop | Gap | Effort |
|----------|------|-----|--------|
| P0 | Loop 4 | Fix `validate.yml` failures on `main` (2 weeks red) | Small |
| P0 | Loop 3 | Apply migration 0047 in Supabase SQL editor | Owner action |
| P0 | Loop 8 | Apply migrations 0049 + 0052; probe OR signal before enabling cron | Owner + Small |
| P1 | Loop 7 | Alert on per-state ingest job failure (Slack/email) | Small |
| P1 | Loop 7 | Auto-skip states where freshness probe shows no delta | Medium |
| P1 | Loop 2 | Chain `post_ingest_check.py` after CDSS ingest | Small |
| P1 | Loop 4 | Post-deploy `smoke_test.py` in GitHub Actions | Medium |
| P2 | Loop 1 | New-state scaffold generator from playbook | Medium |
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
