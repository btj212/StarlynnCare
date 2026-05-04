import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { CountyRow, CityRow } from "@/lib/data/stateHub";

type Props = {
  sectionLabel: string;
  sectionTitle: ReactNode;
  stateSlug: string;
  browseSectionTitle: string;
  counties: CountyRow[];
  comingCounties: readonly string[];
  popularCitiesTitle: string;
  topCities: CityRow[];
  viewAllHref: string;
  viewAllLabel: string;
};

export function StateHubBrowse({
  sectionLabel,
  sectionTitle,
  stateSlug,
  browseSectionTitle,
  counties,
  comingCounties,
  popularCitiesTitle,
  topCities,
  viewAllHref,
  viewAllLabel,
}: Props) {
  return (
    <section
      id="browse"
      className="border-b border-paper-rule"
      style={{ background: "var(--color-paper-2)" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
        <SectionHead label={sectionLabel} title={sectionTitle} />

        <div className="grid gap-12 items-start md:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="smallcaps mb-3.5">{browseSectionTitle}</p>
            <div className="flex flex-col">
              {counties.map((c, i) => (
                <Link
                  key={c.slug}
                  href={`/${stateSlug}/${c.slug}`}
                  className="flex flex-col gap-2 py-4 px-1 border-b border-paper-rule no-underline text-ink hover:bg-paper transition-colors min-w-0 sm:grid sm:grid-cols-[32px_1fr_auto_auto] sm:items-center sm:gap-3.5"
                >
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.04em]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-[20px] sm:text-[22px] leading-tight tracking-[-0.005em] min-w-0">
                    {c.name}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] sm:text-[12px] text-ink-3 tracking-[0.04em] sm:self-center">
                    {c.count} fac · {c.cities} cities
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-rust sm:self-center sm:justify-self-end">→</span>
                </Link>
              ))}
              {comingCounties.map((name) => (
                <div
                  key={name}
                  className="flex flex-col gap-2 py-4 px-1 border-b border-paper-rule opacity-40 min-w-0 sm:grid sm:grid-cols-[32px_1fr_auto] sm:items-center sm:gap-3.5"
                >
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.04em]">—</span>
                  <span className="font-[family-name:var(--font-display)] text-[20px] sm:text-[22px] leading-tight tracking-[-0.005em] min-w-0">{name}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-ink-4 tracking-[0.04em] sm:self-center">Q2 2026</span>
                </div>
              ))}
            </div>
            <Link
              href={viewAllHref}
              className="inline-block mt-4 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-rust underline underline-offset-4"
            >
              {viewAllLabel}
            </Link>
          </div>

          <div>
            <p className="smallcaps mb-3.5">{popularCitiesTitle}</p>
            <div className="columns-1 sm:columns-2 lg:columns-3 [column-gap:2rem]">
              {topCities.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${stateSlug}/${c.slug}`}
                  className="flex justify-between py-[7px] border-b border-dotted border-paper-rule no-underline text-[14px] text-ink-2 hover:text-teal break-inside-avoid transition-colors"
                >
                  <span>{c.name}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-4">{c.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
