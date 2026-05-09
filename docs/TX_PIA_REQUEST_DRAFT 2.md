# Texas Public Information Act (PIA) Request — DRAFT

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
