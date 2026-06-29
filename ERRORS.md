# ERRORS.md — Failure log

Append-only log of approaches that didn't work and what worked instead. Check this before suggesting an approach to a similar task. Newest at the top.

Format per entry: **what went wrong**, what worked instead, source.

The OR pipeline learnings doc (`docs/OR_PIPELINE_LEARNINGS.md`) is the canonical long-form version of items 1–6. Entries here are the short, searchable version.

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

<!-- New entries go above this line. Format:

## YYYY-MM — Short title

**What didn't work:** …

**What worked instead:** …

**Source:** file / doc / commit reference

-->
