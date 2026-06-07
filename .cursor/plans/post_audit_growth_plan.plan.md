---
name: Post-audit growth plan (API fix + CA county replication + TX phase 2)
overview: Three workstreams sequenced by leverage. (1) Fix the /api/facilities regression that shipped today; cheap, urgent. (2) Build reusable infrastructure to replicate the Alameda County playbook to LA, Orange, San Diego, Contra Costa once 30-60 day Alameda data lands. (3) Complete Texas Phase 2 (inspection ingest + publishable flip) to unlock a second flagship state. Skip more US states until at least one of (CA replication, TX) shows ranking lift.
todos:
  - id: api-debug
    content: Reproduce /api/facilities/california 500 in local dev; capture real Supabase error from console.error log
    status: pending
  - id: api-fix
    content: Patch the regression in src/app/api/facilities/[state]/route.ts and verify all 5 covered states return 200
    status: pending
  - id: api-smoke-test
    content: Add a tiny check script in scrapers/ that hits each /api/facilities/[state] endpoint and asserts count > 0, used as a pre-deploy smoke
    status: pending
  - id: alameda-measure-baseline
    content: Record GSC baseline for /california/alameda-county today (rank, impressions, clicks, top queries) so the 30-60 day check has a comparison point
    status: pending
  - id: county-content-module
    content: Refactor countyIntroParasForRegion (currently hard-coded for Alameda) to accept county-level CDSS stats as input, so adding new counties is data-driven not copy-pasted
    status: pending
  - id: la-county-content
    content: Author 4-6 paragraph LA County intro referencing real LA CDSS data (facility count, deficiency rate, geographic tiers, ALW participation, Medi-Cal context for LA-specific market)
    status: pending
  - id: oc-county-content
    content: Author Orange County intro
    status: pending
  - id: sd-county-content
    content: Author San Diego County intro
    status: pending
  - id: cc-county-content
    content: Author Contra Costa County intro
    status: pending
  - id: county-internal-links
    content: Add 1-line contextual links to each of the 4 new county hubs from cost-guide, cost-by-city, glossary, and medi-cal-and-memory-care (same pattern as Alameda)
    status: pending
  - id: county-replication-merge
    content: Ship the 4 new county pages as one PR, with Vercel preview review before merging to main
    status: pending
  - id: alameda-30day-check
    content: At T+30 days post-deploy, pull GSC numbers for Alameda and compare to baseline. Go/no-go decision on continuing county replication
    status: pending
  - id: tx-publish-gate-design
    content: Define publish gate criteria for TX facilities (e.g. must have ≥1 inspection record AND Alzheimer-certified OR HHSC-confirmed dementia program). Document in docs/TX_PHASE2_PUBLISH_GATE.md
    status: pending
  - id: tx-inspection-ingest
    content: Land tx_inspections_ingest.py output for the 1,389 ingested TX facilities; verify HHSC LTCR data quality on a 50-facility sample before bulk run
    status: pending
  - id: tx-narrative-pia
    content: Submit the TX PIA request from docs/TX_PIA_REQUEST_DRAFT.md for bulk historical inspection narratives (asynchronous; can start immediately)
    status: pending
  - id: tx-publish-flip
    content: Run script to flip publishable=true on TX facilities meeting the publish gate. Target ≥500 publishable rows for meaningful state hub
    status: pending
  - id: tx-state-hub-qa
    content: QA /texas state hub and at least 3 county hubs (Harris, Dallas, Bexar) for parity issues (no fake Type-A/B, correct HHSC terminology, valid breadcrumbs)
    status: pending
  - id: tx-stay-quiet
    content: Do NOT promote TX externally until ≥500 publishable facilities and QA passes — thin-page guard prevents accidental indexing of empty hubs
    status: pending
isProject: false
---

# Post-audit growth plan

Three workstreams sequenced by leverage and dependency. Stream 1 is urgent (broken in production today). Stream 2 is engineering you ship now and content you author now but **measure in 30 days** before fanning out. Stream 3 runs in parallel because PIA paperwork has a multi-week lag.

Skip more US states until Streams 2 or 3 produces ranking lift.

---

## Stream 1 — Fix the `/api/facilities` regression (today, ~30-60 min)

**What's broken:** `https://www.starlynncare.com/api/facilities/california` returns `{"error":"Unable to load facilities"}` in production. The same 500 is happening across all 5 covered states. This was working before today's merge.

**Why it matters:**
- The endpoint backs the `Dataset` JSON-LD claim on `/data`.
- It's referenced by `llms.txt` and `llms-full.txt` as the "machine-readable facility data" surface.
- External integrators (incl. AI crawlers) hitting it get an opaque error, which is worse than getting a 503.

