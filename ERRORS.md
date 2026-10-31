# ERRORS.md — Failure log

Append-only log of approaches that didn't work and what worked instead. Check this before suggesting an approach to a similar task. Newest at the top.

Format per entry: **what went wrong**, what worked instead, source.

The OR pipeline learnings doc (`docs/OR_PIPELINE_LEARNINGS.md`) is the canonical long-form version of items 1–6. Entries here are the short, searchable version.

---

## 2026-10 — Turbopack dev will not start in a worktree with a linked node_modules

**What went wrong:** A git worktree that symlinks `node_modules` from the main checkout failed `next dev` with a Turbopack panic: "Symlink [project]/node_modules is invalid, it points out of the filesystem root." Every page returned an empty body.

**What worked instead:** `npx next dev --webpack -p <port>` in the worktree. `npx tsc --noEmit` works with the symlink as is.

**Source:** `cursor/aeo-article-depth` worktree, 2026-10-31.

## 2026-10 — Washington adult family home documents were invisible to the scraper

**What went wrong:** The adult family home scraper only kept PDF links that were already a full `https://fortress.wa.gov/...pdf` address. DSHS posts relative links, with the month and the category in the link text (`10/2026 - Enforcement Letters`). Every weekly run recorded zero documents. Approving one of those homes published it, and the page said there were no citations. That included a home whose license had been revoked.

**What worked instead:** Read the link and its text, keep the category and the month, and do not publish a Washington adult family home until that list has been read. A Tier 1 flag stays off the page until a person approves the banner. A later lift letter closes only the same kind of action.

**Source:** AFHForms pages for licenses 756400, 755245, and 753541 on 2026-10-27.

## 2026-10 — The review queue's 5,000-row limit still returned 1,000 homes

**What went wrong:** The yellow queue asked for 5,000 homes that still need a decision. The database API stops at 1,000. Homes kept pending stay in that status, so their notes filled the window. California and Minnesota were all the page could show, and Oregon, Pennsylvania, Texas, and Washington never appeared. Refreshing did not help.

**What worked instead:** Ask only for homes whose note is empty, 1,000 at a time, and put a Next link on the page. A saved note stays on the home and keeps it unpublished. It just leaves the window so the next state can load.

**Source:** Review session on 2026-10-26. Unreviewed homes with no note: Minnesota 254, Oregon 128, Pennsylvania 657, Texas 75, Washington 7,144. California's remaining 20 already had notes.

## 2026-10 — A partial California crawl had visit changes and still must not email

**What went wrong:** The morning Mac crawl often stops inside its time budget. Those runs are stored as `partial` and can still list new visits. Treating that list as a finished scan would email families about a crawl that did not finish. The older California data check would also have failed a quiet week, which would have blocked a finished scan for the wrong reason.

**What worked instead:** Sunday mail reads `state_scan_runs.status`. Only `completed` is eligible, and only after the current data check passes. The check no longer fails because facility rows were left untouched.

**Source:** California scan rows from 2026-10-16 through 2026-10-25. Layer 5 run on 2026-10-26 passed 4/4.

## 2026-10 — Merging the ingest script started a production scan and could email families

**What went wrong:** The weekly workflow ran on a push to `main` of `scripts/weekly_inspection_ingest.py` or `scripts/probe_inspection_freshness.py`. Merging earlier pull requests queued two full scans on the old data checks. The alert step also ran whenever the scrape itself succeeded, including when the data check failed, so a passing check on a weeknight merge would have emailed families.

**What worked instead:** Take the push trigger off. Send family mail only from the Sunday schedule, and only when the data check passes. A manual run still has to opt in. Cancel the two scans that the merges had already started.

**Source:** Runs `40262641487` and `40262771711`.

## 2026-10 — Data Validation stayed red on checks that do not describe the record

**What went wrong:** Every pull request failed Layer 1. The failures were a facility `updated_at` older than 90 days in California, Minnesota, Oregon, Texas, and Utah; 34 homes with blank or zero beds, 30 of them the entire Illinois roster; and Marquis Oregon City Post Acute Rehab, whose composite rank was 78 with three repeated codes in a state that stores no repeat flags. Layer 2 then failed because a static California article had drifted from live citation totals. None of those checks said whether an inspection date was real.

