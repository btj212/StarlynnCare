# Reviewer Bylines Audit
> **STATUS: Audit draft — for internal review only. Not published.**
> Audited: May 10, 2026
> Registry source: `src/lib/content/articleRegistry.ts`
> Total articles in registry: **19** (all `live: true`)

---

## Byline audit table

All 19 articles use the `AuthorByline` React component (imported from `@/components/editorial/AuthorByline`) with a `lastReviewed` prop set to `DATE_PUBLISHED`. The reviewer in every case is Rebecca Lynn Starkey BSN, RN, PHN (via the default `AuthorByline` render, which pulls from `src/lib/seo/editor.ts`). The Article JSON-LD also embeds `author` and `reviewedBy` nodes pointing to the same Person.

| # | Slug | Title | Reviewer on page | Published date | Last-reviewed date | Notes |
|---|------|-------|-----------------|----------------|--------------------|-------|
| 1 | `/library/when-is-it-time-for-memory-care` | When is it time for memory care? | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-03 | 2026-05-03 (= pub date) | reviewNote: footer links CA city hubs — update before OR/WA prominence |
| 2 | `/library/dementia-vs-alzheimers-vs-lewy-body` | Dementia vs. Alzheimer's vs. Lewy body | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-03 | 2026-05-03 (= pub date) | reviewNote: byline credits CA RN, content is universal |
| 3 | `/memory-care-vs-assisted-living` | Memory care vs. assisted living | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-02 | 2026-05-02 (= pub date) | reviewNote: uses CA inspections as examples; update before OR/WA prominence |
| 4 | `/library/37-questions-to-ask-on-a-memory-care-tour` | 37 questions to ask on a memory care tour | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-09 | 2026-05-09 (= pub date) | Registry slug duplicated: also at `/california/37-questions-to-ask-on-a-tour` (CA-specific version). Universal version is the canonical. |
| 5 | `/library/memory-care-vs-nursing-home` | Memory care vs. nursing home (SNF) in California | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-04 | 2026-05-04 (= pub date) | CA-specific; slug is under `/library/` not `/california/` |
| 6 | `/library/medi-cal-and-memory-care` | Medi-Cal & memory care | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-04 | 2026-05-04 (= pub date) | High YMYL (payer guidance). Cites CA statute §14132.275. |
| 7 | `/library/type-a-vs-type-b-deficiencies-explained` | Type-A vs. Type-B deficiencies, explained | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-02 | 2026-05-02 (= pub date) | CA regulatory, CDSS/CCLD framework only |
| 8 | `/california/cost-guide` | What memory care costs in California | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-02 | 2026-05-02 (= pub date) | Cites Genworth + CA RCFE market benchmarks |
| 9 | `/california/cost-by-city` | Memory care costs by California city & region | ✅ Rebecca Lynn Starkey BSN, RN, PHN | (confirm) | (confirm) | DATE_PUBLISHED not verified in audit; page has `AuthorByline` ✅ |
| 10 | `/california/glossary` | California memory care glossary | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-02 | 2026-05-02 (= pub date) | |
| 11 | `/california/37-questions-to-ask-on-a-tour` | 37 questions to ask on a memory care tour (CA) | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-02 | 2026-05-02 (= pub date) | CA-specific version; also exists as universal at #4 |
| 12 | `/texas/type-a-b-c-licensing` | Type A, B, and C assisted living in Texas | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-09 | 2026-05-09 (= pub date) | TX regulatory framework; CA RN reviewing TX regs — see note below |
| 13 | `/texas/memory-care-vs-nursing-home` | Memory care vs. nursing home (SNF) in Texas | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-09 | 2026-05-09 (= pub date) | TX regulatory framework |
| 14 | `/oregon/memory-care-licensing` | Oregon memory care licensing | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-09 | 2026-05-09 (= pub date) | OR DHS framework |
| 15 | `/oregon/memory-care-vs-nursing-home` | Memory care vs. nursing home in Oregon | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-09 | 2026-05-09 (= pub date) | OR framework |
| 16 | `/washington/memory-care-licensing` | Washington memory care licensing | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-09 | 2026-05-09 (= pub date) | WA DSHS framework |
| 17 | `/washington/memory-care-vs-nursing-home` | Memory care vs. nursing home in Washington | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-09 | 2026-05-09 (= pub date) | WA framework |
| 18 | `/minnesota/memory-care-licensing` | Minnesota memory care licensing | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-09 | 2026-05-09 (= pub date) | MN MDH/Ch. 144G framework |
| 19 | `/minnesota/memory-care-vs-nursing-home` | Memory care vs. nursing home in Minnesota | ✅ Rebecca Lynn Starkey BSN, RN, PHN | 2026-05-09 | 2026-05-09 (= pub date) | MN framework |

