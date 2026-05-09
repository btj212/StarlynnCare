# Facility Profile Architecture

This document describes the full implementation of the StarlynnCare facility profile page — the section components, the normalized data loader, the per-state configuration contract, the empty-state matrix, mobile breakpoints, and the runbook for adding new states.

---

## 1. High-level flow

```
/[state]/[city]/[facility]/page.tsx  (server component)
  └── loadFacilityProfile()           (src/lib/facility/loadFacilityProfile.ts)
        ├── Supabase: facilities table (1 row)
        ├── Supabase: inspections table + deficiencies table (parallel)
        ├── Supabase: facility_snapshot() RPC (peer-set, percentiles, heatmap)
        ├── loadPublishedReviews()     (reviews table)
        └── getStateProfileConfig(stateCode)
              ├── src/lib/states/CA/profileConfig.ts
              ├── src/lib/states/TX/profileConfig.ts  (stub)
              └── … other states
      → FacilityProfile (fully normalized, no DB calls in section components)
  └── Section components (pure presentation)
        FacilitySubNav · FacilityHero · FacilityQuickFacts
        FacilitySnapshot · FacilityPeerRank · FacilityRecord
        FacilityRules · FacilityTourPrep · FacilityFullInspections · FacilitySiblings
  └── Downstream components (kept from v1)
        ReviewsSection · RelatedFacilities · MetroNearbyFacilities
        SameOperatorFacilities · FacilityBrowseLinks · ReportListingForm
```

---

## 2. FacilityProfile shape

```ts
interface FacilityProfile {
  // Core facility row
  facility: Facility;
  state: StateInfo;
  region: Region | null;   // URL segment (county or city)
  county: { name: string; slug: string } | null;
  cfg: StateProfileConfig; // per-state configuration

  // Inspection / deficiency data
  inspections: InspectionRow[];           // most-recent-first, limit 50
  deficienciesByInspection: Map<string, DeficiencyRow[]>;
  totals: {
    inspections: number;
    deficiencies: number;  // includes substantiated-complaint gaps
    typeA: number;
    lastCitation: string | null;  // ISO date of most-recent citation
  };

  // facility_snapshot() RPC output
  snapshot: SnapshotPayload | null;       // null when Supabase unconfigured or RPC fails
  timeline: TimelinePoint[];              // 24-month trajectory (derived from snapshot)
  scopeSeverityGrid: ScopeSeverityCell[]; // 4×3 heatmap grid (derived from snapshot)

  // Section-specific derived data
  rulesCards: RuleCard[];     // cfg.rulebook annotated with citedDate
  tourQuestions: string[];    // facility.content.tour_questions (filtered empty)

  reviews: Review[];
  photoUrls: string[];        // [facility.photo_url] for now, will expand
  mapState: { lat: number; lon: number; mapboxToken: string | null } | null;

  // SEO
  canonicalUrl: string;
  backHref: string;           // URL of the parent city/county hub
  backLabel: string;          // display name for back link
  breadcrumbTrail: { name: string; url: string }[];
  jsonLd: object[];           // LocalBusiness + BreadcrumbList + Review + FAQPage
}
```

---

## 3. Per-state config contract

All state-specific knowledge lives in `src/lib/states/{STATE_CODE}/profileConfig.ts` and is exported as a `StateProfileConfig` object. **No section component imports from a state-specific module.**

```ts
interface StateProfileConfig {
  code: string;                          // "CA"
  agencyShort: string;                   // "CDSS"
  agencyLong: string;                    // "California Dept. of Social Services…"
  citationPrefix: string;                // "22 CCR §"
  inspectionWindowMonths: number;        // 36
  timelineWindowMonths: number;          // 24
  formatSeverityTag(d: Deficiency): { label: string; tone: SeverityTone } | null;
  formNameForDeficiency(d: Deficiency): string | null;  // "LIC-9099" for CA
  rulebook: Rule[];
}
```

### Registered states

| State | File | Rulebook | Severity tags | Form name |
|-------|------|----------|---------------|-----------|
| CA | `src/lib/states/CA/profileConfig.ts` | 5 rules (training, staffing, health, reporting, enforce) | Type A / Type B / IJ / CMS A–L letter | LIC-9099 |
| TX | `src/lib/states/TX/profileConfig.ts` | empty stub | raw severity / IJ fallback | none |
| OR | `src/lib/states/OR/profileConfig.ts` | empty stub | raw severity / IJ fallback | none |
| WA | `src/lib/states/WA/profileConfig.ts` | empty stub | raw severity / IJ fallback | none |
| MN | `src/lib/states/MN/profileConfig.ts` | empty stub | raw severity / IJ fallback | none |

