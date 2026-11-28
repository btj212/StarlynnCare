# ERRORS.md — Failure log

Append-only log of approaches that didn't work and what worked instead. Check this before suggesting an approach to a similar task. Newest at the top.

Format per entry: **what went wrong**, what worked instead, source.

The OR pipeline learnings doc (`docs/OR_PIPELINE_LEARNINGS.md`) is the canonical long-form version of items 1–6. Entries here are the short, searchable version.

---

## 2026-11-28 — A `.range()` page with no `order` skips or repeats the next thousand rows

**What went wrong:** Three walks in `loadStateMemoryCareStats` paged with `.range(from, from + 999)` and never called `.order()`. PostgREST can return a different thousand rows on the next page. California has more than 1,000 publishable homes, so `/data` could drop or double a home. The same gap made the FAQ "tagged Type A" sentence count only the newest 25 visits.

**What worked instead:** `.order("id")` on each of those reads, and the California tagged sentence uses the Type A head count.

**Source:** Re-review of PR 277 at head `0d074ee`. No database write.

---

## 2026-11-28 — `facilities!inner` newest and oldest queries hit the 3-second cap

**What went wrong:** A preview build of main failed while generating pages. The anon role has `statement_timeout` of 3 seconds. `newestInspection` and the inspection-window oldest query selected `facilities!inner(...)` and ordered by date with `limit 1`. PostgREST turns that into a lateral join that sorts inspections for the state. California and Texas newest, and Illinois oldest, were the lines that canceled. `loadStateMemoryCareStats` was also uncached, so one build repeated that walk about ten times. `.limit(5000)` does not raise PostgREST's max-rows, so a dense deficiency page can stop at 1000.

**What worked instead:** Read published facility ids, then count with `.in("facility_id", chunk)` and `head: true`. Take the newest date from the inspection rows that count already reads. Memoize the successful walk for the process and drop the promise when it returns null. Page any select that would have asked for more than 1000 rows. Do not add an index or change the timeout.

**Source:** `/cursor/stores/bot/reviews/build-timeout-diagnosis-2026-11-27.md`. No database write.

---

## 2026-11-28 — A complaint was printed as the last inspection, and California counts stopped at 50

**What went wrong:** `latestVisit` was the newest visit of any kind, so a Washington complaint investigation was the "Last inspection" date. `fetchInspectionsAndDeficiencies` used `.limit(50)`, so a home with more visits in the window said "across 50 inspections". The headline added substantiated complaints that had no deficiency rows, which made the California total higher than Type A plus Type B. The phone cell was a dash when the database had no number, and a short digit string would have been shown as typed. Every compliance-banner link said "DSHS".

**What worked instead:** Keep `latestVisit` for "any visit", and print `latestInspection` separately from `latestComplaint` on Washington pages. Page the inspection and deficiency reads. For California, the headline is the deficiency rows in the window, and the three-year phrase stays even when nothing is older. Show a phone only after it parses to 10 digits; otherwise say "Not on file" and link the regulator record. Label the banner link from the state regulator.

**Source:** Live profiles and read-only SQL on project `fwvrupjgwvvzqiutwwdg`, 2026-11-27 and 2026-11-28. The California rebuild was still inserting rows (`deficiencies.created_at` moving, `poc_deadline` still on 14 rows at the first check).

Pennsylvania pages for Elm Terrace, Spring Mill Pointe, Sunrise of Lafayette Hill, and Symphony Square linked to SeniorAdvisor or Caring.com from the cost source, not from `facilities.website` (that column is null). Treating the link as the home's website was the wrong fix. Drop the link when the host is a directory, and do not leave a "Source" label with nothing to click. The price paragraph still names the directory.

A first pass also treated Minnesota, Utah, Washington assisted living, and Missouri as if they had no severity scale, and it printed "None are tagged …" for Oregon, Illinois, and Colorado homes whose rows do not store one. Minnesota uses SS letters (144G.31, top tier J–L). Utah uses Low/Moderate/High/Extreme. Washington assisted living uses DSHS Type A/B/C. Missouri uses Class I/II/III. Pennsylvania nursing homes use the CMS grid; personal care does not. The negative sentence waits until every in-window citation has a scale value. Texas with nothing in the three-year window must not say "0 citations" or "clean record"; it says Health and Human Services has not published recent results and links the HHSC search.

---

## 2026-11-27 — Colorado event ids and the Washington recount update were not writable

**What went wrong:** `backfill_co_inspection_gate.py --apply` copied `raw_data.co_event_id` into `source_event_id`. 318 of those ids are on 2–3 rows each (646 rows), one per rule set, so the unique index `(source_agency, source_event_id)` would reject the write. `recount_wa_citation_counts.py --apply` joined `facilities` on `i.facility_id` inside `FROM` before the inspection being updated was in scope, and Postgres rejected that. `inspectionQualifies` for Illinois and Colorado accepted only the visit-id route, so a Colorado CMS nursing home with a real link and no visit id failed.

**What worked instead:** Store `raw_data.co_event_key`, and only where `source_event_id` is null. Dry-run lists duplicate `(source_agency, source_event_id)` values and the write stops if any exist. The recount is `UPDATE ... FROM` a distinct-code subquery, and `f.id = i.facility_id` is in `WHERE`. Illinois and Colorado pass on a date and a count with either a visit id or an http(s) URL.

**Source:** PR 274, commit `ea7436b`, applied and then stopped. No `--apply` in the correction.

---

## 2026-11-27 — Inspection rows looked stale because the count or the URL was dropped

**What went wrong:** `scrape_runs` has no Illinois, Utah, Colorado, or Pennsylvania rows, and the last `wa_dshs_inspections` success is 2026-05-11. That made the Sunday job look stopped. It is not. `state_scan_runs` shows Washington completing through 2026-11-27 (inspections stayed 4,073 that day). Illinois completes with inspections stuck at 1,532 because the weekly job only checks that LLCS has no public PDF. Washington's weekly backfill only selects inventory created after `STATE_SCAN_STARTED_AT`, and `backfill_one` skips when the runner's `.parsed.json` sidecar is gone, so older adult-family-home PDFs never become inspections. Illinois `parse_citations` used to return nothing for a whole cell when any line said "no violation". Utah's insert wrote `source_url` as `''` and `ON CONFLICT DO NOTHING` left it empty. CMS nursing-home ingest wrote the F-tags and the data.cms.gov URL and left `total_deficiency_count` null. A Postgres `~* '\bnone\b'` check undercounted Illinois, because `\b` is a backspace in Postgres.

**What worked instead:** Read the PDF or the FOIA cell in Python. Washington count is cited WAC blocks, or zero when the letter says the consult was not cited. Illinois count skips a no-violation line and keeps the 295 lines; a blank cell stays null. Utah fills `https://ccl.utah.gov/facility/{id}` from `external_id`. Pennsylvania sets the count from the deficiency rows for that `cms_ccn`. Colorado still has no per-event URL. Do not add one.

**Source:** Project `fwvrupjgwvvzqiutwwdg`, 2026-11-27. The one-time scripts are `scrapers/backfill_*_inspection_gate.py`. Dry-run is the default.

---

## 2026-11 — Texas inspections never ran because the weekly job does not fetch, and the old TULIP account id is dead

