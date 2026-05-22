# ERRORS.md — Failure log

Append-only log of approaches that didn't work and what worked instead. Check this before suggesting an approach to a similar task. Newest at the top.

Format per entry: **what went wrong**, what worked instead, source.

The OR pipeline learnings doc (`docs/OR_PIPELINE_LEARNINGS.md`) is the canonical long-form version of items 1–6. Entries here are the short, searchable version.

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
