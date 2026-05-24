# Texas (HHSC) — data discovery notes

Private research doc for Phase 5 ingest. **Do not treat URLs below as API contracts** — verify before production scrapers.

## Regulator

- **HHSC** — Texas Health & Human Services Commission  
- **LTCR** — Long-Term Care Regulation (licensing / inspections for assisted living and related settings)

## Facility taxonomy (memory-care relevant)

- Texas Assisted Living Facility (ALF) license types **Type A / Type B / Type C** describe **facility capability**, not deficiency severity (do not confuse with California Type-A / Type-B *deficiency* labels).
- **Alzheimer Certification** — endorsement relevant for dementia-capable programming; use roster flags when published.

## Discovery checklist

1. Provider search / roster export — enumerate licensed ALFs by county with certification flags.
2. Inspection / survey reports — HTML vs PDF; determine stable URL patterns and whether bulk PIA export is cheaper than scrape.
3. Deficiency taxonomy — map HHSC categories into StarlynnCare `severity` ordinal + `state_severity_raw` verbatim string ([`0014_tx_scaffold_columns.sql`](../supabase/migrations/0014_tx_scaffold_columns.sql)).
4. Rate limits & robots.txt — record crawl delay before automation.
5. Public Information Act — optional bulk historical pull if portal lacks machine-readable history.

## Repo scaffolding

- Nullable TX columns on `facilities` / `state_severity_raw` on `deficiencies`.
- Seed counties in [`src/lib/regions.ts`](../src/lib/regions.ts) — hubs **404 until publishable rows exist** (thin-page guard).

## Roster / directory (Phase 1 — implemented)

- **HHSC ALF directory Excel** (active license export) — ingested by [`scrapers/tx_alf_ingest.py`](../scrapers/tx_alf_ingest.py). Join keys: `License No` → `facilities.license_number` (6-digit, zero-padded), `Facility ID` → `facilities.tx_facility_id` ([`0015_tx_alf_directory_columns.sql`](../supabase/migrations/0015_tx_alf_directory_columns.sql)).
- **Alzheimer columns** in the export: treat **non-expired** `Alzheimer Expiration Date` + present cert number as `tx_alzheimer_certified` / `serves_memory_care` (ground truth, not name-regex).

## TULIP (Long-Term Care provider portal)

- **Base:** `https://tulip.hhs.texas.gov/TULIP/` — Salesforce *Experience Cloud* / Lightning community (UI, not a stable public API contract).
- **Example provider detail URL pattern:** `…/TULIP/s/ltc-provider-detail?c__accountidparam=<18-char Salesforce Account Id>`  
  The `c__accountidparam` is **not** the same as the 6-digit `License No` or 6–7 character zero-padded `Facility ID` in the directory export. Phase 2 must map **License No** or `tx_facility_id` → Account Id via the **provider search** experience (`/TULIP/s/ltc-provider-search` or equivalent) and network panel (search XHR / `aura` `Apex` calls). **Verify in browser DevTools** before automating; do not hard-code Account Ids.
- **robots.txt (2026-05-04):** `User-agent: *` / `Allow: /` for the host; sitemaps listed including `https://tulip.hhs.texas.gov/TULIP/s/sitemap.xml`. **Be polite:** ≤1 req/s, identify via `User-Agent` with contact email, respect WAF / session behavior.
- **Sitemap:** large; automated fetch of the full XML may time out from serverless environments — use `curl` / local download when building a URL inventory.

## Public reports & open data (inspections)

- **LTCR** publishes various **inspection, investigation, and provider performance** materials over time (formats and portals move). Before scraping at scale: check HHSC “Reports”, “Facilities”, and Texas Open Data for **ALF / assisted living** datasets with inspection counts or survey IDs.
- If no machine-readable bulk history is available (or join keys are unstable), use the Texas **Public Information Act** template in [`docs/TX_PIA_REQUEST_DRAFT.md`](./TX_PIA_REQUEST_DRAFT.md) for a CSV/Excel extract keyed to license number.

## Bulk PIA inputs (2026-05 fulfilment)

HHSC LTCR Records Management responded to the bulk PIA request with **two Excel files** covering 2020-05-06 through 2026-05-06 (per their retention policy). **Neither file contains inspector-narrative text** — narratives must be requested per-event in a follow-up records request.

**Contact for narrative follow-ups:**

- Email: `RSLTCR.RecordsMgmt@hhs.texas.gov`
- Fax: `512-438-2738`
- Mail: HHSC — Regulatory Services — LTC — Regulatory · Records Management — MC: E-349 · PO Box 149030, Austin TX 78714-9030