Unregistered states fall back to `makeNullConfig()` in `src/lib/states/profileConfig.ts` — no chips, no rulebook, no form names.

---

## 4. Section inventory

| # | ID anchor | Component | Empty-state behaviour |
|---|-----------|-----------|----------------------|
| 00 | (hero) | `FacilityHero` | Always renders. Derives fallback copy from `totals.deficiencies` + `totals.lastCitation`. |
| QF | (strip) | `FacilityQuickFacts` | Always renders. Individual cells show "—" dash when data is absent. |
| 01 | `#snapshot` | `FacilitySnapshot` | Gallery shows gradient placeholders when no `photoUrls`. Map shows SVG gridpaper sketch when `mapState` is null. |
| 02 | `#peer` | `FacilityPeerRank` | Shows "data still indexing" message when `snapshot` is null or `!snapshot.has_inspections`. |
| 03 | `#record` | `FacilityRecord` | Timeline rail shows "No inspection activity" label. Heatmap shows "No findings in last 36 months". |
| 04 | `#rules` | `FacilityRules` | Returns `null` (hidden entirely) when `rulesCards.length === 0`. |
| 05 | `#tour` | `FacilityTourPrep` | Returns `null` when `tourQuestions.length < 3`. |
| 06 | `#full-record` | `FacilityFullInspections` | Always renders. Shows empty-state message when `inspections.length === 0`. |
| 07 | `#siblings` | `FacilitySiblings` | Returns `null` when no nearby facilities found. |
| — | — | `ReviewsSection` | Delegates to existing component (unchanged). |
| — | — | `RelatedFacilities` | Delegates to existing component (unchanged). |
| — | — | `MetroNearbyFacilities` | Delegates to existing component (unchanged). |
| — | — | `SameOperatorFacilities` | Delegates to existing component (unchanged). |

### Sub-nav anchor filtering

`FacilitySubNav` hides anchors to sections that won't render:
- `#rules` — hidden when `rulesCards.length === 0`
- `#tour` — hidden when `tourQuestions.length < 3`

---

## 5. Mobile breakpoints

All multi-column grids collapse at `md:` (768 px) unless noted otherwise:

| Section | Desktop | Tablet (sm:) | Mobile |
|---------|---------|--------------|--------|
| Hero grid | `grid-cols-[1.5fr_1fr]` | — | stacked |
| Quick facts | `grid-cols-6` | `grid-cols-3` | `grid-cols-2` |
| Snapshot | `grid-cols-[1.5fr_1fr]` | — | stacked |
| Peer rank cells | `grid-cols-3` | — | stacked |
| Record heatmap+list | `grid-cols-2` | — | stacked |
| Rules expand body | `sm:grid-cols-2` | `grid-cols-2` | stacked |
| Tour prep | `grid-cols-3` | — | stacked |
| Full inspections | 5-col CSS grid | — | card layout (via `md:hidden` / `hidden md:grid` pair) |
| Siblings | `grid-cols-4` | `grid-cols-2` | `grid-cols-1` |
| Sub-nav anchors | visible | — | hidden (`hidden md:flex`) |

---

## 6. Design tokens used

All tokens are already defined in `src/app/globals.css` — no new CSS variables were added:

| Token | Usage |
|-------|-------|
| `--color-paper` | Page background, card backgrounds |
| `--color-paper-2` | Alternate card fill, table row backgrounds |
| `--color-paper-rule` | All divider lines |
| `--color-ink` | Primary text, dark section background |
| `--color-ink-2/3/4` | Secondary / tertiary / faint text |
| `--color-rust` | Accent color — section borders, severity tags, CTAs |
| `--color-rust-soft` | Rust tints for citation expand backgrounds |
| `--color-gold` | Dark-section headline text |
| `--color-gold-soft` | Cited rule pills, warm tint backgrounds |
| `--color-teal` | AI summary borders, informational tags |
| `--color-teal-soft` | Icon backgrounds, tour section fill |
| `--color-grade-a` | Percentile number text (green signal) |
| `--font-display` | Instrument Serif — headings, hero H1, citation italic quotes |
| `--font-sans` | Inter Tight — body, operator names |
| `--font-mono` | JetBrains Mono — labels, dates, tags, data lines |

---

## 7. Runbook: adding a new state (e.g. Oregon full build-out)

