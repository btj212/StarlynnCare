import Link from "next/link";
import { countyRegionContainingCitySlug } from "@/lib/regionsCountyLookup";

type Props = {
  stateSlug: string;
  stateCode: string;
  currentCitySlug: string;
};

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * City listing hubs only: links to sibling city hubs in the same seeded county region.
 */
export function SiblingCityHubLinks({ stateSlug, stateCode, currentCitySlug }: Props) {
  const county = countyRegionContainingCitySlug(stateCode, currentCitySlug);
  const siblings =
    county?.citySlugs.filter((s) => s.toLowerCase() !== currentCitySlug.toLowerCase()) ?? [];
  if (!county || siblings.length === 0) return null;

  const shown = siblings.slice(0, 16);

  return (
    <section className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-10">
        <div className="mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
          Nearby cities
        </div>
        <p className="font-[family-name:var(--font-display)] text-[20px] leading-snug text-ink mb-4 max-w-[62ch]">
          Other memory care city hubs in <span className="font-medium">{county.name}</span>
        </p>
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {shown.map((slug) => (
            <li key={slug}>
              <Link
                href={`/${stateSlug}/${slug}`}
                className="inline-block rounded-full border border-paper-rule bg-paper px-3.5 py-1.5 text-[14px] text-teal no-underline hover:border-rust/40 hover:bg-paper transition-colors"
              >
                {titleFromSlug(slug)}
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
