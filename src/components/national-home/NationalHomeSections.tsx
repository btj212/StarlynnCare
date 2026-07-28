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

const MIN_LIVE_THRESHOLD = 100;
const gutter = "mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px]";

export function NationalHomeSections({ data }: Props) {
  const { totalFacilities, totalInspections, totalSevereCitations, states, topCities, sampleReviews } = data;

  const liveStates = states.filter((s) => s.facilityCount >= MIN_LIVE_THRESHOLD);
  const pilotStates = states.filter((s) => s.facilityCount > 0 && s.facilityCount < MIN_LIVE_THRESHOLD);

  const nationalStats = [
    {
      n: totalFacilities > 0 ? totalFacilities.toLocaleString() : "0",
      label: `Licensed memory care facilities indexed across ${liveStates.length + pilotStates.length} states`,
      src: "CDSS · DHS · DSHS · MDH · HHSC · PA DHS",
    },
    {
      n: totalInspections > 0 ? totalInspections.toLocaleString() : "0",
      label: "State inspection reports, parsed and dated",
      src: "Multi-state regulators",
      delta: "Updated regularly",
    },
    {
      n: totalSevereCitations > 0 ? totalSevereCitations.toLocaleString() : "0",
      label: "Severe deficiencies on file in the last 6 months",
      src: "State regulators",
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
      {/* § 00 · Hero — production copy kept; Clearing surfaces */}
      <section
        className="border-b border-clearing-rule"
        style={{ background: "linear-gradient(180deg, var(--color-clearing-tint) 0%, var(--color-clearing-bg) 100%)" }}
      >
        <div className={`${gutter} py-14 md:py-16 md:pt-[72px] md:pb-16`}>
          <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-7">
            <span className="clearing-chip">
              <span className="live-dot" aria-hidden />
              {totalFacilities > 0
                ? `${totalFacilities.toLocaleString()} facilities · ${liveStates.length + pilotStates.length} states`
                : `${liveStates.length + pilotStates.length} States · Vol. 01 · 2026`}
            </span>
          </div>

          <div className="grid items-start gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
            <div>
              <h1
                className="mb-5 max-w-none font-[family-name:var(--font-display)] font-normal leading-[0.98] tracking-[-0.02em] text-ink sm:mb-6 md:max-w-[16ch]"
                style={{ fontSize: "clamp(32px, 5vw + 0.5rem, 68px)" }}
              >
                Find memory care you can{" "}
                <em className="italic text-teal">trust,</em>{" "}
                ranked with regulator data.
              </h1>

              <p className="mb-6 max-w-[44ch] font-[family-name:var(--font-sans)] text-[18px] leading-[1.55] text-[#4A564F] sm:mb-8 sm:text-[19px]">
                Public inspection data. No paid ads. No sales calls. Every claim sourced to a state record.
              </p>

              <div className="w-full min-w-0 max-w-[460px]">
                <ZipSearch variant="editorial" />
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-ink-3">
                <span>✓ No sales calls</span>
                <span>✓ No paid placement</span>
                {liveStates.length > 0 && (
                  <span className="text-ink-4">
                    {liveStates.map((s) => s.stateCode).join(" · ")}
                    {pilotStates.length > 0 && (
                      <> · Pilot: {pilotStates.map((s) => `${s.stateCode} (${s.facilityCount})`).join(" · ")}</>
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="hidden md:block">
              <div
                className="relative w-full overflow-hidden rounded-3xl border border-clearing-rule-2 shadow-[var(--shadow-hero-image)]"
                style={{ aspectRatio: "4/3", background: "var(--color-clearing-tint)" }}
              >
                <Image
                  src="/illustrations/couch-grandmother-grandkids-reading.png"
                  alt="Illustrated grandmother reading a book to two young grandchildren on a couch — representing the relationships dementia care planning aims to preserve"
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
      <section id="data" className="border-b border-clearing-rule bg-clearing-tint">
        <div className={`${gutter} py-16 md:py-20`}>
          <SectionHead
            title={<>National facility data, <em>curated from state regulators.</em></>}
          />
          <StatBlock stats={nationalStats} />
        </div>
      </section>

      {/* § 02 · States we cover */}
      <section id="states" className="border-b border-clearing-rule bg-clearing-bg">
        <div className={`${gutter} py-16 md:py-20`}>
          <SectionHead
            title={<>Choose your state, <em>or start with a city below.</em></>}
          />
          <StatesWeCoverGrid states={states} />
          <div className="mt-6">
            <Link
              href="/states"
              className="font-[family-name:var(--font-sans)] text-[14px] font-semibold text-teal underline underline-offset-4 hover:text-rust"
            >
              All covered states →
            </Link>
          </div>
        </div>
      </section>

      {/* § 03 · Popular cities */}
      <section id="browse" className="border-b border-clearing-rule bg-clearing-tint">
        <div className={`${gutter} py-16 md:py-20`}>
          <SectionHead
            title={<>Top cities by facility count, <em>across all states.</em></>}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topCities.map((c) => (
              <Link
                key={`${c.stateCode}-${c.slug}`}
                href={`/${c.stateSlug}/${c.slug}`}
                className="card-lift flex items-center justify-between rounded-2xl border border-clearing-rule-2 bg-clearing-card px-5 py-4 text-[15px] text-ink-2 no-underline transition-colors hover:text-teal"
              >
                <span className="font-semibold text-ink">
                  {c.name}
                  <span className="ml-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-4">
                    {c.stateCode}
                  </span>
                </span>
                <span className="text-[14px] text-ink-4">{c.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* § 04 · How we grade */}
      <section id="methodology" className="border-b border-clearing-rule bg-clearing-bg">
        <div className={`${gutter} py-16 md:py-20`}>
          <SectionHead
            title={<>Three data signals. <em>Compared to peers.</em></>}
          />
          <div className="relative mb-12 overflow-hidden rounded-[22px] border border-clearing-rule-2 shadow-[var(--shadow-feature)]" style={{ aspectRatio: "21/9", background: "var(--color-clearing-tint)" }}>
            <Image
              src="/illustrations/hallway-family-staff-conversation.png"
              alt="Illustrated family member speaking with a facility staff member in a hallway, holding documents — representing the conversations families have when researching memory care options"
              fill
              sizes="1280px"
              className="object-cover"
            />
          </div>
          <div className="grid items-start gap-10 md:grid-cols-[1fr_1.05fr] md:gap-16">
            <div>
              <h3 className="m-0 mb-4 font-[family-name:var(--font-display)] text-[26px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[32px]">
                Data you can trace to a citation number.
              </h3>
              <div className="mb-4 leading-relaxed text-ink-2">
                <p className="mb-4">
                  Each facility shows its full inspection record from the state regulator — every citation, severity level, and repeat violation. We compare each facility against similar facilities in the same state so you can see what&rsquo;s normal and what stands out.
                </p>
              </div>
              <p className="mb-6 leading-relaxed text-ink-2">
                The methodology is published and version-controlled. We change it in public.{" "}
                <Link href="/methodology" className="text-teal underline underline-offset-4 hover:text-rust">
                  Read the full methodology →
                </Link>
              </p>
              <div className="flex flex-wrap gap-2">
                {["Severity", "Repeat violations", "Inspection frequency"].map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-[#E7EBE4] bg-[#F5F7F3] px-3 py-1.5 text-[13px] font-medium text-[#3C4A43]"
                  >
                    {pill}
                  </span>
                ))}
              </div>
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
