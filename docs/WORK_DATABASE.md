# Work Database — StarlynnCare

Running log of shipped work, research, QA, deployments, and infrastructure. Updated weekly by the work-database automation (Sundays 13:00 UTC). Each entry: **date**, **description**, **category**, **status**.

**Status values:** `Shipped` · `In progress` · `Blocked` · `Research complete` · `QA passed` · `Deployed`

**Last updated:** 2026-09-13

---

## Week of 2026-09-07 → 2026-09-13

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-09-13 | Sunday GHA weekly scan run **34758293379** queued/in progress at automation time (schedule 12:52 UTC) | Infrastructure | In progress |
| 2026-09-12 | Cron probe — no new source data beyond post-#122 GHA **34656724807** — **PR #123 open** (draft; baseline sync only; does not trigger ingest) | Infrastructure | Shipped |
| 2026-09-11 | **PR #122 merged** — cron probe OR +1, MN insertDate +20 (trigger weekly ingest); GHA **34656724807** (~8h, workflow failed; L5 post-ingest pattern unchanged) | Infrastructure | Shipped |
| 2026-09-10 | **PR #121 merged** — cron probe OR +2 (max 2026-09-09), MN insertDate unchanged (trigger weekly scan) | Infrastructure | Shipped |
| 2026-09-09 | **PR #120 merged** — cron probe OR +2, MN insertDate +5 (trigger weekly scan) | Infrastructure | Shipped |
| 2026-09-07 | **PR #119 merged** — cron probe OR +1, MN insertDate +8 (trigger weekly scan); GHA **34168824191** (~7.5h, failed) | Infrastructure | Shipped |
| 2026-09-07–09-13 | **Four probe PRs merged** (#119–#122) — **recovers from Sep 2–6 merge gap**; supersedes open chain #114–#118 and stale #116; Clearing redesign (PR #77, Jul 30) remains last feature ship | Infrastructure | Shipped |
| 2026-09-07–09-13 | Sep 6 Sunday GHA **34031195270** completed (failure) — matrix ingest ran ~6h; **L5 post-ingest fails**; alert dispatch skipped (carried from prior week) | Infrastructure | Blocked |
| 2026-09-07–09-13 | `validate.yml` on push — **still failing** (15th week red): **31/37** unchanged; scraper freshness MN/OR/TX/UT; publishable null/zero beds; repeat-offender composite rank | QA | Blocked |
| 2026-09-07–09-13 | Pre-ingest production page spot-check — **153/153** on merged probe PRs #119–#122; PR #123 **151/151** (one transient SSL retry on `/california/oakland`) | QA | QA passed |
| 2026-09-07–09-13 | Weekly work database — **PR #117 still open** (Aug 31–Sep 6); superseded by this run | Research | In progress |
| 2026-09-07–09-13 | Stale open ingest probe PRs **#76–#82, #93, #98–#118** still unclosed (superseded by #119–#122 merges) | Infrastructure | Blocked |
| 2026-09-07–09-13 | **Facility Watch Premium** — operator QA (controlled $9 purchase + first concierge fulfillment) still pending | QA | In progress |
| 2026-09-07–09-13 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before library magnet emails deliver | Deployment | Blocked |

### Week patterns (2026-09-07 → 2026-09-13)

**Dominant work types:** Infrastructure (~94%), QA (~5%), Research (~1%).

**Themes:**
1. **Loop 7 merge-gap recovery (streak mode)** — after Sep 2–6 drought, **four consecutive nightly merges** (#119 Sep 7 → #122 Sep 11). MN insertDate **+20** on Sep 11 shows bulk posting-delay catch-up after gap; OR advanced incrementally (+1→+2→+2→+1). Open #116/#114–#118 chain obsolete but still open as draft PRs.
2. **Sunday GHA + merge-triggered ingest (Loop 7/8)** — Sep 6 scan 34031195270 finished (failure); each #119–#122 merge re-dispatched weekly scan workflows (all failed at workflow level); Sep 13 scan 34758293379 is next scheduled catch-up. Pattern: **nightly merge is back as primary delta path**; Sunday scan still bulk engine.
3. **L5 + alert dispatch unchanged (Loop 8)** — GHA 34168824191, 34415388839, 34540485733, 34656724807 all complete with failure conclusion; per-state ingest still succeeds but L5 post-ingest fails matrix-wide; `notify_scan_failure.py` Loops `submittedAt` gap persists.
4. **Validation CI frozen (Loop 4)** — 15th consecutive week red at **31/37**; no remediation PRs.
5. **No new product development** — seventh consecutive ops-focused week.
6. **Stale PR debt** — merges resumed but **batch-close still not done**; superseded drafts (#76–#118) accumulate despite #119–#122 shipping.

**Emerging loops:** None new. Loop 7 adds **recovery streak** sub-pattern: gap → burst of daily merges → large MN batch event → baseline-sync no-op PR (#123).

**Resolved from prior week:**
- Sep 2–6 merge gap closed by #119–#122 (OR/MN deltas ingested via merge-triggered GHA, not #116).
- Sep 6 GHA 34031195270 no longer in progress — completed failure.

**New blockers / escalations:**
- PR #123 draft — confirm merge for baseline sync or auto-close after #122 baselines on main.
- Sep 13 Sunday GHA outcome TBD at automation time.

**Open / blocked (carried forward):**
- Batch-close stale ingest probe PRs #76–#82, #93, #98–#118 (superseded by #119–#122).
- Commit post-ingest baselines on main (last baseline commit still Aug 8).
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- `validate.yml` — fix null-bed publishable facilities; investigate repeat-offender composite rank; tune scraper freshness thresholds for MN/OR/TX/UT.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress.
- MO SOD remaining backfill — 7,987/11,820 deficiencies still rule-text only.
- Facility Watch Premium — controlled live purchase + concierge fulfillment (operator QA).
- Weekly state source scan — fix TX fail-soft handling and Loops `submittedAt` on admin-alert template; investigate L5 failures blocking alert dispatch across all states.
- Layer 0 source contract checks — merge `ee312af` and wire into `validate.yml`.

### Month context (2026-08-13 → 2026-09-13)

Probe merges to `main`: **#95** (Aug 13) → gap → **#106** (Aug 26) → **#113** (Sep 1) → **5-day gap** → **#119–#122** (Sep 7–11 daily). Net learning: production freshness tracks **merge cadence**, not probe cron alone; Sunday GHA compensates but L5 failures prevent Loop 8 alerts regardless. Only feature ship in window remains **PR #77** (Jul 30 Clearing redesign).

---

## Week of 2026-08-31 → 2026-09-06

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-09-06 | Sunday GHA weekly scan run **34031195270** completed (~6h, failure) — **L5 post-ingest fails** matrix-wide; alert dispatch skipped | Infrastructure | Blocked |
| 2026-09-05 | Cron probe OR +8 (max 2026-09-03), MN insertDate +8 — **PR #116 open** (supersedes #114–#115) | Infrastructure | Blocked |
| 2026-09-04 | Cron probe OR +4 (max 2026-09-03), MN insertDate +2 — **PR #115 open** (superseded by #116) | Infrastructure | Blocked |
| 2026-09-02 | Cron probe OR +1 (max 2026-09-01), MN insertDate +9 — **PR #114 open** (superseded by #115–#116) | Infrastructure | Blocked |
| 2026-09-01 | **PR #113 merged** — cron probe OR +9 (max 2026-08-31), MN insertDate +3; triggered GHA run **33569498104** | Infrastructure | Shipped |
| 2026-09-01 | GHA run 33569498104 (post-#113 merge) — matrix ingest runs all 10 states; **L5 post-ingest fails** every state; alert dispatch skipped | Infrastructure | Blocked |
| 2026-08-31 | Cron probe — no new inspection data since Sunday GHA 33313974682 (Aug 30) — **PR #112 open** | Infrastructure | Shipped |
| 2026-08-31–09-06 | **One PR merged to main** (#113) — then **5-day merge gap** resumes (Sep 2–6); OR/MN deltas compound in open chain **#114→#115→#116** (OR +1→+4→+8; MN insertDate +9→+2→+8); Clearing redesign (PR #77, Jul 30) remains last feature ship | Infrastructure | Blocked |
| 2026-08-31–09-06 | `validate.yml` on push — **still failing** (14th week red): **31/37** unchanged; scraper freshness MN/OR/TX/UT >90 days; publishable null/zero beds; repeat-offender composite rank | QA | Blocked |
| 2026-08-31–09-06 | Pre-ingest production page spot-check — **153/153 pass** on probe PRs #112–#116 | QA | QA passed |
| 2026-08-31–09-06 | Sunday GHA 33313974682 (Aug 30) ingested all states before week started; Aug 31 probe correctly reports no new data; Sep 1 #113 merge advanced OR to 2026-08-31 in probe baselines but production ingest blocked on L5 | Infrastructure | In progress |
| 2026-08-31–09-06 | Weekly work database updates — **PR #110 still open** (Aug 24–30); superseded by this run | Research | In progress |
| 2026-08-31–09-06 | Stale open ingest probe PRs **#76–#82, #93, #98–#111** plus superseded docs PRs **#92, #96, #102** still unclosed | Infrastructure | Blocked |
| 2026-08-31–09-06 | **Facility Watch Premium** — operator QA (controlled $9 purchase + first concierge fulfillment) still pending | QA | In progress |
| 2026-08-31–09-06 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before library magnet emails deliver | Deployment | Blocked |

### Week patterns (2026-08-31 → 2026-09-06)

**Dominant work types:** Infrastructure (~92%), QA (~6%), Research (~2%).

**Themes:**
1. **Loop 7 merge-gap regression returns** — single merge (#113, Sep 1) after Aug 26 recovery, then 5 consecutive days without merge (Sep 2–6). OR regulator delta compounds: +1 (Sep 2) → +4 (Sep 4) → +8 (Sep 5) in superseding open PRs #114→#115→#116. MN insertDate posting-delay events accumulate (+9, +2, +8).
2. **Sunday GHA + nightly probe rhythm stable (Loop 7/8)** — Aug 30 scan (33313974682) current through Aug 31; Sep 1 #113 merge triggered GHA 33569498104; Sep 6 scan (34031195270) running at automation time. Pattern unchanged: Sunday scan is catch-up engine; nightly probes stage deltas that require merge-to-main.
3. **L5 + alert dispatch still matrix-wide blocked (Loop 8)** — GHA 33569498104 (Sep 1) and early Sep 6 jobs (MN, OR, IL) fail L5 post-ingest despite successful per-state ingest; alert dispatch correctly skipped; `notify_scan_failure.py` Loops `submittedAt` gap persists.
4. **Validation CI frozen (Loop 4)** — 14th consecutive week red at **31/37**; no remediation PRs; scraper-freshness invariant still misaligned with matrix ingest cadence (MN/OR just probed/ingested but `updated_at` checks fail).
5. **No new product development** — sixth consecutive ops-focused week.
6. **Stale PR debt accelerating** — 20+ open superseded probe PRs (#76–#82, #93, #98–#111) plus four unmerged work-database PRs (#92, #96, #102, #110).

**Emerging loops:** None new. Loop 7 documents a **boom-bust merge cadence**: gap → single merge → immediate re-gap → superseding PR chain.

**Resolved from prior week:**
- PR #107 superseded — #113 merged Sep 1 with larger OR +9 / MN +3 delta.
- Aug 30 Sunday GHA (33313974682) confirmed current through Aug 31 probe.

**New blockers / escalations:**
- 5-day probe merge gap (Sep 2–6) with OR +8 and MN insertDate +8 pending in #116.
- Sep 6 Sunday GHA L5 failures on MN/OR/IL before full matrix completes — pattern widening into September runs.

**Open / blocked (carried forward):**
- Merge probe PR #116 (OR +8 max 2026-09-03, MN insertDate +8); then commit post-ingest baselines (last baseline commit still Aug 8).
- Batch-close stale ingest probe PRs #76–#82, #93, #98–#111.
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- `validate.yml` — fix null-bed publishable facilities; investigate repeat-offender composite rank; tune scraper freshness thresholds for MN/OR/TX/UT.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress.
- MO SOD remaining backfill — 7,987/11,820 deficiencies still rule-text only.
- Facility Watch Premium — controlled live purchase + concierge fulfillment (operator QA).
- Weekly state source scan — fix TX fail-soft handling and Loops `submittedAt` on admin-alert template; investigate L5 failures blocking alert dispatch across all states.
- Layer 0 source contract checks — merge `ee312af` and wire into `validate.yml`.

---

## Week of 2026-08-24 → 2026-08-30

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-08-29 | Cron probe — no new inspection data in any covered state — **PR #109 open** | Infrastructure | Shipped |
| 2026-08-28 | Cron probe — no new inspection data — **PR #108 open** | Infrastructure | Shipped |
| 2026-08-27 | Cron probe OR +1 (max 2026-08-26), MN insertDate +3 — **PR #107 open** (pending ingest) | Infrastructure | Blocked |
| 2026-08-26 | **PR #106 merged** — cron probe OR +5 (max 2026-08-25), MN insertDate +8; triggered GHA run 33021970807 | Infrastructure | Shipped |
| 2026-08-26 | GHA run 33021970807 (post-#106 merge) — matrix ingest: OR +11 (max 2026-08-25), MN +5 (max 2026-08-19), AZ +24, CA +81, WA +54, UT +12, PA +2; **L5 post-ingest fails** every state; alert dispatch skipped | Infrastructure | Blocked |
| 2026-08-25 | Cron probe OR +2 pending ingest (source max 2026-08-24) — **PR #105 open** (superseded by #106–#107) | Infrastructure | Shipped |
| 2026-08-24 | Cron probe — no new data; Sunday GHA run 32627736751 (Aug 23) already current — **PR #104 open** | Infrastructure | Shipped |
| 2026-08-24–30 | **One PR merged to main** (#106) — breaks 10-day merge gap from prior week; Clearing redesign (PR #77, Jul 30) remains last feature ship | Infrastructure | Shipped |
| 2026-08-24–30 | `validate.yml` on push — **regressed** (13th week red): **31/37** (was 35/37); new failures — MN/OR/TX/UT scraper freshness >90 days; unchanged — publishable null/zero beds; repeat-offender composite rank | QA | Blocked |
| 2026-08-24–30 | Pre-ingest production page spot-check — **153/153 pass** on probe PRs #104–#109 | QA | QA passed |
| 2026-08-24–30 | OR data **caught up** via #106 merge + GHA 33021970807 (max 2026-08-25); MN resolved max advanced to 2026-08-19; incremental deltas in open **PR #107** (OR +1, MN insertDate +3) | Infrastructure | In progress |
| 2026-08-24–30 | Weekly work database update (Aug 17–23) — **PR #102 still open** (superseded by this run) | Research | In progress |
| 2026-08-24–30 | Stale open ingest probe PRs **#76–#82, #93, #98–#105** plus superseded docs PRs **#92, #96** still unclosed | Infrastructure | Blocked |
| 2026-08-24–30 | **Facility Watch Premium** — operator QA (controlled $9 purchase + first concierge fulfillment) still pending | QA | In progress |
| 2026-08-24–30 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before library magnet emails deliver | Deployment | Blocked |

### Week patterns (2026-08-24 → 2026-08-30)

**Dominant work types:** Infrastructure (~90%), QA (~7%), Research (~3%).

**Themes:**
1. **Ingest merge gap partially closed (Loop 7)** — PR #106 merged Aug 26 after 10-day drought; GHA 33021970807 ingested OR +11 (to 2026-08-25) and MN +5 (to 2026-08-19), clearing the #101 backlog. Aug 27 probe found incremental OR +1 / MN +3 in open PR #107.
2. **Sunday GHA is the real catch-up engine (Loop 7/8)** — Aug 23 run 32627736751 ingested OR +28, AZ +46, CA +81 before nightly probes caught up; Aug 24 probe correctly reports "no new data." Pattern: Sunday scan advances production; nightly probes stage incremental deltas.
3. **L5 + operator alerting unchanged (Loop 8)** — every matrix ingest job (Aug 23 + Aug 26 runs) fails L5 post-ingest despite successful per-state ingest; alert dispatch correctly skipped; `notify_scan_failure.py` Loops `submittedAt` gap persists.
4. **Validation CI regressed (Loop 4)** — `validate.yml` dropped from 35/37 to **31/37** after #106 merge; four new scraper-freshness failures (MN/OR/TX/UT >90 days) surfaced — likely invariant drift vs actual ingest cadence, not missing data (OR/MN just ingested).
5. **No new product development** — fifth consecutive ops-focused week.
6. **Stale PR debt still growing** — 15+ open superseded probe PRs (#76–#82, #93, #98–#105) plus unmerged work-database PRs #92, #96, #102.

**Emerging loops:** None new. Loop 7 sub-loop now shows recovery pattern: merge gap → Sunday GHA catch-up → single probe merge → incremental staging resumes.

**Resolved from prior week:**
- 10-day probe merge gap closed by PR #106 (Aug 26).
- OR backlog from #101 cleared — production max now 2026-08-25.
- MN resolved max advanced from 2026-08-13 to 2026-08-19 via GHA 33021970807.

**New blockers / escalations:**
- `validate.yml` regressed 35/37 → 31/37 — scraper freshness invariant may need per-state threshold tuning after matrix ingest cadence changes.
- No post-ingest baseline commits on main since Aug 8 despite two GHA catch-up runs (Aug 23, Aug 26).

**Open / blocked (carried forward):**
- Merge probe PR #107 (OR +1, MN insertDate +3); then commit post-ingest baselines.
- Batch-close stale ingest probe PRs #76–#82, #93, #98–#105.
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- `validate.yml` — fix null-bed publishable facilities; investigate repeat-offender composite rank; tune scraper freshness thresholds for MN/OR/TX/UT.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress.
- MO SOD remaining backfill — 7,987/11,820 deficiencies still rule-text only.
- Facility Watch Premium — controlled live purchase + concierge fulfillment (operator QA).
- Weekly state source scan — fix TX fail-soft handling and Loops `submittedAt` on admin-alert template; investigate L5 failures blocking alert dispatch across all states.
- Layer 0 source contract checks — merge `ee312af` and wire into `validate.yml`.

---

## Week of 2026-08-17 → 2026-08-23

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-08-23 | Sunday GHA weekly scan run 32627736751 — matrix ingest: OR +28 (max 2026-08-21), MN +7, AZ +46, CA +81, PA +21, UT +4; **L5 post-ingest fails** every state; alert dispatch skipped | Infrastructure | Blocked |
| 2026-08-22 | Cron probe OR +13 inspections pending ingest (source max 2026-08-21 vs ingested 2026-08-14) — **PR #101 open** (supersedes #98–#100) | Infrastructure | Blocked |
| 2026-08-20 | Cron probe OR +3 AFH inspections pending ingest — **PR #99 open** (superseded by #101) | Infrastructure | Blocked |
| 2026-08-19 | Cron probe OR +3 AFH inspections pending ingest — **PR #98 open** (superseded by #101) | Infrastructure | Blocked |
| 2026-08-17 | Cron probe — no new inspection data; Sunday GHA run 31935924974 (Aug 16) already caught up all states — **PR #97 open** | Infrastructure | Shipped |
| 2026-08-16 | Sunday GHA weekly scan run 31935924974 — per-state ingest steps complete (OR +11 to 2026-08-14, MN +16 to 2026-08-13) but **L5 post-ingest fails** on every state; `notify_scan_failure.py` also fails (Loops `submittedAt` missing) | Infrastructure | Blocked |
| 2026-08-17–23 | **No PRs merged to main** — last merge #95 (Aug 13); fourth consecutive ops-focused week; Clearing redesign (PR #77, Jul 30) remains last feature ship | Infrastructure | Blocked |
| 2026-08-17–23 | `validate.yml` on probe PRs — **still failing** (12th week): **35/37**; unchanged — publishable null/zero beds; repeat-offender composite rank | QA | Blocked |
| 2026-08-17–23 | Pre-ingest production page spot-check — **153/153 pass** on probe PRs #97–#101 | QA | QA passed |
| 2026-08-17–23 | OR inspection backlog **compounding in open PRs** — 3 rows (Aug 19) → 9 (Aug 21) → 13 (Aug 22); MN insertDate advancing but resolved dates ≤ 2026-08-13 already ingested (posting delays only) | Infrastructure | Blocked |
| 2026-08-17–23 | Weekly work database update (Aug 10–16) — **PR #96 still open** (superseded by this run) | Research | In progress |
| 2026-08-17–23 | Stale open ingest probe PRs **#76–#82, #93** plus superseded **#98–#100** still unclosed | Infrastructure | Blocked |
| 2026-08-17–23 | **Facility Watch Premium** — operator QA (controlled $9 purchase + first concierge fulfillment) still pending | QA | In progress |
| 2026-08-17–23 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before library magnet emails deliver | Deployment | Blocked |

### Week patterns (2026-08-17 → 2026-08-23)

**Dominant work types:** Infrastructure (~94%), QA (~4%), Research (~2%).

**Themes:**
1. **Ingest merge regression returns (Loop 7)** — second gap within a month: no probe PR merged Aug 14–22 (10 days after #95). OR regulator delta compounds daily in superseding open PRs (#98→#99→#100→#101: 3→9→13 rows). MN insertDate advances but resolved dates already ingested — posting-delay noise only.
2. **Sunday GHA catch-up vs nightly probes (Loop 7/8)** — Aug 16 scan run 31935924974 ingested OR +11 and MN +16 despite marking every state job failed at L5 post-ingest. Aug 17 probe correctly treats Sunday catch-up as baseline ("no new data").
3. **L5 + operator alerting still broken (Loop 8)** — L5 post-ingest fails on every state after successful ingest; `notify_scan_failure.py` Loops 400 (`submittedAt` missing) prevents clean operator signal. Pattern unchanged since Jul 26.
4. **Automation env constraint surfaced** — nightly probe PRs note `DATABASE_URL` unavailable in automation env and workflow_dispatch returns 403; **merge to main is the only ingest trigger**, explaining why open PRs accumulate without auto-merge.
5. **No new product development** — fourth consecutive ops-focused week.
6. **Validation CI frozen** — 12th consecutive week red at 35/37.
7. **Stale PR debt worsening** — 13+ open superseded probe PRs (#76–#82, #93, #98–#100) plus unmerged work-database PRs #92, #96.

**Emerging loops:** None new. Loop 7 regression pattern documented: probe → PR → **(blocked merge)** → backlog compounds → superseding PR chain.

**Resolved from prior week:**
- Sunday GHA did advance OR to 2026-08-14 and MN to 2026-08-13 (partial data freshness via scheduled scan, not nightly merges).

**New blockers / escalations:**
- 10-day probe merge gap (Aug 14–22) — production OR data stale vs regulator (13 rows pending in #101).
- Probe automation cannot trigger ingest without merge — structural dependency on owner/auto-merge.

**Open / blocked (carried forward):**
- Merge OR probe PR #101 (or chain) to trigger matrix ingest; then commit post-ingest baselines.
- Stale open ingest probe PRs #76–#82, #93, #98–#100 need batch close.
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- `validate.yml` — fix null-bed publishable facilities; investigate repeat-offender composite rank invariant.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress.
- MO SOD remaining backfill — 7,987/11,820 deficiencies still rule-text only.
- Facility Watch Premium — controlled live purchase + concierge fulfillment (operator QA).
- Weekly state source scan — fix TX fail-soft handling and Loops `submittedAt` on admin-alert template; investigate L5 failures blocking alert dispatch across all states.
- Layer 0 source contract checks — merge `ee312af` and wire into `validate.yml`.

---

## Week of 2026-08-10 → 2026-08-16

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-08-16 | Scheduled Weekly state source scan — Aug 16 Sunday cron running (run 31935924974); per-state ingest jobs succeed (MN, OR, UT, CA confirmed) but **L5 post-ingest failing** on every state checked; alert dispatch skipped; admin notify still failing | Infrastructure | In progress |
| 2026-08-13 | **PR #95 merged** — cron probe OR max 2026-08-12 (+2: Fanaye Tesguri AFH, Avamere Rehabilitation of Lebanon NF); MN insertDate max 2026-08-13 (+5 survey PDFs) | Infrastructure | Shipped |
| 2026-08-12 | **PR #94 merged** — cron probe OR max 2026-08-11 (+7: 4 NF/AFH Aug 7–11); MN insertDate max 2026-08-12 (+12: 4 complaint + 8 survey PDFs) | Infrastructure | Shipped |
| 2026-08-11 | Cron probe OR +6 (max 2026-08-10), MN insertDate +4 — **PR #93 open** (superseded by #94; not merged) | Infrastructure | Shipped |
| 2026-08-10–16 | `validate.yml` on push — **still failing** (11th week): **35/37**; unchanged — publishable null/zero beds; repeat-offender composite rank | QA | Blocked |
| 2026-08-10–16 | Ingest probe merge cadence **continues** — 2 nightly merges (#94–#95, Aug 12–13); no merges Aug 14–16; OR source advanced to 2026-08-12; MN insertDate to 2026-08-13; **no post-ingest baseline commits** on main after Aug 8 | Infrastructure | Shipped |
| 2026-08-10–16 | Pre-ingest production page spot-check — **153/153 pass** on merged probe PRs (#94–#95) | QA | QA passed |
| 2026-08-10–16 | Weekly work database update (Aug 3–9) — **PR #92 still open** (superseded by this run) | Research | In progress |
| 2026-08-10–16 | Stale open ingest probe PRs **#76–#82, #93** still unclosed — superseded by #87–#95 | Infrastructure | Blocked |
| 2026-08-10–16 | Weekly state source scan — L5 failures block alert dispatch on every trigger; TX fail-soft + Loops `submittedAt` on admin-alert template still unresolved | Infrastructure | Blocked |
| 2026-08-10–16 | **Facility Watch Premium** — operator QA (controlled $9 purchase + first concierge fulfillment) still pending | QA | In progress |
| 2026-08-10–16 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before library magnet emails deliver | Deployment | Blocked |

### Week patterns (2026-08-10 → 2026-08-16)

**Dominant work types:** Infrastructure (~92%), QA (~6%), Research (~2%).

**Themes:**
1. **Ingest ops steady but slowing (Loop 7)** — two nightly probe merges (#94–#95) advanced OR to 2026-08-12 and MN insertDate to 2026-08-13; GHA matrix ingest on merge (runs 31649927067, 31753812815) ingested UT +2, AZ +24, PA +3 on Aug 12–13. No merges Aug 14–16; no post-ingest baseline commits since Aug 8 — probe script may be ahead of committed baselines.
2. **L5 post-ingest now systemic (Loop 8)** — Aug 16 Sunday scan shows L5 failing on MN, OR, UT, CA (not just MN/IL as Aug 9); ingest itself succeeds but alert dispatch correctly skipped. Admin notify step also fails (Loops `submittedAt` gap persists). Pattern widening from state-specific to matrix-wide.
3. **No new product development** — third consecutive ops-focused week; Clearing redesign (PR #77, Jul 30) remains last feature ship.
4. **Validation CI frozen** — 11th consecutive week red at 35/37; no remediation PRs.
5. **Stale PR debt accumulating** — 8 open superseded probe PRs (#76–#82, #93) plus unmerged work-database PR #92; risks duplicate merge attempts and operator confusion.

**Emerging loops:** None new. Loop 7 sub-loop stable: probe → PR → merge → matrix ingest → (missing) baseline commit.

**Resolved from prior week:**
- Ingest merge cadence maintained through Aug 13 (no regression like Jul 27–Aug 2 gap).

**New blockers / escalations:**
- L5 post-ingest failures now affect multiple states (MN, OR, UT, CA on Aug 16 scan) — not isolated to MN/IL.
- Probe baselines on main may be stale — last baseline commit Aug 8 while probes merged through Aug 13.

**Open / blocked (carried forward):**
- Stale open ingest probe PRs #76–#82, #93 need batch close (superseded by #87–#95).
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- `validate.yml` — fix null-bed publishable facilities; investigate repeat-offender composite rank invariant.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress.
- MO SOD remaining backfill — 7,987/11,820 deficiencies still rule-text only.
- Facility Watch Premium — controlled live purchase + concierge fulfillment (operator QA).
- Weekly state source scan — fix TX fail-soft handling and Loops `submittedAt` on admin-alert template; investigate L5 failures blocking alert dispatch across all states.
- Layer 0 source contract checks — merge `ee312af` and wire into `validate.yml`.

---

## Week of 2026-08-03 → 2026-08-09

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-08-09 | Scheduled Weekly state source scan — Aug 9 Sunday cron running; ingest jobs complete but **L5 post-ingest failing** on MN/IL; alert dispatch skipped; admin notify still failing | Infrastructure | In progress |
| 2026-08-08 | **PR #91 merged** — cron probe MN insertDate +5 (trigger weekly scan) | Infrastructure | Shipped |
| 2026-08-08 | Post-ingest baselines MN insertDate=2026-08-08 (+2 ingested) | Infrastructure | Shipped |
| 2026-08-07 | **PR #90 merged** — post-ingest baselines MN insertDate=2026-08-07 (+3) | Infrastructure | Shipped |
| 2026-08-07 | **PR #89 merged** — cron probe OR unchanged, MN insertDate +7 | Infrastructure | Shipped |
| 2026-08-06 | **PR #88 merged** — cron probe OR +2 max=2026-08-05, MN insertDate +3 | Infrastructure | Shipped |
| 2026-08-06 | Post-ingest baselines OR max=2026-08-05 (+7), MN insertDate=2026-08-06 (+0) | Infrastructure | Shipped |
| 2026-08-06 | Trigger weekly scan after 2026-08-06 probe (OR +2, MN +3) | Infrastructure | Shipped |
| 2026-08-05 | **PR #87 merged** — cron probe OR +2 max=2026-08-04, MN insertDate +20 pending ingest | Infrastructure | Shipped |
| 2026-08-05 | Post-ingest baselines OR max=2026-08-04 (+7), MN insertDate=2026-08-05 (+15) — bulk catch-up after backlog cleared | Infrastructure | Shipped |
| 2026-08-05 | MN resolved baseline 2026-07-28 after GHA run 31055201575 (stale baseline from Jul 27–Aug 2 merge gap) | Infrastructure | Shipped |
| 2026-08-04 | Cron probe — no new ingestable data — **PR #86 open** (superseded; not merged) | Infrastructure | Shipped |
| 2026-08-03 | Cron probe — confirm no new inspection data; update probe baselines — **PR #85 open** (superseded; not merged) | Infrastructure | Shipped |
| 2026-08-03–09 | `validate.yml` on push — **still failing** (10th week): **35/37**; unchanged — publishable null/zero beds; repeat-offender composite rank | QA | Blocked |
| 2026-08-03–09 | Ingest probe merge cadence **restored** — 5 consecutive nightly merges (#87–#91, Aug 5–8) after Jul 27–Aug 2 backlog; stale open PRs **#76–#82** still unclosed | Infrastructure | Shipped |
| 2026-08-03–09 | Pre-ingest production page spot-check — **153/153 pass** on merged probe PRs (#87–#91) | QA | QA passed |
| 2026-08-03–09 | Weekly state source scan — L5 failures block alert dispatch; TX fail-soft + Loops `submittedAt` on admin-alert template still unresolved | Infrastructure | Blocked |
| 2026-08-03–09 | **Facility Watch Premium** — operator QA (controlled $9 purchase + first concierge fulfillment) still pending | QA | In progress |
| 2026-08-03–09 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before library magnet emails deliver | Deployment | Blocked |

### Week patterns (2026-08-03 → 2026-08-09)

**Dominant work types:** Infrastructure (~90%), QA (~8%), Deployment (~2%).

**Themes:**
1. **Ingest merge regression resolved (Loop 7)** — five consecutive nightly probe PRs merged (#87–#91); OR source advanced to 2026-08-05 (+7 ingested); MN insertDate advanced to 2026-08-08 (+2 ingested after +20/+15/+7/+5/+3 probe chain). Aug 5 bulk catch-up (+15/+7) shows how staged regulator deltas compound when matrix ingest finally runs after a merge gap.
2. **Stale probe PR cleanup needed** — open PRs #76–#82 from Jul 27–Aug 1 backlog were superseded by #87–#91 but never closed; risks confusion and duplicate merge attempts.
3. **No new product development** — second consecutive ops-focused week; Clearing redesign (PR #77) remains the last feature ship (Jul 30).
4. **Validation CI frozen** — 10th consecutive week red at 35/37; no remediation PRs.
5. **State Watch scan partially running (Loop 8)** — Aug 9 Sunday cron dispatched matrix ingest; per-state ingest succeeds but **L5 post-ingest fails** on MN/IL, skipping alert dispatch; admin notify step also fails (Loops template gap persists).

**Emerging loops:** None new. Loop 7 sub-loop formalized: probe → PR → merge → matrix ingest → baseline commit → (optional) weekly scan trigger.

**Resolved from prior week:**
- Ingest probe PR merge backlog — cadence restored Aug 5–8 (#87–#91).
- Production data freshness — OR/MN deltas from Jul 27–Aug 2 backlog ingested via Aug 5–8 catch-up runs.

**New blockers:**
- Stale open ingest PRs #76–#82 need batch close (superseded by #87–#91).
- L5 post-ingest failures on weekly scan block State Watch alert dispatch even when ingest succeeds.

**Open / blocked (carried forward):**
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- `validate.yml` — fix null-bed publishable facilities; investigate repeat-offender composite rank invariant.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress.
- MO SOD remaining backfill — 7,987/11,820 deficiencies still rule-text only.
- Facility Watch Premium — controlled live purchase + concierge fulfillment (operator QA).
- Weekly state source scan — fix TX fail-soft handling and Loops `submittedAt` on admin-alert template; investigate L5 failures blocking alert dispatch.
- Layer 0 source contract checks — merge `ee312af` and wire into `validate.yml`.

---

## Week of 2026-07-27 → 2026-08-02

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-08-02 | Scheduled Weekly state source scan — queued 09:46 UTC (Aug 2 Sunday cron); matrix ingest jobs dispatching | Infrastructure | In progress |
| 2026-08-01 | Cron probe OR + MN new inspection data — **PR #82 open** (not merged) | Infrastructure | Blocked |
| 2026-07-31 | Cron probe OR + MN new inspection data — **PR #81 open** (not merged) | Infrastructure | Blocked |
| 2026-07-30 | **PR #77 merged** — Clearing visual redesign (presentation-only): softer paper stack, white cards, teal chrome across home, hubs, listings, facility profiles, library; copy/offers/GovernanceBar unchanged | Development | Deployed |
| 2026-07-30 | Cron probe OR + MN new inspection data — **PR #80 open** (not merged) | Infrastructure | Blocked |
| 2026-07-29 | style: extend Clearing chrome across remaining pages (library, guides, auth-adjacent shells) | Development | Shipped |
| 2026-07-29 | Cron probe OR source max 2026-07-28 (+2 inspections: Florica Botocan AFH, Stanley Post Acute NF); MN insertDate max 2026-07-29 (+26 events incl. Spes Residential Care) — **PR #79 open** | Infrastructure | Blocked |
| 2026-07-28 | fix(facility): Premium checkout block under first plain-language inspection summary (not mid-page band); MEMORY.md decision logged | Development | Deployed |
| 2026-07-28 | Clearing visual redesign applied without changing copy or offers (`globals.css` token remap + `--color-clearing-*`) | Development | Shipped |
| 2026-07-28 | Cron probe MN Spes Residential Care LLC DT8011 pending ingest — **PR #78 open** | Infrastructure | Blocked |
| 2026-07-27 | fix(funnel): surface Premium earlier (`FacilityWatchPremiumAnchor`), track checkout events, stop hub 404-on-error hardening | Development | Shipped |
| 2026-07-27 | Cron probe — no new inspection data in any covered state — **PR #76 open** | Infrastructure | Shipped |
| 2026-07-27–08-02 | `validate.yml` on push — **still failing** (9th week): **35/37**; unchanged — publishable null/zero beds; repeat-offender composite rank | QA | Blocked |
| 2026-07-27–08-02 | Nightly ingest probe PRs **backlogged** — 6 open PRs (#76–#82, excl. #77) since Jul 27; last merged ingest PR was #73 (Jul 25); spot-check **153/153 pass** on each open probe PR | Infrastructure | Blocked |
| 2026-07-27–08-02 | Weekly state source scan — Jul 26 run failed; Aug 2 cron queued; TX fail-soft + Loops `submittedAt` still unresolved | Infrastructure | Blocked |
| 2026-07-27–08-02 | **Facility Watch Premium** — operator QA (controlled $9 purchase + first concierge fulfillment) still pending; Premium placement + Clearing chrome shipped via PR #77 | QA | In progress |
| 2026-07-27–08-02 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before library magnet emails deliver | Deployment | Blocked |

### Week patterns (2026-07-27 → 2026-08-02)

**Dominant work types:** Development (~40%), Infrastructure (~45%), QA (~10%), Deployment (~5%).

**Themes:**
1. **Design refresh shipped (Loop 14)** — PR #77 lands Clearing presentation system site-wide without touching copy, offers, or SEO inventory; MEMORY.md guards against prototype headline/IA drift.
2. **Funnel hardening post-Premium launch** — Premium anchor scroll, checkout tracking, hub error handling (Jul 27); Premium block moved under first inspection summary to reduce CTA fatigue (Jul 28).
3. **Ingest merge regression (Loop 7)** — nightly probes still run and pass 153/153 spot-checks, but **no probe PR merged Jul 27–Aug 1** (6 open: #76–#82). OR through 2026-07-28 (+2) and MN insertDate through 2026-07-29 (+26) are staged in open PRs, not production. Last merged ingest was #73 (Jul 25).
4. **Validation CI frozen** — 9th consecutive week red at 35/37; no remediation PRs.
5. **State Watch scan still broken (Loop 8)** — weekly scan failed Jul 26; Aug 2 cron queued; operator alerting still blocked by Loops template gap.

**Emerging loops:** Loop 14 — presentation-only design refresh (validated Jul 28–30). Sub-loop of Loop 4 with explicit scope guard in MEMORY.md.

**Resolved from prior week:** Product development resumed after post-launch ops week (PR #77 + funnel fixes).

**New blockers:**
- Ingest probe PR backlog — 6 days of unmerged nightly probes; production data stale vs regulator sources since Jul 25 merge.
- Investigate why probe PRs stopped auto-merging after #73 (owner or automation config).

**Open / blocked (carried forward):**
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- `validate.yml` — fix null-bed publishable facilities; investigate repeat-offender composite rank invariant.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress.
- MO SOD remaining backfill — 7,987/11,820 deficiencies still rule-text only.
- Facility Watch Premium — controlled live purchase + concierge fulfillment (operator QA).
- Weekly state source scan — fix TX fail-soft handling and Loops `submittedAt` on admin-alert template.
- Layer 0 source contract checks — merge `ee312af` and wire into `validate.yml`.

---

## Week of 2026-07-20 → 2026-07-26

| Date | Description | Category | Status |
|------|-------------|----------|--------|
| 2026-07-26 | Post-ingest baselines OR max=2026-07-24 (+10), MN insertDate max=2026-07-25 (+2) | Infrastructure | Shipped |
| 2026-07-26 | Scheduled Weekly state source scan — queued 09:48 UTC (Jul 26 Sunday cron) | Infrastructure | In progress |
| 2026-07-25 | **PR #73 merged** — cron probe OR source max 2026-07-24 (+5 inspections), MN insertDate max 2026-07-25 (+6 events) | Infrastructure | Shipped |
| 2026-07-24 | Post-ingest baselines OR +7 max=2026-07-23; MN +2 max=2026-07-24 | Infrastructure | Shipped |
| 2026-07-24 | **PR #72 merged** — cron probe OR source max 2026-07-23 (+4), MN insertDate max 2026-07-24 (+5) | Infrastructure | Shipped |
| 2026-07-23 | Post-ingest baselines MN insertDate max=2026-07-23 (+99 inspections — large catch-up batch after incremental probes) | Infrastructure | Shipped |
| 2026-07-23 | **PR #71 merged** — cron probe MN insertDate max 2026-07-23 (+7 survey events) | Infrastructure | Shipped |
| 2026-07-22 | **PR #70 merged** — cron probe MN insertDate max 2026-07-22 (+7 events) | Infrastructure | Shipped |
| 2026-07-21 | Post-ingest baselines OR +7 max=2026-07-20 (run 29876029989) | Infrastructure | Shipped |
| 2026-07-21 | **PR #69 merged** — cron probe OR source max 2026-07-20 (+2 AFH inspections) | Infrastructure | Shipped |
| 2026-07-20 | Cron probe — no new inspection data in any covered state (no merge PR) | Infrastructure | Shipped |
| 2026-07-20 | **Layer 0 source contract checks** drafted (`ee312af`, unmerged) — real HTTPS calls to CMS NH Provider Directory + Census Geocoder; catches upstream API field drift before ingest | Research | In progress |
| 2026-07-20–26 | `validate.yml` on push — **still failing** (8th week): **35/37**; unchanged — publishable null/zero beds; repeat-offender composite rank | QA | Blocked |
| 2026-07-20–26 | Weekly state source scan — **failing** on push triggers; TX ingest expected manual-fail + `notify_scan_failure.py` Loops 400 (`submittedAt` data variable missing on admin-alert template) | Infrastructure | Blocked |
| 2026-07-20–26 | Pre-ingest production page spot-check — **153/153 pass** on every probe PR (#69–#73) | QA | QA passed |
| 2026-07-20–26 | **Facility Watch Premium** — no new product PRs; operator QA (controlled $9 purchase + first concierge fulfillment) still pending | QA | In progress |
| 2026-07-20–26 | **Loops magnet templates** — 6 `LOOPS_MAGNET_*` env vars still needed before library magnet emails deliver | Deployment | Blocked |

### Week patterns (2026-07-20 → 2026-07-26)

**Dominant work types:** Infrastructure (~85%), QA (~10%), Research (~3%), Deployment (~2%).

**Themes:**
1. **Ingest ops at steady state (Loop 7)** — five consecutive nightly probe PRs (#69–#73); OR source advanced through 2026-07-24; MN insertDate through 2026-07-25 with daily +5–7 event probes plus one +99 catch-up batch (Jul 23) showing incremental probes can lag bulk regulator drops.
2. **No new product development** — first full week post–Facility Watch Premium launch (Jul 19); team focused on keeping data fresh, not shipping features.
3. **State Watch scan reliability regressing (Loop 8)** — weekly scan workflow fails on every push/schedule trigger; TX TULIP failure is expected but workflow treats it as hard-fail; secondary failure in `notify_scan_failure.py` (Loops template missing `submittedAt`) prevents clean operator alerting.
4. **Validation CI frozen** — 8th consecutive week red at 35/37; same two invariants (null beds, repeat-offender composite rank); no remediation PRs this week.
5. **Upstream contract validation researched** — Layer 0 draft (`ee312af`) adds pre-ingest HTTPS checks against live CMS NH + Census APIs; not merged.

**Emerging loops:** Loop 7 nightly probe cadence is now fully automated (probe → PR → merge → matrix ingest → baseline commit). Consider formalizing as sub-loop of Loop 7.

**Resolved from prior week:** None — all Jul 13–19 blockers remain open.

**Open / blocked:**
- Migration `0047_hub_content.sql` still not applied in Supabase SQL editor.
- `validate.yml` — fix null-bed publishable facilities; investigate repeat-offender composite rank invariant.
- 6 Loops magnet templates + Vercel env vars before magnet emails go live.
- AZ deficiency backfill (`--mode deficiencies`) — still in progress.
- MO SOD remaining backfill — 7,987/11,820 deficiencies still rule-text only.
- Facility Watch Premium — controlled live purchase + concierge fulfillment (operator QA).
- Weekly state source scan — fix TX fail-soft handling and Loops `submittedAt` on admin-alert template; confirm Jul 26 scheduled run dispatches alerts.
- Layer 0 source contract checks — merge `ee312af` and wire into `validate.yml`.

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

## Month-level progress and learning (May → early September 2026)

| Metric | Start (May 4) | End (Sep 6) |
|--------|---------------|-------------|
| States with frontend | CA + partial OR/WA/MN/TX | CA, OR, WA, MN, UT, IL, PA, AZ, **MO** (TX hidden) — **10 covered** |
| Merged PRs | — | 58 total (#1–#77, #87–#95, **#106**, **#113**; probe-only merges dominate Aug–Sep; gaps at #27–29, #32, #35–#36, #38–#40, #42–#43, #47–#49, #52, #55, #61, #63, #66, #68, #74, #78–#86, #92–#105, #107–#112, #114–#116) |
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
- **New (Jul 23):** MN regulator can drop large insertDate batches (+99) that daily incremental probes under-count — post-ingest baseline commits are the ground truth for catch-up.
- **New (Jul 26):** Weekly state source scan hard-fails on expected TX TULIP skip; `notify_scan_failure.py` also fails when Loops admin-alert template lacks `submittedAt` — breaks operator alerting on partial scans.
- **New (Jul 20):** Layer 0 source contract checks — validate live upstream API shapes (CMS NH, Census Geocoder) before ingest; complements DB-only Layers 1–5.
- **New (Jul 28):** Clearing visual redesign is presentation-only — token remap in `globals.css`; never ship prototype headlines, thinner home IA, or free Watch CTAs from design handoff.
- **New (Jul 28):** Premium CTA belongs under the first plain-language inspection summary — mid-page duplicate module causes CTA fatigue; anchor scroll still targets `#facility-watch-premium`.
- **New (Aug 2):** Nightly ingest probe PRs can backlog without blocking spot-checks — 6 days of open probes (#76–#82) while last merge was #73 (Jul 25); regulator deltas staged but not in production until PRs merge.
- **New (Aug 5):** After a multi-day probe merge gap, a single merged probe can trigger bulk catch-up ingest (MN +20 probe → +15/+7 post-ingest) — staged regulator deltas compound when matrix ingest finally runs.
- **New (Aug 5):** Stale probe baselines (MN stuck at 2026-07-28) require manual resolution after backlog clears — GHA run ID must be traced to update `probe_inspection_freshness.py` comments.
- **New (Aug 9):** Weekly scan ingest can succeed while L5 post-ingest fails — alert dispatch is correctly gated but operator gets no clean failure signal when `notify_scan_failure.py` also fails on Loops template.
- **New (Aug 16):** L5 post-ingest failures are matrix-wide, not state-specific — Aug 16 Sunday scan shows MN, OR, UT, CA all failing L5 while ingest steps succeed; alert dispatch correctly skipped on every state.
- **New (Aug 16):** Probe merge cadence can continue without post-ingest baseline commits — #94–#95 merged Aug 12–13 but last baseline commit on main remains Aug 8; probe script baselines may drift from committed state.

- **New (Aug 17):** Sunday GHA run 31935924974 ingested OR +11 (to 2026-08-14) and MN +16 (to 2026-08-13) despite L5 marking every state job failed — nightly probes must treat Sunday catch-up as the freshness baseline.
- **New (Aug 22):** Second ingest merge regression within a month — no probe PR merged Aug 14–22; OR backlog compounds in superseding open PR chain (#98→#101: 3→13 rows).
- **New (Aug 22):** Nightly probe automation lacks `DATABASE_URL` and cannot `workflow_dispatch` ingest (403) — merge to main is the only ingest trigger path.
- **New (Aug 26):** Single probe merge (#106) after 10-day gap triggered bulk matrix catch-up — GHA 33021970807 ingested OR +11 and MN +5 in one run; validates Aug 5 learning that staged deltas compound on merge.
- **New (Aug 26):** `validate.yml` scraper-freshness invariant regressed 35/37 → 31/37 after ingest — `updated_at` freshness checks may lag actual per-state ingest cadence; tune thresholds or exclude states with Sunday-only catch-up.
- **New (Aug 30):** Sunday GHA (Aug 23 run 32627736751) is the primary catch-up path when nightly probe merges stall — OR +28/AZ +46/CA +81 ingested before #106 nightly merge closed the gap.
- **New (Sep 1):** Boom-bust probe merge cadence — #113 merged Sep 1 after Aug 26 #106 recovery, then 5-day re-gap (Sep 2–6); OR/MN deltas compound in superseding chain #114→#115→#116 without production ingest.
- **New (Sep 6):** L5 post-ingest failures persist into September GHA runs (33569498104 Sep 1; 34031195270 Sep 6) — ingest steps succeed but alert dispatch remains blocked matrix-wide.

**Week-over-week trajectory:**
- **Jun 1–8:** Content automation (hub pipeline) + PA ship + mobile engagement.
- **Jun 8–14:** Ingest automation at scale + hub differentiation + buy-side journey instrumentation.
- **Jun 15–21:** Ninth state launch (AZ) + post-launch YMYL QA. Shift to "run pipelines + ship states fast."
- **Jun 22–28:** Pipeline stabilization (9-state all-green) + AZ deficiency depth + mobile hub polish.
- **Jun 29–Jul 5:** Tenth state (MO) + buy-side conversion surfaces + stable ingest ops. Shift to "ship states + grow conversion + deepen narratives."
- **Jul 6–12:** MO narrative completion + hub content self-healing + ingest ops at scale. Shift to "deepen data quality + reduce manual ops overhead."
- **Jul 13–19:** State Watch reliability + Facility Watch Premium monetization. Shift to "ship revenue product + harden alert infrastructure."
- **Jul 20–26:** Post-launch ops cadence — nightly ingest probes dominate; no new feature PRs. Shift to "keep data fresh + fix alert/validation infrastructure debt."
- **Jul 27–Aug 2:** Design refresh + funnel polish resume; ingest probe merge regression surfaces. Shift to "improve conversion UX while unblocking data freshness pipeline."
- **Aug 3–9:** Ingest ops recovery — merge cadence restored, bulk OR/MN catch-up ingested; no new features. Shift to "stabilize data pipeline + close infrastructure debt (validation, scan alerts, stale PRs)."
- **Aug 10–16:** Ingest ops steady — OR/MN probes through Aug 13; L5 failures escalate to matrix-wide; stale PR debt grows. Shift to "fix L5 post-ingest + operator alerting before next state launch or feature work."
- **Aug 17–23:** Ingest merge regression returns — 10-day merge gap; OR backlog compounds in open PRs; Sunday GHA provides partial catch-up. Shift to "unblock probe auto-merge + fix L5/alerting before data staleness affects family-facing alerts."
- **Aug 24–30:** Merge gap partially closed (#106); Sunday + post-merge GHA runs advance OR to 2026-08-25 and MN to 2026-08-19; validation CI regresses on freshness invariants. Shift to "tune validation invariants to match ingest cadence + auto-commit baselines + batch-close stale PRs."
- **Aug 31–Sep 6:** Boom-bust merge cadence resumes — single #113 merge then 5-day gap; OR +8 / MN insertDate +8 pending in #116; L5 still blocks alerts. Shift to "break probe merge dependency (auto-merge or baseline-only commits) + fix L5 root cause."

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
| L1+L2 validation CI | No | Yes | `validate.yml` on push — failing 14 weeks; **31/37** (scraper freshness MN/OR/TX/UT + null beds + repeat-offender composite rank) |
| L3 smoke tests | No | Partial | Chained in ingest workflow — green on recent runs |
| External audit (Ahrefs/Clarity) | Yes | No | No new audit this week |

**Last run:** PR #77 deployed Jul 30 (Clearing redesign + funnel fixes). `validate.yml` failing **14th week** — **31/37** unchanged since Aug 26 regression (scraper-freshness failures on MN/OR/TX/UT; null beds; repeat-offender composite rank). **Automation opportunity:** post-deploy `smoke_test.py` in GitHub Actions; auto-update invariant lists on new state merge; presentation-only design refresh checklist (Loop 14); **tune scraper freshness thresholds per-state after matrix ingest cadence changes**.

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

**Last run:** Sep 7–13 — PRs #119–#122 merged nightly (OR incremental; MN insertDate +8 then +5 then +20); GHA runs 34168824191, 34415388839, 34540485733, 34656724807 all failed at workflow level (L5). Sep 6 GHA 34031195270 completed failure; Sep 13 GHA 34758293379 in progress. PR #123 draft baseline-sync (no new data). #116/#114–#118 superseded but still open. No baseline commits since Aug 8. Stale PRs #76–#82, #93, #98–#118 unclosed. Pre-ingest 153/153 on #119–#122. **Automation opportunity:** alert on per-state failure; retry on `AdminShutdown`; auto-tune parallelism from pooler metrics; detect bulk catch-up vs incremental delta; **alert when probe PRs age >24h without merge**; **auto-close superseded probe PRs when newer probe merges**; **auto-commit post-ingest baselines after successful GHA ingest**; **document that merge-to-main is the only ingest trigger** (automation env lacks `DATABASE_URL`).

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

**Last run:** Sep 7–13 — merge-triggered GHAs through #122 (34656724807 latest) plus Sep 6 34031195270 and Sep 13 34758293379 (in progress) — per-state ingest completes but **L5 post-ingest fails matrix-wide**, skipping alert dispatch; `notify_scan_failure.py` Loops 400 (`submittedAt` missing). Probe merges #119–#122 shipped; #123 baseline-only. Premium placement unchanged since PR #77. **Automation opportunity:** fail-soft TX in workflow; fix `submittedAt` on admin-alert template; auto-retry partial scans; county-scoped dispatch generalization; **decouple alert dispatch from L5 failure when ingest itself succeeded**; **investigate root cause of matrix-wide L5 failures** (may be invariant drift, not per-state data).

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

**Last run:** Jul 19 — PR #60 merged; Jul 28–30 Premium placement + Clearing chrome via PR #77. **Blocked:** operator QA (one live purchase + first concierge fulfillment). **Automation opportunity:** Firecrawl provision script after webhook; delivery ledger (Phase 2).

---

### Loop 14 — Presentation-only design refresh *(new Jul 28)*

```
design handoff → scope guard (MEMORY.md) → token remap in globals.css
  → extend chrome page-by-page → preserve copy/offers/SEO → PR + preview QA → merge
```

| Step | Manual? | Automated? | Notes |
|------|---------|------------|-------|
| Design handoff review | Yes | No | Clearing `1c` + pages zip |
| Scope guard (presentation-only) | Yes | No | MEMORY.md: no prototype headlines, no free Watch CTAs, no GovernanceBar removal |
| Token / CSS remap | Yes | No | `--color-paper` → `#FBF9F4`; `--color-clearing-*` tokens |
| Page-by-page chrome extension | Yes | No | Home → hubs → listings → profiles → library |
| Preview QA (sections + offers intact) | Yes | Partial | PR #77 test plan checklist |
| Merge + deploy | Yes | Yes | PR #77 Jul 30 |

**Last run:** Jul 28–30 — Clearing visual system shipped site-wide (PR #77). **Automation opportunity:** visual regression screenshot diff on key routes; automated checklist that GovernanceBar + magnet CTAs + Premium paths still present post-redesign.

---

## Automation priority backlog

| Priority | Loop | Gap | Effort |
|----------|------|-----|--------|
| P0 | Loop 7 | **Merge probe PR #116** — OR +8 (max 2026-09-03), MN insertDate +8 pending; then commit post-ingest baselines (last commit Aug 8) | Owner action |
| P0 | Loop 8 | Investigate matrix-wide L5 post-ingest failures (Sep 1 + Sep 6 GHA runs); fix root cause or decouple alert dispatch from L5 when ingest succeeds | Medium |
| P0 | Loop 8 | Weekly scan fail-soft for TX + fix `notify_scan_failure.py` Loops `submittedAt` on admin-alert template | Small |
| P0 | Loop 13 | Operator QA — one controlled live $9 purchase → webhook → welcome → cancel/refund; first concierge fulfillment | Owner action |
| P0 | Loop 4 | Fix `validate.yml` — **31/37** (regressed); tune scraper freshness for MN/OR/TX/UT; fix publishable null/zero beds; repeat-offender composite rank | Small |
| P0 | Loop 3 | Apply migration 0047 in Supabase SQL editor | Owner action |
| P1 | Loop 7 | **Close stale ingest probe PRs** — batch-close superseded #76–#82, #93, #98–#111 after #116 merges | Small |
| P1 | Loop 7 | Auto-commit post-ingest baselines after successful GHA matrix ingest (Sep 1 GHA 33569498104 + prior catch-up runs; no commits since Aug 8) | Small |
| P1 | Loop 7 | Alert when nightly probe PR ages >24h without merge | Small |
| P1 | Loop 4 | Merge Layer 0 source contract checks (`ee312af`) into `validate.yml` | Small |
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
| P2 | Loop 14 | Visual regression screenshot diff on key routes post-redesign | Medium |
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
