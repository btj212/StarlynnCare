# Inspection source gaps

Read on November 27, 2026, after the Washington, Pennsylvania, and Utah writes. Nothing in this note was written to the database. Live pages are `facilities.publishable = true`. A page fails the current URL rule when it has no inspection with a date, an http(s) source URL, and a citation count. Zero is a real count.

The gate change in this branch is narrower than that URL rule. Illinois and Colorado qualify with a date and a citation count when they also have either the state visit id in `inspections.source_event_id` or an http(s) source URL. That URL route is how the Colorado CMS nursing home passes. Every other state still needs the URL. `GATE_ENFORCED` stays false, so robots and the sitemap do not change until that flag is turned on.

## Washington citation count

One definition: the citation count is the number of distinct cited WAC requirements on that inspection. That is the same number as the citation rows. One rule is one row.

Two things that are not a second requirement:

- A second "This requirement was not met" line inside the same rule. Asis, license `0000754652`, inspection `e2a98b3a-9b86-42c7-815b-6ad5411a00ed`, date 2023-10-05, has 13 of those lines and 12 stored rules. The extra line sits in the `WAC 388-76-10165` block. The next header is `WAC 388-112A-0200`, which the parser does not treat as a new requirement. The stored count is already 12, and it stays 12.
- The same rule written again later in the letter. Blue Orchid, license `0000757030`, inspection `d2931454-aad4-42b7-8de1-63b544111218`, date 2025-05-20, stored 15 because `WAC 388-76-10135` and `WAC 388-76-10475` were each emitted twice. The citation rows are the 13 distinct codes. The count should be 13.

The parser now keeps the first title for a code and drops the repeat, so a future write stores the same number it stores as rows. The insert already skipped a duplicate code, which is why Blue Orchid has 13 rows and a count of 15.

A stored count with no citation rows is a different case. 521 Washington inspections have a positive count and zero coded rows. Many are assisted-living statements, not adult-family-home letters. This recount does not set those to zero. There is no row to agree with, and zero would erase a number that was stored without rows.

Dry-run, read-only:

```bash
python3 scrapers/recount_wa_citation_counts.py
```

On November 27, 2026 that list is 214 inspections. 93 would go down (Blue Orchid is 15 to 13). 121 would go up, because the stored integer is lower than the number of distinct codes already in the rows. 19 of the 214 are adult family homes. The other 195 are assisted-living statements. Asis is not on the list, because 12 already matches its 12 rows. The 521 with no rows stay as they are. The full list is the script output from that read. `--apply` is the write and was not run.

## Colorado — 70 live pages

Public lookup is one search for every facility, not a link per event:

- https://cdphe.colorado.gov/health-facilities/find-and-compare-facilities
- https://cohealthviz.dphe.state.co.us/t/HealthFacilitiesPublic/views/HealthFacilitySearchSite/1_HealthFacilitySearchSite

The tableau page says it shows inspections for the last three years, the citations, the regulation text, and plans of correction. The embedded view returned an error when opened directly. The view address itself redirects. Neither is a stable URL for one event, so it is not stored.

data.colorado.gov dataset `98pp-s4r4` is a 2017 facility directory. It has a point and a link, not a survey. Catalog hits for health-facility inspections were restaurant inspections and occurrence files that stop in 2013. The newest CDPHE file in this database is the May 18, 2026 HFQ workbook. No newer public survey file was found. None of the 70 assisted-living residences have a CMS certification number, so Care Compare does not cover them.

Additional homes we could cover with a real document URL: 0.

What does cover them: the event key already in `raw_data.co_event_key` (for example `23033N|035H13|AL18`). `co_event_id` (for example `M5T211`) is the visit, and one visit is stored once per rule set, so that id is shared by two or three rows. The unique index is `(source_agency, source_event_id)`, so the copy writes the key, and only where `source_event_id` is null. All 70 have a date, a citation count, and that key. The one live Colorado page that already passes is a CMS nursing home, which has a document URL.

```bash
python3 scrapers/backfill_co_inspection_gate.py
python3 scrapers/backfill_co_inspection_gate.py --apply
```

The dry-run prints how many keys would be copied and any duplicate `(source_agency, source_event_id)` the write would create. It stops if any duplicate is found. `--apply` copies the key only. It still refuses to write the tableau address. It was not run here. A future HFQ ingest writes `source_event_id` on the insert so a second backfill is not required.

## Illinois — 300 live pages

