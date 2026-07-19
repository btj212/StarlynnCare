# MEMORY.md — Decision log

Append-only log of durable architectural and data-shape decisions. Read at the start of any non-trivial session. Never contradict a logged decision without flagging it first.

Format per entry: **decision**, why it was made, what was rejected, source. Newest at the top.

---

## 2026-07 — Premium replaces free per-facility Facility Watch signup

**Decided:**
- **New free per-facility watch enrollment is closed.** Profile strip/modal/sticky/`offer_watch` sources return 410 from `/api/watch`. Premium (`FacilityWatchPaid`) is the only acquisition path for ongoing facility alerts when `FACILITY_WATCH_PAID_ENABLED=1`.
- **Legacy watchers kept.** Migration `0064` adds `facility_watchers.alerts_eligible` (default `true`). Existing confirmed rows keep official-record dispatch. Paid checkout upserts an eligible row. One-time records/tour leads may still write a row with `alerts_eligible=false` and are excluded from `dispatch_watch_alerts` / deferred scanner.
- **Area Watch stays** as a weekly official-record area digest on city/state hubs — not marketed as a free substitute for monitoring one facility.
- Overbroad “free forever / free for families” StarlynnCare pricing claims were scrubbed; public records remain openly readable. TX/MO: no paid CTA and no free facility-watch fallback until official sources meet the paid reliability standard.

**Rejected:** Keeping a public free facility-watch funnel beside Premium; treating Area Watch as the free per-facility alternative; cutting off existing free subscribers.

**Source:** `cursor/paid-facility-watch-mvp`; plan `facility_watch_launch_qa_f24cdfc9`.

---

## 2026-07 — Paid Facility Watch launches as concierge MVP (not full automation)

**Decided:**
- Paid entitlement lives in `facility_watch_subscriptions` (migration `0063`), synced from Stripe webhooks. Official-record alert delivery for watchers is gated by `alerts_eligible` (migration `0064`) — see newer entry above for Premium-replaces-free.
- Pricing: **$9/month** or **$59/year**. CTA is inline on facility profiles (“Does your loved one live here already?”) — never a second popup/interstitial. Gated by `FACILITY_WATCH_PAID_ENABLED=1`. Excluded for TX/MO until official weekly scans are dependable.
- Phase 1 fulfillment is **manual**: operator creates Firecrawl monitors and forwards curated hits (see `docs/FACILITY_WATCH_CONCIERGE.md`). Promise copy: “usually within a day,” not “hours.”
- Phase 2 (deferred until ~5–10 paying subscribers): automated Firecrawl provision/reconcile, signed Firecrawl webhooks, check/event/delivery ledgers, automated subscriber alerts.
- SEO/AEO: nothing indexed is walled off; paid product is a service beside the public record.

**Rejected:** Full Stripe + Firecrawl automation before proving willingness-to-pay; walling free regulator data behind paywall; charging TX/MO while official alert delivery is incomplete.

**Source:** `cursor/paid-facility-watch-mvp`; plan `paid-facility-watch_d0a6f4f2`.

---

## 2026-07 — State Watch alerts are scan-ledger driven

**Decided:**
- Area and facility subscriptions receive a `baseline_at` at signup. Historical regulator records are never presented as a newly detected change.
- Every scheduled state ingest writes a `state_scan_runs` ledger, per-source outcomes, and stable facility/public-record fingerprints. Subscriber delivery runs only when the scan status is `completed`; partial or failed scans send no family-facing message.
- `watch_alert_deliveries` deduplicates by watcher + change fingerprint. Area alerts summarize affected facilities in the watched state/city; facility alerts go only to watchers of an affected facility.
- The consolidated state-source workflow runs weekly and owns California too; the former CDSS workflow is manual-only to avoid duplicate CA scans.
- Washington weekly coverage includes Geo universe, CMS NH data, SDCP/specialty signals, AFH forms, and ALF/ESF BHForms discovery. The prior AFH-only incremental pass was not full-state coverage.
- Texas remains an explicit failed/manual source until TULIP capture becomes non-interactive. Missouri refreshes its live directory weekly, while FOIA inspection and SOD narrative refreshes remain manual/monthly constraints.