**Constraints from the response email:**

- Records requests >100 pages incur a charge.
- Investigations within the last 45 days are unavailable while processing completes.

### File 1 — FVH (Facility Visit History)

`FVH_AllALFs_<startdate>_<enddate>.xlsx` (~2.5 MB at 6-year window). Columns:

```
CARES Region, ABBREV, STATEID, NAME, Address, City, Zip,
EVENTID, EntranceDate, EXIT_DATE, VisitType, VisitSequence,
FullBook, FullBookType, Investigation, InfectionControl,
SurveyLocation, StateViolations
```

Key fields:

- **STATEID** — HHSC internal facility ID (`tx_facility_id`); 6-digit when zero-padded. Join key.
- **EVENTID** — opaque 6-character survey identifier. Use this + `EXIT_DATE` to request narratives.
- **VisitType** — `Health` or `LSC` (Life Safety Code).
- **Investigation** — `Yes` when the visit was complaint/incident-driven (these get `is_complaint = true` in the bundle).
- **StateViolations** — coded string like `P-0031 s/s: 0; P-2554 s/s: F` — rule code (`P-XXXX`) plus CMS scope/severity letter (`A`–`L`, or `0` for no finding). Parsed by [`scrapers/tx_pia_to_bundle.py`](../scrapers/tx_pia_to_bundle.py) `parse_state_violations()`. Letters `J/K/L` → `immediate_jeopardy = true`. Letter `A` and `0` are excluded by the narrative request batcher's default severity floor (`B`).

### File 2 — IntakeHistory (Complaints + Incidents)

`IntakeHistory_AllALFs_<startdate>_<enddate>.xlsx` (~5.4 MB at 6-year window). Columns:

```
Facility ID, Agency/Facility, Program Type, Agency/Facility Address,
RS Case No., Case Type, Priority, Date Received,
Date/Time Sent to Region, Status, Allegation, Findings
```

Key fields:

- **Facility ID** — same `tx_facility_id` as FVH `STATEID`. Join key.
- **RS Case No.** — opaque 6–7 digit complaint identifier. Use this to request narratives.
- **Case Type** — `Complaint` (~70%) or `Incident` (~30%).
- **Findings** — `UNSUBSTANTIATED` (88%), `SUBSTANTIATED AND CITED` (~6%), `SUBSTANTIATED BUT NOT CITED` (~6%), plus tiny tail (`WITHDRAWN`, `REFERRED TO DFPS`). Bundle synthesizes a deficiency row only for `SUBSTANTIATED AND CITED`. Both substantiated variants count toward the narrative-request universe by default.
- **Allegation** — high-level category like `RESIDENT/PATIENT/CLIENT NEGLECT`. Stored verbatim in `deficiencies.category`.
- HHSC sometimes lists one complaint twice when it has multiple allegation categories — [`scrapers/tx_narrative_request_batch.py`](../scrapers/tx_narrative_request_batch.py) deduplicates by `(license, RS Case No.)` before generating request batches.

### Two-step ingest workflow

1. **Generate roster lookup** (one-time, before first parse):
    ```bash
    python3 scrapers/tx_export_facility_lookup.py
    # writes scrapers/data/tx_facility_lookup.csv (gitignored)
    ```
2. **Parse the bulk files into a bundle:**
    ```bash
    python3 scrapers/tx_pia_to_bundle.py \
      --input .firecrawl/tx-pia/2026-05-bulk/FVH_AllALFs_<dates>.xlsx \
      --input .firecrawl/tx-pia/2026-05-bulk/IntakeHistory_AllALFs_<dates>.xlsx \
      --output .firecrawl/tx-pia/2026-05-bulk/bundle.json
    ```
   The parser auto-detects sheet shape (FVH / IntakeHistory / legacy TULIP-style) and dispatches to the right processor.

3. **Generate narrative request batches** (memory-care subset only by default):
    ```bash
    python3 scrapers/tx_narrative_request_batch.py \
      --bundle .firecrawl/tx-pia/2026-05-bulk/bundle.json \
      --out-dir out/tx-narrative-requests/
    ```
   Defaults: `--memory-care-only` (Alzheimer-cert subset), `--severity-min B`, `--batch-size 25`. Outputs per-batch CSV (audit trail) plus an email body ready to paste into a reply to `RSLTCR.RecordsMgmt@hhs.texas.gov`.