**What worked instead:** Judge freshness by the inspection date. Count missing beds only where the state publishes them. Compare repeat codes with composite rank only in states that store repeat flags. Print article drift, and print a sample row that gained a visit, instead of failing the build. A visit the sample named and the database no longer has still fails. Retry a Pennsylvania block or a Utah 500 once, and fail the scan if it is still down. An Arizona facility call that errors fails the same way. A missing Texas capture file does not.

**Source:** Data Validation run `40261769957`; `scripts/validate/db_invariants.py`.

## 2026-10 — Illinois and Washington Sunday runs were not reading a new inspection

**What went wrong:** Illinois exited 0 after probing PDFs for the 147 visits already stored and finding none. That job does not ask the portal for a survey newer than 2026-05-06. New Illinois visits come from the FOIA file. Washington spent about four hours and added zero inspections. Two hours and eighteen minutes were the adult-family-home discovery step, and about an hour was the physical-city recompute. The newest Washington date stayed 2026-12-01, which is the date on the Aegis Living Kirkland source file.

**What worked instead:** Say in the Illinois log that the run is looking up PDFs, not new visits. Leave the Washington date in place. The long Washington steps are a later performance task, not a bad date.

**Source:** GitHub Actions run `40194733653`, jobs `121173017040` and `121173017116`.

## 2026-10 — Sunday scan emails fired on checks a quiet week cannot pass

**What went wrong:** Run `40194733653` marked Minnesota, Oregon, Illinois, Pennsylvania, Utah, Arizona, Missouri, and Washington failed after the scrape step had already exited 0. The post-ingest hook required 80% of facility rows to be edited in the last 7 days, and it required `facilities.last_inspection_date` on every published home. Most states do not rewrite facility rows when the source is unchanged, and that date column is blank for every published home except most of Minnesota. Illinois also failed because none of its 30 homes have bed counts. The failure email always said no subscriber alerts were sent, including when the alert step still ran. California, sitting in the middle of the one-at-a-time queue, was cancelled at six hours and delayed the states behind it.

**What worked instead:** Keep California on the Mac job. Judge the GitHub job by whether the scrape finished and whether the checks that state can actually pass succeeded. Print the quiet-week edit count instead of failing on it. Coverage is an inspection row, which every live state already has. Send one email when the scrape stops, and a different email when a real data check fails after a finished scrape.

**Source:** GitHub Actions run `40194733653`; `scripts/validate/post_ingest_check.py`.

## 2026-10 — Sequential California checks held DB transactions during CDSS waits

**What went wrong:** `ccld_citations_ingest.py` checked roughly 662 publishable
homes one at a time, opened a database connection before each network check,
and retried a slow CDSS request up to six times. A routine zero-change pass
could therefore hold an idle transaction for minutes per home and run until
GitHub's six-hour timeout. Cancellation then left `state_scan_runs` and
`scrape_runs` falsely marked `running`.

**What worked instead:** Preload stored report URLs in one query, check facility
indexes with six bounded workers and per-worker HTTP connection reuse, and open
write connections only for newly discovered reports. After twelve consecutive
index failures, stop the outage crawl and return non-zero so the scan is
recorded partial/failed and cannot notify families. Always close the two ledger
rows after externally cancelling a job.

**Source:** GitHub Actions run `40129407306`; `scrapers/ccld_citations_ingest.py`.

## 2026-07 — Local ESLint hangs under Node 24 without producing output

**What went wrong:** Both `npx eslint ...` and direct `node node_modules/eslint/bin/eslint.js ...` remained asleep for more than five minutes with no file handles or diagnostics. Even `eslint --version` hung. This is local-tooling behavior under Node `v24.14.1`, not a reported lint violation.

**What worked instead:** `node node_modules/typescript/lib/tsc.js --noEmit --pretty false` completed successfully (slowly, after ~17 minutes). Python syntax/tests, workflow YAML parsing, and `git diff --check` were run independently. Use the repository CI/runtime Node version for ESLint until the local Node/ESLint hang is resolved.

---

## 2026-07 — Vercel Stripe Price IDs had trailing newlines