**What went wrong:** 546 of 547 Texas memory-care homes have no inspection row. The only rows are the May 2026 smoke capture for license 148715 (exit 2020-02-07 and a synthesized 2023-02-16). `scripts/weekly_inspection_ingest.py` `ingest_tx` looks for a local `.firecrawl/tulip*` directory and returns success when it is missing, so Sunday never called HHSC. The stored source URL uses Account Id `001cv00000RpEjOAAV`. That id now returns an empty general-info payload and `visitType: noData`. The same license's current Account Id is `001cv00000Rs8SAAAZ`. `alf-violations-data.pdf` is a 3-page statewide total, not a facility file. data.texas.gov HHSC CCL is child care.

**What worked instead:** Guest Aura (`aura.token=null`) on `https://tulip.hhs.texas.gov/TULIP/s/sfsites/aura`. `RS_LTCProviderController.searchAccounts` by `licenseNumber` with `programType=Assisted Living Facilities`. Parse `LIcense_Number__c`. `retrieveInspectionsInfo` for the survey date. `retrieveRSEventForEnfAction` for the penalty citations (date, rule, narrative). Read `fwuid` from the search page each run.

**Source:** `scrapers/tx_tulip_public.py`, `scrapers/fixtures/tx_tulip_public_sample.json`, project `fwvrupjgwvvzqiutwwdg` read-only SQL.

---

## 2026-11-27 — Arizona city cards were a partial count

**What went wrong:** `loadStateHubData` and the fallback state page selected publishable city rows with no `.order()` and no `.range()`. PostgREST stops at 1,000 rows. Arizona has 1,923 publishable homes, so Mesa's card showed 150. The city page itself said 145, which was the old listed set (169 publishable, minus 24 homes of 10 beds or fewer with no citations). An id-ordered first 1,000 contains 101 Mesa rows, so the number moved depending on which 1,000 came back.

**What worked instead:** Page city reads with `.order("id").range(...)`. The card count is the homes the city page lists.

**Source:** Task 8, 2026-11-27. Live `/arizona` and `/arizona/mesa`.

---

## 2026-11-27 — AFH dementia specialty was treated as memory care

**What went wrong:** `wa_dementia_specialty` was an OR branch of Washington `serves_memory_care`, a profile basis sentence, a "Dementia Specialty" badge, a city-hub chip, and a hub FAQ basis. It is a staff-training credential (RCW 70.128.230(5), WAC 388-112A-0490). About 98.5% of operating adult family homes hold it (6,199 of 6,296 in the 2026-11-27 DSHS pull), so it says nothing about a particular home. The ASP.NET stamp guessed `ddlSpecFocus=Dementia` and wrote 0 rows. ArcGIS `Speciality` / `SpecialityCode=SPDE` is the real field, and the weekly geo ingest stamps it. Reverting the column to null would be undone on the next Sunday scan.

**What worked instead:** Keep the column as raw DSHS data. Do not read it for a badge, chip, FAQ, JSON-LD claim, content prompt, or eligibility. An assisted living facility is memory care from Memory Care Certified, a Specialized Dementia Care contract, or the operator's own page for that address. An adult family home is memory care only from that operator page. Leave the 858 published AFHs listed.

**Source:** Owner, 2026-11-27. `src/lib/facility/memoryCareBasis.ts`.

---

## 2026-11 — --refetch generated summaries and wrote none; intro date lagged the PDF month

**What went wrong:** The ID-gated refetch job summarized 99 inspections and saved 0. SELECT dropped the `narrative_summary IS NULL` filter under `--refetch`, but UPDATE still required `WHERE id=%s AND narrative_summary IS NULL`. Claude also said "no deficiencies" / "does not specify whether deficiencies were cited" for visits whose source cites WAC 388-78A-2120, 24701, 2600 (Fields 2669, Avamere 2460). WA profile intro used `inspections[0]` ("Last inspected Sep 2024") while the header used `wa_latest_posted_report` ("Last inspection Jun 2026").

**What worked instead:** `--refetch` UPDATE is `WHERE id=%s` only. Skip empty source text. Post-check rejects a clean-visit claim when deficiency rows or source citations exist. Intro/header/quick facts/meta share `latestVisit` and `formatRecordDate` month wording.

**Source:** Actions run 45949879362; Ciel 2448 / South Hill Village 2480.

---

## 2026-11 — WA name keyword, SDC summaries, successor inserts, hidden PDF dates

**What went wrong:** `recompute_publishable.py` treated `mc_signal_explicit_name` (a name containing “Memory Care”) as a WA memory-care signal. South Hill Village 2480 has no DSHS dementia specialty, SDC contract, or Memory Care Certified flag; the name rule would flip `serves_memory_care` back to true after it was set false. The profile still said “Memory-care basis not yet recorded”, asked “Does … provide memory care?”, and ranked the home among “Washington memory care facilities”.

`summarize_inspections.py` told Claude that “Washington memory care lives in ALFs holding a DSHS Specialized Dementia Care contract.” Fields Spokane Valley 2669 has `wa_contract_types = {No Contract}` and `wa_dementia_care_contract = false`, but its June 2025 summary claimed the visit “verified compliance with Washington DSHS Specialized Dementia Care requirements”.

The weekly geo scan keyed only on `license_number`. DSHS reissued licenses 2799, 2800, 2801 for the same campuses as 2037, 1947, 2141 (same street/phone/beds); the scan inserted brand-new rows and left inspections on the old URLs.

`wa_signal_dementia_specialty.py` guessed ASP.NET `ddlSpecFocus=Dementia` and stamped 0 AFHs. ArcGIS `Speciality` / `SpecialityCode` (SPDE) is the real field. `wa_pdf_inventory` is admin-only RLS, so 352 publishable WA homes with a posted PDF and no `inspections` row showed last inspection as “—”.

**What worked instead:** Exclude name keywords from WA `serves_memory_care`. When that flag is false, say DSHS does not list a dementia designation; skip the memory-care FAQ; rank among “Washington assisted living”. Summarizer prompt + post-check refuse an SDC claim unless the roster holds the contract. Geo ingest flags a successor license to a review list and skips the insert; do not delete or merge existing rows. Stamp specialty from ArcGIS. Public last-inspection date uses RPC `wa_latest_posted_report` (0085).

**Source:** WA display audit, 2026-11-27.

---

## 2026-11 — Sunday PA/UT "source URL changed" was a false lead

**What went wrong:** Four Sunday `weekly-inspection-ingest.yml` runs failed on PA and UT. The guess was that DHS / CCL endpoints had moved. They had not. PA `AzureInspVioltnReprtSearchResults` still returns the inspection table for ~356/363 homes; seven GitHub-runner requests got Azure Front Door 403 (the `StarlynnCare-bot/1.0` User-Agent made that worse) and the scraper exited 1 after one retry. UT `cclapi.dlbc.utah.gov` still works; 118/119 facilities stored 566 inspections and one API call failed after one retry, which also exited 1. WA finished, but took 5.5–6 hours because AFH discovery walked 6,429 licensed homes at 1 req/s, physical-city hit Census for every WA row (no cache on the runner), compliance flags re-fetched 1,040 publishable homes, and `wa_pdf_backfill.py --rescore` re-summarized 3,335 inspections.

**What worked instead:** Browser-like PA headers, three backoffs plus a second pass on blocked pages, three UT API retries. Fail the job only when nothing was stored or >20% of attempts stayed failed; otherwise warn and keep the rows. WA: 4 AFH workers at 0.4s, physical-city `--created-since-days 14`, compliance skip when this scan added no new PDF for a home that already has a flag, drop `--rescore`, summarize at most 80 new NULL-summary visits. Per-state job/step timeouts.

