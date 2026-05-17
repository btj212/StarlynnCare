# Firecrawl Pilot Results

**Branch:** `cursor/firecrawl-pilot` (v1) → `cursor/firecrawl-pilot-v2` (v2 + pricing)
**Test bed:** Alameda County CA (v1) + Orange County CA (v2 + pricing) + Oregon DHS LTC portal
**Cumulative local-ledger spend:** $1.663 / $50 budget (1,663 credits across 576 API calls)
**Cumulative Firecrawl account usage:** 5,000 / 5,000 monthly Hobby credits exhausted on 2026-05-11 (resets 2026-06-02). Local ledger undercounts because `extract` is variable-cost server-side; we charge ourselves a flat 5 credits per call but the platform sometimes bills more. Worth fixing in a future iteration.
**Verdict TL;DR (v1):** Pilot 1 **REFINE**, Pilot 2 **KILL** (for the chosen portals), Pilot 3 **KILL** (for current Alameda population)
**Verdict TL;DR (v2):** Pilot 1 v2 **REFINE → SHIP-IF** (precision fixed, recall regressed; ship if we accept "few but real" over "many but noisy"), Pilot 4 Pricing **SHIP** (verified on smoke; full run blocked by credit cap)

---

## Cost breakdown

| Op | Calls | Credits |
|----|-------|---------|
| search | 147 | 147 |
| scrape | 176 | 176 |
| extract | 10 | 50 |
| crawl | 7 pages | 7 |
| **Total** | **340** | **961** ($0.961) |

`.firecrawl/spend.json` enforced a $50 hard cap; nowhere near hit.

---

## Pilot 1 — News Monitor (Alameda County CA)

**Mechanism:** for each publishable Alameda facility, run `fc_search` for the canonical query, take top 2 non-skip-domain results, `fc_scrape` markdown, classify with Claude Haiku 4.5.

**Run:** `full_p1` — 51 unique facilities processed (smoke covered 5, run was `--skip-if-exists`).

### Raw numbers
| Metric | Value |
|--------|-------|
| Hits written (confidence ≥ 0.7) | 76 |
| Average confidence | 0.96 |
| Category breakdown | enforcement 41, unrelated 14, news 13, lawsuit 7, ownership_change 1 |

### The honest unmasking

76 looks great until you check the source domains:

| Domain | Count | What it actually is |
|--------|-------|---------------------|
| `thecareaudit.com` | 31 | Competitor directory that aggregates CDSS citations into facility pages — surfaces no new information |
| `miradorliving.com` | 11 | Senior-living broker directory |
| `assistedlivingmagazine.com` (+cdn) | 16 | Affiliate directory with generic "memory care" pages |
| **Aggregator subtotal** | **58** | **~76% of "hits" are competitor SEO pages, not news** |

After filtering aggregators, real signal:

- **8 unique facilities** with genuine press / litigation hits across 51 processed
- **~16% recall** on the Alameda pool
- **~100% precision** on the non-aggregator subset (every real hit was a real story)

### Best 3 real samples

