<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## SEO / GEO checklist (new or changed routes)

1. **`generateMetadata` / `metadata`:** set `alternates.canonical` using `canonicalFor("/your/path")` from [`src/lib/seo/canonical.ts`](src/lib/seo/canonical.ts).
2. **JSON-LD:** use builders in [`src/lib/seo/schema.ts`](src/lib/seo/schema.ts) and render with [`src/components/seo/JsonLd.tsx`](src/components/seo/JsonLd.tsx) — no inline one-off `<script type="application/ld+json">` in pages.
3. **Minimum structured data:** at least `BreadcrumbList` (+ `WebPage` with `reviewedBy` for editorial hubs).
4. **Never fabricate:** no `aggregateRating` without published reviews; no `geo` without real lat/lng; no fake CDSS `sameAs` without a license number.

Full details: [`docs/SEO_GEO_CONVENTIONS.md`](docs/SEO_GEO_CONVENTIONS.md).

## Editorial design system checklist (hub pages)

When adding or editing a **state, county, or city hub page** (any route under `/[state]`) or the homepage:

1. **Governance bar**: include `<GovernanceBar />` above `<SiteNav />`. Never on Clerk/auth pages.
2. **Section headers**: use `<SectionHead label="§ N · Label" title={<>…<em>…</em></>}>` from `src/components/editorial/SectionHead.tsx`.
3. **Stat grids**: use `<StatBlock stats={StatItem[]} footnotes={string[]}>` from `src/components/editorial/StatBlock.tsx`. Every cell must have a real `src` (CDSS, policy, etc.).
4. **Data citations**: attach `<DataFootnote source="…" refreshed="…" />` to any sentence with a numeric claim.
5. **No placeholder numbers**: all stats must come from Supabase or a confirmed constant. Never ship prototype mock data.
6. **Fonts**: use `font-[family-name:var(--font-display)]` for headlines, `font-[family-name:var(--font-mono)]` for data/citations.

Full details: [`docs/SEO_GEO_CONVENTIONS.md#8-editorial-design-system-v1`](docs/SEO_GEO_CONVENTIONS.md).

