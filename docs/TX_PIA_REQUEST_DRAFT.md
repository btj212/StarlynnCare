# Texas Public Information Act (PIA) Request — DRAFT

**Status:** Draft — review and edit before sending.  
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

- Use this if **TULIP** or other HHSC portals do not expose bulk, joinable inspection/deficiency history keyed to **license number** or **facility id** from the ALF directory export ingested by [`scrapers/tx_alf_ingest.py`](../scrapers/tx_alf_ingest.py).
- Phase 2 ingest should map verbatim LTCR labels into `deficiencies.state_severity_raw` ([`0014_tx_scaffold_columns.sql`](../supabase/migrations/0014_tx_scaffold_columns.sql)).
