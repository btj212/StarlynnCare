import Link from "next/link";
import Image from "next/image";
import type { NationalHomeData } from "@/lib/data/nationalHome";
import { SectionHead } from "@/components/editorial/SectionHead";
import { StatBlock } from "@/components/editorial/StatBlock";
import { StateHubReviews } from "@/components/state-hub/StateHubReviews";
import { StateHubFaq } from "@/components/state-hub/StateHubFaq";
import { StateHubCta } from "@/components/state-hub/StateHubCta";
import { StatesWeCoverGrid } from "./StatesWeCoverGrid";
import { ZipSearch } from "@/components/site/ZipSearch";
import { SyncedHomeSampleCardDesktop } from "@/components/home/SampleFacilityRotation";
import { CA_FAQS } from "@/lib/content/stateFaqs";

type Props = {
  data: NationalHomeData;
};

export function NationalHomeSections({ data }: Props) {
  const { totalFacilities, totalInspections, totalSevereCitations, states, topCities, sampleReviews } = data;

  const nationalStats = [
    {
      n: totalFacilities > 0 ? totalFacilities.toLocaleString() : "0",
      label: "Licensed memory care facilities indexed across 5 states",
      src: "CDSS · DHS · DSHS · MDH · HHSC",
    },
    {
      n: totalInspections > 0 ? totalInspections.toLocaleString() : "0",
      label: "State inspection reports, parsed and dated",
      src: "Multi-state regulators",
      delta: "Updated regularly",
    },
    {
      n: totalSevereCitations > 0 ? totalSevereCitations.toLocaleString() : "0",
      label: "Severe deficiencies on file in the last 24 months",
      src: "5 state regulators",
    },
    {
      n: "0",
      label: "Referral commissions, lead fees, or paid placements accepted from operators",
      src: "Policy",
      delta: "Since day one",
    },
  ];

  return (
    <>
      {/* § 00 · Hero */}
      <section className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14 md:py-16">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 sm:mb-7 font-[family-name:var(--font-mono)] text-[10.5px] sm:text-[11.5px] uppercase tracking-[0.18em] text-rust">
            <span className="h-px w-6 sm:w-9 shrink-0 bg-rust opacity-60" aria-hidden />
            <span className="min-w-0 flex-1 basis-[min(100%,14rem)] sm:flex-none sm:basis-auto">
              5 States · Vol. 01 · 2026
            </span>
            <span className="h-px min-w-[2rem] flex-1 basis-0 bg-rust opacity-60 max-sm:hidden" aria-hidden />
          </div>

          <div className="grid gap-10 md:gap-16 items-start md:grid-cols-[1.15fr_1fr]">
            <div>
              <h1
                className="font-[family-name:var(--font-display)] font-normal leading-[0.98] tracking-[-0.02em] text-ink mb-5 sm:mb-6 max-w-none md:max-w-[16ch]"
                style={{ fontSize: "clamp(32px, 5vw + 0.5rem, 84px)" }}
              >
                Memory care you can{" "}
                <em className="italic text-rust">trust,</em>{" "}
                <span
                  className="px-1"
                  style={{ backgroundImage: "linear-gradient(transparent 70%, var(--color-gold-soft) 70%)" }}
                >
                  ranked by regulators.
                </span>
              </h1>

              <p className="font-[family-name:var(--font-display)] italic text-[18px] sm:text-[22px] leading-[1.45] text-ink-3 mb-6 sm:mb-8 max-w-[40ch]">
                Public inspection data. No paid ads. No sales calls. Every claim sourced to a state record.
              </p>

              <div className="w-full max-w-[460px] min-w-0">
                <ZipSearch variant="editorial" />
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-3 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.08em] text-ink-3">
                <span className="flex items-center gap-1.5 text-grade-a">
                  <span className="live-dot" aria-hidden />
                  {totalFacilities > 0 ? `${totalFacilities.toLocaleString()} facilities live` : "Live across 5 states"}
                </span>
                <span className="text-ink-4">· CA · OR · WA · MN · TX</span>
              </div>
            </div>

            <div className="hidden md:block">
              <div
                className="relative w-full border border-paper-rule overflow-hidden"
                style={{ aspectRatio: "1/1", background: "var(--color-paper-2)" }}
              >
                <Image
                  src="/illustrations/family.png"
                  alt="Illustrated family walking together — representing the families we help navigate memory care decisions"
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

      {/* § 01 · The Public Record */}
      <section
        id="data"
        className="border-b border-paper-rule"
        style={{ background: "var(--color-paper-2)" }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
          <SectionHead
            title={<>National facility data, <em>curated from 5 state regulators.</em></>}
          />
          <StatBlock stats={nationalStats} />
        </div>
      </section>

      {/* § 02 · States we cover */}
      <section
        id="states"
        className="border-b border-paper-rule"
        style={{ background: "var(--color-paper)" }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
          <SectionHead
            title={<>Choose your state, <em>or start with a city below.</em></>}
          />
          <StatesWeCoverGrid states={states} />
          <div className="mt-6">
            <Link
              href="/states"
              className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-rust underline underline-offset-4"
            >
              All covered states →
            </Link>
          </div>
        </div>
      </section>

      {/* § 03 · Popular cities (state-aware) */}
      <section
        id="browse"
        className="border-b border-paper-rule"
        style={{ background: "var(--color-paper-2)" }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
          <SectionHead
            title={<>Top cities by facility count, <em>across all states.</em></>}
          />
          <div className="columns-1 sm:columns-2 lg:columns-3 [column-gap:2rem]">
            {topCities.map((c) => (
              <Link
                key={`${c.stateCode}-${c.slug}`}
                href={`/${c.stateSlug}/${c.slug}`}
                className="flex justify-between py-[7px] border-b border-dotted border-paper-rule no-underline text-[14px] text-ink-2 hover:text-teal break-inside-avoid transition-colors"
              >
                <span>
                  {c.name}
                  <span className="ml-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4">
                    {c.stateCode}
                  </span>
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-ink-4">{c.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* § 04 · How we grade */}
      <section
        id="methodology"
        className="border-b border-paper-rule"
        style={{ background: "var(--color-paper)" }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
          <SectionHead
            title={<>Three data signals. <em>Compared to peers.</em></>}
          />
          <div className="grid gap-10 md:gap-16 items-start md:grid-cols-[1fr_1.05fr]">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[32px] font-normal leading-[1.1] tracking-[-0.01em] m-0 mb-4">
                Data you can trace to a citation number.
              </h3>
              <div className="text-ink-2 mb-4 leading-relaxed">
                <p className="mb-4">
                  Each facility shows its full inspection record from the state regulator — every citation, severity level, and repeat violation. We compare each facility against similar facilities in the same state so you can see what&rsquo;s normal and what stands out.
                </p>
              </div>
              <p className="text-ink-2 mb-6 leading-relaxed">
                The methodology is published and version-controlled. We change it in public.{" "}
                <Link href="/methodology" className="text-teal underline underline-offset-4">
                  Read the full methodology →
                </Link>
              </p>
            </div>
            <SyncedHomeSampleCardDesktop />
          </div>
        </div>
      </section>

      {/* § 05 · Reviews */}
      <StateHubReviews reviews={sampleReviews} />

      {/* § 06 · FAQ */}
      <StateHubFaq faqs={CA_FAQS} />

      {/* § 07 · CTA */}
      <StateHubCta facilityCount={totalFacilities} ctaHref="/states" />
    </>
  );
}