4. **Smoke test before the full ask:**
    ```bash
    python3 scrapers/tx_narrative_request_batch.py \
      --license <one-license> --batch-size 8 \
      --out-dir out/tx-narrative-requests/smoke/
    ```
   Send that single batch first. Calibrate `--est-pages-per-event` based on the actual page count Texas returns, then run the full batch generation.

5. **(Future) When narratives arrive:** a separate merger script will join per-`EVENTID` / per-`RS Case No.` narrative responses onto the bundle's deficiency rows, then `tx_inspections_ingest.py --import-json` ingests into Supabase.

### Reference numbers (2026-05 delivery, six-year window)

After matching against the metro-filtered roster (1,389 facilities) and the Alzheimer-certified subset (515):

| Metric | All metros | Alz-cert (memory care) |
|---|---:|---:|
| Bundle facilities (any event) | 1,375 | 512 |
| Inspection events (visits) | ~15,800 | ~1,350 |
| Inspections with B+ violations | ~4,300 | 484 |
| Complaint events | ~53,900 | ~40,600 |
| Substantiated complaints (any) | — | 4,439 raw / 3,562 deduped |
| Narrative-request universe (default filters) | — | 4,046 events / ~162 batches |

## Phase 2 scraper architecture (sketch)

1. **Join:** `(state_code, license_number)` or `tx_facility_id` → TULIP Account Id (one-time resolution table or cache in Postgres optional).
2. **Fetch:** inspection index JSON/HTML/PDF links → normalize into `inspections` (`source_url`, `inspection_date`, `raw_data`).
3. **Parse:** deficiency rows → `deficiencies` with `state_severity_raw` verbatim + mapped `severity` / flags.
4. **Publish gate:** separate TX rule module; flip `publishable` only after editorial agrees inspection coverage is sufficient.

**Ingest (Phase 2 — implemented):** [`scrapers/tx_inspections_ingest.py`](../scrapers/tx_inspections_ingest.py) loads **`format_version: 1` JSON bundles** (import-json / `--smoke` fixture) into `inspections` + `deficiencies` with `source_agency = 'TX HHSC LTCR'`, `raw_data` jsonb, verbatim `state_severity_raw`, and (for complaint events) `inspections.incident_date` distinct from `inspection_date`. Run `recompute_publishable.py --state TX` after ingest. **Publish gate:** 48 months of inspection freshness (see `TX_PUBLISH_GATE_MONTHS` in [`scrapers/recompute_publishable.py`](../scrapers/recompute_publishable.py)) — bumped from 36 after first TULIP smoke captures showed shallow history.

### Two parallel ingest paths

| Source | Parser | Throughput | When to use |
|---|---|---|---|
| **TULIP** (manual DevTools capture) | [`scrapers/tx_tulip_to_bundle.py`](../scrapers/tx_tulip_to_bundle.py) | ~10–50 facilities / session | Spot-checks, urgent additions, validating a single license. |
| **HHSC PIA** (CSV / XLSX) | [`scrapers/tx_pia_to_bundle.py`](../scrapers/tx_pia_to_bundle.py) | All 515 Alzheimer-certified ALFs in one fulfilment | Bulk coverage; this is the primary scaling path. See [`docs/TX_PIA_REQUEST_DRAFT.md`](./TX_PIA_REQUEST_DRAFT.md). |

Both parsers emit the same `format_version: 1` bundle, so the ingest, publish gate, and editorial enrichment chain are unchanged regardless of source.

## Phase 2 — TULIP smoke & scrape feasibility (2026)

**Agent / curl smoke (no authenticated browser automation in-repo):**

1. **Shell HTML:** `GET /TULIP/s/ltc-provider-search` returns Experience Cloud bootstrap (`aura_prod.js`, Lightning Out). Structured provider rows are **not** present in the initial HTML — they load after client-side search.
2. **reCAPTCHA:** The search experience includes **Google reCAPTCHA v2** in page scripts. Unattended server `curl` cannot complete interactive challenges; **naive server-only scraping is blocked (RED) for search** without a real browser session and token.
3. **Aura / JSON:** Inspection content is expected under Salesforce **Aura** `POST` calls (e.g. `…/s/sfsites/aura` with `message` payloads). These require session cookies + captured bodies from DevTools / Playwright — not reproducible from static curl alone.

### Sample shapes (illustrative — redact tokens)

**Search (conceptual Aura envelope)** — actual action descriptors vary by release:

```json
{
  "message": {
    "actions": [
      {
        "id": "123;a",
        "descriptor": "aura://…",
        "params": { "licenseNumber": "307194" }
      }
    ]
  }
}
```

**Detail tab response (excerpt)** — structure depends on Apex controller; preserve **verbatim** in `raw_data`:

```json
{
  "event": {
    "status": 200,
    "returnValue": {
      "surveys": [{ "surveyDate": "2024-06-01", "surveyType": "Annual", "findings": [] }]
    }
  }
}
```

### Feasibility verdict: **GREEN (interactive) / YELLOW (unattended)**

- **Interactive (browser) path is GREEN.** TULIP's "Inspections" tab calls `…/TULIP/s/sfsites/aura?aura.ApexAction.execute=1` and returns a clean JSON array of violations (real, parseable, no obfuscation). Captured smoke for `license=148715`, `accountId=001cv00000RpEjOAAV` lives in [`.firecrawl/tulip-smoke/148715.json`](../.firecrawl/tulip-smoke/148715.json) (gitignored at scale; one example committed for shape documentation).
- **Unattended path remains YELLOW.** reCAPTCHA v2 + Salesforce session cookies block server-only `curl`. Scaling to all 515 Alzheimer-certified TX rows needs either:
  - **Manual DevTools capture** (sustainable for 10–50 facilities; one envelope per `license_number` saved under `.firecrawl/tulip-smoke/`), then [`scrapers/tx_tulip_to_bundle.py`](../scrapers/tx_tulip_to_bundle.py) → `--import-json`, **or**
  - **Playwright runner** with stored session + captured Aura payload (template), **or**
  - **HHSC Public Information Act** request ([`docs/TX_PIA_REQUEST_DRAFT.md`](./TX_PIA_REQUEST_DRAFT.md)) for bulk historical CSV.

### Observed Aura row shape (TULIP "Inspections" tab)

```jsonc
// actions[0].returnValue.returnValue is an array of these:
{
  "correctedDate": "3/6/2020",                  // M/D/YYYY → deficiencies.corrected_date
  "exitDate": "2/7/2020",                       // M/D/YYYY → inspections.inspection_date + deficiencies.cited_date
  "mostRecentExitDate": "February 16, 2023",    // header echo (may differ from per-row exitDate)
  "stateViolationCited": "The facility failed to ensure …",  // → deficiencies.description / inspector_narrative
  "visitType": "Life Safty Code"                // verbatim (note HHSC's typo) → state_severity_raw
}
```

**No** citation code is exposed by TULIP for ALFs — `tx_inspections_ingest.py` synthesizes a stable `__tx_<sha1>` key for dedupe. **No** severity ordinal is exposed (TX ALF inspection findings are narrative-only); `severity` stays NULL and the editorial layer surfaces narratives directly.

### Capture workflow (per facility)

1. Open `https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-search`, solve reCAPTCHA, search by **License No**, click facility → Inspections tab. Note the `c__accountidparam` from the URL.
2. Chrome **DevTools → Network → filter `ApexAction`** before clicking the tab. Refresh if the only Apex calls are from the prior tab.
3. Right-click the `aura?…ApexAction.execute=1` row → **Copy → Copy response**. Save raw response into `.firecrawl/tulip-smoke/<license>.json` wrapped in this envelope:

```jsonc
{
  "license_number": "148715",
  "account_id": "001cv00000RpEjOAAV",
  "source_url": "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-detail?c__accountidparam=001cv00000RpEjOAAV",
  "captured_at": "2026-05-04",
  "aura": { /* paste verbatim Aura response */ }
}
```

4. Run [`scrapers/tx_tulip_to_bundle.py --capture-dir .firecrawl/tulip-smoke/ --output .firecrawl/tulip-smoke/bundle.json`](../scrapers/tx_tulip_to_bundle.py).
5. Run `python3 scrapers/tx_inspections_ingest.py --import-json .firecrawl/tulip-smoke/bundle.json`.
6. Run `python3 scrapers/recompute_publishable.py --state TX`.

### Synthesized "clean visit" rows

The page header reports a **most-recent comprehensive inspection date** even when that visit had **0 violations** (no rows in the Aura array). The bundle parser synthesizes a zero-deficiency `inspections` row for that date so the publish gate sees the recent visit. Marker: `raw_data.synthesized_from = "mostRecentExitDate header"`.

## Companion / legacy script

[`scrapers/tx_research_snapshot.py`](../scrapers/tx_research_snapshot.py) — early placeholder; **roster path** supersedes with `tx_alf_ingest.py` above.