**Source:** Runs `41316847867`, `42490606983`, `43727623295`, `45039897772`.

---

## 2026-11 — CA watch marked homes reconciled before the PDF existed

**What went wrong:** `com.starlynncare.ca-watch` only opened `FacilityReports` when a snapshot was pending or the bulk fingerprint changed. Homes were stored as fully reconciled while CDSS **Last Visit Date** / **All Visit Dates** were already newer than both stored inspections and `REPORTARRAY` dates, so later-posted PDFs were never fetched. `ccld_citations_ingest.py` also skipped a listed Lotus `REPORTPAGE` id whenever it was in `previous_keys`, without checking that an `inspections` row existed; `snapshot_update_for` wrote the full index inventory; the pending path logged “pending gap unchanged; index has no new report id” and never retried. `inspections_facility_date_type_agency_unkeyed` blocked two complaints on the same day. GitHub Actions TLS/timeouts on `FacilityReports` were treated as “no new reports.” 317 reports across 211 published CA homes had to be backfilled by hand.

**What worked instead:** Keep the snapshot pending while any bulk visit date is newer than stored inspections and `REPORTARRAY` dates. Skip by key only when the inspections row exists (`report_key` in `raw_data`, or date + type + `complaint_id`); if the key is stored and the row is missing, refetch and insert. Write only ingested keys plus explicit `no_document` skips. Widen the unkeyed unique index with `complaint_id` (migration 0084, not applied here) and set CA `source_event_id` to the Lotus id. Refuse `FacilityReports` from GitHub Actions; TLS failures stay errors. Run the watch on the Mac.

**Source:** Hand backfill 2026-11-26; `scrapers/ccld_citations_ingest.py`; `scripts/test_ccld_citations_ingest.py`.

---

## 2026-11 — Repeat-offender CSV vs current publishable license

**What went wrong:** Layer 2 `content_checks.py` looked up the frozen May 2026 repeat-offender CSV with `publishable = true LIMIT 1`. After a home is re-licensed, the visits live on the unpublished prior row (Opal Care, Beach Terrace 306005901, Lincoln Villa 019201025). Duplicate names (two publishable Merisol Care Home rows) made `LIMIT 1` pick the license with zero visits for that code. CI then failed "not found" / "lost visits" even though the inspection rows are still in the database.

**What worked instead:** Match any CA row with that legal name and city, including unpublished, and pick the candidate whose visit count for the regulation is closest to the article. Do not merge licenses and do not republish closed rows from the app.

**Source:** PR #251 validate job, 2026-11-26.

---

## 2026-11 — City hub counts drifted because CMS intros and CA FAQ fallback

**What went wrong:** San Diego's live intro said 23 homes / 3,374 beds while the headline, stats, and A–Z said 22 / 3,224. The missing home (Vista del Sol) had no inspections, so `facilityListedOnHub` dropped it, and a published `hub_content` row still quoted 23. Kansas City FAQs were California (Medi-Cal, CDSS, RCFE, Type-A/B) because `getStateStrings` had no Missouri branch and fell through to the CA default. Findings footnotes defaulted to CA CDSS Type-A/Type-B for Minnesota and Oregon. Oregon "serious citations = 0" was `severity >= 3` on rows with no class or severity. Kansas City "Improving 135 → 100 → 17" used a 12-month window with only 5 inspections.

**What worked instead:** One listed set for every count on the page; skip `hub_content` bodies on city hubs; add MO (and keep MN/OR) to `getStateStrings`; state-keyed `findingsCopy`; Oregon never counts as "serious"; Missouri Class I from `class` only; suppress the 12-month trend below 8 inspections in the window. Do not write publishable flags or merge licenses to close the remaining local-pack gaps.

**Source:** Four-city hub specs, 2026-11-26.

---

## 2026-11 — HB2764 is not a Memory Care subclass

**What went wrong:** The Arizona licensing guide, FAQs, and regulator primer said HB2764 created a separate Memory Care subclass that facilities apply for, and that Directed Care alone does not confer that status. That contradicted A.R.S. § 36-405.03 and A.A.C. R9-10-816.

**What worked instead:** HB2764 (Laws 2024, Ch. 100) told ADHS to write memory-care standards for homes already licensed for directed care. R9-10-816 (eff. June 30, 2025) is that rule. ADHS's final-rulemaking hearing said memory care services are the same as directed care. Copy now uses: “Licensed for Directed Care. Arizona authorizes these homes to provide memory care services (A.A.C. R9-10-816).” Do not imply a dedicated secured unit without other evidence.

**Source:** ADHS notice of final rulemaking; A.R.S. § 36-405.03; user correction 2026-11-26.

---

## 2026-11 — City hub name-dedupe collapsed distinct Mesa homes

**What went wrong:** Display-level name dedupe ran on every city. Mesa has five listed homes that share a legal-style name in different ZIPs, so the H1 dropped from 145 to 140 while title/meta still said 145.

**What worked instead:** Dedupe by name + ZIP, and only on Pennsylvania city hubs (the Pittsburgh duplicate-license problem). Arizona homonymous names stay listed.

**Source:** Local `/arizona/mesa` curl after the city-hub template, 2026-11-26.

---

## 2026-11 — PA “Immediate Jeopardy” on personal care homes

**What went wrong:** `pa_pdf_parse.py` asked Haiku to classify 55 Pa Code findings into a vocabulary that included “Immediate Jeopardy.” Abuse/neglect citations (`§ 2600.42`) came back as IJ. Display then mapped `immediate_jeopardy=true` and `severity >= 4` to an IJ chip, so Substantiated Abuse and CMS F-tags on mixed SNF rows looked the same.

**What worked instead:** Display-only remap in `paFormatSeverityTag`: 55 Pa Code IJ → Substantiated Abuse or Serious finding; CMS F-tag IJ → “Immediate Jeopardy (CMS).” Do not write the deficiency rows from the app. Re-parse is a future ingest job.

**Source:** Pittsburgh city spec, 2026-11-26.

---

## 2026-11 — Nested PostgREST counts blanked /data

**What went wrong:** `loadStateMemoryCareStats` counted serious homes with a three-level `facilities → inspections → deficiencies` embed and `.or(..., { referencedTable: "inspections.deficiencies" })`. Any one state's error returned `null` for the whole table, so `/data` printed "The state counts could not be loaded."

**What worked instead:** Walk publishable facility IDs in chunks, load inspections and deficiencies the same way state hubs do, skip a state that still fails, and return the rows that measured. Do not fail the page because one nested join timed out.

**Source:** Read-only data audit, 2026-11-26.

---

## 2026-11 — Firecrawl price extract: rate limit, and a neighbour's price

**What went wrong:** The 20-home price probe through `fc_search` and `fc_extract` got rejected by the plan's rate limit on 18 homes. The two answers it did give had a problem: A Place for Mom's compare table puts neighbouring homes' prices on a home's own page, and the model took one (Touch of Love at $6,500, where its own column is empty).

**What worked instead:** Plain HTTP with `scrapers/_robots.py`, the sites' own sitemaps to find each page, a check that the page's address block has our ZIP and house number, and a reader of the home's own price rows only. No model, no paid API.

**Source:** `scrapers/cost_fetch.py`, probes `cost_fetch_probe_1` and `cost_fetch_probe_2`.

## 2026-11 — The Arizona plan backfill sat still after a browser driver died

