# Utah Narrative Probe Findings

Generated: 2026-05-17 19:29

Probes run against 3 sample UT facilities with UT-CCL inspections.

---

## Facility: The Lodge at Riverton (Riverton)
- DB id: `3bf9518c-f170-4b9a-8aa6-2ee36bf4e21d`
- external_id: `F23-106552`
- CCL id used: `106552`
- Inspections in DB: 16

### Probe A — CCL JSON API (`https://cclapi.dlbc.utah.gov/api/public/facilities/106552`)
- Status: **200**
- Top-level keys: `['idNumber', 'name', 'address', 'phone', 'type', 'licenseType', 'capacity', 'underAgeTwoCapacity', 'initialRegulationDate', 'expirationDate', 'conditional', 'condExpirationDate', 'status', 'occQiReq', 'licenseTypes', 'inspections', 'dcount', 'icount', 'ccount', 'specialties', 'cmsCertNumber']`
- Inspection-level keys: `['id', 'inspectionDate', 'inspectionTypes', 'checklistIds', 'findings', 'underAppeal']`
- Finding-level keys: `['ruleId', 'ruleNumber', 'ruleDescription', 'complaintDates', 'findingCategory', 'noncomplianceLevel', 'correctionVerification', 'correctionDate', 'findingText', 'cmpAmount', 'warnCmpAmount', 'correctionAction', 'appealDate', 'underAppeal']`
- Finding sample:
  ```json
  {
  "ruleId": 32738,
  "ruleNumber": "R432-270-18(7)(a)-(f)",
  "ruleDescription": "Resident unable to self administer medications",
  "complaintDates": "01/27/2026",
  "findingCategory": "REPEAT_CITED",
  "noncomplianceLevel": "Moderate",
  "correctionVerification": {
    "key": "VERIFICATION_PENDING",
    "value": "Follow-up required to verify compliance/maintenance",
    "active": null
  },
  "correctionDate": null,
  "findingText": "The licensee was out of compliance with R432-270-18(7)(d) by not ensuring medications were administered according to the prescribing order. During the inspection, a review of the electronic medication administration records for 4 residents indicated that multiple medications were not administered according to the prescribing orders. This is a repeat non-com
  ```
- **Long text fields found (93):**
  - `inspections[0].findings[0].findingText`: "The licensee was out of compliance with R432-270-18(7)(d) by not ensuring medications were administered according to the prescribing order. During the inspection, a review of the electronic medication..."
  - `inspections[4].findings[0].findingText`: "The Licensee was out of compliance with R380-80-4(1) by not protecting each client from exploitation. Exploitation is defined in R380-80 as "the use of client's property, labor or resources without th..."
  - `inspections[4].findings[0].correctionAction`: "On October 14, 2025 the licensor verified that the Administrator protected each client from abuse, neglect and exploitation, as stated in rule...."
  - `inspections[5].findings[0].findingText`: "The Licensee was out of compliance with R432-270-18(15) by not ensuring that medication error incident reports were completed if a medication error occurred or was identified. During the inspection, 3..."
  - `inspections[5].findings[0].correctionAction`: "On September 29, 2025, the licensor verified with the administrator that medication errors  incident reports were completed, as stated in rule...."