**Source:** migration `0060_state_watch_automation.sql`; `scripts/{weekly_inspection_ingest,state_watch_ledger,dispatch_watch_alerts}.py`; `.github/workflows/weekly-inspection-ingest.yml`.

---

## 2026-07 — Hub content drift audit is now self-healing (supersedes "set-only" clause of the 2026-06 pipeline entry)

**Context:** Weekly CA ingest kept adding facilities, so every regenerate → approve cycle was invalidated within days: 20 published city hubs were drift-suppressed twice in one month (the "drift treadmill"). Owner approved changing the logged **set-only** drift design.

**Decided:**
- **The audit (`scripts/validate/hub_content_drift_check.py`) repairs rows in place** when only the numbers moved: it rewrites each `<span data-stat>` with the live value (deterministic string surgery, `%`/comma style preserved), re-verifies the patched body with the generator's own `verify_stats` against the live snapshot, refreshes `stats_snapshot`, and clears the flag. Status + approval provenance untouched — approved prose stays live. Public pages pick the patch up via ISR (`revalidate = 3600`).
- **Repair happens at audit time (Python), not render time.** Numbers only change on ingest, and the audit already runs post-ingest in both weekly workflows — so audit-time patching keeps pages exact with zero render cost, no TS mirror of the aggregation SQL, and the RLS suppress-guarantee unchanged.
- **A materiality guard falls back to the old flag-and-suppress behavior** when the change could invalidate prose *around* the number: any metric crossing zero, `pct_with_serious` crossing the 50% line or moving > 25 points, any count more than doubling/halving, missing snapshot keys, nested markup in a span, or a patched body failing the gate. Blocked reasons are written into `drift_details.repair_blocked`. Those rows still require regenerate + re-approve.
- `mark_audited` still never clears a flag on a clean diff — a caught-up snapshot doesn't mean the body was repaired.

**Rejected:** Render-time substitution in `loadPublishedHubContent` (duplicates the aggregation SQL in TS, weakens the RLS guarantee, per-request cost); flipping `drift_detected` manually (republishes stale numbers with no review — never do this); keeping set-only and re-approving 20 cities per ingest (the treadmill).

**Verified:** 25-check unit test of guard/format/patch logic, `--dry-run` review, then live run: 59 audited, 16 repaired in place, 5 guard-blocked (all `pct_with_serious` crossing 50) regenerated as drafts for re-approval. Production page (`/california/oakland`) confirmed serving patched values.

**Source:** `scripts/validate/hub_content_drift_check.py`; consumers unchanged (`scrapers/generate_hub_content.py`, `src/lib/content/hubGate.ts`, `src/app/actions/hubContent.ts`).

---

## 2026-06 — Missouri inspector narratives: ShowMeLTC SOD/POC OCR pipeline

**Context:** The FOIA Excel (`missourirecords.xlsx`) behind `mo_inspections_ingest.py` is TAG-level only — per cited tag it carries the standard *regulation* text in its `DESCRIPTION` column, NOT the inspector's finding. So `deficiencies.description` held the verbatim rule and `inspector_narrative` was null, and the profile's "Verbatim citation text" block showed the rule (always ending in the class code "I/II"), never what the facility did. We had real inspection *events/citations*, not the prose finding.

