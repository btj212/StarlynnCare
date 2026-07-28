import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHead } from "@/components/editorial/SectionHead";
import type { CountyRow, CityRow } from "@/lib/data/stateHub";

type Props = {
  sectionLabel?: string;
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
    <section id="browse" className="border-b border-clearing-rule bg-clearing-tint">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:px-[60px] md:py-20">
        <SectionHead label={sectionLabel} title={sectionTitle} />

        <div className="grid items-start gap-12 md:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="smallcaps mb-3.5">{browseSectionTitle}</p>
            <div className="flex flex-col gap-2">
              {counties.map((c, i) => (
                <Link
                  key={c.slug}
                  href={`/${stateSlug}/${c.slug}`}
                  className="card-lift flex min-w-0 flex-col gap-2 rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-4 py-4 text-ink no-underline shadow-[var(--shadow-card)] transition-colors hover:text-teal sm:grid sm:grid-cols-[32px_1fr_auto_auto] sm:items-center sm:gap-3.5"
                >
                  <span className="font-[family-name:var(--font-sans)] text-[12px] font-medium tracking-[0.04em] text-ink-4">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 font-[family-name:var(--font-display)] text-[20px] leading-tight tracking-[-0.005em] sm:text-[22px]">
                    {c.name}
                  </span>
                  <span className="font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-3 sm:self-center sm:text-[13px]">
                    {c.count} fac · {c.cities} cities
                  </span>
                  <span className="font-semibold text-teal sm:justify-self-end sm:self-center">→</span>
                </Link>
              ))}
              {comingCounties.map((name) => (
                <div
                  key={name}
                  className="flex min-w-0 flex-col gap-2 rounded-[18px] border border-clearing-rule-3 bg-clearing-card/60 px-4 py-4 opacity-50 sm:grid sm:grid-cols-[32px_1fr_auto] sm:items-center sm:gap-3.5"
                >
                  <span className="font-[family-name:var(--font-sans)] text-[12px] font-medium tracking-[0.04em] text-ink-4">—</span>
                  <span className="min-w-0 font-[family-name:var(--font-display)] text-[20px] leading-tight tracking-[-0.005em] sm:text-[22px]">{name}</span>
                  <span className="font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-4 sm:self-center">Q2 2026</span>
                </div>
              ))}
            </div>
            <Link
              href={viewAllHref}
              className="mt-4 inline-block font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal underline underline-offset-4 hover:text-rust"
            >
              {viewAllLabel}
            </Link>
          </div>

          <div>
            <p className="smallcaps mb-3.5">{popularCitiesTitle}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topCities.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${stateSlug}/${c.slug}`}
                  className="card-lift flex items-center justify-between rounded-2xl border border-clearing-rule-2 bg-clearing-card px-5 py-4 text-[15px] text-ink-2 no-underline transition-colors hover:text-teal"
                >
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span className="text-[14px] text-ink-4">{c.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
