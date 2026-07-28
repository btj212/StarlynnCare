import Image from "next/image";
import type { ReactNode } from "react";
import { ZipSearch } from "@/components/site/ZipSearch";
import { HeroFacilitySearch } from "./HeroFacilitySearch";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  subtitle: string;
  illustrationSrc: string;
  illustrationAlt: string;
  /** e.g. "Live across 58 CA counties" */
  liveLabel: string;
  roadmapNote?: string;
  stateSlug: string;
  stateName: string;
  facilityCount: number;
};

export function StateHubHero({
  eyebrow,
  title,
  subtitle,
  illustrationSrc,
  illustrationAlt,
  liveLabel,
  roadmapNote = "· Texas Q2 · Florida Q2",
  stateSlug,
  stateName,
  facilityCount,
}: Props) {
  return (
    <section
      className="border-b border-clearing-rule"
      style={{
        background:
          "linear-gradient(180deg, var(--color-clearing-tint) 0%, var(--color-clearing-bg) 100%)",
      }}
    >
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 md:px-[60px] md:py-16 md:pt-[72px]">
        {eyebrow && (
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-7">
            <span className="clearing-chip">
              <span className="live-dot" aria-hidden />
              {eyebrow}
            </span>
          </div>
        )}

        <div className="grid items-start gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
          <div>
            <h1
              className="mb-5 max-w-none font-[family-name:var(--font-display)] font-normal leading-[0.98] tracking-[-0.02em] text-ink sm:mb-6 md:max-w-[16ch]"
              style={{ fontSize: "clamp(32px, 5vw + 0.5rem, 68px)" }}
            >
              {title}
            </h1>

            <p className="mb-6 max-w-[44ch] font-[family-name:var(--font-sans)] text-[18px] leading-[1.55] text-[#4A564F] sm:mb-8 sm:text-[19px]">
              {subtitle}
            </p>

            <div className="w-full min-w-0 max-w-[460px]">
              <ZipSearch variant="editorial" />
            </div>

            <HeroFacilitySearch
              stateSlug={stateSlug}
              stateName={stateName}
              facilityCount={facilityCount}
            />

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-ink-3">
              <span className="flex items-center gap-1.5 text-grade-a">
                <span className="live-dot" aria-hidden />
                {liveLabel}
              </span>
              <span className="text-ink-4">{roadmapNote}</span>
            </div>
          </div>

          <div className="hidden md:block">
            <div
              className="relative w-full overflow-hidden rounded-3xl border border-clearing-rule-2 shadow-[var(--shadow-hero-image)]"
              style={{ aspectRatio: "1/1", background: "var(--color-clearing-tint)" }}
            >
              <Image
                src={illustrationSrc}
                alt={illustrationAlt}
                fill
                sizes="(max-width: 768px) 0px, 40vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