**Likely cause (untested hypothesis):** the most recent change to the route was [src/app/api/facilities/[state]/route.ts](src/app/api/facilities/[state]/route.ts) in commit `e94cfe4` (security M3/L1). That commit changed error responses to a generic string and added `Vary: Origin`. The underlying Supabase query itself wasn't changed in that commit, so the regression is more likely:
- A column rename in a recent migration that the route still references (e.g. `total_deficiency_count` vs `serious_citations`).
- A type cast issue introduced by a stricter Supabase client.

**Investigation steps:**
1. Run `npm run dev` locally with production-equivalent Supabase env vars.
2. Hit `http://localhost:3000/api/facilities/california` and read the actual `console.error` line for the Supabase error message — that's the truth.
3. Likely fix is one column name or one type cast.

**Verification:**
- All 5 endpoints (`california`, `texas`, `oregon`, `washington`, `minnesota`) return 200 with non-zero `count`.
- `count` matches a sanity-check vs. the sitemap-facilities.xml per-state numbers (CA ≈ 484, MN ≈ 552, WA ≈ 180, OR ≈ 131, TX ≈ 1, UT ≈ 118).

**Pre-deploy smoke test:** add `scrapers/check_facilities_api.py` (or `.ts`) — hits each endpoint, asserts `count > 0`, runs in CI. Avoids re-shipping this regression.

**Commit shape:** one small commit, direct to main per the "1-2 file fix" carve-out in CLAUDE.md. No new branch needed.

---

## Stream 2 — Build the county replication infrastructure (~1 week of work spread over 60 days)

The Alameda playbook shipped today: 5-paragraph county intro + county breadcrumb on city hubs + 4 inbound contextual links. That code is in place and works for any California county.

**Strategic frame:** we **do not** know yet whether the playbook moves Alameda's rank from #50 to somewhere visible. **The 30-60 day measurement window is the gate** for whether to fan this out.

So Stream 2 has two phases.

### Phase 2a — Set the baseline now (today, 30 min)

- Record current Google Search Console stats for `/california/alameda-county` and 3-5 representative facility pages: rank, impressions, clicks, top queries.
- Note today's date as T0.
- This is a notebook entry, not code.

### Phase 2b — Author content + refactor for reuse (~3-5 hours, do now while context is fresh)

The `countyIntroParasForRegion` shipped today hard-codes Alameda's 5 paragraphs. Before adding 4 more counties, refactor so each county entry takes:
- `totalFacilities`
- `deficiencyRate`
- `topCities` (3-5)
- `notes` (1-2 narrative paragraphs unique per county)

…and assembles the prose from a template. **Trade-off flag:** This sits at the edge of Rule 2 (Simplicity First). If the prose template feels formulaic, ship 4 fully hand-authored intros instead — quality > scaling abstraction.

Then author content for:

1. **Los Angeles County** — 8.8M people, ~1,200 RCFEs, biggest CA market by far. Per-region geographic split (Westside, SFV, SGV, Southbay, Eastside, downtown) deserves more than 5 paragraphs.
2. **Orange County** — 3.2M people, ~400 RCFEs. Suburban market, OC-specific dementia care patterns.
3. **San Diego County** — 3.3M people, ~350 RCFEs. North County vs central vs South Bay.
4. **Contra Costa County** — 1.1M people, ~150 RCFEs. East Bay sibling to Alameda; will benefit from the Alameda county breadcrumb scaffold already shipped.

**For each county, add the same 4 contextual links** (cost-guide, cost-by-city, glossary, medi-cal article) — keep the link copy short and county-specific, not templated.

**Ship as one PR with Vercel preview** — this touches `[state]/[city]/page.tsx` data dependencies and 4 article pages, well over the 3-file branch threshold in CLAUDE.md.

### Phase 2c — Decision gate at T+30 days

Measure Alameda. Three outcomes:

- **Alameda moved into top 30 → ship LA/OC/SD/CC content immediately, then plan more counties.**
- **Alameda moved 5-15 positions (e.g. #50 → #35) → ship the 4 counties as planned; this is a slow-burn ranking play and 30 days is short.**
- **Alameda didn't move → DO NOT publish the 4 county pages.** Instead, diagnose: is it backlinks (most likely), is it competitor consolidation, is it the page itself? Schema + content is necessary but not sufficient. The intervention then is human outreach (backlinks, press), not more pages.

**Why the gate matters:** publishing 4 thin-data county hubs without proven traction risks dragging down the perceived quality of the property. The thin-page noindex guardrail catches the worst case, but better to not ship until the pattern works.

---

## Stream 3 — Texas Phase 2 (parallel, multi-week)

Texas Phase 1 is done: **1,389 facilities ingested** to the DB, all with `publishable = false`. Per [docs/TX_PHASE1_AUDIT.md](docs/TX_PHASE1_AUDIT.md), 515 of those have non-expired Alzheimer certification. The blocker for going live is inspection data — you can't publish a facility profile with no inspection history under the YMYL standard.

### Why TX next (not IL)

- TX has Harris (Houston), Dallas, Bexar (San Antonio), Tarrant (Fort Worth). Combined memory-care search demand exceeds Bay Area.
- 515 already-certified candidate facilities is enough for a real /texas hub.
- TX HHSC has a real PIA process for bulk historical inspections — paperwork already drafted in [docs/TX_PIA_REQUEST_DRAFT.md](docs/TX_PIA_REQUEST_DRAFT.md).
- IL is mid-flight (scrapers exist, migration 0042 deduped) but structurally similar to MN/WA — doesn't unlock a new buyer market.

### Phase 2 sub-steps

#### 3a — Design the publish gate (1-2 hours)

Document `docs/TX_PHASE2_PUBLISH_GATE.md` with explicit criteria. Strawman:

> A TX facility is `publishable = true` when ALL are true:
> 1. It has at least one inspection record in `inspections` table.
> 2. It is Alzheimer-certified (`tx_alzheimer_certified = true`) OR it operates under an HHSC-confirmed dementia program.
> 3. Its inspection narrative has been parsed (no PDF-links-only profiles in initial publish wave).

Tighter gate = smaller initial /texas hub but higher quality. **Tradeoff:** at the strawman gate, you might end up with only ~150 publishable TX facilities at first. That's still 150× the current TX hub.

#### 3b — Run TX inspection ingest (~1-2 days of work + run time)

[scrapers/tx_inspections_ingest.py](scrapers/tx_inspections_ingest.py) exists. Verify HHSC LTCR data quality on a 50-facility sample before bulk run. Look for:
- Inspection date formatting consistency.
- Deficiency category mapping (HHSC uses different categories than CDSS — `state_severity_raw` should preserve verbatim).
- Narrative text presence vs PDF-only.

#### 3c — Submit the PIA request now (asynchronous, ~4-6 weeks lag)

This is paperwork. Submit it today regardless of other steps — TX HHSC PIA fulfillment runs in weeks, not days, so the clock starts when you submit, not when you're ready to ingest the response.

#### 3d — Flip publishable (1 day)

Write a one-off script that flips `publishable = true` for the rows passing 3a. Target ≥500 to make the /texas hub meaningful. If gate is too tight, loosen narrative requirement in iteration 2.

#### 3e — QA before promoting (1-2 days)

Curl-test the /texas hub, /texas/harris-county, /texas/dallas-county, /texas/bexar-county. Check:
- JSON-LD valid (no fake aggregate ratings, no NursingHome misclassification).
- HHSC terminology used correctly (no "Type-A deficiency" — that's CDSS, not HHSC).
- Breadcrumbs work.
- Thin-page noindex guard kicks in if a county has fewer than ~5 publishable facilities.

#### 3f — Do not promote externally yet

Per the corrective audit logic — don't pitch press, don't add to Wikidata, don't seed backlinks until ≥500 publishable TX facilities and QA passes. Premature distribution of a thin state hub damages the property.

---

## What this plan deliberately skips

- **Adding more US states.** No IL completion, no new states, until either CA county replication or TX shows ranking lift. Per the leverage analysis, inventory is not the bottleneck — Alameda has 93 facilities and ranks #50.
- **A chatbot.** Decided no in the previous turn.
- **More schema work.** Production schema is healthy.
- **More library articles.** They're already on the backlog and are tertiary.
- **Wikidata / Kaggle / press pitches.** These are the highest-leverage non-engineering moves and should happen *in parallel* (assigned to a human, not in this plan) — but they're not engineering tasks so they don't go in this plan.

---

## Sequencing summary

| Order | Workstream | Calendar time | Engineering time |
|---|---|---|---|
| 1 | Fix `/api/facilities` regression | Today | 30-60 min |
| 2 | Record Alameda baseline | Today | 15 min |
| 3 | Submit TX PIA request | Today | 30 min (paperwork) |
| 4 | Refactor + author 4 county intros | This week | ~5 hours |
| 5 | Run TX inspection ingest + publish flip | Next 2 weeks | ~3-4 days spread |
| 6 | T+30 day Alameda check | Late June | 30 min |
| 7 | Ship or shelve 4 county pages | Late June | 0 (already authored) |
| 8 | TX state hub QA + soft launch | Mid-July | 1-2 days |
| 9 | Decision on whether to add IL or pitch press | August | strategic decision, not engineering |

---

## Open questions worth resolving before starting

1. **Where do GSC numbers live?** If you're not already exporting them to a notebook, this is the moment to start — without a baseline you can't make the T+30 decision objectively.
2. **TX publish gate aggressiveness.** Strawman is tight (3 conditions). If you'd rather ship a larger /texas hub faster with looser gates, surface that trade-off now — affects 3a.
3. **Who handles the human outreach (Wikidata, Kaggle, press)?** If it's you, schedule a 4-hour block. If nobody, those tasks won't happen and the engineering work in this plan is doing less than it could.