**What went wrong:** Each worker printed only when its whole batch finished. One of the three Playwright drivers exited, the page call never returned, and the count of `View` rows stayed at 1,138 for 20 minutes.

**What worked instead:** Stop that process and start `--mode poc` again. It only selects rows that are still `View`. Print one line per inspection, and give the page a 25-second timeout so a dead browser becomes an error instead of a wait.

**Source:** `scrapers/az_adhs_inspections_ingest.py --mode poc`.

## 2026-11 — Arizona plan text was the word View

**What went wrong:** The inspections ingest stored the button label `View`. The plan is a separate public page, not a file and not behind a login. Reading the button text, reading a detached copy of the page, and passing `page.wait_for_function` its argument in the wrong position all came back empty. The page also shows a "Sorry to interrupt CSS Error" dialog. That dialog is not the plan. `--mode deficiencies` deletes the findings and inserts them again, so it is the wrong way to fill in the text.

**What worked instead:** Open `inspection-plan-of-corrections` for that finding. Read the connected element's text. Wait until a known label is followed by a line that is not another label. Update `plan_of_correction` only where it is still `View`, matched within the inspection by the rule text and the evidence. A finding that does not match stays `View`.

**Source:** `scrapers/az_adhs_inspections_ingest.py --mode poc`.

---

## 2026-11 — An unordered citation checksum looked like a new inspection

**What went wrong:** The facility-watch checksum sorted deficiency rows by date, source URL, and code, and left ties unordered. Reading the same California record twice could produce a different checksum. Palm Villas, Campbell and Mountain View Center were then logged as “inspection record changed (+0 inspections, +0 citations)” on a run that stored nothing. A finished scan would have emailed that.

**What worked instead:** Sort each checksum row by the full row text, then by inspection id and deficiency id, so the order is total. Two captures of the same state now match.

**Source:** `scripts/state_watch_ledger.py`. Scan `1e6a2659-3cbb-49bd-abdf-f19eea185c30`.

## 2026-11 — CDSS report index ignores a new request shape while it is hung

**What went wrong:** The FacilityReports index and the per-report page accepted the connection and returned no bytes. Retrying with the official client header removed, with `Connection: close`, and with HTTP/1.0, HTTP/1.1, and HTTP/2 all timed out the same way. The query-string index route returned 404. A rewritten Lotus document URL returned 404. Guessed statewide report downloads returned 400. The public search page returned 503. The statewide elder-care file kept returning 200.

**What worked instead:** Keep the statewide file as the change detector. Check the report index in batches of eight, stop a wave after two failed batches, and look twice more on a fresh connection later in the same run. Do not fail the run again when a pending home's stored statewide row is unchanged and the index has no new document id.

**Source:** `scrapers/ccld_citations_ingest.py`. Live probes on 2026-11-07 against facility `306002915`.

## 2026-11 — A model refusal was stored as the family's summary

**What went wrong:** Visits whose stored text is a cover sheet, an abbreviation list, or a form heading were sent to the summarizer. When the model answered "I cannot provide a summary," that sentence was saved on `narrative_summary` and shown on the profile. A few California cover pages also hid a real finding that lived on the deficiency row, not in `raw_data.narrative`.

**What worked instead:** Treat a cover, a glossary, and an unreadable report as not a finding. Quote the deficiency account when it says what happened. When the file does not include the finding, say that in one sentence, and include a marked substantiated or unsubstantiated result only when that field is stored. Reject any model reply that says "I cannot" or "please provide." Leave a real multi-sentence narrative for the state-specific prompt.

**Source:** `scrapers/plain_visit_summaries.py` and `scrapers/summarize_inspections.py`.

## 2026-11 — An Illinois rule number is not an inspector's account

**What went wrong:** The Illinois visit file stores lines like `295.6000, T1, $2,000`. Sending those to the California summarizer, or to a prompt that says "state what was found," produces an invented incident. The profile also hid `narrative_summary` whenever `raw_data.narrative` was missing, so a real summary never appeared. Updating each inspection with `WHERE id::text =` could not use the primary key, and one batch sat for several minutes. `$1K` was read as a one-dollar fine, and `$1.000` was read as one dollar.

**What worked instead:** Translate the section number with the official Part 295 title, name the Type and the fine, and say the file does not describe what the inspector saw. Show a stored summary even when there is no long narrative. Load the new summaries into a temp table and update on `inspections.id`. Treat `$1K` as $1,000 and `$1.000` as $1,000. A later `**CA 2K` is the revised amount, not California.

**Source:** `scrapers/plain_visit_summaries.py`.

## 2026-11 — A plain fetch of the Illinois LLCS lookup is not the roster

**What went wrong:** `https://llcs.dph.illinois.gov/s/facility-lookup` returns a Salesforce shell to a non-JavaScript fetch. Guest REST on `LLCS_Facility__c` is 401. The 2021 open-data file `8z4a-ix8q` still looks like a roster and is expired. A title-case of all-caps portal names turned `II` into `Ii`, `MC` into `Mc`, and `MCHENRY` into `Mchenry`. A slash in `AVONLEA COTTAGE #1/QUAD CITIES` was dropped on the first repair.

**What worked instead:** The same guest session the page uses answers Aura calls with `aura.token=null`: `FacilitySearchLookupHomePage.getFaciliyResult` by county, `RecordUi.getRecordUis` with the Alzheimer field requested as an optional field, and `LLCS_LicensePageUnauth.getLicenseResult` for `licId`. Two full pulls matched. Title-case keeps LLC, MC, II, and McHenry, and keeps slashes. The designation is that lookup field, not a 295.4060 citation and not a directory ad.

**Source:** `scrapers/il_llcs_live_roster.py` and `scrapers/il_llcs_roster_apply.py`.

## 2026-10 — Missouri tour questions copied California Title 22

**What went wrong:** The non-California prompt included the Silverado Berkeley example and a fallback line that said memory care was "not formally designated in CDSS licensing data." Missouri questions then cited CDSS and Title 22 §87705. A later pass cited section 198.510 as if that disclosure were on the facility's row. The model quality gate let some of those through. The single-directory review step also marked published Illinois name-match homes as `needs_review` because it did not treat `il_mc_name_match` as a stronger signal.

**What worked instead:** Drop the California example from the non-California prompt. Tell the generator not to mention a designation, a disclosure, or a statute section. Reject the question in code if it contains CDSS, Title 22, 87705, 198.510, "designation," or "disclosure." Leave the single-directory queue for homes that do not already have the Illinois name match, the Illinois dementia flag, or a Missouri government signal.

**Source:** `scrapers/generate_content.py` and `scrapers/recompute_publishable.py`. Illinois and Missouri parity rebuild, 2026-10-31.

## 2026-10 — Missouri same-day visits and Illinois visit ids were collapsed

**What went wrong:** The Missouri loader upserted on facility, date, and type, so 169 events that shared a day were overwritten and 231 of their tags were deleted. A rerun also turned Excel datetimes into text and then stored a blank inspection date. The Illinois loader treated the FOIA `Name` cell as a license number. The LLCS portal is a Salesforce shell with no facility list, and the open-data file expires in 2021.

**What worked instead:** Keep one inspection per Missouri `EVENT_ID` and per Illinois visit id. Parse the spreadsheet date before it is stored as text. Match Illinois visits by physical name, quarantine the rest, and refuse `--bootstrap-from-foia`. Do not insert an `il_inspection_inventory` row unless someone supplies a real PDF URL. There was no ShowMeLTC manifest in this checkout, so the narrative summary used the inspector text already stored.