1. **Write the severity mapper** in `src/lib/states/OR/profileConfig.ts`.
   - Map `d.state_severity_raw` or `d.class` to `{ label, tone }`.
   - Add `immediate_jeopardy` → `"IJ"` / `"danger"` as the first check.
   - If the state uses CMS scope×severity letters, reuse the pattern from `CA/severity.ts`.

2. **Write the rulebook** in the same file (assign to `rulebook: [...]`).
   - Each `Rule` needs `id`, `icon`, `question`, `regCite`, `plain`, `ask`.
   - Add `codePattern` (regex) to auto-compute the "Cited" pill from citation history.

3. **Register** in `src/lib/states/profileConfig.ts` — import `orProfileConfig` and add `OR: orProfileConfig` to `STATE_CONFIGS`.

4. **That's it.** No section component changes. The `#rules` section auto-appears when `rulebook.length > 0`. The `#peer` section uses the `facility_snapshot` RPC which already handles OR peer sets via the state-code filter in the SQL function.

5. **Verify** on a known OR facility:
   - `FacilityRules` renders with the new rulebook.
   - Severity chips show the correct labels.
   - "Cited" pills surface the right dates.
   - `FacilityPeerRank` shows OR peer-set size from the RPC.

---

## 8. AGENTS.md alignment

- **SEO/GEO checklist**: `FacilityHero` does not render a `<h1>` from AI content; it derives it from the real `facility.name`. All `generateMetadata` output comes from `loadFacilityProfile` which uses `canonicalFor()`. JSON-LD is assembled from typed builders in `src/lib/seo/schema.ts`.
- **Editorial design system**: The section headers (`§ 01 · Snapshot`, etc.) use `<SectionHead label="…" title={<>…<em>…</em></>}>` from `src/components/editorial/SectionHead.tsx`.
- **No fabricated data**: All stats (beds, dates, deficiency counts, percentiles) come from Supabase. No mock values reach production.
- **No inline `<script type="application/ld+json">`**: JSON-LD rendered via `<JsonLd objects={profile.jsonLd} />` only.

---

## 9. Files added / changed / removed

### Added
```
src/lib/states/profileConfig.ts
src/lib/states/CA/profileConfig.ts
src/lib/states/CA/rulebook.ts
src/lib/states/CA/severity.ts
src/lib/states/TX/profileConfig.ts
src/lib/states/OR/profileConfig.ts
src/lib/states/WA/profileConfig.ts
src/lib/states/MN/profileConfig.ts
src/lib/facility/loadFacilityProfile.ts
src/components/facility/profile/FacilitySubNav.tsx
src/components/facility/profile/FacilityHero.tsx
src/components/facility/profile/FacilityQuickFacts.tsx
src/components/facility/profile/FacilitySnapshot.tsx
src/components/facility/profile/FacilityPeerRank.tsx
src/components/facility/profile/FacilityRecord.tsx
src/components/facility/profile/FacilityRules.tsx
src/components/facility/profile/FacilityTourPrep.tsx
src/components/facility/profile/FacilityFullInspections.tsx
src/components/facility/profile/FacilitySiblings.tsx
docs/FACILITY_PROFILE_ARCHITECTURE.md  (this file)
```

### Changed
```
src/app/[state]/[city]/[facility]/page.tsx  (full rewrite, ~130 lines)
```

### Removed
```
src/components/facility/QuickFacts.tsx        → superseded by FacilityQuickFacts
src/components/facility/BenchmarkRow.tsx      → superseded by FacilityPeerRank
src/components/facility/RegulatoryBaseline.tsx → superseded by FacilityRules
src/components/facility/QualitySnapshot.tsx   → superseded by FacilityPeerRank + FacilityRecord
src/components/facility/TourQuestions.tsx     → superseded by FacilityTourPrep
src/lib/benchmarks.ts                         → superseded by facility_snapshot() RPC percentiles
```

### Kept untouched
```
src/components/facility/RelatedFacilities.tsx
src/components/facility/MetroNearbyFacilities.tsx
src/components/facility/SameOperatorFacilities.tsx
src/components/facility/FacilityBrowseLinks.tsx
src/components/facility/ReportListingForm.tsx
src/components/facility/SiblingCityHubLinks.tsx
src/components/facility/MemoryCareDesignationBasis.tsx
src/components/reviews/ReviewsSection.tsx
src/components/site/SiteNav.tsx
src/components/site/SiteFooter.tsx
src/lib/seo/  (all helpers unchanged)
supabase/migrations/0009_quality_snapshot.sql
```
