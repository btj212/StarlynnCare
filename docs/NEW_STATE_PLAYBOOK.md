# New State Deployment Playbook

This document is the canonical checklist for launching StarlynnCare in a new state. Follow it in order. Every step maps to a real file in the repo. Texas is the worked example for every article type.

---

## Overview of the content system

```
src/lib/content/articleRegistry.ts     ← Central registry. Every article, tagged by state.
src/lib/stateHubConfigs/[state].ts     ← State hub config: editorialCards, stateArticles, guidesHref.
src/app/[state]/guides/page.tsx        ← Auto-generated guides index (filters registry by state).
src/app/[state]/[article]/page.tsx     ← State-specific article pages (one per stateArticles entry).
```

When you add a new state:
1. The guides index at `/[state]/guides` is **automatically generated** from the registry — no new page code needed.
2. You only need to write code for the **state-specific article pages** (the ones unique to that state's regulatory system).
3. Universal articles (`states: ["all"]`) appear automatically on every state's guides page.

---

## Checklist

### Step 1 — Create the state hub config

Copy the closest stub (e.g. `src/lib/stateHubConfigs/wa.ts`) to `src/lib/stateHubConfigs/[stateSlug].ts`.

Fill in all required fields:

```typescript
export const xxStateConfig: StateHubConfig = {
  stateSlug: "statename",        // URL slug, e.g. "oregon"
  stateCode: "XX",               // Two-letter code, e.g. "OR"
  stateName: "State Name",
  edition: "Vol. 01",
  regulatorAbbr: "REGULATOR",   // e.g. "HHSC", "CDSS", "Oregon DHS"
  inspectionSrc: "SOURCE NAME",  // e.g. "HHSC LTCR"
  showZipSearch: false,
  comingCounties: [],
  faqs: XX_FAQS,                 // Add to src/lib/content/stateFaqs.ts
  guidesHref: "/statename/guides",  // Always /{stateSlug}/guides for non-CA states
  stateArticles: [
    // One entry per state-specific article page you will create in Step 4
    {
      slug: "licensing-explainer",
      title: "Title of the licensing explainer",
      desc: "One sentence description.",
      tags: ["licensing", "inspection"],
      live: false,  // Set to true once the page exists
    },
  ],
  methodologySteps: [ ... ],
  editorialCards: [
    // 2-3 featured articles (can reference registry slugs)
    // Last card must always be the guides index link:
    {
      kind: "[State] editorial library",
      title: "All [State] guides & explainers",
      desc: "...",
      meta: "Live · Full library",
      href: "/statename/guides",
      live: true,
    },
  ],
};
```

### Step 2 — Register the state in the index

In `src/lib/stateHubConfigs/index.ts`, add:

```typescript
import { xxStateConfig } from "./xx";

// In CONFIGS:
statename: xxStateConfig,

// In the exports at top of file:
export { xxStateConfig } from "./xx";
```

### Step 3 — Add state articles to the registry

In `src/lib/content/articleRegistry.ts`, add entries for state-specific articles:

```typescript
// ── [State Name] ──────────────────────────────────────────────────────────
{
  slug: "/statename/licensing-explainer",
  title: "Title of the licensing explainer",
  desc: "One sentence description.",
  states: ["XX"],
  tags: ["licensing", "inspection"],
  live: true,  // Set to true once the page exists (Step 4)
},
```

**Universal articles** (`states: ["all"]`) already appear on every state's guides page automatically — no registry changes needed for those.

### Step 4 — Create state-specific article pages

For each entry in `stateArticles`, create `src/app/[stateSlug]/[slug]/page.tsx`.

Each page must include:
- `export const metadata: Metadata` with `alternates.canonical` via `canonicalFor(PAGE_PATH)`
- `buildArticleSchema`, `buildBreadcrumbList`, `buildFaqSchemaFromPairs` JSON-LD
- Breadcrumb trail: Home → [State] → Guides → Article
- `<AuthorByline lastReviewed={DATE_PUBLISHED} />`
- At least 5 FAQ pairs (these become the FAQ schema and are indexed by LLMs)
- A "Continue reading" block at the bottom linking to related articles and `/[stateSlug]/guides`

**Use the Texas articles as templates:**
- Licensing explainer: `src/app/texas/type-a-b-c-licensing/page.tsx`
- Decision guide (state-framed): `src/app/texas/memory-care-vs-nursing-home/page.tsx`

### Step 5 — Write state FAQs

In `src/lib/content/stateFaqs.ts`, add `XX_FAQS` for the state hub FAQ section (§ 06 on the hub page). Export it and import it in the state config.

### Step 6 — Verify the guides page

Visit `/[stateSlug]/guides` locally. Confirm:
- Universal articles appear (decision guides, clinical articles)
- State-specific articles appear
- No CA-specific articles appear (RCFE, Medi-Cal, CCL, CDSS, Cal. H&S)
- Section headers only render if they have articles

### Step 7 — Update editorialCards to go live

Once all article pages are published (`live: true` in both registry and stateArticles), update the `editorialCards` in the state config to point to the live article URLs (not `href: null`).

---

## Article type templates

These are the standard article types we ship per state. Use the Texas versions as the starting draft and swap regulatory terminology.

### 1. Licensing explainer

**What it covers:** The state's residential care license classes for memory care. How they work, what they mean for dementia care, and how they differ from other states.

**Texas template:** `src/app/texas/type-a-b-c-licensing/page.tsx`

**Content outline:**
1. Short version callout (4 bullets)
2. What each license class means (one H3 per class)
3. Comparison table (License class × key factors)
4. Alzheimer/dementia certification (if separate from license)
5. How to read on a StarlynnCare profile
6. Note for families familiar with other states
7. FAQ (5+ pairs, JSON-LD)
8. Continue reading block

**State-specific terminology to swap:**

| California | Texas | Your state |
|---|---|---|
| RCFE | ALF (Type A/B/C) | TBD |
| CDSS / CCL | HHSC / LTCR | TBD |
| Type A/B citation severity | HHSC deficiency scope/severity | TBD |
| Medi-Cal / ALW | STAR+PLUS waiver | TBD |
| Cal. H&S Code §1569 | TAC Title 26, Ch. 553 | TBD |

### 2. Memory care vs. nursing home (state-framed)

**What it covers:** How residential memory care and skilled nursing differ in the specific state's regulatory context, funding sources, and inspection record systems.

**Texas template:** `src/app/texas/memory-care-vs-nursing-home/page.tsx`

**Content outline:**
1. Short version callout (4 bullets)
2. What each one actually is (ALF/RCFE vs SNF framing for the state)
3. Two regulators, two inspection records (state regulator vs CMS Care Compare)
4. Funding (state Medicaid program vs Medicare)
5. When to choose each setting (clinical decision checklist)
6. Tour questions by setting
7. FAQ (5+ pairs, JSON-LD)
8. Continue reading block

### 3. Costs & payers (state-specific) — future

**What it covers:** Monthly cost ranges in the state, state Medicaid waiver specifics, what payer documents to request, hidden fees.

**No template yet.** Closest reference: `src/app/california/cost-guide/page.tsx`.

---

## Content quality rules for "all states" articles

Universal articles (`states: ["all"]` in the registry) must not contain:

- Any state regulator's name or acronym (RCFE, CDSS, CCL, HHSC, LTCR, Oregon DHS, DSHS, MDH)
- Any state-specific Medicaid program name (Medi-Cal, ALW, STAR+PLUS, ALTCS, COPES)
- Any state-specific statute reference (Cal. H&S Code, TAC, ORS, RCW, Minn. Stat.)
- Any city, county, or metro-specific language unless illustrative and geographically neutral

Before a new state launches, run a text search over all `states: ["all"]` articles for the new state's regulatory terms. If any appear, either:
- Move the article to `states: ["CA"]` or the relevant state only, or
- Rewrite the sentence to use national framing (e.g. "your state regulator" instead of "CDSS")

**Current audit notes (checked 2026-05-09):**

| Article | Note |
|---|---|
| `/memory-care-vs-assisted-living` | Uses CA inspection examples as illustrations — acceptable framing; update before OR/WA launch |
| `/library/when-is-it-time-for-memory-care` | Footer links to CA city hubs — update footer before OR/WA launch |
| `/library/dementia-vs-alzheimers-vs-lewy-body` | AuthorByline credits a CA-licensed RN — content is clinically universal; no rewrite needed |

---

## Editorial card layout rules

The `editorialCards` array drives the § 04 section on the state hub. Rules:

- **First card:** The "annual report / data overview" card. For states without a published data report, use a state licensing explainer as the first card. Do not leave the first card with `href: null` if other live articles exist.
- **Last card:** Always the guides index card, pointing to `/{stateSlug}/guides`.
- **Middle cards (2-3):** The most important state-specific + universal articles for that state's families.
- The hero artwork block in the editorial section renders `"The State of Memory Care in {stateName}"` — the state name is injected from `config.stateName` automatically.

---

## Data pipeline — throttling, cost, and ops guidance

When running the downstream enrichment pipeline for a new state, follow these rules to keep API costs
manageable and avoid rate-limit errors.

### Pipeline order

Run steps in this exact order to avoid wasted API calls on unpublishable facilities:

```
1. scrapers/geocode_facilities.py --state XX       # fill lat/lon
2. scrapers/recompute_publishable.py --state XX     # set publishable = true
3. scrapers/fetch_streetview.py --state XX          # photos (Google Street View)
4. scrapers/summarize_inspections.py --state XX     # AI summaries (Anthropic)
5. scrapers/generate_content.py --state XX          # AI tour questions (Anthropic)
```

Steps 3-5 are independent once step 2 has run; run them in parallel if you have the budget.

### Estimated record counts and runtimes (May 2026 baseline)

| State | Publishable facilities | Inspections to summarize | Expected runtime |
|-------|----------------------|--------------------------|------------------|
| CA | ~484 | ~742 remaining | ~6 h (summaries) |
| TX | ~1 | ~0 remaining | < 10 min |
| OR | ~244 | ~8,900+ | ~14 h (summaries) |
| WA | ~99 | ~420 (stub narratives — no real text) | 30 min geocode / content |
| MN | ~552 | 0 (no narrative text in source data) | 3-5 h (content only) |

### Anthropic cost estimates

- `claude-haiku-4-5-20251001` (summarize): ~$0.0005 per inspection. 8,900 OR records ≈ **$4.50**.
- `claude-sonnet-4-5-20251001` (generate_content, quality gate): ~$0.006 per facility × 2 calls = $0.012/facility. 244 OR facilities ≈ **$3**.
- Budget for a full new-state run (5k inspections + 500 facilities): **≈ $10–15**.

### Rate limits

- **Anthropic Haiku:** 1,000 requests/min on Tier 2+. The scripts use a 0.5 s sleep per record by default;
  adjust `SLEEP_BETWEEN` in the script if you hit 429s.
- **Google Geocoding:** 50 req/s / $5 per 1,000. 500 facilities ≈ **$2.50**.
- **Google Street View Static:** $7 per 1,000. 500 facilities ≈ **$3.50**.
- Both Google APIs use the same `GOOGLE_MAPS_API_KEY` in `.env.local`.

### Running in stages

For very large states (> 5,000 inspections), use `--city-slugs` to run a metro at a time:

```bash
python summarize_inspections.py --state OR \
  --city-slugs portland,eugene,salem
```

This lets you ship a metro sooner without waiting for the whole state.

### Monitoring progress

Log files are written to `logs/ingest/`. Check the tail to see current position:

```bash
tail -f logs/ingest/summarize_or.log
tail -f logs/ingest/content_or.log
```

A completed run ends with `Done. N summarized, M failed, P processed.`

### After the pipeline

After all steps complete, commit the script updates (not data — that lives in Supabase) and
run a TypeScript build to confirm no regressions:

```bash
npx tsc --noEmit
git add scripts/ scrapers/
git commit -m "chore: run XX state enrichment pipeline"
git push
```

Then trigger a Vercel preview deploy and spot-check 3 facility profiles and 2 city hubs in the
new state before promoting to production.

---

## Thumbnail registration

If you create illustration art for a state-specific article, register it in `src/lib/content/articleThumbnails.ts`:

```typescript
"/statename/licensing-explainer": {
  src: "/illustrations/your-illustration.png",
  alt: "Descriptive alt text matching the article topic",
},
```

Thumbnails appear on the guides index page cards when available. The guides page gracefully omits the image container if no thumbnail is registered.

---

## CMS Nursing Home data (all states)

CMS data is the easiest source for skilled nursing facilities and works for **all US states** — not just WA. Add this step for any new state with a significant SNF footprint.

```bash
# 1. Ingest NH directory (replace WA with your state code)
python3 scrapers/cms_nh_directory_ingest.py --state XX

# 2. Ingest NH health deficiencies
python3 scrapers/cms_nh_deficiencies_ingest.py --state XX

# 3. Recompute publishable (NHs start as needs_review — manually promote)
python3 scrapers/recompute_publishable.py --state XX
```

CMS datasets:
- Provider Information: `https://data.cms.gov/provider-data/dataset/4pq5-n9py`
- Health Deficiencies: `https://data.cms.gov/provider-data/dataset/r5ix-sfxw`

No API key required. Data updated monthly by CMS; safe to refresh weekly.

NH facilities get `wa_facility_type='NH'` (WA) or equivalent and automatically use `waNhProfileConfig` (F-tag citations, CMS star ratings, federal scope-severity matrix). For non-WA states, add a matching `nh{State}ProfileConfig` in `src/lib/states/{STATE}/profileConfig.ts` and extend the `getStateProfileConfig` dispatcher.

### Memory care classification for NHs

CMS flags memory care SCUs via the Provider Information `Dementia Unit Type` or similar fields. Until that field is parsed, new NHs land in `needs_review`. Check CMS Compare for the facility to confirm a dementia/memory-care unit before setting `serves_memory_care=true` manually.

### WA-specific multi-signal classification

For WA, `serves_memory_care` is ORed from three independent signals:
- `wa_memory_care_certified` — Memory Care unit certification
- `wa_earc_sdc_contracted` — DSHS SDCP contract
- `wa_dementia_specialty` — training-based dementia designation

See `docs/WA_PIPELINE_V2.md` for the full WA runbook.