**What went wrong:** `STRIPE_PRICE_FACILITY_WATCH_MONTHLY` was stored as `price_…\n` (likely `printf`/`vercel env add`). Stripe rejected Checkout with `No such price: 'price_…\n'`.

**What worked:** Re-add env values with `printf '%s'` (no newline), and trim all Stripe env reads in `src/lib/stripe/server.ts` via `envTrim()`.

**Source:** Facility Watch launch QA after checkout 500s.

---


## 2026-07 — facilities has no state_slug column

**What went wrong:** Paid Facility Watch checkout/webhook/billing queried `facilities.state_slug`. PostgREST returned column does not exist → checkout 404 "Facility not found" with the CTA live.

**What worked:** Derive the URL slug with `stateFromCode(state_code)` from `src/lib/states.ts` (same pattern as watch welcome digests). Do not select `state_slug` from `facilities`.

**Source:** Facility Watch launch QA after PR #60.

---


## 2026-07 — WA full refresh overwrote physical city before Census recompute

**What went wrong:** `wa_geo_directory_ingest.py` updated `facilities.city` from the ArcGIS directory for existing rows but did not update `city_slug` or run the required Census physical-city step. The first State Watch catch-up attempt was stopped after the Geo pass began. The repair script then failed because production was unexpectedly missing migration 0045 (`historical_city_slugs`).

**What worked instead:** Existing WA rows no longer accept `city` from the directory upsert. The weekly WA pipeline runs `recompute_physical_city.py --state WA --apply` immediately after Geo, before publication. Migration 0045 was safely applied before retrying the Census recompute. The recompute now retries transport failures and never caches a timeout as “no Census place”; legacy null cache entries are discarded. Any interrupted state scan is marked failed, so it cannot notify subscribers.

**Source:** `scrapers/wa_geo_directory_ingest.py`, `scrapers/recompute_physical_city.py`, `scripts/weekly_inspection_ingest.py`.

---

## 2026-06 — AZ facility pages returning 500/timeout after deficiency backfill

**What went wrong:** After the 2026-06-22 AZ deficiency backfill, AZ facility pages started returning 500 errors and timing out in Ahrefs (120 hard 500s + 1,100 timeouts). Root cause: each page render called `facility_snapshot` ~60 times (loader called twice with no dedup, plus discovery rails calling it per card for up to 58 facilities) and the backfill made each RPC scan a much larger AZ peer corpus.

**What worked instead:**
1. `React.cache()` on `loadFacilityProfile` to deduplicate the double call
2. Strip RPC from discovery rails — sort by `last_inspection_date` at DB level
3. `maxDuration = 60` on the facility route
4. Migration 0055 snapshot cache columns for future rail grade display

**Do not** call `facility_snapshot` per card in discovery rails. It is O(n) in the number of facilities shown and kills cold ISR performance.



## 2026-06 — AZ deficiency endpoint: Salesforce Aura guest access blocked

**What didn't work:**
1. Guessing Aura controller/method combinations for deficiency details (e.g. `getInspectionDeficiencies`, `getDeficiencies`, `getStatementOfDeficiencies`) — all returned `clientOutOfSync`, which is Salesforce's error for "this Apex action is not exposed to guest users." Not a `fwuid` mismatch.
2. Two browser-agent CDP capture attempts — both hung/were interrupted because the Salesforce Experience Cloud page uses a complex multi-frame setup and the deficiency data is bootstrapped into the initial page render rather than fetched as a discrete subsequent XHR.
3. Fetching `app.js` bundle to grep for Apex descriptors — dynamically loaded controllers aren't in the main bundle.

**What worked instead:** Playwright (headless Chromium) rendering the full page at `/s/inspection-details?inspectionId=&facilityId=`, waiting for `[role='grid']`, and parsing the rendered DOM. The deficiency table is fully rendered in the DOM with `<th>` rule cells and `[role='gridcell']` evidence/POC cells. See `scrapers/az_adhs_inspections_ingest.py --mode deficiencies`.

**Source:** `cursor/az-deficiency-parsing` 2026-06-22.

---

## 2026-06 — Loops Facility Watch welcome: wrong editor + wrong variable syntax

