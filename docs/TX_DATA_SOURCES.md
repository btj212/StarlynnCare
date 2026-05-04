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

## Phase 2 scraper architecture (sketch)

1. **Join:** `(state_code, license_number)` or `tx_facility_id` → TULIP Account Id (one-time resolution table or cache in Postgres optional).
2. **Fetch:** inspection index JSON/HTML/PDF links → normalize into `inspections` (`source_url`, `inspection_date`, `raw_data`).
3. **Parse:** deficiency rows → `deficiencies` with `state_severity_raw` verbatim + mapped `severity` / flags.
4. **Publish gate:** separate TX rule module; flip `publishable` only after editorial agrees inspection coverage is sufficient.

**Ingest (Phase 2 — implemented):** [`scrapers/tx_inspections_ingest.py`](../scrapers/tx_inspections_ingest.py) loads **`format_version: 1` JSON bundles** (import-json / `--smoke` fixture) into `inspections` + `deficiencies` with `source_agency = 'TX HHSC LTCR'`, `raw_data` jsonb, and verbatim `state_severity_raw`. Run `recompute_publishable.py --state TX` after ingest for the 36-month publish gate.

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

### Feasibility verdict: **YELLOW**

- **GREEN criteria not met:** no unattended JSON replay without browser + captcha clearance on search.
- **Not RED for product:** JSON **is** obtainable interactively; ingestion can proceed via **`--import-json` bundles** captured from DevTools / Playwright exports or HHSC PIA bulk files.
- **Chosen path:** Phase 2 ships **import-json ingest + TX publish gate**; optional later Playwright runner posts Aura payloads using captured templates.

### HTTP reproduction notes

Use **browser DevTools → Network** while solving CAPTCHA manually once per session; export **Fetch as cURL** for the Aura POST and store redacted copies under `.firecrawl/tulip-smoke/` (gitignored). Keep **`User-Agent`** + contact email per [`scrapers/ccld_rcfe_ingest.py`](../scrapers/ccld_rcfe_ingest.py) politeness defaults.

## Companion / legacy script

[`scrapers/tx_research_snapshot.py`](../scrapers/tx_research_snapshot.py) — early placeholder; **roster path** supersedes with `tx_alf_ingest.py` above.