**Source:** `records.xlsx` SHA-256 `ff7e732b7e2e39d5e9d085ecd9976669f36b6705d0012405ec6e3da98c4ada55` and the FOIA workbook SHA-256 `2218c844463e75a3e4f9d934dc6f24ac874f0ec89c7c5f0ea7f0c88f2c4d86b4`. `docs/drafts/illinois-missouri-parity-audit.md`.

## 2026-10 — Street View uploads returned HTTP 400 with the new Supabase key

**What went wrong:** `scrapers/fetch_streetview.py` uploaded JPEGs to the `facility-photos` bucket with only `Authorization: Bearer`. The service key is the newer `sb_` key, not a JWT. Storage rejected every file with HTTP 400. The image itself was a valid JPEG.

**What worked instead:** Send the same key again as the `apikey` header, next to the bearer token. A rerun is safe: a failed upload never writes `photo_url`, and a later upload uses `x-upsert`.

**Source:** Colorado Street View pass on 2026-10-31. One manual upload of the same bytes succeeded after the header was added.

## 2026-10 — Turbopack dev will not start in a worktree with a linked node_modules

**What went wrong:** A git worktree that symlinks `node_modules` from the main checkout failed `next dev` with a Turbopack panic: "Symlink [project]/node_modules is invalid, it points out of the filesystem root." Every page returned an empty body.

**What worked instead:** `npx next dev --webpack -p <port>` in the worktree. `npx tsc --noEmit` works with the symlink as is.

**Source:** `cursor/aeo-article-depth` worktree, 2026-10-31.

## 2026-10 — Washington adult family home documents were invisible to the scraper

**What went wrong:** The adult family home scraper only kept PDF links that were already a full `https://fortress.wa.gov/...pdf` address. DSHS posts relative links, with the month and the category in the link text (`10/2026 - Enforcement Letters`). Every weekly run recorded zero documents. Approving one of those homes published it, and the page said there were no citations. That included a home whose license had been revoked.

**What worked instead:** Read the link and its text, keep the category and the month, and do not publish a Washington adult family home until that list has been read. A Tier 1 flag stays off the page until a person approves the banner. A later lift letter closes only the same kind of action.

**Source:** AFHForms pages for licenses 756400, 755245, and 753541 on 2026-10-27.

## 2026-10 — The review queue's 5,000-row limit still returned 1,000 homes

**What went wrong:** The yellow queue asked for 5,000 homes that still need a decision. The database API stops at 1,000. Homes kept pending stay in that status, so their notes filled the window. California and Minnesota were all the page could show, and Oregon, Pennsylvania, Texas, and Washington never appeared. Refreshing did not help.

**What worked instead:** Ask only for homes whose note is empty, 1,000 at a time, and put a Next link on the page. A saved note stays on the home and keeps it unpublished. It just leaves the window so the next state can load.

**Source:** Review session on 2026-10-26. Unreviewed homes with no note: Minnesota 254, Oregon 128, Pennsylvania 657, Texas 75, Washington 7,144. California's remaining 20 already had notes.

## 2026-10 — A partial California crawl had visit changes and still must not email

**What went wrong:** The morning Mac crawl often stops inside its time budget. Those runs are stored as `partial` and can still list new visits. Treating that list as a finished scan would email families about a crawl that did not finish. The older California data check would also have failed a quiet week, which would have blocked a finished scan for the wrong reason.

**What worked instead:** Sunday mail reads `state_scan_runs.status`. Only `completed` is eligible, and only after the current data check passes. The check no longer fails because facility rows were left untouched.

**Source:** California scan rows from 2026-10-16 through 2026-10-25. Layer 5 run on 2026-10-26 passed 4/4.

## 2026-10 — Merging the ingest script started a production scan and could email families

**What went wrong:** The weekly workflow ran on a push to `main` of `scripts/weekly_inspection_ingest.py` or `scripts/probe_inspection_freshness.py`. Merging earlier pull requests queued two full scans on the old data checks. The alert step also ran whenever the scrape itself succeeded, including when the data check failed, so a passing check on a weeknight merge would have emailed families.

**What worked instead:** Take the push trigger off. Send family mail only from the Sunday schedule, and only when the data check passes. A manual run still has to opt in. Cancel the two scans that the merges had already started.

**Source:** Runs `40262641487` and `40262771711`.

## 2026-10 — Data Validation stayed red on checks that do not describe the record

**What went wrong:** Every pull request failed Layer 1. The failures were a facility `updated_at` older than 90 days in California, Minnesota, Oregon, Texas, and Utah; 34 homes with blank or zero beds, 30 of them the entire Illinois roster; and Marquis Oregon City Post Acute Rehab, whose composite rank was 78 with three repeated codes in a state that stores no repeat flags. Layer 2 then failed because a static California article had drifted from live citation totals. None of those checks said whether an inspection date was real.

**What worked instead:** Judge freshness by the inspection date. Count missing beds only where the state publishes them. Compare repeat codes with composite rank only in states that store repeat flags. Print article drift, and print a sample row that gained a visit, instead of failing the build. A visit the sample named and the database no longer has still fails. Retry a Pennsylvania block or a Utah 500 once, and fail the scan if it is still down. An Arizona facility call that errors fails the same way. A missing Texas capture file does not.

**Source:** Data Validation run `40261769957`; `scripts/validate/db_invariants.py`.

## 2026-10 — Illinois and Washington Sunday runs were not reading a new inspection

**What went wrong:** Illinois exited 0 after probing PDFs for the 147 visits already stored and finding none. That job does not ask the portal for a survey newer than 2026-05-06. New Illinois visits come from the FOIA file. Washington spent about four hours and added zero inspections. Two hours and eighteen minutes were the adult-family-home discovery step, and about an hour was the physical-city recompute. The newest Washington date stayed 2026-12-01, which is the date on the Aegis Living Kirkland source file.

**What worked instead:** Say in the Illinois log that the run is looking up PDFs, not new visits. Leave the Washington date in place. The long Washington steps are a later performance task, not a bad date.

**Source:** GitHub Actions run `40194733653`, jobs `121173017040` and `121173017116`.

## 2026-10 — Sunday scan emails fired on checks a quiet week cannot pass

**What went wrong:** Run `40194733653` marked Minnesota, Oregon, Illinois, Pennsylvania, Utah, Arizona, Missouri, and Washington failed after the scrape step had already exited 0. The post-ingest hook required 80% of facility rows to be edited in the last 7 days, and it required `facilities.last_inspection_date` on every published home. Most states do not rewrite facility rows when the source is unchanged, and that date column is blank for every published home except most of Minnesota. Illinois also failed because none of its 30 homes have bed counts. The failure email always said no subscriber alerts were sent, including when the alert step still ran. California, sitting in the middle of the one-at-a-time queue, was cancelled at six hours and delayed the states behind it.

**What worked instead:** Keep California on the Mac job. Judge the GitHub job by whether the scrape finished and whether the checks that state can actually pass succeeded. Print the quiet-week edit count instead of failing on it. Coverage is an inspection row, which every live state already has. Send one email when the scrape stops, and a different email when a real data check fails after a finished scrape.

**Source:** GitHub Actions run `40194733653`; `scripts/validate/post_ingest_check.py`.

## 2026-10 — Sequential California checks held DB transactions during CDSS waits

