# Work Database — StarlynnCare

Running log of shipped work, research, QA, deployments, and infrastructure. Updated weekly by the work-database automation (Sundays 13:00 UTC). Each entry: **date**, **description**, **category**, **status**.

**Status values:** `Shipped` · `In progress` · `Blocked` · `Research complete` · `QA passed` · `Deployed`

**Last updated:** 2026-06-08

---

## Week of 2026-06-01 → 2026-06-08

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-06-08 | Hub content bulk-publish script + GitHub Actions workflow (`bulk-publish-hub-content.yml`); first manual run succeeded | Infrastructure | Shipped |
| 2026-06-08 | Mobile facility profile engagement pass — CSS `order` reorder (QuickFacts → Peer rank → Record → Snapshot), compressed Snapshot photo/map, jump-to-facts chips in sticky sub-nav; Clarity-driven | Development | Shipped |
| 2026-06-08 | Mobile facility hero simplification (citation count only); sub-nav chip truncation fix; methodology byline moved below findings | Development | Shipped |
| 2026-06-08 | VerdictCard citation styling fix (italicize trailing *s*) | Development | Shipped |
| 2026-06-07 | Hub content pipeline Phase 1 — checkpoints 1–5: `hub_content` migration (0047), city-hub draft generator, published-content loader with fallback, admin HTML-source review tool + approval gate, post-ingest drift audit wired into `cdss-weekly-ingest.yml` | Development | In progress |
| 2026-06-07 | Hub content generator CI workflow (`generate-hub-content.yml`); 3 manual smoke runs succeeded, 1 failed (env/secrets) | Infrastructure | Shipped |
| 2026-06-07 | City-first hub strategy + automated content pipeline pivot logged in `MEMORY.md`; county replication de-emphasized per Ahrefs keyword data | Research | Research complete |
| 2026-06-07 | TipTap/WYSIWYG rejected for hub editor (silently drops `data-stat` spans); HTML-source editor chosen — logged in `ERRORS.md` | Research | Research complete |
| 2026-06-07 | Ahrefs audit regression fixes — broken links, sitemap gaps, meta trim | QA | Shipped |
| 2026-06-07 | Submissions: record all `SubmissionEventType` values + survive transient insert failures (migration 0048) | Development | Shipped |
| 2026-06-07 | PA inspection editorials merged to `main`; insights stories swapped to thematic custom hero images | Development | Deployed |
| 2026-06-07 | Homepage severe-deficiency stat fixed to use 6-month RPC count (was stale/wrong window) | Development | Shipped |
| 2026-06-07 | SessionStart hook: auto-install deps in web sessions; package-lock churn fix (revert after `npm install`) | Infrastructure | Shipped |
| 2026-06-07 | `CLAUDE.md` communication-style rule — lead with purpose, tell the story | Infrastructure | Shipped |
| 2026-06-06 | **PR #26 merged** — Pennsylvania frontend launch: PCH/ALR memory care, 6 county hubs, 2 state articles, profile config, city intros | Development | Deployed |
| 2026-06-06 | Homepage hero copy ("Find the best" + regulator verification); dynamic state count (no hardcoded 5) | Development | Deployed |
| 2026-06-06 | County hub UX — intro prose below facility grid, collapsible "Read more"; FAQ HTML link rendering fixes | Development | Deployed |
| 2026-06-01 | Homepage mobile search — allow city names in ZIP search field | Development | Deployed |
| 2026-06-01 | **PR #25 merged** — proximity-based scale interactions on state grid and facility sub-nav | Development | Deployed |

### Week patterns (2026-06-01 → 2026-06-08)

**Dominant work types:** Development (~60%), Infrastructure (~20%), Research/QA (~20%).

**Themes:**
1. **Hub content automation** — largest new system: generator → review → publish → drift audit. Emerged from city-first SEO strategy pivot.
2. **Pennsylvania ship** — data plane (May) + frontend (Jun) closed the full new-state loop for PA.
3. **Mobile facility engagement** — Clarity session replay drove a focused mobile reorder pass without changing DOM/SEO crawl order.
4. **Validation CI noise** — many `validate.yml` runs failed on `main` pushes this week (likely `DATABASE_URL` or invariant drift); bulk-publish and hub-content generator workflows succeeded independently.