**Decided:**
- **Real findings live in DHSS's Statement of Deficiencies & Plan of Correction** (CMS-2567-style form) on the Show Me Long Term Care portal (`https://healthapps.dhss.mo.gov/showmeltc/`), as **scanned image PDFs** (`ConvertedTiff.pdf`, 0 extractable text → OCR required). Coverage: deficiencies dated after Jan 1 2019.
- **Portal is ASP.NET WebForms** (all postbacks to `./`, encrypted ViewState, JS-disabled submit). Raw `requests` POSTs are rejected → **drive it with Playwright** (same lesson as AZ). Flow: select `#ContentPlaceHolder1_ddlCity` → force-enable + click `btnShowMeResults` → `gvSearchResults` grid (`Select$N` postback per facility) → facility detail `gvInspections` grid (date link → `inspection_detail.aspx?insid=...`; **"STATE POC" link downloads the SOD/POC PDF**). Selecting the city can itself autopostback (destroys JS context) — guard every step and only click the button if `Select$` links aren't already present.
- **Join strategy (no fragile tag-code mapping):** the SOD header yields provider id (= `facilities.external_id`, **5–6 digits** — `{5,6}` bound avoids capturing the 4-digit street number 1520 / year 2022) + survey date. Within an inspection, each SOD tag block opens with the same *requirement* text we already store in `deficiencies.description`, so **fuzzy-match (rapidfuzz `token_set_ratio`, threshold 70) the SOD requirement → the deficiency row** and attach its narrative. Inspection date match uses the portal's `gvInspections` date (manifest_date), not the OCR'd date. Facility falls back to name+city ILIKE when provider id doesn't OCR.
- **Parsing anchors (OCR-tolerant):** evidence marker on the stable tail `"is not met as evidenced by"` (OCR mangles "This regulation"); narrative anchored on `"Based on "` (every SOD finding opens this way — skips the "Class X" token and interleaved POC text on older filled forms); class regex tolerant of `Il`/`ll`/`ii` → normalized; dedupe tag blocks by rule_cite keeping the longest narrative.
- **No migration needed** — `deficiencies` already has `inspector_narrative`, `class`, `residents_affected`, `harm_description`, `plan_of_correction`. Load writes `inspector_narrative` (+ class/residents) per deficiency and sets `inspections.raw_data.narrative` to the full SOD text (so `summarize_inspections.py` can generate the plain-language summary).
- **UI already prefers `inspector_narrative` over `description`**, so loaded findings light up automatically. Until then, the `moProfileConfig.deficiencyTextIsRuleOnly` flag relabels the rule-only block "Regulation cited" (added same change) so we never imply the rule is the finding. After load, rows with a narrative auto-revert to "Verbatim citation text"; rows still without one (pre-2019, unmatched) stay honestly labeled.

**Pipeline:** `scrapers/mo_sod_ingest.py` with three modes — `crawl` (Playwright → download PDFs + `data/mo_sod/manifest.jsonl`), `ocr` (Tesseract `/opt/homebrew/bin/tesseract` + per-tag parse → `parsed.jsonl`), `load` (DB upsert). PDFs/manifests gitignored under `scrapers/data/mo_sod/`.

**Verified:** End-to-end on Fremont Senior Living (`mo28782`, Springfield) — 7 SOD PDFs crawled, OCR'd, and parsed into real narratives across 2019–2025, incl. the two 12/17/2024 complaint findings (notification + medication system) that previously rendered only as rule text. Tesseract is clean on these typed forms. Load not yet run against prod DB (needs `DATABASE_URL`).

**Rejected:** Raw `requests`/WebForms ViewState replay (server rejects). OCR'ing the narrow (X4) prefix-tag column to map tags (unreliable; fuzzy requirement match is robust). Vision-LLM OCR (Tesseract is accurate on these typed scans and free; reserve LLM for the plain-language summary).

**Source:** `cursor/fix-mo-severity-mapping`; `scrapers/mo_sod_ingest.py`, `src/lib/states/MO/profileConfig.ts`, `src/components/facility/profile/FacilityFullInspections.tsx`.

---

## 2026-06 — AZ perf: React.cache() + rail de-fan-out + snapshot cache