---

## Summary

| Metric | Count |
|--------|-------|
| Total live articles in registry | 19 |
| Articles with visible `AuthorByline` on page | 19 |
| Articles with `datePublished` in Article JSON-LD | 19 |
| Articles with a **separate** last-reviewed date (distinct from pub date) | 0 |
| Articles with no reviewer byline | 0 |
| Articles with no published date | 0 |

### Structural notes

**Last-reviewed = publication date for all 19 articles.** No article has been independently re-reviewed since it was first published. This is fine at launch but becomes an E-E-A-T liability once articles age past 6–12 months, especially for cost and payer-program guides where regulations can change. The `AuthorByline` component takes a `lastReviewed` prop — scheduling a quarterly review pass and updating that date is the fix.

**CA RN reviewing non-CA regulatory content.** Star's credential is California-specific. The Texas, Oregon, Washington, and Minnesota articles are reviewed by a CA RN. This is defensible for educational regulatory overview content, but if Google's quality raters look closely at the TX/OR/WA/MN licensing guides, the credential-to-jurisdiction match is imperfect. The editorial policy should acknowledge this explicitly (proposed language in `editorial-policy.md`).

**`/memory-care-vs-assisted-living` is at root, not `/library/`.** This may cause confusion for internal linking and sitemap organization. Worth noting for a future cleanup, but not a byline issue.

---

## Top 5 articles most urgently needing attention before Google consolidates their indexing

None of the 19 articles is missing a reviewer byline. The urgency ranking below is based on E-E-A-T risk factors: YMYL sensitivity, publication date staleness, credential-to-jurisdiction gap, and whether the content contains time-sensitive claims.

1. **`/library/medi-cal-and-memory-care`** — Payer guidance is the highest YMYL subcategory. California's ALW waitlist and DHCS rates change. Last reviewed 2026-05-04. Needs a quarterly review date commitment in the byline and a note that families should confirm current DHCS rates directly.

2. **`/california/cost-guide`** — Regional cost benchmarks decay faster than regulatory content. Cites Genworth Cost of Care Survey. The survey year should appear inline with the claim; "last reviewed 2026-05-02" doesn't tell a quality rater whether the underlying source data is from 2024 or 2022.

3. **`/texas/type-a-b-c-licensing`** — CA RN reviewing TX licensing classifications. Most complex regulatory article in the TX set. Reviewer credential is CA-specific but article content is HHSC-specific. If Star has any relevant multi-state context (public health case management work, research on TX frameworks), it should be surfaced in the byline on this article specifically.

4. **`/library/when-is-it-time-for-memory-care`** — Highest-traffic universal article and most likely to appear in AI Overviews. The existing `reviewNote` flags footer links to CA city hubs. Before this article is featured in a rich result across non-CA traffic, those CA-specific links should be updated to universal resources or removed.

5. **`/california/cost-by-city`** — Regional benchmark data. DATE_PUBLISHED needs confirmation (the audit could not verify it against the live file during this pass). If the date is older than 2026, it should be refreshed before the article draws organic traffic from regional cost queries.
