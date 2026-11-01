# Illinois and Missouri parity audit

Recorded before the lossless reload. Counts below are the production database
before this rebuild, compared with the two source workbooks.

## Source files

Both attached workbooks are byte-for-byte copies of the files already on disk.
Nothing was mid-ingest. The earlier loads were lossy.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| Illinois FOIA visits (`FOIA AL Visits-2024 to present.xlsx`) | 130,262 | `2218c844463e75a3e4f9d934dc6f24ac874f0ec89c7c5f0ea7f0c88f2c4d86b4` |
| Missouri DHSS records (`records.xlsx` / `missourirecords.xlsx`) | 828,258 | `ff7e732b7e2e39d5e9d085ecd9976669f36b6705d0012405ec6e3da98c4ada55` |

## Missouri

Workbook `Sheet 1`: 17,035 tag rows, 8,907 `EVENT_ID` values, 12,051 real tag
rows, 4,984 zero-deficiency markers (`000L`, `00FM`, `00IC`, `00LC`, `000I`).
Dates run from 2018-01-02 to 2026-06-11. No event is missing its id, facility,
or date. No event mixes dates, survey types, facilities, or repeated tags.

Production before this rebuild: 8,738 inspections and 11,820 deficiencies.
The missing 169 events and 231 findings are same-day, same-type visits that
the old `(facility, date, type, agency)` key collapsed. The last event in
each collision kept its tags. The earlier event was overwritten and its tags
were deleted.

Join: strip the letter suffix from `FACILITY_ID` (`27367N` → `27367`) and
match `facilities.external_id`. All 587 workbook facility numbers are already
in the directory. Do not create facilities from this file.

Result after the reload: 8,907 inspections, 12,051 deficiencies, and 17,035
`mo_source_rows` with source `foia_records`. None were quarantined. The 169
missing events and 231 findings were inserted. Existing narratives and
ShowMeLTC links were left in place. A zero-deficiency marker is `normalized`
with reason `zero_deficiency_marker`. It is not a finding.

Rows are quarantined, not merged, for: `missing_event_id`,
`missing_facility_id`, `undated`, `conflicting_dates`, `conflicting_types`,
`conflicting_facilities`, `unmatched_facility`.

Existing inspector narratives and ShowMeLTC links stay. The reload does not
delete deficiencies and does not replace `source_url` on an update. New rows
use an empty inspection link until a real ShowMeLTC URL is crawled.

## Illinois

Workbook `Copy of AL Visits`: 2,209 rows, 2,209 visit ids, 517 physical names,
2,530 parsed citation lines. Dates run from 2022-11-30 to 2026-05-09.

The `Name` column is the visit id. It is not a license number. The old loader
treated it as a license, then a later dedupe collapsed those rows by name.
Production before this rebuild: 33 facilities, 147 visits, 206 findings.
All 33 names are in the workbook. Those names account for 155 visit rows and
206 findings. Seven of those rows have no survey exit date, so they are
quarantined as `undated` and are not given an invented date. The other 148
are loaded. One same-day pair remains at Reflections Memory Care - Chatham
on 2024-12-03 (`00120355` and `00121041`). The lower id keeps the stored
row. The other visit is inserted.

The other 2,054 visits, about 484 names, are not in the directory. They are
quarantined as `unmatched_facility`. They are not published and they do not
get a manufactured license.

The public LLCS portal did not return a facility roster. The Illinois open
data file `8z4a-ix8q` expires in 2021 and is not a current license list. It
is not loaded. A name stays unpublished until a current LLCS row confirms it.

Quarantine reasons: `missing_visit_id`, `missing_facility_name`, `undated`,
`unmatched_facility`, `ambiguous_facility_name`.

Result for this file: 2,209 `il_source_rows`. 148 normalized onto the 33
existing homes. 2,061 quarantined: 84 undated (7 of them are the known homes)
and 1,977 dated rows whose name is not in the directory. The stored visits
are 148, and the findings stayed 206. New inspection links do not put the
visit id in a license hash. The LLCS probe is one quarantined
`llcs_directory` row, `portal_unreadable`.