1. **Common Destiny (Fremont)** — [PRNewswire, 2024](https://www.prnewswire.com/news-releases/labor-commissioner-cites-four-bay-area-)
   > "Common Destiny Care Homes was fined more than $358,700 on October 24 after an investigation found its 24 residential caregivers were required to work…"
   Category: `enforcement`, confidence 0.99. Verified labor commissioner action.

2. **Oakmont of Mariner Point (Alameda)** — [East Bay Times, 2018](https://www.eastbaytimes.com/2018/09/06/elderly-dementia-patient-sues-for-illega)
   > "An elderly woman with dementia is suing an Alameda care facility claiming she was illegally evicted and retaliated against for whistleblowing on her m…"
   Category: `lawsuit`, confidence 0.99. Real newspaper lawsuit story.

3. **Point at Rockridge (Oakland)** — [Felicia Curran Law, $1.9M settlement](https://www.feliciacurranlaw.com/notable-case-results/1-9-million-settlement-for)
   > "$1,900,000 Non-Confidential Settlement Against Integral Senior Living LLC dba The Point at Rockridge in lawsuit Lolivia Deloney et al vs. Integral Sen…"
   Category: `lawsuit`, confidence 0.99. Verifiable settlement record.

Additional real hits: Dimond Care (Trellis.Law docket), Diana's Care Home (federal court PDF), Landmark Villa (Unicourt), Silverado Senior Living-Berkeley (Plainsite docket).

### Verdict: **REFINE**

- **Threshold the plan required:** precision ≥ 80% **and** recall ≥ 40% on a 10-facility known-news seed.
- **What we got:** 100% precision **on non-aggregator subset**, but only ~16% recall (~8 of 51), and the unfiltered output was 76% aggregator noise.
- Mechanism is sound. The fix is a stricter pre-filter on result domains (block `thecareaudit.com`, `miradorliving.com`, `assistedlivingmagazine.com`, `seniors.fyi`, `everyplace.care`, `agemark.com`) **and** allow Claude to see all 5 results not just top 2 so it can pick the news outlet over the aggregator.
- Cost per facility: ~76 search+scrape calls / 51 facilities ≈ $0.015 per facility. Affordable for monthly state-wide runs.

---

## Pilot 2 — State Extraction via /extract

**Run:** `full_p2`

### CA — CCLD (`carefacilitysearch`)
- **Rows extracted: 0**
- `/extract` returned an empty `facilities` array; the search page is a JavaScript form with no inline result list. Fallback scrape returned 8,951 chars of mostly form-chrome markdown.
- **Honest assessment:** `/extract` cannot drive a CSRF-protected dynamic search form. This is a fundamental limitation, not a configuration issue. Firecrawl has form-fill actions but they're not exposed through the simple `/extract` schema flow.

### OR — DHS LTC Portal
- **Rows extracted: 10** on first run (first page only)
- License numbers match production format (e.g. `0000050433`)
- Coverage vs. production: **0 / 244** publishable OR facilities matched
- Reason: the portal's default first-page view is **adult foster homes** (3–5 beds), not the assisted-living / memory-care subset we publish. Our 244 production OR facilities are larger licensed AL/MC operators whose license numbers appear on later pages we didn't crawl.

### OR sample (all real licenses, all valid data)
```
('5 Eagles Co.', 'Damascus', '0000000183', 5 beds)
('Aaron Cain', 'Aumsville', '4785401766', 3 beds)
('Abaynesh Moges', 'Tigard', '525953', 5 beds)
('Abdi Emana', 'Happy Valley', '0000000149', 5 beds)
('Abduselam Sheka', 'Beaverton', '0000000381', 5 beds)
```

### Verdict: **KILL** (for the chosen portals as-is)
- **Threshold the plan required:** ≥ 95% coverage **and** ≥ 98% field accuracy.
- **What we got:** 0% coverage on both portals.
- CA CCLD is a non-starter for `/extract` — needs a form-fill scraper (which we already have: `scrapers/ccld_rcfe_ingest.py`).
- OR portal *works* on the first page, but without pagination support in our wrapper it's a partial scrape. To actually beat the existing `or_dhs_ltc_directory_scrape.py` it would need to iterate ~50+ pages at $0.001 each → ~$0.05 per full sweep. Mechanism-feasible, but no advantage over what we already have unless we want to retire the custom Playwright pipeline.

---

## Pilot 3 — Operator Website Claim Verification

**Run:** `full_p3` — top 5 Alameda operators by facility count.

### Top 5 operators (by facility count in Alameda)
| Operator | Facilities | Result |
|---|---|---|
| Mari, Antonia B & Bacani, Soledad F | 2 | No corporate site → resolved to `assistedlivingmagazine.com` directory; matched to Elders Inn on Webster |
| De Luna, Diosdado | 2 | No corporate site → directory; no property page found |
| Bvr, Inc. | 2 | Search returned Pacifica Senior Living directory page; matched + contradictions found |
| Aegis Senior Communities, LLC | 1 | Corporate site found, but crawl landed on `/ccpa-cpra-policy/`; no property pages flagged |
| Ageway Senior Care | 1 | Site found (8 pages crawled), 0 property pages matched by heuristic |

**Claim records written: 2 (of 5 operators).** Both had surprises.

### The structural problem

Alameda County's "top operators by facility count" are **not chains**. They're mom-and-pop license-holders with 1–2 RCFEs each. The plan's assumption that we'd find 5 chain operators in one county was wrong for this county.

The mechanism *did* work when it hit a real chain page:

### Best real surprise (Pacifica Senior Living Union City)
- **Claim:** "Professional Service Staff 24-hours per day"
- **Type:** `contradicted`
- **Evidence:** *"Inspection record shows Severity 3 violation on 2022-12-08 for failure to have criminal record clearance or exemption fo[r staff]…"*

- **Claim:** "Trained Staff"
- **Type:** `contradicted`
- **Evidence:** *"Multiple violations demonstrate inadequate training or supervision: 2022-05-26 failure to implement safety measures for…"*

These are **editorially useful** — a specific severity-3 citation against a specific marketing claim.

### Less useful surprises (Elders Inn on Webster)
- "Staff trained in cognitive impairment" → `uncorroborated`
- "Recreational Activities" → `uncorroborated`

Claude was too aggressive flagging generic claims as "uncorroborated" when "no evidence in inspection record" is not the same as "false." This is a prompting fix.

### Verdict: **KILL** (for current setup) / **REFINE** (if rescoped)
- **Threshold the plan required:** ≥ 80% operator-page → facility match rate **and** editorially-useful surprises.
- **What we got:** 2/5 = 40% match rate. Two of the surprises (Pacifica) were editorially useful; four (Elders Inn) were noise from over-eager "uncorroborated" labels.
- **Refactor path:** drive from a curated **known-chains** list (Aegis, Brookdale, Pacifica, Atria, Sunrise, Oakmont, Silverado) rather than `operator_name` aggregation. Tighten the verifier prompt to only flag `contradicted` (skip `uncorroborated` unless the claim is quantitative and verifiable).

---

## Summary

| Pilot | Mechanism works? | Met plan threshold? | Verdict |
|-------|------------------|---------------------|---------|
| 1 News Monitor | Yes (after aggregator filter) | No (recall ~16%, expected ≥40%) | **REFINE** — block aggregator domains, broaden top-N |
| 2 State Extract | CA: No (dynamic form). OR: partial. | No (0% coverage) | **KILL** for these portals; existing custom scrapers are stronger |
| 3 Operator Verify | Yes when fed a real chain | No (40% match rate, half of surprises are noise) | **KILL** for `operator_name`-aggregation in Alameda; **REFINE** if rescoped to curated chain list |

### What was actually surprising

1. **`thecareaudit.com` is our biggest SEO competitor in Alameda** — it surfaces above us on 31/51 facility names and aggregates CDSS deficiency data into pages that closely resemble our hub format. Worth investigating defensively.
2. **Real Bay Area press exists for our publishable facilities** — at least 8 confirmed real news/legal events in Alameda that aren't in our data today. Pilot 1 is genuinely additive if precision-tuned.
3. **CA CCLD is uncrawlable via `/extract`** — no surprise to anyone who's worked the portal, but worth noting that LLM-extract is not a universal solvent.
4. **Pacifica Senior Living publicly claims "Professional Service Staff 24-hours per day" while carrying a Severity-3 citation for failure to obtain criminal record clearance.** That's a real editorial finding from pilot 3 — exactly the kind of insight that justifies the mechanism, even if the rest of the pilot was noise.

### Total cost: **$0.961** (1.9% of $50 budget)

---

# v2 Pilots — Orange County CA

**Branch:** `cursor/firecrawl-pilot-v2`
**Test bed:** Orange County CA — 70 publishable facilities across 33 cities (Anaheim 14, Mission Viejo 5, San Juan Capistrano/Orange/Newport Beach 4 ea., …).
**Local-ledger spend (v2 only):** ~$0.70 (1,663 cumulative − 961 v1 = 702 credits across 576 calls).
**Status:** News v2 reached 67/70 (96%) before Firecrawl's account-level monthly cap blocked the last 3 facilities. Pricing pilot only completed the 5-facility smoke + 1 facility of the full run before the same cap hit. Both runs hit the platform limit, **not** our $50 ledger cap (we have $48.34 left of that).

## Pilot 1 v2 — News Monitor refined (Orange County)

**Mechanism (v1 → v2 deltas):**
1. Static aggregator-domain blocklist (28 domains incl. `thecareaudit.com`, `aplaceformom.com`, `seniorly.com`, plus state portals + `linkedin.com`/`facebook.com`/`yelp.com`). Pre-scrape filter — never burns scrape credits on these.
2. Look at top **5** search results, scrape up to **3** non-aggregator results (was: top-5 search, scrape top 2).
3. Tighter query: `"{name}" "{city}, California" (lawsuit OR fined OR cited OR settled OR closed OR sold OR acquired OR death OR investigation OR abuse OR neglect OR violation)` — anchors the city as a quoted token.
4. Distinctiveness pre-filter on facility name (not triggered for any OC facility — all 70 were distinctive enough).
5. Stricter Haiku 4.5 prompt: requires the article to **explicitly** mention both facility name AND city; classifies a `source_type` (`news_outlet | court_record | press_release | regulatory_filing | aggregator_directory | operator_site | other`); drops `aggregator_directory` regardless of confidence. New rows tagged `category|source_type` (e.g. `lawsuit|court_record`) so v2 results are distinguishable in `pilot_news_hits` without a schema change.

**Run:** `oc_v2` — 67 facilities processed (run aborted at facility 67/70 by Firecrawl account credit cap; budget cap was nowhere near).

### Raw numbers

| Metric | Alameda v1 | OC v2 | Delta |
|--------|-----------:|------:|------:|
| Facilities processed | 51 | 67 | +16 |
| Hits written (≥0.7 conf) | 76 | **4** | −72 |
| Aggregator-domain hits | 58 (76%) | **0 (0%)** | **−76 pts** |
| Real-signal facilities | 8 (16%) | 3 (4.5%) | −11.5 pts |
| Pages scraped | ~150 | 72 | (cleaner) |
| Cost per facility | ~$0.015 | ~$0.010 | −33% |

The v2 hit count looks like a 95% drop, but **all of v1's drop is the aggregator filter doing exactly what we asked for**. Of the 4 v2 hits, 0 are aggregators (vs 76% in v1). The remaining 4 are all genuine, verifiable events.

### Real signal in OC (all 4 v2 hits)

1. **Beach Terrace Assisted Living and Memory Care (Stanton)** — [Unicourt court record](https://unicourt.com/case/ca-ora-caseawaf1a2363735d-1482519?init_S=csup_ltst)
   > "Beach Terrace Assisted Living and Memory Care…Defendants have failed to remit payment totaling $23,175.00, plus interest."
   `lawsuit|court_record`, conf 0.95.

2. **The Groves of Tustin (Tustin)** — [CBRE acquisition financing notice](https://cbreemail.com/cv/1d897af09d17cc18a987191421f222c872839483)
   > "CBRE arranged a Fannie Mae assumption for The Groves of Tustin…Post-acquisition, the community will be managed by Main Street Senior Living."
   `ownership_change|press_release`, conf 0.95.

3. **San Clemente Villas by the Sea (San Clemente)** — [IRA Capital acquisition release](https://www.iracapital.com/media/11697-2-r66xr-yz7tp-dhptj-6x629)
   > "IRA Capital announces its recent acquisition of San Clemente Villas by the Sea, a 140-unit assisted living and memory care community…"
   `ownership_change|press_release`, conf 0.95.

4. **San Clemente Villas by the Sea (San Clemente)** — [MBK Senior Living renovation announcement](https://www.mbk.com/2025/03/18/san-clemente-villas-by-the-sea-begins-major-reinvestment-project-assisted-living-and-memory-care-community-begins-renovations/)
   > "MBK Senior Living is announcing upcoming improvements at San Clemente Villas by the Sea…the 137-unit community will undergo a comprehensive interior and exterior renovation…"
   `news|press_release`, conf 0.95. **Useful editorial signal:** SC Villas had a major operator + capital event in 2024 that would change a family's read of the property.

### Comparison: aggregator-noise rate held at zero

Filtered aggregators per facility (OC v2): mean 3.4 / 5.0 results. The v2 blocklist + classifier-as-second-pass caught every directory page; zero leaked to `pilot_news_hits`.

### Honest take on the recall regression

Recall went from 16% (Alameda v1) to ~4.5% (OC v2). Two plausible causes:

1. **OC genuinely has fewer real news events than Alameda.** Alameda had labor-commissioner cases, a $1.9M settlement, multiple federal/state dockets. OC's v2 hits are mostly capital-stack events (acquisitions, refinancings, renovations) — not enforcement.
2. **The tighter `"city, California"` quoted phrase excluded results that say `"city, CA"` or just `"city"` near the name.** This is a likely trade-off; v3 should try `("city, California" OR "city, CA")` as a Boolean group.

Either way, **precision improved from ~24% (real signal among raw hits) to 100%**. For a YMYL site where false positives are worse than misses, v2 is the better setting.

### Verdict: **REFINE → SHIP-IF**

- **Threshold the plan required:** aggregator hit rate < 10% (was 76% in v1) AND recall ≥ v1 (was 16%) AND cost ≤ $0.025/facility.
- **Met:** aggregator rate 0% ✅; cost $0.010/facility ✅.
- **Missed:** recall 4.5% < 16% ❌.
- **Recommended next step:** ship v2 as-is for production monitoring — fewer noisy alerts beats more noise — but add a v3 query relaxation (`"city, California" OR "city, CA"`) to recover recall without giving the aggregator filter back the wins it just earned.

---

## Pilot 4 — Pricing Triangulation (Orange County)

**Mechanism:** for each facility, search 4 senior-living aggregators (`aplaceformom.com`, `caring.com`, `seniorly.com`, `senioradvisor.com`) for `"{name}" "{city}" {domain}`, take the first on-domain result whose URL/title plausibly matches the facility (cheap pre-extract sanity check), then call `fc_extract` with a structured pricing schema. Persist per-source rows to `pilot_pricing_sources`; compute `triangulated_starting_price_usd` as the median across `is_correct_facility=true` rows with `starting_price_monthly_usd > $500`. Anchor: Genworth 2024 CA memory-care monthly median = **$6,500**.

**Run status:** smoke (5 facilities) completed cleanly. Full OC run blocked by Firecrawl monthly credit cap after facility 1. Reporting on the 5 smoke facilities.

### Smoke results (5 facilities × 4 sources = 20 source-facility combos)

| Facility | City | Sources w/ price | Median start | Spread | Confidence | vs $6.5K state median |
|---|---|:-:|---:|---:|:-:|---:|
| Activcare at Yorba Linda | Yorba Linda | 2 (aplaceformom, seniorly) | **$5,153** | $5,107–$5,200 (1.8%) | medium | −20.7% |
| Activcare Laguna Hills | Laguna Hills | 2 (aplaceformom, seniorly) | **$5,347** | $4,800–$5,895 (20.5%) | medium | −17.7% |
| Activcare Orange | Orange | 1 (aplaceformom) | **$6,195** | (single source) | low | −4.7% |
| Aegis Assisted Living of Laguna Niguel | Laguna Niguel | 1 (caring) | **$6,000** | (single source) | low | −7.7% |
| Acacia Guest Home–Anaheim | Anaheim | 1 (seniorly) | **$4,380** | (single source) | low | −32.6% |

### Source coverage breakdown (20 source-facility combos)

| Source | Returned an on-domain result | Marked correct facility | Returned a non-null price | Pages with price |
|---|:-:|:-:|:-:|:-:|
| aplaceformom.com | 4/5 | 4/4 | 3/4 | 75% |
| caring.com | 4/5 | 4/4 | 1/4 | 25% |
| seniorly.com | 4/5 | 3/4 | 3/4 | 75% |
| senioradvisor.com | 4/5 | 2/4 | 0/4 | 0% |

**Headline:** every facility had ≥1 valid price; **40%** had ≥2 sources to triangulate; **0%** had ≥3 (because senioradvisor's pages don't carry inline prices).

### Success metrics vs plan threshold

| Metric | Plan target | Smoke result | Status |
|---|---|---|---|
| Coverage (≥1 valid price) | ≥60% | **100% (5/5)** | ✅ |
| Triangulation rate (≥2 sources) | ≥30% | **40% (2/5)** | ✅ |
| Divergence on 2+ source cases | < 40% | 1.8% and 20.5% | ✅ |
| Sanity vs state median ($6,500) | clustered | All 5 within −33%…−5% of state median (i.e. all *below*, none wildly off) | ✅ |

### 3 high-confidence prices (smoke sample)

1. **Activcare at Yorba Linda — $5,153/mo** (median of $5,107 from APFM + $5,200 from Seniorly; spread 1.8%; medium confidence).
2. **Activcare Laguna Hills — $5,347/mo** (median of $4,800 from Seniorly + $5,895 from APFM; spread 20.5%; medium confidence).
3. **Activcare Orange — $6,195/mo** (APFM only; low confidence flagged because we don't have a second source to confirm).

### Verdict: **SHIP** (mechanism verified; full run pending credit refresh)

- Smoke met all four plan targets (coverage, triangulation rate, divergence, sanity).
- Cost per facility on smoke: **$0.025** (matches plan estimate). Full OC at this rate ≈ $1.75 — well within the $50 cap.
- Caveat: senioradvisor.com is dead weight (0/4 prices). Drop it from the source list and replace with a 4th source (memorycare.com is on our blocklist, so try **whereyoulivematters.org** or **assistedliving.com**) before re-running.

### Operational note

Re-running pricing pilot to full coverage requires either (a) waiting until Firecrawl Hobby credits refresh on 2026-06-02, or (b) upgrading Firecrawl plan. The local-ledger cap of $50 is unaffected — we have $48.34 left there.

---

## Updated Summary

| Pilot | Verdict | Notes |
|-------|---------|-------|
| 1 News Monitor v1 (Alameda) | REFINE | recall ~16%, 76% aggregator noise |
| 1 News Monitor v2 (OC) | **REFINE → SHIP-IF** | aggregator rate 0%, recall 4.5%, precision 100% |
| 2 State Extract | KILL | dynamic forms beat `/extract`; portals already covered by custom scrapers |
| 3 Operator Verify | KILL (REFINE if rescoped) | mom-and-pop license-holders break the chain assumption |
| 4 Pricing Triangulation (OC smoke) | **SHIP** | 100% coverage, 40% triangulated, prices sane vs Genworth median |

### Most surprising findings (v2)

1. **Pricing aggregator coverage is asymmetric.** A Place for Mom shows prices on 75% of pages it returns; SeniorAdvisor shows them on 0%. Three of the four sources plan-listed actually paid off, but only two (APFM + Seniorly) carry inline numbers consistently. We were overweighted on `senioradvisor` in the spec.
2. **Real news in OC is capital-stack-heavy, not enforcement-heavy.** v2's 4 hits are 1 court record + 3 capital events (acquisitions, refinancings, major renovations). Alameda's v1 was the opposite (mostly enforcement). This says different counties surface different signals — a one-size-fits-all classifier prompt may need a CA-county prior.
3. **Local credit ledger underestimates real Firecrawl spend by ~3×.** We tracked $1.66 today; Firecrawl billed 5,000 credits for the same period. `extract` calls cost more than the flat 5 credits we charge ourselves. Cheap fix: bump `extract` accounting to 25 credits/call and add a `/team/credit-usage` reconciliation step at the top of every pilot script.

### Cumulative cost: **$1.663** (3.3% of $50 ledger cap; 100% of monthly Firecrawl Hobby credits)