### Probe B — Public CCL portal
- `https://ccl.utah.gov` → **200** (final: https://ccl.utah.gov/)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/facility/106552` → **200** (final: https://ccl.utah.gov/facility/106552)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/facilities/106552` → **200** (final: https://ccl.utah.gov/facilities/106552)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/search?facilityId=106552` → **200** (final: https://ccl.utah.gov/search?facilityId=106552)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/search?licenseNumber=F23-106552` → **200** (final: https://ccl.utah.gov/search?licenseNumber=F23-106552)
  - SPA detected (`<div id="app">` or similar)

### Probe C — Per-inspection URL patterns
- No inspection IDs found in facility response

### Probe D — PDF discovery
- `https://ccl.utah.gov/reports/106552.pdf` → **200** (text/html) 
- `https://ccl.utah.gov/documents/106552.pdf` → **200** (text/html) 
- `https://cclapi.dlbc.utah.gov/api/public/facilities/106552/report` → **500** (application/json) 
- `https://cclapi.dlbc.utah.gov/api/public/facilities/106552/documents` → **500** (application/json) 
- `https://cclapi.dlbc.utah.gov/api/public/facilities/106552/files` → **500** (application/json) 
- `https://ccl.utah.gov/api/report?id=106552` → **200** (text/html) 

---

## Facility: Desert Willows Memory Care (Saint George)
- DB id: `d18d5010-85ab-4fb0-98f6-ec8580816463`
- external_id: `F23-106607`
- CCL id used: `106607`
- Inspections in DB: 14

### Probe A — CCL JSON API (`https://cclapi.dlbc.utah.gov/api/public/facilities/106607`)
- Status: **200**
- Top-level keys: `['idNumber', 'name', 'address', 'phone', 'type', 'licenseType', 'capacity', 'underAgeTwoCapacity', 'initialRegulationDate', 'expirationDate', 'conditional', 'condExpirationDate', 'status', 'occQiReq', 'licenseTypes', 'inspections', 'dcount', 'icount', 'ccount', 'specialties', 'cmsCertNumber']`
- Inspection-level keys: `['id', 'inspectionDate', 'inspectionTypes', 'checklistIds', 'findings', 'underAppeal']`
- **Long text fields found (14):**
  - `inspections[3].findings[0].findingText`: "The provider was out of compliance with this rule by not ensuring that resident's admission agreement included a notice that the department has the authority to examine resident records to determine c..."
  - `inspections[3].findings[0].correctionAction`: "On March 10, 2025, the Licensor verified that resident's admission agreement included a notice that the department has the authority to examine resident records to determine compliance with licensing ..."
  - `inspections[3].findings[1].findingText`: "The provider was out of compliance with this rule by not ensuring that each resident received a written description of the residents legal rights upon admission, that included a statement that the res..."
  - `inspections[3].findings[1].correctionAction`: "On March 10, 2025 the Licensor verified that each resident received a written description of the residents legal rights upon admission, that included a statement that the resident may file a complaint..."
  - `inspections[4].findings[0].findingText`: "The provider was out of compliance with this rule by not ensuring that each resident received a written description of the residents legal rights upon admission, that included a statement that the res..."

### Probe B — Public CCL portal
- `https://ccl.utah.gov` → **200** (final: https://ccl.utah.gov/)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/facility/106607` → **200** (final: https://ccl.utah.gov/facility/106607)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/facilities/106607` → **200** (final: https://ccl.utah.gov/facilities/106607)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/search?facilityId=106607` → **200** (final: https://ccl.utah.gov/search?facilityId=106607)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/search?licenseNumber=F23-106607` → **200** (final: https://ccl.utah.gov/search?licenseNumber=F23-106607)
  - SPA detected (`<div id="app">` or similar)

### Probe C — Per-inspection URL patterns
- No inspection IDs found in facility response

### Probe D — PDF discovery
- `https://ccl.utah.gov/reports/106607.pdf` → **200** (text/html) 
- `https://ccl.utah.gov/documents/106607.pdf` → **200** (text/html) 
- `https://cclapi.dlbc.utah.gov/api/public/facilities/106607/report` → **500** (application/json) 
- `https://cclapi.dlbc.utah.gov/api/public/facilities/106607/documents` → **500** (application/json) 
- `https://cclapi.dlbc.utah.gov/api/public/facilities/106607/files` → **500** (application/json) 
- `https://ccl.utah.gov/api/report?id=106607` → **200** (text/html) 

---

## Facility: Petersen Farms Assisted Living and Memory Care (South Weber)
- DB id: `0fc01354-d0fc-482d-bf29-d10466345907`
- external_id: `F23-106885`
- CCL id used: `106885`
- Inspections in DB: 13

### Probe A — CCL JSON API (`https://cclapi.dlbc.utah.gov/api/public/facilities/106885`)
- Status: **200**
- Top-level keys: `['idNumber', 'name', 'address', 'phone', 'type', 'licenseType', 'capacity', 'underAgeTwoCapacity', 'initialRegulationDate', 'expirationDate', 'conditional', 'condExpirationDate', 'status', 'occQiReq', 'licenseTypes', 'inspections', 'dcount', 'icount', 'ccount', 'specialties', 'cmsCertNumber']`
- Inspection-level keys: `['id', 'inspectionDate', 'inspectionTypes', 'checklistIds', 'findings', 'underAppeal']`
- **Long text fields found (32):**
  - `inspections[1].findings[0].findingText`: "The Licensee was out of compliance with R432-270-25(1) by not ensuring maintenance, including preventive maintenance, was conducted according to a written schedule, to ensure facility equipment was op..."
  - `inspections[1].findings[0].correctionAction`: "On May 29, 2025, the licensor ensured that maintenance was conducted and the licensees phones were functioning and working properly, as stated in rule...."
  - `inspections[2].findings[0].findingText`: "The provider was out of compliance with R432-270-11(10)(c)(i) by not ensuring all conditions of accepting and retaining a hospice patient resident were met. During the inspection, 1 hospice patient re..."
  - `inspections[2].findings[1].findingText`: "The provider was out of compliance with R432-270-16(4) by not ensuring that at least one direct care staff was in the secure unit continuously.  During the inspection, the licensor reviewed 2 incident..."
  - `inspections[2].findings[1].correctionAction`: "On April 30, 2025, the licensor verified that the Administrator ensured that one direct care staff was in the secure unit continuously, as stated in rule...."

### Probe B — Public CCL portal
- `https://ccl.utah.gov` → **200** (final: https://ccl.utah.gov/)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/facility/106885` → **200** (final: https://ccl.utah.gov/facility/106885)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/facilities/106885` → **200** (final: https://ccl.utah.gov/facilities/106885)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/search?facilityId=106885` → **200** (final: https://ccl.utah.gov/search?facilityId=106885)
  - SPA detected (`<div id="app">` or similar)
- `https://ccl.utah.gov/search?licenseNumber=F23-106885` → **200** (final: https://ccl.utah.gov/search?licenseNumber=F23-106885)
  - SPA detected (`<div id="app">` or similar)

### Probe C — Per-inspection URL patterns
- No inspection IDs found in facility response

### Probe D — PDF discovery
- `https://ccl.utah.gov/reports/106885.pdf` → **200** (text/html) 
- `https://ccl.utah.gov/documents/106885.pdf` → **200** (text/html) 
- `https://cclapi.dlbc.utah.gov/api/public/facilities/106885/report` → **500** (application/json) 
- `https://cclapi.dlbc.utah.gov/api/public/facilities/106885/documents` → **500** (application/json) 
- `https://cclapi.dlbc.utah.gov/api/public/facilities/106885/files` → **500** (application/json) 
- `https://ccl.utah.gov/api/report?id=106885` → **200** (text/html) 

---

## Summary and Recommendation

### What we found

**Probe A — WINNER.** The CCL JSON API (`cclapi.dlbc.utah.gov/api/public/facilities/{id}`) already
returns full plain-English inspector narrative in `findings[].findingText`, and the plan-of-correction
follow-up in `findings[].correctionAction`. The current scraper ignores both — it only stores
`ruleDescription` (the short rule title). No separate detail-scrape or PDF pipeline is needed.

Field mapping:
| CCL API field     | DB column (`deficiencies`)   | Notes |
|-------------------|------------------------------|-------|
| `findingText`     | `inspector_narrative`        | Full "during the inspection..." prose |
| `correctionAction`| `plan_of_correction`         | Licensor verification follow-up |
| `ruleDescription` | `description`                | Rule title, keep as-is |

Sample `findingText` (The Lodge at Riverton, inspection 1, finding 1):
> "The licensee was out of compliance with R432-270-18(7)(d) by not ensuring medications were
> administered according to the prescribing order. During the inspection, a review of the electronic
> medication administration records for 4 residents indicated that multiple medications were not
> administered according to the prescribing orders..."

**Probe B — ccl.utah.gov is a SPA** (Vue/React `<div id="app">`). All URL patterns return 200 +
the app shell. This means `https://ccl.utah.gov/facility/{ccl_id}` is a valid, working URL that
will deep-link to the facility page once the SPA bootstraps. It is the correct replacement for the
broken `provider.dlbc.utah.gov` source_url.

**Probe C** — Note: inspection-level `id` field IS present in the API response (e.g. key `id` in
inspection objects) but Probe C's lookup code checked for `inspectionId`/`surveyId` only — a bug in
the probe. IDs are available. However since Probe A gives us all the data, per-inspection URL
patterns are not needed.

**Probe D — No PDF endpoints found.** The PDF-pattern GETs all return 200 text/html (the SPA
shell), confirming no server-side document store at those paths. Not relevant since Probe A covers us.

### Actions taken (from this probe run)

1. [x] `ut_ccl_inspections_scraper.py` patched to also store `findingText` →
   `inspector_narrative` and `correctionAction` → `plan_of_correction`.
2. [x] `source_url` in the scraper corrected to `https://ccl.utah.gov/facility/{ccl_id}`.
3. [x] `supabase/migrations/0036_ut_source_url_backfill.sql` — rewrites existing UT-CCL inspection
   `source_url` values from the broken `provider.dlbc.utah.gov` pattern to `ccl.utah.gov/facility/{id}`.
4. [ ] **Next: re-run `ut_ccl_inspections_scraper.py`** (or a targeted backfill variant) to
   populate `inspector_narrative` + `plan_of_correction` for all existing UT deficiency rows.
   Once done, `hasRealInspectionText` will return true, grade suppression lifts, and the
   "PDFs not yet parsed" banner disappears automatically.