**What didn't work:**
1. Pasting `watch-welcome.html` into Loops's **Styled/block** editor — HTML renders as escaped raw tags.
2. Using `{{double braces}}` — Loops uses **single braces** `{facilityName}` in Plain/Styled/Subject, and `{DATA_VARIABLE:facilityName}` in MJML.
3. Expecting a paste box in the **Code** tab — it wants an **MJML zip upload**, not inline HTML.
4. Naming the MJML `watch-welcome.mjml` inside the zip — Loops requires the file to be named **`index.mjml`** exactly.
5. HTML comments in MJML containing bare `{facilityName}` — Loops parses them as **contact properties** and rejects the upload ("Contact properties are not allowed in transactional emails"). Only `{DATA_VARIABLE:name}` may appear in MJML; setup notes belong in `LOOPS_WATCH_WELCOME_SETUP.md`, not in the uploaded file.

**What worked instead:** Upload `src/lib/email/templates/watch-welcome-loops.zip` containing a single `index.mjml` (copy of `watch-welcome.mjml`) in the Code tab. Subject: `You're watching {facilityName}`. Publish → set `LOOPS_WATCH_WELCOME_ID`. See `LOOPS_WATCH_WELCOME_SETUP.md`.

**Source:** [Loops transactional docs](https://loops.so/docs/transactional/guide), `src/lib/email/templates/`.

---

## 2026-06 — TipTap silently drops the data-stat spans (hub content editor)

**What didn't work:** Planning a TipTap/WYSIWYG editor for `/admin/hub-content`. TipTap parses input HTML through its own schema; a `<span data-stat="facility_count">93</span>` is not a node/mark it knows, so on load it **silently strips the span** (or its attribute), turning a verified number into unverifiable plain text. On a YMYL page that defeats the entire accuracy gate. Making it safe would require a custom mark/node extension that round-trips + locks the data-stat spans — high surface area that fails silently if subtly wrong.

**What worked instead:** An **HTML-source editor + live sanitized preview**. Numbers stay as literal text in the source (impossible to drop), and `verifyHubStats` runs live in the editor and again on save/publish. Zero new deps. If WYSIWYG is ever wanted, the numbers must be render-time tokens resolved from the snapshot (not literal in the editable body), not editable text.

**Source:** `src/app/admin/hub-content/[id]/HubContentEditor.tsx`, `src/lib/content/hubGate.ts`.

---

## 2026-06 — Claude Code on the web can't reach the DB: HTTP-only proxy + disabled legacy keys

**What didn't work:** Reaching Supabase/Postgres from a Claude Code web session. Two distinct blockers, often confused: (1) the sandbox proxies **HTTP/HTTPS only**, so raw Postgres (psycopg / `DATABASE_URL` / psql) over TCP 5432/6543 times out — it can't tunnel the Postgres wire protocol even with "Full" network access. (2) Even over HTTPS (REST/`@supabase/supabase-js`), the env's **legacy `service_role`/anon keys were disabled 2026-05-20** → `401 "Legacy API keys are disabled"`. A *fresh* session opens the HTTPS path (resumed sessions keep the old network policy), but the key must be re-enabled (Supabase dashboard) or replaced with new publishable/secret keys for any live read.

**What worked instead:** Re-enable the keys (owner action), then read live over HTTPS via the supabase-js client. All psycopg scrapers / validators (incl. `hub_content_drift_check.py`) still run only in **GitHub Actions or Cursor**, never the web sandbox. Verify TS/render code here over HTTPS; verify Python by conformance + `py_compile` + unit-testing the pure logic.

**Source:** this session; `docs/` Claude Code on the web notes.

---

## 2026-06 — Claude Code on the web rewrites package-lock.json on every npm install

**What didn't work:** The web SessionStart hook (`.claude/hooks/session-start.sh`) runs `npm install` on each session start/resume. The cloud container's npm (10.9.7) annotates `package-lock.json` differently than whatever npm generated the committed lockfile — it adds `"dev": true` to `sharp`'s optional platform binaries and drops some `"libc"` arrays. ~40 lines of pure metadata churn, no version changes, on every session. The stop hook then nags about uncommitted changes every turn.

**What didn't work either:** `npm install --no-package-lock` keeps the tree clean but re-resolves the whole dependency tree from the registry (~38s) instead of using the lockfile (~4s) — a startup regression. `npm ci` was rejected too: it wipes `node_modules` and reinstalls from scratch each resume (slow, and the setup-hook guidance is to prefer cache-friendly `npm install`).

**What worked instead:** Keep the fast `npm install`, then `git checkout -- package-lock.json` immediately after. The committed lockfile stays byte-for-byte authoritative; the cloud sandbox never authors lockfile changes. **This means real dependency changes must be made in Cursor (or a deliberate task that commits the new lockfile) — the cloud hook will revert any uncommitted lockfile edit on the next resume.** Local Cursor is unaffected: the hook is guarded by `CLAUDE_CODE_REMOTE != "true"` and the lockfile content never changes.

**Source:** `.claude/hooks/session-start.sh`.

---

## 2026-05 — State directory feeds publish USPS mailing city, not physical city

**What didn't work:** Trusting the source feed's `CITY` field from UGRC's Utah ArcGIS facility layer. USPS assigns every SLC-metro suburb (Taylorsville, Murray, West Jordan, Holladay, etc.) to "Salt Lake City" for mail routing. Six months of Utah pages had wrong city slugs in the URL, breadcrumb, JSON-LD, and page copy.

**What worked instead:** Re-derive physical city from lat/lon via the Census Geocoder **after** geocoding, **before** `recompute_publishable.py`. Run `scrapers/recompute_physical_city.py --state XX --apply`. This pattern applies to TX (CCAD), MN (MDH), and IL (IDPH) too — they all inherit USPS conventions for metro suburbs. Prior slugs are stored in `historical_city_slugs[]` for 301 redirects.

**Do not:** Set `facility.city` from a directory CSV without running `recompute_physical_city.py`. Do not use a render-time override to patch the display name while leaving the slug wrong — URL/JSON-LD/page text must all agree on a YMYL directory.

---

## 2026-05 — `inspections.source_agency` was populated at ingest but SELECT ignored it

**What didn't work:** Using `cfg.agencyShort` for every inspection row in the UI. Utah facility profiles mix CMS nursing-home inspections (`source_agency = 'CMS'`, F-tags) with state ALF inspections (`source_agency = 'UT-CCL'`, R432 codes). Every CMS row showed "DLBC citations" and "View official DLBC report" linking to medicare.gov.

**What worked instead:** Add `source_agency` to the `fetchInspectionsAndDeficiencies` SELECT and `InspectionRow` type; call `agencyLabelForInspection(insp, cfg)` at every UI touch-point. See `src/lib/states/profileConfig.ts`.

---

## 2026-05 — UT facility detail endpoint: no stable URL found

**What didn't work:** Direct GET on `provider.dlbc.utah.gov/ccl/facilities/<id>`, `/ccl/facility/<id>`, `/ccl/facilities/<id>/inspections`, `/ccl/facilities/<id>/compliance`. All redirect or 404. Also probed `cclapi.dlbc.utah.gov/api/public/...` — no documented detail-by-id route surfaced.

**What worked instead (partial):** The facility list page exposes data only via the search form + row click handler. Inspection detail still requires a session-bound click flow, not a stable URL.

**Status:** UT inspection ingest is **WIP**. See `scrapers/_ut_detail_probe.py` for the failed direct-endpoint attempts and current state of the click-driven approach. Do not assume UT works the same way OR does (CSV exports + stable IDs).

---

## 2026-05 — Warning-flag signal misclassification → 116 false positives

**What didn't work:** Wiring `unendorsed_mc_violation` (facility names containing "Memory Care" without endorsement) as a Tier-1 signal in `recompute_publishable.py`. Caused 116 unendorsed OR facilities to publish.

**What worked instead:** `*_violation` flags are read-only editorial context for the profile page only. Never factor them into `serves_memory_care` or `publishable`. Tier-1 promotion requires an actual government credential (endorsement, certification, contract).

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #7. Now codified in `MEMORY.md`.

---

## 2026-05 — OR ingest INSERT column-name mismatches

**What didn't work:** Initial OR ingest scripts referenced columns that don't exist:

| Script used | Actual column |
|---|---|
| `regulation_code` | `code` |
| `is_relicensure` | (doesn't exist — use `inspection_type` text) |
| `is_followup` | (doesn't exist — use `inspection_type` text) |
| `deficiency_count` | `total_deficiency_count` |

**What worked instead:** Add a "DB column map" section to every state brief that maps **source CSV columns → actual `facilities` / `inspections` / `deficiencies` columns**. Verify against `supabase/migrations/0001_init.sql` and the state-specific migration before writing any SQL.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #2.

---

## 2026-05 — psycopg "aborted transaction" cascade

**What didn't work:** A failed `cur.execute()` inside a `with conn:` block puts the connection in an aborted state. Every subsequent execute — including the fallback — fails with `current transaction is aborted, commands ignored until end of transaction block`. One bad row silently kills the rest of the batch.

**What worked instead:** Wrap each row's writes in:

```python
cur.execute("SAVEPOINT sp")
try:
    # … row inserts …
    cur.execute("RELEASE SAVEPOINT sp")
except Exception:
    cur.execute("ROLLBACK TO SAVEPOINT sp")
```

All OR ingest scripts use this pattern. Copy it verbatim into new state scripts.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #4.

---

## 2026-05 — Per-row facility lookups don't scale past a few thousand rows

**What didn't work:** OR violations ingest (46k rows) doing per-row `SELECT id FROM facilities WHERE external_id = %s`. At ~150 ms / query × 46k rows ≈ **2 hours just for lookups**.

**What worked instead:** Pre-load the full `{external_id: uuid}` map once at the start of the script:

```python
cur.execute("SELECT external_id, id FROM facilities WHERE state_code = 'OR' AND external_id IS NOT NULL")
fac_map = {row[0]: str(row[1]) for row in cur.fetchall()}
```

Apply to any script resolving facility IDs in a loop > ~1k rows.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #5.

---

## 2026-05 — Violations silently skipped 100% of rows because inspections hadn't run

**What didn't work:** Running `or_violations_ingest.py` before `or_inspections_ingest.py`. `deficiencies.inspection_id` is `NOT NULL`. Every violation row hit the `skip_insp` counter — **no exception raised, no failure surfaced**. The script reported "completed" with 0 inserts.

**What worked instead:** Hard sequencing: inspections must complete before violations / regulatory actions. Scripts should assert non-zero inserts before reporting success ("Fail loud" — `CLAUDE.md` Rule 12).

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #3.

---

## 2026-05 — Python `print()` is invisible for 20+ min in overnight piped runs

**What didn't work:** `python3 script.py | tee logs/ingest/run.log`. `print()` block-buffers (4 KB) when piped. Progress lines don't appear in the log until the buffer flushes — usually only on process exit. Made overnight runs look stuck.

**What worked instead:**
- `python3 -u script.py | tee …` (forces unbuffered output), or
- `print("...", flush=True)` on every progress line.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #8.

---

## 2026-05 — CMS NF directory ingest creates orphan rows (open)

**What didn't work (still open):** `cms_nh_directory_ingest.py` creates a brand-new facility row when it can't match an existing row by CMS CCN. OR's providers CSV doesn't include CCNs → all 128 OR nursing homes in the CMS dataset became orphan rows (`license_type=NULL`, all-caps names, no state license number). The 197 OR NF rows from the state providers CSV ended up with no CMS star ratings linked.

**What partially works (mitigation):** Orphan rows are not publishable, so no user-visible harm. But CMS quality data isn't surfaced on the state-licensed NF rows either.

**Fix pending:** One-time name + address fuzzy-match pass to merge CMS rows into state-licensed NF rows and copy over `cms_ccn` + `cms_overall_rating`. Must complete before surfacing NF quality on profile pages.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` ("CMS deduplication gap").

---

## 2026-05 — Inspections query silently truncated → 0 citations on facility list pages

**What didn't work:** Querying `inspections` with `.in("facility_id", ids)` and no `.limit()`. PostgREST's default row cap (typically 1000) silently truncated results. For CA's `/california/facilities` page, up to 2000 facility IDs were passed — producing a massive URL **and** only returning the first ~1000 of tens of thousands of CA inspections. Facilities beyond that slice (including Opal Care, CA's most-cited facility) showed 0 inspections / 0 citations on every list page.

The deficiencies query in the same page already had the correct pattern (chunked by 150 + `.limit(5000)`) — it was never applied upstream to inspections.

**What worked instead:** Chunk `.in("facility_id", ids)` exactly like deficiencies: 150 IDs per chunk, `.limit(5000)` per chunk. Apply to every page/helper that fetches inspections for multiple facilities:
- `src/app/[state]/facilities/page.tsx` (critical — state-scoped, up to 2000 facilities)
- `src/app/[state]/[city]/page.tsx` (city + county hubs, 3 separate inspections queries)
- `src/lib/regionsHubCount.ts` (SERP snippet data in `generateMetadata`)
- `src/app/api/facilities/[state]/route.ts` (public JSON API)

**Rule:** Any `supabase.from("inspections").select(…).in("facility_id", ids)` call without a `.limit()` is a latent truncation bug. Every such query must be chunked + limited.

## 2026-06 — MO ShowMeLTC crawl died repeatedly on a single transient error

**What didn't work:** Running the statewide `mo_sod_ingest.py crawl --from-db` (hours-long Playwright crawl) three ways that each lost all progress:
1. `nohup python … &` backgrounded from the agent shell — the job was **orphaned/killed** when the launching shell exited; it never got past the first city.
2. Harness-managed background, but with a **second Playwright crawl running concurrently** (a bounded test). Tearing down the test crawl killed shared browser processes → `write EPIPE` in Playwright's `PipeTransport.send`, killing the live run.
3. Single clean run, but the per-city loop had **no exception handling**: a transient `Page.goto: net::ERR_ABORTED` on the portal (a network hiccup ~18 cities / 318 PDFs in) threw uncaught and ended the whole crawl. Because the pipeline was a `crawl && ocr && load` chain, OCR/load never ran.

**What worked instead:**
- Launch long jobs via the **harness-managed background** (`block_until_ms: 0`), never `nohup … &` from the agent shell.
- **Never run two Playwright crawls at once** — tearing one down can kill the other's browser (EPIPE).
- Make the crawl **resilient per city**: extracted `_crawl_one_city()`, wrapped each city in a try/except that rebuilds the browser (handles both EPIPE browser-death and ERR_ABORTED) and retries once, then moves on. The crawl is **resumable** via the manifest (`(facility_name, inspection_date)` pairs), so completed facilities are skipped and any skipped city is recovered on a later pass.

**Source:** `scrapers/mo_sod_ingest.py` (`_crawl_one_city`, `crawl`); MEMORY.md "Missouri inspector narratives".

---

## 2026-10 — CDSS report indexes are zero-based and indexed URLs are unstable

**What didn't work:** Iterating `range(1, COUNT + 1)` skipped the first real
report and requested one nonexistent terminal index for every facility.
Treating `FacilityReports?facNum=X&inx=N` as report identity also missed reports
when CDSS arrays shrank or reordered. A statewide routine scan then spent over
30 minutes retrying hundreds of index/detail requests and still covered only
110 of 662 facilities.

**What worked instead:** Mirror the official client contract and enumerate
`REPORTARRAY` from zero. Use the Lotus document ID in `REPORTPAGE` as stable
identity, send the official client headers, and use the statewide bulk CSV as
the routine change detector. Persist only fully reconciled facility snapshots;
retry incomplete facilities on the next pass.

**Source:** `scrapers/ccld_citations_ingest.py`,
`scripts/test_ccld_citations_ingest.py`.

## 2026-10 — GitHub-hosted retries cannot reach CDSS

**What didn't work:** Re-running the California report crawl from GitHub
Actions. Four bounded probes to the same facility index all timed out, while
the identical request from this Mac returned a report list. More hosted
retries just repeated the outage and could not build the missing baselines.

**What worked instead:** Run regulator requests from the Mac. Keep the
statewide CSV as the fast check, and only deep-check facilities whose
snapshot is missing or changed, plus the two homes absent from the bulk file.

**Source:** `scripts/run_ca_watch_local.sh`,
`scrapers/ccld_citations_ingest.py`.

---

<!-- New entries go above this line. Format:

## YYYY-MM — Short title

**What didn't work:** …

**What worked instead:** …

**Source:** file / doc / commit reference

-->
