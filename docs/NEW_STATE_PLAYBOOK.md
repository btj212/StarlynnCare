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

## Thumbnail registration

If you create illustration art for a state-specific article, register it in `src/lib/content/articleThumbnails.ts`:

```typescript
"/statename/licensing-explainer": {
  src: "/illustrations/your-illustration.png",
  alt: "Descriptive alt text matching the article topic",
},
```

Thumbnails appear on the guides index page cards when available. The guides page gracefully omits the image container if no thumbnail is registered.
