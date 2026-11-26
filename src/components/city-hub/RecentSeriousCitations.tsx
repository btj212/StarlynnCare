import Link from "next/link";
import { SectionHead } from "@/components/editorial/SectionHead";
import { formatFacilityName } from "@/lib/facility/displayName";
import type { RecentSeriousHome } from "@/lib/city-hub/stats";

export function RecentSeriousCitations({
  homes,
  stateSlug,
  regionName,
}: {
  homes: RecentSeriousHome[];
  stateSlug: string;
  regionName: string;
}) {
  if (homes.length === 0) return null;

  return (
    <section className="border-b border-clearing-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-14">
        <SectionHead
          label="Recent serious citations"
          title={
            <>
              Last 12 months in <em>{regionName}.</em>
            </>
          }
        />
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {homes.map((home) => (
            <li key={home.id}>
              <Link
                href={`/${stateSlug}/${home.city_slug}/${home.slug}`}
                className="flex min-w-0 flex-col gap-1 rounded-[16px] border border-clearing-rule-2 bg-clearing-card px-4 py-3 no-underline shadow-[var(--shadow-card)] transition-colors hover:border-teal/40"
              >
                <span className="font-[family-name:var(--font-display)] text-[17px] leading-snug text-ink">
                  {formatFacilityName(home.name)}
                </span>
                <span className="font-[family-name:var(--font-sans)] text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
                  {home.seriousCount} serious · {home.date}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