**What went wrong:** `ccld_citations_ingest.py` checked roughly 662 publishable
homes one at a time, opened a database connection before each network check,
and retried a slow CDSS request up to six times. A routine zero-change pass
could therefore hold an idle transaction for minutes per home and run until
GitHub's six-hour timeout. Cancellation then left `state_scan_runs` and
`scrape_runs` falsely marked `running`.

**What worked instead:** Preload stored report URLs in one query, check facility
indexes with six bounded workers and per-worker HTTP connection reuse, and open
write connections only for newly discovered reports. After twelve consecutive
index failures, stop the outage crawl and return non-zero so the scan is
recorded partial/failed and cannot notify families. Always close the two ledger
rows after externally cancelling a job.

**Source:** GitHub Actions run `40129407306`; `scrapers/ccld_citations_ingest.py`.

## 2026-07 — Local ESLint hangs under Node 24 without producing output

**What went wrong:** Both `npx eslint ...` and direct `node node_modules/eslint/bin/eslint.js ...` remained asleep for more than five minutes with no file handles or diagnostics. Even `eslint --version` hung. This is local-tooling behavior under Node `v24.14.1`, not a reported lint violation.

**What worked instead:** `node node_modules/typescript/lib/tsc.js --noEmit --pretty false` completed successfully (slowly, after ~17 minutes). Python syntax/tests, workflow YAML parsing, and `git diff --check` were run independently. Use the repository CI/runtime Node version for ESLint until the local Node/ESLint hang is resolved.

---

## 2026-07 — Vercel Stripe Price IDs had trailing newlines

**What went wrong:** `STRIPE_PRICE_FACILITY_WATCH_MONTHLY` was stored as `price_…\n` (likely `printf`/`vercel env add`). Stripe rejected Checkout with `No such price: 'price_…\n'`.

**What worked:** Re-add env values with `printf '%s'` (no newline), and trim all Stripe env reads in `src/lib/stripe/server.ts` via `envTrim()`.

**Source:** Facility Watch launch QA after checkout 500s.

---


## 2026-07 — facilities has no state_slug column

**What went wrong:** Paid Facility Watch checkout/webhook/billing queried `facilities.state_slug`. PostgREST returned column does not exist → checkout 404 "Facility not found" with the CTA live.

**What worked:** Derive the URL slug with `stateFromCode(state_code)` from `src/lib/states.ts` (same pattern as watch welcome digests). Do not select `state_slug` from `facilities`.

**Source:** Facility Watch launch QA after PR #60.

---


## 2026-07 — WA full refresh overwrote physical city before Census recompute

**What went wrong:** `wa_geo_directory_ingest.py` updated `facilities.city` from the ArcGIS directory for existing rows but did not update `city_slug` or run the required Census physical-city step. The first State Watch catch-up attempt was stopped after the Geo pass began. The repair script then failed because production was unexpectedly missing migration 0045 (`historical_city_slugs`).

**What worked instead:** Existing WA rows no longer accept `city` from the directory upsert. The weekly WA pipeline runs `recompute_physical_city.py --state WA --apply` immediately after Geo, before publication. Migration 0045 was safely applied before retrying the Census recompute. The recompute now retries transport failures and never caches a timeout as “no Census place”; legacy null cache entries are discarded. Any interrupted state scan is marked failed, so it cannot notify subscribers.

**Source:** `scrapers/wa_geo_directory_ingest.py`, `scrapers/recompute_physical_city.py`, `scripts/weekly_inspection_ingest.py`.

---

## 2026-06 — AZ facility pages returning 500/timeout after deficiency backfill

**What went wrong:** After the 2026-06-22 AZ deficiency backfill, AZ facility pages started returning 500 errors and timing out in Ahrefs (120 hard 500s + 1,100 timeouts). Root cause: each page render called `facility_snapshot` ~60 times (loader called twice with no dedup, plus discovery rails calling it per card for up to 58 facilities) and the backfill made each RPC scan a much larger AZ peer corpus.

**What worked instead:**
1. `React.cache()` on `loadFacilityProfile` to deduplicate the double call
2. Strip RPC from discovery rails — sort by `last_inspection_date` at DB level
3. `maxDuration = 60` on the facility route
4. Migration 0055 snapshot cache columns for future rail grade display

**Do not** call `facility_snapshot` per card in discovery rails. It is O(n) in the number of facilities shown and kills cold ISR performance.



## 2026-06 — AZ deficiency endpoint: Salesforce Aura guest access blocked

**What didn't work:**
1. Guessing Aura controller/method combinations for deficiency details (e.g. `getInspectionDeficiencies`, `getDeficiencies`, `getStatementOfDeficiencies`) — all returned `clientOutOfSync`, which is Salesforce's error for "this Apex action is not exposed to guest users." Not a `fwuid` mismatch.
2. Two browser-agent CDP capture attempts — both hung/were interrupted because the Salesforce Experience Cloud page uses a complex multi-frame setup and the deficiency data is bootstrapped into the initial page render rather than fetched as a discrete subsequent XHR.
3. Fetching `app.js` bundle to grep for Apex descriptors — dynamically loaded controllers aren't in the main bundle.

**What worked instead:** Playwright (headless Chromium) rendering the full page at `/s/inspection-details?inspectionId=&facilityId=`, waiting for `[role='grid']`, and parsing the rendered DOM. The deficiency table is fully rendered in the DOM with `<th>` rule cells and `[role='gridcell']` evidence/POC cells. See `scrapers/az_adhs_inspections_ingest.py --mode deficiencies`.

**Source:** `cursor/az-deficiency-parsing` 2026-06-22.

---

## 2026-06 — Loops Facility Watch welcome: wrong editor + wrong variable syntax

**What didn't work:**
1. Pasting `watch-welcome.html` into Loops's **Styled/block** editor — HTML renders as escaped raw tags.
2. Using `{{double braces}}` — Loops uses **single braces** `{facilityName}` in Plain/Styled/Subject, and `{DATA_VARIABLE:facilityName}` in MJML.
3. Expecting a paste box in the **Code** tab — it wants an **MJML zip upload**, not inline HTML.
4. Naming the MJML `watch-welcome.mjml` inside the zip — Loops requires the file to be named **`index.mjml`** exactly.
5. HTML comments in MJML containing bare `{facilityName}` — Loops parses them as **contact properties** and rejects the upload ("Contact properties are not allowed in transactional emails"). Only `{DATA_VARIABLE:name}` may appear in MJML; setup notes belong in `LOOPS_WATCH_WELCOME_SETUP.md`, not in the uploaded file.

**What worked instead:** Upload `src/lib/email/templates/watch-welcome-loops.zip` containing a single `index.mjml` (copy of `watch-welcome.mjml`) in the Code tab. Subject: `You're watching {facilityName}`. Publish → set `LOOPS_WATCH_WELCOME_ID`. See `LOOPS_WATCH_WELCOME_SETUP.md`.