IDPH does not publish an assisted-living survey PDF we can store.

- The guest lookup (`FacilitySearchLookupHomePage.getFaciliyResult` and `LLCS_LicensePageUnauth.getLicenseResult`) returns the roster and `licId`. The shell `https://llcs.dph.illinois.gov/s/?language=en_US#license=` is not a document.
- Quarterly violator reports (https://dph.illinois.gov/topics-services/health-care-regulation/nursing-homes/violator-quarterly-reports.html) are Nursing Home Care Act homes. All 300 live Illinois pages are assisted living.
- data.illinois.gov dataset `8z4a-ix8q` is the licensed-establishment roster (name, address, license, beds). It is not a survey.
- The assisted-living page on dph.illinois.gov has no survey PDF index.
- A commercial host has copies of statements of deficiency dated into 2026. That host is not IDPH, so those addresses are not stored.

No official file newer than the May 9, 2026 FOIA workbook was found. Additional homes we could cover with a document URL: 0.

The FOIA visit id is already in `source_event_id`. The citation count is not stored yet. "none", "No Violations", and "NONE" are zero. A blank cell stays unknown. After the count backfill, 294 of 300 live pages would have a date, a count, and a visit id. These six would not, because the tag cell is blank and there are no deficiency rows: `05100695`, `05106940`, `05106957`, `05108144`, `05108987`, `05202053`.

```bash
python3 scrapers/backfill_il_inspection_gate.py
python3 scrapers/backfill_il_inspection_gate.py --apply
```

`--apply` writes the citation count only. It does not write a URL and it does not replace a visit id. A newer inspection date needs a newer FOIA workbook:

```bash
python3 scrapers/il_foia_visits_ingest.py --input path/to/workbook.xlsx --dry-run
```

Neither write was run here.

## Washington — 478 live pages still failing

After the text-PDF write, 653 of 1,131 live pages pass the URL rule. 478 still do not.

The forms page for a home is `https://fortress.wa.gov/dshs/adsaapps/lookup/AFHForms.aspx?Lic=` plus the license digits. Inspection PDFs, investigation PDFs, enforcement letters, and limitation letters are all on that page. There is not a second ALTSA list that covers the homes with nothing posted.

Of the 269 licenses that had no report in the earlier inventory, a fresh read of that page found:

- 2 new inspection letters that already parse as a date, a matching license, and a count of zero: Bright Love (`755323`, 2025-10-16) and Brighter Home II (`757473`, 2025-10-03). The existing text backfill can store those. They were not written here.
- 1 investigation that is an image-only file (`758314`).
- 1 enforcement letter (`758590`, September 2, 2026) with a license and no inspection date or citation count.
- 7 homes with only a limitations PDF. Those are not inspection statements.
- 258 homes with nothing posted.

OCR was tried on 10 scanned letters (tesseract 5.3.4, every page). The license matched the folder on all 10, and the date matched the sentence in the letter. Citation counts did not. On a 9-page cited letter the full OCR found 4 not-met blocks and the parser returned 3, because the scan split a WAC header. Truncating to the first two pages under-counted further. Five one-page letters say "found no deficiencies." The parser does not treat that phrase as zero today, so those stay unknown rather than a guessed zero. OCR counts are not reliable enough to store. No OCR write path was added.

Additional homes that would pass from a source we can already read: the 2 new text letters above, if the existing text backfill is run again. The other 476 are scans we will not count automatically, or homes with no posted report.

## Other states

After the Pennsylvania, Utah, and Washington writes, live pages failing the date + URL + count test:

| State | Live pages | Failing |
| --- | ---: | ---: |
| Washington | 1,131 | 478 |
| Illinois | 300 | 300 |
| Colorado | 71 | 70 |
| Arizona | 1,880 | 2 |
| Pennsylvania | 429 | 0 |
| Utah | 118 | 0 |
| California, Minnesota, Missouri, Oregon, Texas | the rest | 0 |

The two Arizona homes have no inspection row at all: Aegis at Homestead (`AL10538H`) and Intouch Assisted Living (`AL11452H`). Arizona assisted-living surveys come from AZ Care Check (`https://azcarecheck.azdhs.gov/s/`). This pass did not download a new survey for those two licenses, and it does not add an Arizona writer.

Pennsylvania and Utah are covered by the writes already run (`cms_nh_deficiencies_ingest.py --state PA` and `backfill_ut_inspection_gate.py`). The one publishable Texas page already passes. Texas ingestion is out of scope here.