**Emerging loops:** Hub content pipeline (see Loop 3 below) is the week's main new repeatable workflow. PA launch re-validated the new-state loop (Loop 1).

**Open / blocked:**
- Migration `0047_hub_content.sql` must be applied in Supabase SQL editor before admin tool can write (DDL can't go through PostgREST).
- Hub content checkpoints 4–5 were on preview branch `claude/amazing-hopper-5HquU`; bulk-publish workflow now on `main`.

---

## Prior weeks (month context)

### Week of 2026-05-25 → 2026-05-31

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-31 | May 31 analytics audit remediation — all 10 todos (Clarity + Ahrefs findings) | QA | Shipped |
| 2026-05-31 | Bibliofangirl Pittsburgh memory care report page (`/bibliofangirl`) | Development | Deployed |
| 2026-05-31 | Bibliofangirl page: live deficiency data after PA backfill | Development | Shipped |
| 2025-05-31 | Shortlist page split server/client — fix `next/headers` build error | Development | Shipped |
| 2026-05-28 | Pittsburgh report page scaffold | Development | Shipped |
| 2026-05-25 | **PR #24 merged** — Utah audit fixes (7 issues) applied across all states | QA | Deployed |
| 2026-05-25 | Mobile dead-click fixes on facility card name + decorative illustrations | Development | Shipped |
| 2026-05-25 | Editorial factual corrections on AI-cited pages | QA | Shipped |
| 2026-05-24 | Pennsylvania data-ingest pipeline — DHS HSD XLSX + CMS NF overlay (355 publishable facilities) | Infrastructure | Shipped |
| 2026-05-24 | `pa_pdf_download` session pooler idle-timeout reconnect fix | Infrastructure | Shipped |

### Week of 2026-05-18 → 2026-05-24

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-23 | WA editorial articles (2) + severity ingest bug fixes; WA guides placement fix | Development | Deployed |
| 2026-05-23 | Firecrawl pilot v2 merged — news monitor + pricing triangulation (Orange County smoke) | Research | Research complete |
| 2026-05-23 | 6 editorial illustrations added and wired across site | Development | Deployed |
| 2026-05-23 | Clarity UX audit fixes — CLS, dead-click disclosure, false affordances, preview exclusion | QA | Shipped |
| 2026-05-23 | TX hidden from `/states` grid until full HHSC dataset ready | Development | Shipped |
| 2026-05-22 | Mobile chrome redesign + warmth restore + chart removal | Development | Deployed |
| 2026-05-22 | UX/UI audit — 12-item polish pass | QA | Shipped |
| 2026-05-22 | Inspections query chunking — fix PostgREST truncation on list pages | Development | Shipped |
| 2026-05-22 | Facility 404 → city hub redirect; UT guide redirects | Development | Shipped |
| 2026-05-21 | Alameda County deficiency rate corrected (83% → 92/93, DB-verified) | QA | Shipped |
| 2026-05-20 | SEO/GEO corrective audit — P0 + P1 + P2 engineering tasks | QA | Shipped |
| 2026-05-19 | Security hardening pass — rate limits, honeypots, JSON-LD escape, headers, RLS, admin allowlist (H1–H8, M1–M6, L1–L5) | Infrastructure | Deployed |
| 2026-05-18 | **PR #23 merged** — Utah wiring + nav/label UI cleanup | Development | Deployed |

### Week of 2026-05-11 → 2026-05-17

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-16 | **PR #22 merged** — Washington full data rebuild + California truth fixes | Infrastructure | Deployed |
| 2026-05-16 | Unified submission alerts + audit log; Ahrefs analytics script alongside Clarity | Development | Deployed |
| 2026-05-14 | **PR #20 merged** — 5-layer automated validation and self-healing system | Infrastructure | Shipped |
| 2026-05-14 | **PR #21 merged** — Phase 5 press pitch (reporter list + email drafts) | Research | Research complete |
| 2026-05-14 | SEO audit implementation — schema dates, snippet rewrites, DOM reorder | QA | Shipped |
| 2026-05-13 | **PR #16 merged** — Stage 6 analyses (7 data stories + tooling) | Research | Shipped |
| 2026-05-13 | **PR #17 merged** — consolidate all email captures to Loops Audience | Infrastructure | Deployed |
| 2026-05-13 | Peer rank copy fix + remove letter-grade framing; repeat rank formula fix | Development | Shipped |
| 2026-05-13 | **PR #18 merged** — Opal Care data audit (repeat rank percentile) | QA | Shipped |
| 2026-05-11 | **PRs #12–15 merged** — thin-page badge, homepage counts fix, full-history waitlist, WA BHForms narrative scraper, facility profile 404 fix | Development | Deployed |
| 2026-05-11 | Firecrawl pilot v1 — 3 scrapers, honest verdicts documented in `FIRECRAWL_PILOT_RESULTS.md` | Research | Research complete |
| 2026-05-11 | Photo attribution backfill + Supabase Storage migration | Infrastructure | Shipped |

### Week of 2026-05-04 → 2026-05-10

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-05-10 | **PRs #1–9 merged** — national homepage, state hubs, facility profile redesign, Watch conversion (3 placements), About page, OR data fixes, schema P0 fixes, cross-state data depth, `/{state}/facilities` browse page | Development | Deployed |
| 2026-05-10 | Facility Watch v0 — email capture on every facility profile; Resend → Loops migration | Development | Deployed |
| 2026-05-10 | 3-year free-tier inspection display cap; multi-state signal model (`SCRAPER_MODEL.md`) | Development | Shipped |
| 2026-05-09 | Phase 0 SEO recovery + state content tagging + Texas editorial library | Development | Deployed |
| 2026-05-09 | MN PDF narrative scraper; MN citation data fix (substantiated complaints) | Infrastructure | Shipped |
| 2026-05-09 | Ahrefs audit issues — meta, titles, schema, OG, broken links | QA | Shipped |

---

## Month-level progress and learning (May → early June 2026)

| Metric | Start (May 4) | End (Jun 8) |
|--------|---------------|-------------|
| States with frontend | CA + partial OR/WA/MN/TX | CA, OR, WA, MN, UT, **PA** (TX hidden) |
| Merged PRs | — | 26 total (#1–#26) |
| Validation layers | 0 | 5 (L1–L2 in CI, L3 manual smoke, L5 post-ingest, L5b hub drift) |
| Analysis data stories | 0 | 7 (+ canvas + INDEX) |
| Email provider | Resend | Loops (audience + transactional) |

**Key learnings logged:**
- Pull broad, filter via signals — never prefilter at scrape (`SCRAPER_MODEL.md`).
- Physical city from Census Geocoder, not directory CSV city field (`recompute_physical_city.py`).
- TipTap drops `data-stat` spans — HTML-source editor only for hub content.
- Claude Code web can't reach Postgres wire protocol; Python validators run in CI/Cursor only.
- City-first hub strategy beats county replication (Ahrefs: zero county query volume).

---

## Repeatable loops

### Loop 1 — New state launch

```
scrape universe → parity audit → recompute_publishable → frontend config
  → county/city hubs + articles → PR + Vercel preview → merge → smoke test
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Scrape licensed universe | Trigger | Partial | Per-state Python ingest scripts; no unified orchestrator |
| Parity audit vs playbook | Yes | No | `docs/NEW_STATE_PLAYBOOK.md` checklist |
| `recompute_publishable.py` | Trigger | Yes | Script exists; manual `--apply` |
| Frontend config + hubs + articles | Yes | No | ~15 files per state; PA took ~1 session |
| PR + preview deploy | Yes | Partial | Vercel auto-preview on PR |
| Post-deploy smoke test | Yes | No | `smoke_test.py` — manual, not in CI |

**Last run:** Pennsylvania — data May 24, frontend Jun 6 (PR #26). **Automation opportunity:** scaffold script that copies nearest state config + generates checklist from `NEW_STATE_PLAYBOOK.md`.

---

### Loop 2 — Weekly data ingest (California)

```
cdss-weekly-ingest.yml (Mon 10:00 UTC) → ccld_citations_ingest → hub_content_drift_check
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| CDSS citation scrape | No | Yes | Cron + `workflow_dispatch` |
| Post-ingest validation (L5) | No | Partial | `post_ingest_check.py` not yet chained in workflow — only drift check is |
| Hub content drift audit (L5b) | No | Yes | Flags `drift_detected`; hides stale content from public |

**Last run:** Scheduled; drift check wired Jun 7. **Automation opportunity:** chain `post_ingest_check.py` in the same workflow; alert on failure (Slack/email).

---

### Loop 3 — Hub content generation → publish

```
generate_hub_content.py → admin review (/admin/hub-content) → approve → publish
  → [next ingest] drift_check → regenerate if drifted
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Draft generation | Trigger | Yes | `generate-hub-content.yml` (manual dispatch) |
| Stats verification gate | No | Yes | `verifyHubStats` / `verify_stats` — deterministic, no model |
| Human prose review + edit | Yes | No | HTML-source editor; numbers not human-checked per design |
| Approve + publish | Yes | Partial | Admin UI; `bulk_publish_hub_content.py` + workflow for batch |
| Drift re-audit | No | Yes | Runs on every CDSS ingest |

**Last run:** Generator smoke runs Jun 7–8; bulk-publish workflow succeeded Jun 8. **Blocked:** migration 0047 not yet applied in prod SQL editor. **Automation opportunity:** auto-generate drafts for all eligible cities post-ingest; Slack alert when `drift_detected=true`.

---

### Loop 4 — Deploy QA

```
merge to main → Vercel production deploy → smoke_test.py → Ahrefs/Clarity audit → fix regressions
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Merge + deploy | Yes | Yes | `main` auto-deploys to production |
| L1+L2 validation CI | No | Yes | `validate.yml` on every push — but failing frequently this week |
| L3 smoke tests | Yes | No | Requires live URL; documented in `VALIDATION.md` |
| External audit (Ahrefs/Clarity) | Yes | No | May 31 audit drove 10-todo remediation; Jun 7 regression fixes |

**Last run:** Jun 7 Ahrefs regression fixes; Jun 8 mobile facility pass (Clarity-driven). **Automation opportunity:** run `smoke_test.py` as post-deploy GitHub Action with production URL secret; fix CI `DATABASE_URL`/invariant failures blocking green builds.

---

### Loop 5 — SEO/analytics audit remediation

```
Ahrefs or Clarity audit → triage findings → fix → validate → deploy → re-audit
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Audit execution | Yes | Partial | Ahrefs script in repo; Clarity is passive |
| Triage + prioritize | Yes | No | May 31: 10 todos; Jun 7: regression pass |
| Fix + PR | Yes | No | |
| Re-audit | Yes | No | |

**Last runs:** May 31 (10-item pass), Jun 7 (regressions), Jun 8 (mobile engagement from Clarity replay). **Automation opportunity:** scheduled Ahrefs crawl diff script (`docs/audits/sitemap-diff.md` pattern); Clarity rage-click alert → auto-file issue.

---

### Loop 6 — Research pilot → ship or kill

```
hypothesis → pilot script → honest results doc → MEMORY.md decision → ship or archive
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Pilot run | Trigger | Partial | Firecrawl pilots (news, pricing) |
| Results documentation | Yes | No | `FIRECRAWL_PILOT_RESULTS.md` — honest verdicts |
| Go/no-go decision | Yes | No | Pricing pilot killed (account cap + low signal); news v2 at 96% |
| Production integration | Yes | No | None shipped to prod yet |

**Last run:** Firecrawl v2 May 23. **Learning:** platform monthly cap blocked full runs before project $50 cap.

---

## Automation priority backlog

| Priority | Loop | Gap | Effort |
|----------|------|-----|--------|
| P0 | Loop 4 | Fix `validate.yml` failures on `main` (investigate invariant drift vs secret) | Small |
| P0 | Loop 3 | Apply migration 0047 in Supabase SQL editor | Owner action |
| P1 | Loop 2 | Chain `post_ingest_check.py` after ingest in `cdss-weekly-ingest.yml` | Small |
| P1 | Loop 4 | Post-deploy `smoke_test.py` in GitHub Actions | Medium |
| P2 | Loop 1 | New-state scaffold generator from playbook | Medium |
| P2 | Loop 3 | Auto-trigger hub draft generation after ingest for drifted cities | Medium |
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
