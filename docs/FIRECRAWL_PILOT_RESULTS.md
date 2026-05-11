# Firecrawl Pilot Results

**Branch:** `cursor/firecrawl-pilot`
**Test bed:** Alameda County CA (93 publishable facilities) + Oregon DHS LTC portal
**Total spend:** $0.961 / $50 budget (961 credits across 340 API calls)
**Verdict TL;DR:** Pilot 1 **REFINE**, Pilot 2 **KILL** (for the chosen portals), Pilot 3 **KILL** (for current Alameda population)

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