**Source:** [Loops transactional docs](https://loops.so/docs/transactional/guide), `src/lib/email/templates/`.

---

## 2026-06 — TipTap silently drops the data-stat spans (hub content editor)

**What didn't work:** Planning a TipTap/WYSIWYG editor for `/admin/hub-content`. TipTap parses input HTML through its own schema; a `<span data-stat="facility_count">93</span>` is not a node/mark it knows, so on load it **silently strips the span** (or its attribute), turning a verified number into unverifiable plain text. On a YMYL page that defeats the entire accuracy gate. Making it safe would require a custom mark/node extension that round-trips + locks the data-stat spans — high surface area that fails silently if subtly wrong.

**What worked instead:** An **HTML-source editor + live sanitized preview**. Numbers stay as literal text in the source (impossible to drop), and `verifyHubStats` runs live in the editor and again on save/publish. Zero new deps. If WYSIWYG is ever wanted, the numbers must be render-time tokens resolved from the snapshot (not literal in the editable body), not editable text.

**Source:** `src/app/admin/hub-content/[id]/HubContentEditor.tsx`, `src/lib/content/hubGate.ts`.

---

## 2026-06 — Claude Code on the web can't reach the DB: HTTP-only proxy + disabled legacy keys

**What didn't work:** Reaching Supabase/Postgres from a Claude Code web session. Two distinct blockers, often confused: (1) the sandbox proxies **HTTP/HTTPS only**, so raw Postgres (psycopg / `DATABASE_URL` / psql) over TCP 5432/6543 times out — it can't tunnel the Postgres wire protocol even with "Full" network access. (2) Even over HTTPS (REST/`@supabase/supabase-js`), the env's **legacy `service_role`/anon keys were disabled 2026-05-20** → `401 "Legacy API keys are disabled"`. A *fresh* session opens the HTTPS path (resumed sessions keep the old network policy), but the key must be re-enabled (Supabase dashboard) or replaced with new publishable/secret keys for any live read.

**What worked instead:** Re-enable the keys (owner action), then read live over HTTPS via the supabase-js client. All psycopg scrapers / validators (incl. `hub_content_drift_check.py`) still run only in **GitHub Actions or Cursor**, never the web sandbox. Verify TS/render code here over HTTPS; verify Python by conformance + `py_compile` + unit-testing the pure logic.

**Source:** this session; `docs/` Claude Code on the web notes.

---

## 2026-06 — Claude Code on the web rewrites package-lock.json on every npm install

**What didn't work:** The web SessionStart hook (`.claude/hooks/session-start.sh`) runs `npm install` on each session start/resume. The cloud container's npm (10.9.7) annotates `package-lock.json` differently than whatever npm generated the committed lockfile — it adds `"dev": true` to `sharp`'s optional platform binaries and drops some `"libc"` arrays. ~40 lines of pure metadata churn, no version changes, on every session. The stop hook then nags about uncommitted changes every turn.

**What didn't work either:** `npm install --no-package-lock` keeps the tree clean but re-resolves the whole dependency tree from the registry (~38s) instead of using the lockfile (~4s) — a startup regression. `npm ci` was rejected too: it wipes `node_modules` and reinstalls from scratch each resume (slow, and the setup-hook guidance is to prefer cache-friendly `npm install`).

**What worked instead:** Keep the fast `npm install`, then `git checkout -- package-lock.json` immediately after. The committed lockfile stays byte-for-byte authoritative; the cloud sandbox never authors lockfile changes. **This means real dependency changes must be made in Cursor (or a deliberate task that commits the new lockfile) — the cloud hook will revert any uncommitted lockfile edit on the next resume.** Local Cursor is unaffected: the hook is guarded by `CLAUDE_CODE_REMOTE != "true"` and the lockfile content never changes.

**Source:** `.claude/hooks/session-start.sh`.

---

## 2026-05 — State directory feeds publish USPS mailing city, not physical city

**What didn't work:** Trusting the source feed's `CITY` field from UGRC's Utah ArcGIS facility layer. USPS assigns every SLC-metro suburb (Taylorsville, Murray, West Jordan, Holladay, etc.) to "Salt Lake City" for mail routing. Six months of Utah pages had wrong city slugs in the URL, breadcrumb, JSON-LD, and page copy.

**What worked instead:** Re-derive physical city from lat/lon via the Census Geocoder **after** geocoding, **before** `recompute_publishable.py`. Run `scrapers/recompute_physical_city.py --state XX --apply`. This pattern applies to TX (CCAD), MN (MDH), and IL (IDPH) too — they all inherit USPS conventions for metro suburbs. Prior slugs are stored in `historical_city_slugs[]` for 301 redirects.

**Do not:** Set `facility.city` from a directory CSV without running `recompute_physical_city.py`. Do not use a render-time override to patch the display name while leaving the slug wrong — URL/JSON-LD/page text must all agree on a YMYL directory.

---

## 2026-05 — `inspections.source_agency` was populated at ingest but SELECT ignored it

**What didn't work:** Using `cfg.agencyShort` for every inspection row in the UI. Utah facility profiles mix CMS nursing-home inspections (`source_agency = 'CMS'`, F-tags) with state ALF inspections (`source_agency = 'UT-CCL'`, R432 codes). Every CMS row showed "DLBC citations" and "View official DLBC report" linking to medicare.gov.

**What worked instead:** Add `source_agency` to the `fetchInspectionsAndDeficiencies` SELECT and `InspectionRow` type; call `agencyLabelForInspection(insp, cfg)` at every UI touch-point. See `src/lib/states/profileConfig.ts`.

---

## 2026-05 — UT facility detail endpoint: no stable URL found

**What didn't work:** Direct GET on `provider.dlbc.utah.gov/ccl/facilities/<id>`, `/ccl/facility/<id>`, `/ccl/facilities/<id>/inspections`, `/ccl/facilities/<id>/compliance`. All redirect or 404. Also probed `cclapi.dlbc.utah.gov/api/public/...` — no documented detail-by-id route surfaced.

**What worked instead (partial):** The facility list page exposes data only via the search form + row click handler. Inspection detail still requires a session-bound click flow, not a stable URL.

**Status:** UT inspection ingest is **WIP**. See `scrapers/_ut_detail_probe.py` for the failed direct-endpoint attempts and current state of the click-driven approach. Do not assume UT works the same way OR does (CSV exports + stable IDs).

---

## 2026-05 — Warning-flag signal misclassification → 116 false positives

**What didn't work:** Wiring `unendorsed_mc_violation` (facility names containing "Memory Care" without endorsement) as a Tier-1 signal in `recompute_publishable.py`. Caused 116 unendorsed OR facilities to publish.

**What worked instead:** `*_violation` flags are read-only editorial context for the profile page only. Never factor them into `serves_memory_care` or `publishable`. Tier-1 promotion requires an actual government credential (endorsement, certification, contract).

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #7. Now codified in `MEMORY.md`.

---

## 2026-05 — OR ingest INSERT column-name mismatches

**What didn't work:** Initial OR ingest scripts referenced columns that don't exist:

| Script used | Actual column |
|---|---|
| `regulation_code` | `code` |
| `is_relicensure` | (doesn't exist — use `inspection_type` text) |
| `is_followup` | (doesn't exist — use `inspection_type` text) |
| `deficiency_count` | `total_deficiency_count` |

**What worked instead:** Add a "DB column map" section to every state brief that maps **source CSV columns → actual `facilities` / `inspections` / `deficiencies` columns**. Verify against `supabase/migrations/0001_init.sql` and the state-specific migration before writing any SQL.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #2.

---

## 2026-05 — psycopg "aborted transaction" cascade

**What didn't work:** A failed `cur.execute()` inside a `with conn:` block puts the connection in an aborted state. Every subsequent execute — including the fallback — fails with `current transaction is aborted, commands ignored until end of transaction block`. One bad row silently kills the rest of the batch.

**What worked instead:** Wrap each row's writes in:

```python
cur.execute("SAVEPOINT sp")
try:
    # … row inserts …
    cur.execute("RELEASE SAVEPOINT sp")
except Exception:
    cur.execute("ROLLBACK TO SAVEPOINT sp")
```

All OR ingest scripts use this pattern. Copy it verbatim into new state scripts.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #4.

---

## 2026-05 — Per-row facility lookups don't scale past a few thousand rows

**What didn't work:** OR violations ingest (46k rows) doing per-row `SELECT id FROM facilities WHERE external_id = %s`. At ~150 ms / query × 46k rows ≈ **2 hours just for lookups**.

**What worked instead:** Pre-load the full `{external_id: uuid}` map once at the start of the script:

```python
cur.execute("SELECT external_id, id FROM facilities WHERE state_code = 'OR' AND external_id IS NOT NULL")
fac_map = {row[0]: str(row[1]) for row in cur.fetchall()}
```

Apply to any script resolving facility IDs in a loop > ~1k rows.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #5.

---

## 2026-05 — Violations silently skipped 100% of rows because inspections hadn't run

**What didn't work:** Running `or_violations_ingest.py` before `or_inspections_ingest.py`. `deficiencies.inspection_id` is `NOT NULL`. Every violation row hit the `skip_insp` counter — **no exception raised, no failure surfaced**. The script reported "completed" with 0 inserts.

**What worked instead:** Hard sequencing: inspections must complete before violations / regulatory actions. Scripts should assert non-zero inserts before reporting success ("Fail loud" — `CLAUDE.md` Rule 12).

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #3.

---

## 2026-05 — Python `print()` is invisible for 20+ min in overnight piped runs

**What didn't work:** `python3 script.py | tee logs/ingest/run.log`. `print()` block-buffers (4 KB) when piped. Progress lines don't appear in the log until the buffer flushes — usually only on process exit. Made overnight runs look stuck.

**What worked instead:**
- `python3 -u script.py | tee …` (forces unbuffered output), or
- `print("...", flush=True)` on every progress line.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` #8.

---

## 2026-05 — CMS NF directory ingest creates orphan rows (open)

**What didn't work (still open):** `cms_nh_directory_ingest.py` creates a brand-new facility row when it can't match an existing row by CMS CCN. OR's providers CSV doesn't include CCNs → all 128 OR nursing homes in the CMS dataset became orphan rows (`license_type=NULL`, all-caps names, no state license number). The 197 OR NF rows from the state providers CSV ended up with no CMS star ratings linked.

**What partially works (mitigation):** Orphan rows are not publishable, so no user-visible harm. But CMS quality data isn't surfaced on the state-licensed NF rows either.

**Fix pending:** One-time name + address fuzzy-match pass to merge CMS rows into state-licensed NF rows and copy over `cms_ccn` + `cms_overall_rating`. Must complete before surfacing NF quality on profile pages.

**Source:** `docs/OR_PIPELINE_LEARNINGS.md` ("CMS deduplication gap").

---

## 2026-05 — Inspections query silently truncated → 0 citations on facility list pages

**What didn't work:** Querying `inspections` with `.in("facility_id", ids)` and no `.limit()`. PostgREST's default row cap (typically 1000) silently truncated results. For CA's `/california/facilities` page, up to 2000 facility IDs were passed — producing a massive URL **and** only returning the first ~1000 of tens of thousands of CA inspections. Facilities beyond that slice (including Opal Care, CA's most-cited facility) showed 0 inspections / 0 citations on every list page.

The deficiencies query in the same page already had the correct pattern (chunked by 150 + `.limit(5000)`) — it was never applied upstream to inspections.

**What worked instead:** Chunk `.in("facility_id", ids)` exactly like deficiencies: 150 IDs per chunk, `.limit(5000)` per chunk. Apply to every page/helper that fetches inspections for multiple facilities:
- `src/app/[state]/facilities/page.tsx` (critical — state-scoped, up to 2000 facilities)
- `src/app/[state]/[city]/page.tsx` (city + county hubs, 3 separate inspections queries)
- `src/lib/regionsHubCount.ts` (SERP snippet data in `generateMetadata`)
- `src/app/api/facilities/[state]/route.ts` (public JSON API)

**Rule:** Any `supabase.from("inspections").select(…).in("facility_id", ids)` call without a `.limit()` is a latent truncation bug. Every such query must be chunked + limited.

## 2026-06 — MO ShowMeLTC crawl died repeatedly on a single transient error

**What didn't work:** Running the statewide `mo_sod_ingest.py crawl --from-db` (hours-long Playwright crawl) three ways that each lost all progress:
1. `nohup python … &` backgrounded from the agent shell — the job was **orphaned/killed** when the launching shell exited; it never got past the first city.
2. Harness-managed background, but with a **second Playwright crawl running concurrently** (a bounded test). Tearing down the test crawl killed shared browser processes → `write EPIPE` in Playwright's `PipeTransport.send`, killing the live run.
3. Single clean run, but the per-city loop had **no exception handling**: a transient `Page.goto: net::ERR_ABORTED` on the portal (a network hiccup ~18 cities / 318 PDFs in) threw uncaught and ended the whole crawl. Because the pipeline was a `crawl && ocr && load` chain, OCR/load never ran.

**What worked instead:**
- Launch long jobs via the **harness-managed background** (`block_until_ms: 0`), never `nohup … &` from the agent shell.
- **Never run two Playwright crawls at once** — tearing one down can kill the other's browser (EPIPE).
- Make the crawl **resilient per city**: extracted `_crawl_one_city()`, wrapped each city in a try/except that rebuilds the browser (handles both EPIPE browser-death and ERR_ABORTED) and retries once, then moves on. The crawl is **resumable** via the manifest (`(facility_name, inspection_date)` pairs), so completed facilities are skipped and any skipped city is recovered on a later pass.

**Source:** `scrapers/mo_sod_ingest.py` (`_crawl_one_city`, `crawl`); MEMORY.md "Missouri inspector narratives".

---

## 2026-10 — CDSS report indexes are zero-based and indexed URLs are unstable

**What didn't work:** Iterating `range(1, COUNT + 1)` skipped the first real
report and requested one nonexistent terminal index for every facility.
Treating `FacilityReports?facNum=X&inx=N` as report identity also missed reports
when CDSS arrays shrank or reordered. A statewide routine scan then spent over
30 minutes retrying hundreds of index/detail requests and still covered only
110 of 662 facilities.

**What worked instead:** Mirror the official client contract and enumerate
`REPORTARRAY` from zero. Use the Lotus document ID in `REPORTPAGE` as stable
identity, send the official client headers, and use the statewide bulk CSV as
the routine change detector. Persist only fully reconciled facility snapshots;
retry incomplete facilities on the next pass.

**Source:** `scrapers/ccld_citations_ingest.py`,
`scripts/test_ccld_citations_ingest.py`.

## 2026-10 — GitHub-hosted retries cannot reach CDSS

**What didn't work:** Re-running the California report crawl from GitHub
Actions. Four bounded probes to the same facility index all timed out, while
the identical request from this Mac returned a report list. More hosted
retries just repeated the outage and could not build the missing baselines.

**What worked instead:** Run regulator requests from the Mac. Keep the
statewide CSV as the fast check, and only deep-check facilities whose
snapshot is missing or changed, plus the two homes absent from the bulk file.

**Source:** `scripts/run_ca_watch_local.sh`,
`scrapers/ccld_citations_ingest.py`.

---

<!-- New entries go above this line. Format:

## YYYY-MM — Short title

**What didn't work:** …

**What worked instead:** …

**Source:** file / doc / commit reference

-->
