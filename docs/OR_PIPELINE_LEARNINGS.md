# Oregon Pipeline Learnings
_Completed May 16–17, 2026. Reference this before writing the next state's research brief._

---

## What we built

Full-universe OR ingest pipeline: 4,641 facilities from ltclicensing.oregon.gov CSV exports,
13,215 state inspections, 12,970 deficiencies, plus CMS NF overlay and 7 signal scrapers.

Final result: **131 publishable memory care facilities** (MCE-endorsed, licensed, inspected within
36 months).

---

## Process learnings

### 1. Get the actual CSV before writing a line of code

OR's web UI hid the Memory Care boolean and address fields (City, Zip, County). The initial brief
assumed MCE status would require a portal cross-reference scrape. It was a single column in the
Providers CSV. If we had inspected the real export headers first, the brief would have been
correct on day one and none of the column-name bugs would have happened.

**Rule for next state:** Download a 5-row sample export and paste the raw headers into the brief
before any schema or script planning. Don't trust the web UI column list.

### 2. Schema validation before scripting

Every OR INSERT initially referenced columns that don't exist:

| Script used | Actual column |
|---|---|
| `regulation_code` | `code` |
| `is_relicensure` | (doesn't exist — use `inspection_type` text) |
| `is_followup` | (doesn't exist — use `inspection_type` text) |
| `deficiency_count` | `total_deficiency_count` |

Add a "DB column map" section to every state brief that explicitly maps
source CSV columns → actual `facilities` / `inspections` / `deficiencies` column names.
Verify against `0001_init.sql` and the state migration before writing SQL.

### 3. Script ordering is a hard FK dependency

`deficiencies.inspection_id` is `NOT NULL`. Violations and regulatory actions must run
**after** inspections. If inspections fail, violations silently skip every row (`skip_insp`
counter increments, no error — easy to miss).

The brief should call out the sequencing constraint explicitly, not leave it implicit in
script comments.

### 4. psycopg transaction handling requires savepoints

A failed `cur.execute()` inside a `with conn:` block puts the connection in an aborted state.
Every subsequent execute — including the fallback — gets
`current transaction is aborted, commands ignored until end of transaction block`.

Fix: wrap each row's operations in `SAVEPOINT sp / ROLLBACK TO SAVEPOINT sp / RELEASE SAVEPOINT sp`.
All OR ingest scripts now use this pattern. Copy it verbatim to next-state scripts.

### 5. Pre-load facility maps for multi-row scripts

The violations ingest (46k rows) originally did a per-row
`SELECT id FROM facilities WHERE external_id = %s`. At ~150ms/query × 46k = ~2 hours just
for lookups.

Fix: load the full `{external_id: uuid}` dict once at the start:
```python
cur.execute("SELECT external_id, id FROM facilities WHERE state_code = 'OR' AND external_id IS NOT NULL")
fac_map = {row[0]: str(row[1]) for row in cur.fetchall()}
```
Apply this pattern to any script that resolves facility IDs in a loop.

### 6. `mc_review_status` is NOT NULL — set a default for every row

The facilities table requires a non-null `mc_review_status`. Non-MCE facilities need a value
too. Use `auto_published` as the universal default (the actual publishable gate is
`serves_memory_care`, not this field — it only blocks on `reviewed_reject`).

### 7. Warning flags must not set `serves_memory_care = true`

`unendorsed_mc_violation` (facilities using "Memory Care" in their name without endorsement)
was initially wired as a Tier-1 signal in `recompute_publishable.py`. This caused 116
non-endorsed facilities to be published. It's an editorial warning flag — it should never
promote a facility.

**Standing rule:** Any `*_violation` or statute-violation editorial flag is read-only context
for the profile page. It never sets `serves_memory_care`.

### 8. Python stdout buffering hides progress in overnight runs

When Python runs piped to `tee`, `print()` output is block-buffered (4 KB). Progress lines
don't appear in the log until the buffer flushes on process exit. This makes it look like
nothing is happening for 20+ minutes on large CSV steps.

Add `python3 -u` flag in the overnight script, or add `flush=True` to key progress prints.

---

## CMS deduplication gap

The CMS NF ingest (`cms_nh_directory_ingest.py`) creates **new facility rows** when it can't
match an existing row by CCN. OR's providers CSV doesn't include CMS CCNs, so all 128 OR
nursing homes in CMS data became orphan rows (`license_type=NULL`, all-caps names, no state
license number).

This means:
- The 197 OR NF rows from the providers CSV have no CMS star ratings linked
- 128 duplicate CMS-only rows exist in the DB, not publishable, not harmful but wasteful

**Fix needed before surfacing NF quality data:** a one-time name+address fuzzy-match pass to
merge CMS rows into state-licensed NF rows and copy over `cms_ccn` + `cms_overall_rating`.
See `docs/NEW_STATE_PLAYBOOK.md` for the CMS merge strategy.

---

## Research brief template additions

For whichever state comes next, the brief must answer these before any code is written:

| Question | OR answer | Next state |
|---|---|---|
| Memory care signal source | Providers CSV, single boolean column | TBD |
| Bulk CSV exports available? | Yes — POST + CSRF token | TBD |
| Inspection CSV has PDF URLs? | No | TBD |
| Violations linked to inspections in CSV? | No — separate CSV, date-match only | TBD |
| Civil penalties / regulatory actions published? | Yes — separate CSV | TBD |
| CMS CCN in state export? | No | TBD |
| State freshness gate (months) | 36 | TBD |
| `mc_review_status` default | `auto_published` for all | TBD |

---

## State selection notes

**Minnesota** — fastest path to a second live state. `mn_dementia_care_licensed` column already
exists in the DB and MN is already in `_FRESHNESS_MONTHS` (48 months). Schema work is largely
done. See `docs/MN_DATA_SOURCES.md` for existing source research.

**Arizona** — next high-value market. ADHS issues a formal Memory Care endorsement as part of
the ALF license (not just a CSV boolean — it's a distinct license type). Phoenix/Scottsdale
density is significant. No existing DB scaffolding.

**Utah** — smaller market, less structured inspection publication, more manual scraping likely
required. Lower priority.