**Decided (PR #41):**
- **`React.cache()` on `loadFacilityProfile`**: wraps the whole function so `generateMetadata` and the page server component share one fetch per request. Without this, each AZ facility page fired the `facility_snapshot` RPC twice for the main profile alone.
- **Strip `facility_snapshot` RPC from discovery rails** (`RelatedFacilities`, `SameOperatorFacilities`, `MetroNearbyFacilities`): rails were calling up to 14+20+24=58 live RPCs per page to rank results by `composite_percentile`. Rails now sort by `last_inspection_date DESC` at the DB level — zero extra RPCs. Grade ranking for rails can be restored when the snapshot cache columns are populated (see below).
- **Snapshot cache columns** (`facilities.grade_letter`, `facilities.composite_percentile`, `grade_refreshed_at`) via migration 0055. `scrapers/refresh_snapshot_cache.py` populates nightly. This is the long-term backing for rail grade display and card sorting.
- **`maxDuration = 60`** on the facility page route — raises the Vercel function timeout from 10s default for on-demand ISR.

**Root cause of AZ regression:** The 2026-06-22 deficiency backfill made each `facility_snapshot` RPC scan a far larger AZ peer corpus. Combined with ~60 live RPC calls per page and cold on-demand ISR, pages hit the function budget.

**Rejected:** Disabling the discovery rails entirely (removes navigation value); adding `Suspense` streaming (does not reduce RPC count, only delays the timeout).

---

## 2026-06 — Broken internal links: HubDifferentiators city_slug missing

**Decided (PR #41):**
- **Root cause:** `region_hub_stats` RPC returned only `top_improved_slug`/`top_deteriorated_slug` (facility slug), but `HubDifferentiators.tsx` built 2-segment hrefs `/{state}/{slug}` instead of the correct 3-segment `/{state}/{city_slug}/{slug}`.
- **Fix:** Migration 0056 extends the RPC to also return `top_improved_city_slug` and `top_deteriorated_city_slug`. `HubDifferentiators.tsx` now uses `facilityProfilePath()` from `src/lib/seo/paths.ts`.
- **`facilityProfilePath(stateSlug, citySlug, facilitySlug)`** is now the canonical helper for building 3-segment facility URLs. Use it everywhere to prevent a recurrence.

---

## 2026-06 — Missouri buildout: data signals + join key

**Decided (PR #41):**
- **Memory-care signals (MO Tier-1):** `alzheimer_s_scu=true` (§198.510 RSMo Alzheimer's SCU Disclosure, Form MO 580-2637) OR `level_of_care='ALF**'` (§198.073.6 RSMo non-self-evacuation authorization). No standalone memory care license exists in MO.
- **Join key:** Excel `FACILITY_ID` (e.g. `27367N`) → strip letter suffix → Socrata `facility_number` (e.g. `27367`). Probe confirmed 587/587 (100%) match. One `facility_number` may have multiple license lines; create one facility row per `fcilicensenumber`.
- **Severity mapping (MO):** Baseline `severity=2`. Elevate to 4 for: `SURVEY_CATEGORY` contains "COMPLAINT INVESTIGATION"; description matches `abuse|neglect|exploit|elopement|medication_error|evacuation|immediate_jeopardy` regex. Zero-deficiency sentinel tags: `000L, 00FM, 00IC, 00LC, 000I` (skip, do not insert deficiency row).
- **Freshness gate:** 36 months (same as AZ/OR). Facilities without an inspection in 36 months are not published until fresh records arrive.
- **License status:** `license_expiration` field in Socrata. Active = expiration date >= today.

**Rejected:** Name-keyword matching alone as a standalone MC signal (too weak for YMYL). RCF facilities without `alzheimer_s_scu=true` or `ALF**` are excluded even if their name contains "memory care".



**Decided:**
- **Use Playwright (headless Chromium) to scrape the `inspection-details` DOM** for per-deficiency rows. Salesforce Experience Cloud blocks guest access to the Apex controller for deficiency details — all attempts to call the Aura API directly returned `clientOutOfSync` (guest access denied at the controller level).
- **DOM structure:** The deficiency table at `/s/inspection-details?inspectionId=<sf_insp_id>&facilityId=<sf_fac_id>` uses `[role='grid']` rows. Rule code/text is in `<th>` within each data row; evidence and POC are in `[role='gridcell']` columns. The repeat-deficiency flag appears as text in the row HTML (`"Repeat Deficien"`).
- **Severity mapping (AZ):** `severity=4` for: `immediate_jeopardy=true` (explicit "immediate jeopardy" in evidence/rule text), inspection status "Enforcement", or rule category containing abuse/neglect/exploitation/elopement. All other deficiencies: `severity=2`. No Type A/B system — AZ uses A.A.C. Title 9, Chapter 10 citations.
- **Rule code parsing:** `r"^(R[\d]+-[\d]+-[\w.]+)\.\s*(.+?)(?:\n|$)"` on the first line of the rule text column. Captures code (`R9-10-810.B.1`) and category (`Resident Rights`) correctly.
- **`--mode deficiencies` in `az_adhs_inspections_ingest.py`:** Uses `ThreadPoolExecutor` with 3 concurrent Playwright workers. Each worker has its own browser and DB connection (autocommit). Skips inspections whose narrative contains "no deficien" (fast path). Resumable via `NOT EXISTS` filter + `--offset`. Delete-replace strategy per inspection.
- **`class` column is null for AZ** — `FacilityFullInspections` typeA counter stays 0 (no "severe (Type A)" box shown). Severity communicated via `azFormatSeverityTag` using the `severity` integer.

**Rejected:** CDP/browser agent capture of Aura network calls (browser agent hung twice; Salesforce guest restriction makes it infeasible regardless). Regex-based deficiency counting from `initialComments` narrative (produced counts of 0/1, not per-rule accuracy).

**Source:** `cursor/az-deficiency-parsing`; AZ backfill run 2026-06-22.

---

## 2026-06 — Facility Watch: auto-confirm + probe-first pipeline

**Decided:**
- **No confirmation click.** `POST /api/watch` sets `confirmed_at` on upsert; welcome email via `sendWatchWelcome` (env: `LOOPS_WATCH_WELCOME_ID` or legacy `LOOPS_WATCH_CONFIRM_ID`).
- **Migration numbering:** main already has `0047_hub_content.sql` + `0048_submission_events_event_types.sql`. Watch monitoring is **`0049_facility_watch_monitoring.sql`** — apply only after 0047+0048.
- **Probe before pipeline.** `scrapers/facility_watch_probe.py` is read-only (no ingest, no snapshot tables). Use it to validate signal before enabling `facility_watch_scan.py` or CI workflows (currently `workflow_dispatch` only, cron commented out).
- **OR sources under evaluation:** ltclicensing CSV (inspections/violations live; providers/regulatory 500 → `data/or_*.csv` fallback), portal detail pages, optional Firecrawl news. CMS NH N/A for OR ALF/RCF.

**Rejected:** Auto-applying watch migrations from the scanner. Competing `0047_facility_watch_*` filename (collides with hub content).

**Source:** `cursor/facility-watch-monitoring`; exemplar Footsteps at Carman Oaks (`3d1adb64-06f8-4d5f-aa87-c33f2ad038bc`).

---

## 2026-06 — Facility profile is mobile-reordered via CSS `order`, not DOM moves

**Context:** Microsoft Clarity session replay showed a high-intent mobile visitor land on a facility page (organic, "Top 1% of Minnesota Memory Care"), spend 18s, scroll, and bounce with 0 clicks — never reaching the structured hard facts. Audit confirmed the mobile sequence buried the peer-rank percentiles and citation record beneath the Hero, the methodology byline, the quick-facts strip, and a ~2-screen Snapshot block dominated by a low-value exterior photo + static map.

**Decided:**
- **Reorder the lead sections on mobile only via responsive CSS `order`** (wrapper `<div className="order-N md:order-none">` around each section in `src/app/[state]/[city]/[facility]/page.tsx`). Mobile visual order is QuickFacts → Peer rank → Citation record → conversion CTAs → Snapshot; `md:` resets to the editorial source order. **DOM order is unchanged**, so SEO crawl order and the E-E-A-T byline placement (per the 2026-05 AuthorByline decision) are preserved — the visual change is mobile-only.
- **Snapshot photo+map is compressed on mobile** (`FacilitySnapshot.tsx`): side-by-side `grid-cols-2` instead of stacked, height `230px` (was `360px`), section padding `py-10` (was `py-16`) — all gated `md:` back to the original. A ~2-screen block becomes ~0.7 screen and is deferred below the facts.
- **Mobile "jump to facts" chips**: a horizontally-scrollable anchor nav in the sticky `FacilitySubNav` (mobile-only, `md:hidden`), chip order leads with peer rank / record and pushes Snapshot last. Desktop keeps `FacilitySubNavAnchors` (the proximity-hover nav). All anchored sections got `scroll-mt-28` so the sticky bar doesn't cover the target on tap.

**Rejected:** Physically moving Snapshot below Record in the JSX for all viewports (would change desktop's deliberate §01 Snapshot → §02 Peer order and the crawl order). Duplicating a verdict component for mobile (the Hero snippet already carries the "top X%" line above the fold — confirmed in audit).

**Verified:** Throwaway harness (`/zaudit/facility`, since removed) rendering the real section components with a mock `FacilityProfile`, screenshotted headless at 390px (mobile) and 1280px (desktop). Mobile: facts now sit immediately after quick facts; photo/map compact at the bottom. Desktop: unchanged. `tsc --noEmit` clean, `next build` green.

**Source:** `src/app/[state]/[city]/[facility]/page.tsx`, `src/components/facility/profile/{FacilitySnapshot,FacilitySubNav,FacilityHero,FacilityQuickFacts}.tsx`, + `scroll-mt-28` on the `#peer/#record/#full-record/#rules/#tour` sections.

---

## 2026-06 — Hub content pipeline Phase 1 shipped (generator → review → publish → drift audit)

**Context:** Implements the "City-first hub strategy + automated content pipeline" decision below. The load-bearing requirement: *no human checks the numbers.*

**Decided:**
- **`hub_content` table (migration 0047)** keyed `(state_code, region_slug)`, RLS: anon reads only `status='published' AND drift_detected=false`; writes are service-role only (matches `reviews`). 0047 and the table must be applied via the Supabase SQL editor — DDL can't go through PostgREST and the `exec` RPC was dropped in 0040.
- **Accuracy spine = `<span data-stat="KEY">VALUE</span>` tokens.** A deterministic gate (no model, no DB) checks every token against the row's `stats_snapshot`. Python `verify_stats` (generator) and its TS twin `verifyHubStats` (`src/lib/content/hubGate.ts`) must stay in lockstep — same STAT_KEYS, same `[,%\s]` normalization.
- **Approval gate = tokens == stored snapshot AND not drift-flagged.** It does NOT re-query the live DB at approval. Rationale: the snapshot *is* the DB value at generation time, and the post-ingest drift audit keeps it DB-honest, so "tokens == snapshot AND not drifted" transitively means "tokens == DB" with **zero duplicated aggregation SQL** between Python and TS. **Dependency:** the drift audit must cover draft/in_review rows too (it does), or this guard is hollow.
- **Editor is HTML-source + live preview, not WYSIWYG.** (See ERRORS.md — TipTap silently drops the data-stat spans.) Numbers stay as literal text in the source, impossible to drop; `verifyHubStats` runs live in the editor and again server-side on save/publish.
- **Drift audit (`scripts/validate/hub_content_drift_check.py`, Layer 5b)** recomputes via the generator's `compute_stats` (single source of truth), compares **exactly** (any change is a wrong number on a YMYL page — not thresholded), is **set-only** (clears only via regenerate + re-approve), and is wired as the post-ingest step of `cdss-weekly-ingest.yml`. Exits 0 even on drift (flagging is success).

**Rejected:** TipTap/WYSIWYG (drops data-stat spans); a live-recompute RPC at approval (duplicates the drift audit's job + a second copy of the aggregation SQL); thresholded drift (would let a stale-but-close number render).

**Status (updated 2026-07-01):** All checkpoints 1–5 merged to `main` (`claude/amazing-hopper-5HquU` fully merged; admin review tool + drift audit live). Migration 0047 applied in SQL editor — owner confirmed migrations through 0059 have run except `0057_mo_universe.sql`. Pipeline is unblocked; no hub content generated yet. Note: the generator (`generate_hub_content.py`) imports `anthropic` at module top, so the drift audit transitively needs it installed (fine in CI/Cursor, which install `scrapers/requirements.txt`).

**Source:** `supabase/migrations/0047_hub_content.sql`, `scrapers/generate_hub_content.py`, `src/lib/content/hubGate.ts`, `src/app/actions/hubContent.ts`, `src/app/admin/hub-content/`, `scripts/validate/hub_content_drift_check.py`.

---

## 2026-06 — City-first hub strategy + automated content pipeline (overrides county-replication framing)

**Context:** `post_audit_growth_plan.plan.md` and prior MEMORY framing centered CA fan-out on *county* hubs (Alameda → LA/OC/SD). Ahrefs keyword data shows effectively **zero search volume for county queries** — demand is city-level ("memory care <city>") and "near me." This overrides the county-replication emphasis.

**Decided:**
- CA depth is built as **city hubs at scale** (the existing `/[state]/[city]` route + `cityIntros`), not county hubs. County hubs are de-emphasized, not removed. "Near me" intent is served by city hubs + facility-page geo/`LocalBusiness` schema.
- **Content replication is automated through a generation → human review/edit → publish pipeline.** Generated city/hub content is LLM-drafted, grounded in Supabase stats with citations, and is **never auto-published** — a human edits it in a rich-text (bold/paragraph/etc.) review tool and approves before it goes live.
- **Data accuracy is fully automated, not human-checked.** Per owner direction, no human reviews the underlying numbers. New ingest data automatically triggers a **content audit** of every published page whose numeric claims derive from that data; any drift sends the page back to "needs re-review." This extends the existing Layer-1/2 validation (the chain-scorecard-drift pattern) to all generated content.

**Phase order (revised this session):**
1. **Phase 1** — city-first content replication engine + rich-text review middleware + automated content-data drift audit.
2. **Phase 3** — automated CA data-story / analysis pages from RPCs (PA-insights pattern). **Higher leverage than cost.**
3. **Phase 2** — cost data plane + state-wide reporting. **Gated:** ship only if a *real* cost data source is found. Generic competitor-derived ranges = fluff = do not publish (YMYL).

**Source:** This session. Supersedes the county-replication emphasis in `.cursor/plans/post_audit_growth_plan.plan.md`, which should be updated separately (not edited here, per the "don't edit `.cursor/plans/` plan files" rule).

---

## 2026-06 — Pennsylvania frontend launch (overrides prior "skip new states" decision)

**Context:** `MEMORY.md` 2026-04 and `.cursor/plans/post_audit_growth_plan.plan.md` both said "skip more US states until CA county replication or TX shows ranking lift." This launch **overrides that decision** per explicit user direction.

**Decided:**
- PA launches with the full MN/OR/WA/TX "directory-first + small focused pages" architecture.
- Profile config: `agencyShort: "PA DHS"`, `agencyLong: "PA DHS OLTL"`, `citationPrefix: ""` (codes already include `55 Pa Code §`), `inspectionWindowMonths: 36`.
- Severity tier: Citation (1/info) → Civil Money Penalty (2/warn) → Provisional License (3/danger) → Immediate Jeopardy / Revocation / Substantiated Abuse (4/danger).
- Hub config registered in `stateHubConfigs/index.ts` as `pennsylvania`; `PA_FAQS` added to `stateFaqs.ts`.
- 6 county hubs with Alameda-style long-form intros: Montgomery (48 fac), Allegheny (44), Bucks (29), Chester (26), Lancaster (19), Delaware (16).
- Top-city intros in `cityIntros.ts` for Pittsburgh, Philadelphia, Lancaster, Allentown, York, West Chester, Harrisburg, Erie, King of Prussia, Exton.
- Two state editorial articles: `memory-care-licensing` (PCH vs ALR, Special Care/SDCU) and `memory-care-vs-nursing-home` (DHS vs DOH+CMS).
- Data gap fix: `cited_date` backfilled from `inspections.inspection_date` (proxy; exact dates in sidecars but file-based approach was 10h; DB approach was 6s). `state_severity_raw` derived from `deficiencies.severity` integer column. 42,753/42,753 rows covered.
- `pa_pdf_backfill.py` patched for future runs: INSERT now includes `cited_date` and `state_severity_raw`.
- `pa_backfill_date_severity.py` written as sidecar-based remediation script (kept for reference; DB approach was used instead for speed).

**Result (2026-06-02):** 355 publishable PA facilities, 42,753 deficiencies, all with cited_date + state_severity_raw populated.

**Intentional non-goals:** Not recovering the 94 errored PDFs (OCR failures, corrupt files). No PA cost-band / glossary pages (old CA model; pivot away from it). No rulebook entries yet (ship empty `[]` per OR/UT/IL pattern).

**Source:** `cursor/pennsylvania-launch` branch; plan in `.cursor/plans/pennsylvania_launch_82e8a3ae.plan.md`.

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