The 30 published Illinois homes stay published. A name match is not recorded
as an IDPH Special Alzheimer’s designation.

## Publication gates

- Missouri: `mo_alzheimer_scu` or level of care `ALF**`, plus the 36-month
  inspection freshness gate. Socrata remains the facility universe.
- Illinois: `il_dementia_program_flag` or `il_mc_name_match`, plus the
  36-month gate. A single directory-site match stays `needs_review` and
  unpublished. No new facility is created from a visit id.
- Physical city is reconciled after geocoding and before publishability.
- This historical reload does not send State Watch or Facility Watch mail.
  Paid watch stays off for Missouri.

## Schema

`inspections.source_event_id` identifies a Missouri `EVENT_ID` or an Illinois
visit id. Uniqueness is `(source_agency, source_event_id)` when that id is
present. Rows without an id keep the old facility/date/type/agency key.
Arizona, Minnesota, Washington, and Oregon inserts name that partial key so
the Sunday job still lands. `il_source_rows` and `mo_source_rows` are
service-only: row security is on, and the public API roles have no access.

## Enrichment

Missouri inspector narratives already on the row were summarized. 1,705 of
1,705 narratives now have a summary. No ShowMeLTC crawl was started, because
this checkout has no SOD manifest. Illinois citation text was not summarized.
The LLCS document pass recorded that the portal has no public PDF URL and
inserted no inventory rows.

Street View filled photos where imagery exists. Published coverage is 27 of
30 Illinois homes and 211 of 268 Missouri homes. The rest had no street-level
image.

Tour questions were rewritten so they stay on the inspection record. All 30
published Illinois homes have questions. 243 of 268 published Missouri homes
do. The quality gate left 25 Missouri homes blank. None of the saved questions
cite California law or an Alzheimer's designation.

Directory corroboration stamped existing licensed homes only. Illinois: 21
A Place for Mom matches and 17 Caring matches in the cities already on file.
Missouri: 84 and 28 matches in the 40 largest licensed cities, kept only when
the name score was at least 90. No unpublished home gained both directories.
Publishable counts stayed 30 and 268. Six unpublished Missouri homes with one
directory listing are `needs_review`.

## Live LLCS lookup, 2026-11-01

The sentence above, "the public LLCS portal did not return a facility roster,"
is superseded. The lookup page is a Salesforce shell in a non-JavaScript
fetch. The guest Aura API on that same page returns the current Assisted
Living and Shared Housing roster, including the Alzheimer's Special Care
Program field and the license number. IDPH's assisted-living page links
"View the list" to that portal. Two full pulls matched: 630 search rows,
502 active, 335 program Yes, 167 program No, none blank. The 2021 open-data
file is still not a source. The June 2026 landscape PDF counts are not a roster.

Inactive and change-of-ownership rows stay in the ledger. The original 33
homes keep their stored visit-id license numbers and slugs. New program-Yes
homes use the lookup `licId`. Probationary rows are stored and unpublished.
A 295.4060 or 295.1100 citation does not set the flag. Gurnee Memory Care is
the one published home with that citation whose current program field is not
Yes. Betty's Garden Memory Care and Gurnee Memory Care do not match an active
lookup row under those names. South Prairie Memory Care is active and the
program field is No, so the page does not claim the designation.

After geocoding, census place, and the publish recompute: 338 Illinois homes,
335 flagged, 300 published. 297 of those are licensed program-Yes homes with
an inspection inside 36 months. The other 3 are the name-match homes above.
15 probationary Yes homes and 23 licensed Yes homes with no fresh visit stay
unpublished. A Place for Mom's public city pages listed 549 communities and
matched 137 of our homes. Caring.com's Illinois memory-care pages listed 204
communities and matched 79. 68 homes are on both, 67 of them program Yes.
None of those matches were ambiguous, and none created a facility.
