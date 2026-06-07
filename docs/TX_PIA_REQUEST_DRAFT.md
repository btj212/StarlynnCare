# Texas Public Information Act (PIA) Request — DRAFT

> **2026-05 status:** HHSC fulfilled the bulk request below with two Excel files (FVH + IntakeHistory) — see [`docs/TX_DATA_SOURCES.md` → "Bulk PIA inputs"](./TX_DATA_SOURCES.md). Those files contain coded violation references and complaint outcomes but **no inspector narratives**. To get narratives, follow the per-event records-request workflow at the bottom of this doc.

---


**Status:** Draft — review and edit before sending.
**Why this matters:** Manual TULIP capture (see [`scrapers/tx_tulip_to_bundle.py`](../scrapers/tx_tulip_to_bundle.py)) works for tens of facilities. Bulk coverage of all ~515 Alzheimer-certified Texas ALFs requires this PIA. The HHSC PIA office historically returns CSV / Excel keyed to license number — directly compatible with [`scrapers/tx_pia_to_bundle.py`](../scrapers/tx_pia_to_bundle.py) → `tx_inspections_ingest.py --import-json` (no further code changes needed; the parser is column-name tolerant).
**Recipient:** Texas Health & Human Services Commission — Records Management / Public Information coordinator (use the current contact on [hhs.texas.gov](https://www.hhs.texas.gov/) *Open Records* or *Public Information* as of send date).
**Statute:** Texas Government Code, Chapter 552 (Public Information Act).
**Response window:** As provided in Chapter 552 (ordinarily prompt production; many agencies respond in 10 business days for simple requests, with possible extension for voluminous or complex requests).

---

## Suggested email / portal subject

> Public Information Act request — machine-readable assisted living facility inspection and investigation history (Long-Term Care Regulation)

---

## Body — copy and paste, edit signature and agency routing

```
To: Texas Health and Human Services Commission
    [Public Information / open records address as published on hhs.texas.gov]

Subject: Public Information Act request — ALF inspection and investigation records (LTCR)

Dear Public Information Coordinator,

Pursuant to the Texas Public Information Act (Tex. Gov’t Code ch. 552), I request the following information held by the Texas Health and Human Services Commission, including data maintained for or by the Long-Term Care Regulation (LTCR) program for **licensed assisted living facilities (ALFs)** in Texas.

**1. Inspection and investigation index (preferred format: CSV or Excel)**  
A table with one row per **inspection, survey, or investigation** event, covering at minimum **January 1, 2018** through the date this request is fulfilled (or the earliest date for which electronic records exist if later than 2018), including:

- HHSC facility identifier(s) you use to join to the public facility directory (e.g., facility license number, provider / facility ID, or Salesforce account id if that is the stable join key in your systems)
- Event date (start date of survey / inspection / investigation)
- Event type or category (e.g., annual inspection, complaint investigation, follow-up, abbreviated survey — use your internal categories verbatim in a dedicated column)
- Overall outcome or disposition fields you maintain in structured form (if any)
- Link or document identifier to the **public-facing report** or narrative record, if stored as a URL or document control number

**2. Deficiency / citation detail (preferred format: CSV or Excel)**  
If maintained separately from the index, a companion extract listing each **deficiency, citation, violation, or finding** tied to the events in item 1, including:

- Join key to the event row
- Citation or rule identifier as printed on the report
- Severity / scope / risk category as labeled by LTCR (verbatim text)
- Narrative text fields as released to the public for that citation (or an explicit flag if narrative exists only in an attached PDF)

**3. Complaint outcomes (if maintained distinctly)**  
Any structured complaint log fields associated with ALFs (complaint id, date received, subject facility identifier, disposition, closure date) for the same time window, if not fully captured in items 1–2.

**Format:** Machine-readable (CSV, XLSX, JSON, or pipe-delimited text). PDF extracts alone are **not** sufficient where structured fields exist in agency databases.

**Fees:** I request a cost estimate before any charges exceeding $40 (or the agency’s current threshold), per Gov’t Code §552.2615. If the request can be satisfied by emailing native electronic records at no duplication cost, please do so.

Please acknowledge receipt and provide an estimated timeline as required by Chapter 552.

Thank you,

[Your name]
[Contact email]
[Optional phone]
```

---

## Notes for StarlynnCare engineering

- Use this when **TULIP** capture is too slow for the ~515 Alzheimer-certified ALFs we want to cover. TULIP exposes the same data interactively but requires reCAPTCHA + DevTools per facility (see [`docs/TX_DATA_SOURCES.md`](./TX_DATA_SOURCES.md)).
- The accompanying ingest path is fully built:
  1. Save fulfilment CSV / XLSX under `.firecrawl/tx-pia/` (gitignored).
  2. `python3 scrapers/tx_pia_to_bundle.py --input <file>.xlsx --output .firecrawl/tx-pia/bundle.json` — column matching is fuzzy (handles `License No`, `License Number`, `Visit Exit Date`, `State Violation Cited`, etc.).
  3. `python3 scrapers/tx_inspections_ingest.py --import-json .firecrawl/tx-pia/bundle.json`
  4. `python3 scrapers/recompute_publishable.py --state TX` (current gate: 48 months — see `recompute_publishable.py` `TX_PUBLISH_GATE_MONTHS`).
- Verbatim LTCR labels land in `deficiencies.state_severity_raw` ([`0014_tx_scaffold_columns.sql`](../supabase/migrations/0014_tx_scaffold_columns.sql)). Incident dates land in `inspections.incident_date` ([`0016_inspections_incident_date.sql`](../supabase/migrations/0016_inspections_incident_date.sql)) — **capture-everything** policy, gate at publish time.

---

## Narrative records request (per-event follow-up)

Use this after HHSC has delivered the bulk FVH + IntakeHistory files. The bulk files contain coded references but no inspector-narrative text; per-event records requests fill that gap.

**Recipient:**

- Email: `RSLTCR.RecordsMgmt@hhs.texas.gov` (preferred)
- Fax: `512-438-2738`
- Mail: HHSC — Regulatory Services — LTC — Regulatory · Records Management — MC: E-349 · PO Box 149030, Austin TX 78714-9030

**Constraints:**

- Records requests >100 pages incur a charge — split into smaller batches.
- Investigations within the last 45 days are unavailable.

**Generate batch emails automatically:**

```bash
python3 scrapers/tx_narrative_request_batch.py \
  --bundle .firecrawl/tx-pia/2026-05-bulk/bundle.json \
  --out-dir out/tx-narrative-requests/
```

Defaults: `--memory-care-only` (Alzheimer-certified subset), `--severity-min B`, `--batch-size 25` (≈100 pages at ~4 pages/event). Each batch produces:

- `batch-NNN.csv` — structured audit trail (license, EVENTID/RS Case No., date, severity letters).
- `batch-NNN.email.txt` — ready-to-paste email body for `RSLTCR.RecordsMgmt@hhs.texas.gov`.

The batcher's email body uses the template structure below. Customize `[your name]` / `[contact info]` and adjust the request preamble before sending the first time, then re-run the batcher to regenerate all batches with the updated template.

```
Subject: Records request — assisted living survey/complaint narratives (batch N of M)

Per your reply on the recent ALF facility visit history / intake history bulk
delivery, I am submitting a follow-up records request for inspector-narrative
records on the following events. Please provide the published narrative
(violation findings, inspector observations, and any Statement of Findings
text) for each event listed.

If this batch's total page count exceeds 100 pages, please notify me with a
cost estimate before processing so I can split or revise the request.

Note: I have excluded any events from the last 45 days, as your reply
indicated those may not yet be available.

Events (N total in this batch):
[table generated from batch-NNN.csv: # | Type | License | Facility | City | Date |
 EVENTID-or-RSCaseNo | Detail (S/S letters or outcome)]

Identifiers:
  - "EVENTID" matches the EVENTID column in FVH; pair with EXIT DATE.
  - "RS Case No." matches IntakeHistory.

[your name]
[contact info]
```

**Smoke test before bulk send:**

```bash
python3 scrapers/tx_narrative_request_batch.py \
  --license <one-license> --batch-size 8 \
  --out-dir out/tx-narrative-requests/smoke/
```

Send a single 5-8 event batch first. Use the response to:

1. Confirm Texas's response format (PDF? text? per-event? bundled?).
2. Calibrate per-event page count.
3. Verify EVENTID + EXIT_DATE and RS Case No. are sufficient identifiers.

Then run the full memory-care batch generation, knowing the batch-size + cost trajectory in advance.

## What the PIA fulfilment should produce (specification for the parser)

The [`scrapers/tx_pia_to_bundle.py`](../scrapers/tx_pia_to_bundle.py) parser consumes any CSV / TSV / XLSX file with these *concepts* (column names can vary — see the `COLUMN_ALIASES` table in the parser source for accepted variants):

| Canonical field | What it means | Required |
|---|---|---|
| `license_number` | HHSC ALF license number (we zero-pad to 6 digits on ingest) | ✅ yes |
| `inspection_date` | Surveyor exit / visit-end date | ✅ yes |
| `incident_date` | For complaint / incident events: when the incident occurred (or when the complaint was received) | optional |
| `visit_type` | Verbatim LTCR label (e.g. "Annual", "Complaint", "Life Safety Code", "Health Code") — preserved as `state_severity_raw` | recommended |
| `citation_code` | Rule cite or tag (e.g. `92.41(a)`) — used as `deficiencies.code` | optional |
| `citation` (narrative) | "State Violation Cited" verbatim text | recommended |
| `corrected_date` | Plan-of-correction completion date | optional |
| `complaint_id` | Complaint / intake number for complaint inspections | optional |

Rows are **grouped by `(license_number, inspection_date)`** — multiple deficiencies on the same survey collapse under one inspection. A row with no `citation` text and no `citation_code` is treated as a survey-occurred-but-no-violations marker (no deficiency row written, but the inspection row is still created so the publish gate sees the visit).
