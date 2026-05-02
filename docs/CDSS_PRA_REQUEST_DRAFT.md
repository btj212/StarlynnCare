# California Public Records Act (PRA) Request — DRAFT

**Status:** Draft — review and edit before sending.
**Recipient:** California Department of Social Services, Community Care Licensing Division
**Submission method:** Email to `caregiver@dss.ca.gov` with cc to `CCLDPRA@dss.ca.gov`, OR via the official PRA portal at <https://www.cdss.ca.gov/inforesources/research-and-data/california-public-records-act-requests>.
**Statute:** California Public Records Act, Cal. Gov. Code § 7920.000 et seq. (recodified 2023 from former § 6250 et seq.).
**Response window:** Statutory 10 days to acknowledge, with 14-day extension permitted for unusual circumstances.

---

## Suggested email subject

> California Public Records Act request — RCFE Health and Safety Code § 1569.627 dementia-care disclosure list

---

## Body — copy and paste, edit signature block

```
To: California Department of Social Services
    Community Care Licensing Division
    Adult Care Facilities Branch
    744 P Street, Sacramento, CA 95814

Subject: California Public Records Act request — RCFE Health and Safety Code §1569.627 dementia-care disclosure filings

Dear Records Coordinator,

Pursuant to the California Public Records Act (Cal. Gov. Code §7920.000 et seq.), I am requesting the following public records held by the California Department of Social Services, Community Care Licensing Division (CDSS-CCLD):

1. The current list of Residential Care Facilities for the Elderly (RCFEs) that have filed a Health and Safety Code §1569.627 dementia-care disclosure with CDSS as part of their plan of operation. The disclosure required of any RCFE that advertises, promotes, or otherwise represents that it provides special care, special programming, or a special environment for persons with Alzheimer's disease or other forms of dementia.

2. For each facility on that list, the following identifying fields, to the extent CDSS maintains them in a structured format:
   - Facility name
   - CDSS facility number (9-digit license number)
   - Street address, city, county, ZIP code
   - Date the §1569.627 disclosure was first filed
   - Date of any subsequent disclosure update or withdrawal
   - Any standardized fields CDSS captures regarding the special features disclosed (e.g., secured perimeter, ratio, training, dementia-specific programming)

3. Any internal CDSS guidance, regulation, form, checklist, or memorandum used by Community Care Licensing staff to track or audit §1569.627 disclosures.

I request the records in machine-readable format (CSV, Excel, JSON, or comma-delimited text). Plain text or PDF is acceptable if no structured copy exists.

I am willing to bear reasonable duplication costs in accordance with §7922.530(a) of the Government Code.

Pursuant to §7922.535, please acknowledge receipt of this request within ten (10) days. If any portion of the requested records is being withheld, please cite the specific exemption claimed and identify the withheld material with sufficient specificity to permit me to assess and, if appropriate, contest the withholding.

Thank you for your assistance.

Sincerely,

[YOUR NAME]
[YOUR TITLE — e.g., "Founder, StarlynnCare" or "Editor, StarlynnCare"]
StarlynnCare
[CONTACT EMAIL]
[CONTACT PHONE]
[MAILING ADDRESS — required by some agencies for record delivery]
```

---

## Why we are filing this

CDSS does not currently publish a structured §1569.627 disclosure list on its public-facing data portal (verified April 2026 against [data.ca.gov CKAN](https://data.ca.gov/dataset/community-care-licensing-facilities) and [CCLD Transparency API](https://www.ccld.dss.ca.gov/transparencyapi/api/Facility/any)). The §1569.627 filing is the canonical regulatory signal for "this facility is a memory-care provider" — more authoritative than name keywords, citation history, or operator self-listing on third-party directories. Obtaining this list closes our largest remaining MC-identification gap.

Per the source code in [scrapers/mc_disclosure_ingest.py](../scrapers/mc_disclosure_ingest.py), this PRA request was already flagged as a planned action in the docstring:

```python
# TODO: file a PRA request to CDSS for the §1569.627 disclosure registry if
# a public download does not appear by Q3 2026.
```

## Tracking

| Field | Value |
|---|---|
| Drafted | 2026-04-29 |
| Prepared to send | 2026-05-02 |
| Sent | _pending — fill in signature block below, then submit_ |
| Acknowledgement received | _pending_ |
| Records produced | _pending_ |
| Cost | _pending_ |
| Notes | Ready to submit. Fill in [YOUR NAME], [YOUR TITLE], [CONTACT EMAIL], [CONTACT PHONE], [MAILING ADDRESS] in the body above before sending. Submit via portal first, then send email copy as a paper trail. |

Update this file when you send it and when responses come back so we have a written audit trail.

## Follow-up checklist

- [ ] Confirm best CDSS PRA submission channel (portal vs. email) before sending.
- [ ] Personalize the signature block.
- [ ] Send.
- [ ] Calendar a 10-day reminder for the statutory acknowledgement.
- [ ] Calendar a 24-day reminder for production (10 + 14 day extension).
- [ ] Once received, write `scrapers/import_1569627_disclosure.py` to upsert the list into `facilities.memory_care_disclosure_filed` and set `memory_care_disclosure_source = '§1569.627 disclosure list (CDSS)'`.
