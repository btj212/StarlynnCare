# Thin-page audit

Operational checklist for pages that risk looking like **directory shells** (little unique text beyond listings, repeated boilerplate, or missing regulatory depth). Use alongside internal linking work so thin URLs still sit in a useful graph.

## Definition: “thin” for StarlynnCare

A page is **thin** if, after removing shared chrome (nav, footer, global disclaimers), a reader still cannot answer **why this URL exists** vs. another hub or vs. Google’s SERP snippet.

| Signal | Not thin | Thin |
|--------|----------|------|
| Facility profile | License facts + inspection/deficiency depth OR clear “not yet indexed” with regulator context | Only name/address with no record narrative |
| City / county hub | Region-specific stats, FAQs, primer, facility list with real counts | Same boilerplate as every other hub with 0–1 facilities |
| State hub | Curated FAQs, methodology pointers, real publishable counts | Static grid with no indexed rows |
| Library article | Unique prose, citations, hero | Stub or duplicate abstract |

**Indexed thin URLs:** City/county hubs with **zero** publishable facilities already **404** (`resolveListingRegion` + `countPublishableFacilitiesInRegion`). Remaining risk is **low unique copy** with **non-zero** rows.

## Per-template checks

### Facility (`/[state]/[city]/[facility]`)

- [ ] At least one of: indexed inspections, deficiencies narrative, CMS block (when applicable), or explicit pipeline status for missing CDSS data.
- [ ] Internal links present: city hub, county hub (when mapped), same-city related, cross-city county region, same-operator (when `operator_name` is usable).
- [ ] Editorial footer links to library + methodology (avoid orphan facility URLs).

### City / county hub (`/[state]/[city]`)

- [ ] `StatBlock` figures sourced (CDSS/HHSC/StarlynnCare counts), not placeholder medians.
- [ ] Regulator primer or TX-equivalent where product rules require it.
- [ ] City hubs: sibling city pills + county hub link when the city sits in a seeded county region.

### State hub (`/[state]` rich vs thin)

- [ ] Rich template only when publishable row count supports it (see `STATE_HUB_ARCHITECTURE.md`).
- [ ] Thin fallback: avoid indexing empty shells; canonical and JSON-LD match governance docs.

### Library

- [ ] `EditorialHero` + unique body; cross-link to relevant city/cost/methodology pages where appropriate.

## Optional Supabase probes (read-only)

Run in SQL editor or `psql` against production-like data. Adjust table/column names if schema drifts.

**Facilities published but with no inspections linked**

```sql
select f.id, f.state_code, f.city_slug, f.slug, f.name
from facilities f
left join inspections i on i.facility_id = f.id
where f.publishable = true
group by f.id
having count(i.id) = 0
order by f.state_code, f.city_slug
limit 100;
```

**Facilities with inspections but zero deficiency rows** (may be legitimate for clean surveys; still worth QA)

```sql
select f.id, f.state_code, f.city_slug, f.slug, f.name,
       count(distinct i.id) as inspection_ct
from facilities f
join inspections i on i.facility_id = f.id
left join deficiencies d on d.inspection_id = i.id
where f.publishable = true
group by f.id
having count(d.id) = 0
order by inspection_ct desc
limit 100;
```

**City slugs with very few publishable facilities** (weak hub uniqueness — prioritize editorial intros)

```sql
select state_code, city_slug, count(*) as n
from facilities
where publishable = true
group by state_code, city_slug
having count(*) <= 2
order by n, state_code, city_slug;
```

## Related docs

- [`docs/STATE_HUB_ARCHITECTURE.md`](STATE_HUB_ARCHITECTURE.md) — when state hubs flip rich vs thin.
- [`docs/SEO_GEO_CONVENTIONS.md`](SEO_GEO_CONVENTIONS.md) — metadata and JSON-LD minimums.
