import Link from "next/link";
import { countyRegionContainingCitySlug } from "@/lib/regionsCountyLookup";
import { loadListedCountsForSlugs, loadStateCityCounts } from "@/lib/facility/stateCityCounts";

type Props = {
  stateSlug: string;
  stateCode: string;
  stateName: string;
  currentCitySlug: string;
  /** Spec-ordered nearby slugs. Only hubs with a listed count are linked. */
  preferredNearby?: Array<{ slug: string; name: string }>;
};

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function NearbyList({
  heading,
  intro,
  stateSlug,
  items,
}: {
  heading: string;
  intro: string;
  stateSlug: string;
  items: Array<{ slug: string; name: string; count: number }>;
}) {
  return (
    <section className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-10">
        <div className="mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
          Nearby cities
        </div>
        <p className="font-[family-name:var(--font-display)] text-[20px] leading-snug text-ink mb-4 max-w-[62ch]">
          {intro}
        </p>
        <p className="sr-only">{heading}</p>
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {items.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${stateSlug}/${c.slug}`}
                className="inline-block rounded-full border border-paper-rule bg-paper px-3.5 py-1.5 text-[14px] text-teal no-underline hover:border-rust/40 hover:bg-paper transition-colors"
              >
                {c.name} ({c.count})
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * City listing hubs only: links to sibling city hubs in the same seeded county region.
 * Counts are listed homes (the same denominator the destination page quotes).
 */
export async function SiblingCityHubLinks({
  stateSlug,
  stateCode,
  stateName,
  currentCitySlug,
  preferredNearby,
}: Props) {
  if (preferredNearby && preferredNearby.length > 0) {
    const counted = await loadListedCountsForSlugs(
      stateCode,
      preferredNearby.map((n) => n.slug),
    );
    const seen = new Set<string>();
    const filtered = preferredNearby.flatMap((n) => {
      const row = counted.get(n.slug);
      if (!row || row.count < 1) return [];
      if (seen.has(row.slug)) return [];
      seen.add(row.slug);
      return [{ slug: row.slug, name: n.name || row.name, count: row.count }];
    });
    if (filtered.length > 0) {
      return (
        <NearbyList
          heading={`Nearby city hubs`}
          intro={`Other listed homes near ${titleFromSlug(currentCitySlug)}`}
          stateSlug={stateSlug}
          items={filtered}
        />
      );
    }
  }

  const county = countyRegionContainingCitySlug(stateCode, currentCitySlug);
  if (!county) return <StateCityLinks stateSlug={stateSlug} stateCode={stateCode} stateName={stateName} currentCitySlug={currentCitySlug} />;
  const siblings =
    county?.citySlugs.filter((s) => s.toLowerCase() !== currentCitySlug.toLowerCase()) ?? [];
  if (siblings.length === 0) return null;

  const counted = await loadListedCountsForSlugs(stateCode, siblings);
  const filtered = siblings
    .map((slug) => counted.get(slug) ?? { slug, name: titleFromSlug(slug), count: 0 })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (filtered.length === 0) return null;

  const shown = filtered.slice(0, 16);

  return (
    <section className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-10">
        <div className="mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
          Nearby cities
        </div>
        <p className="font-[family-name:var(--font-display)] text-[20px] leading-snug text-ink mb-4 max-w-[62ch]">
          Other city hubs in <span className="font-medium">{county.name}</span>
        </p>
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {shown.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${stateSlug}/${c.slug}`}
                className="inline-block rounded-full border border-paper-rule bg-paper px-3.5 py-1.5 text-[14px] text-teal no-underline hover:border-rust/40 hover:bg-paper transition-colors"
              >
                {c.name} ({c.count})
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[14px] text-ink-3 m-0">
          <Link href={`/${stateSlug}/${county.slug}`} className="text-teal font-medium hover:underline underline-offset-4">
            Full county directory: {county.name}
          </Link>
        </p>
      </div>
    </section>
  );
}

/**
 * Cities outside a seeded county (Colorado, Arizona, most other states) had no
 * links to any other city. Link the state's largest cities by listed homes.
 */
async function StateCityLinks({ stateSlug, stateCode, stateName, currentCitySlug }: Props) {
  const others = (await loadStateCityCounts(stateCode))
    .filter((c) => c.slug.toLowerCase() !== currentCitySlug.toLowerCase())
    .slice(0, 12);
  if (others.length === 0) return null;

  return (
    <section className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-10">
        <div className="mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
          Other cities
        </div>
        <p className="font-[family-name:var(--font-display)] text-[20px] leading-snug text-ink mb-4 max-w-[62ch]">
          Listed homes in other {stateName} cities
        </p>
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {others.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${stateSlug}/${c.slug}`}
                className="inline-block rounded-full border border-paper-rule bg-paper px-3.5 py-1.5 text-[14px] text-teal no-underline hover:border-rust/40 hover:bg-paper transition-colors"
              >
                {c.name} ({c.count})
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[14px] text-ink-3 m-0">
          <Link href={`/${stateSlug}`} className="text-teal font-medium hover:underline underline-offset-4">
            All {stateName} cities
          </Link>
        </p>
      </div>
    </section>
  );
}
