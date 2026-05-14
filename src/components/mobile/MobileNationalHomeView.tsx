import Image from "next/image";
import Link from "next/link";
import type { NationalHomeData } from "@/lib/data/nationalHome";
import { MobileTopbar } from "@/components/mobile/MobileTopbar";
import { MobileTrustBar } from "@/components/mobile/MobileTrustBar";
import {
  SyncedHomeSampleCardMobile,
} from "@/components/home/SampleFacilityRotation";
import { MobileHomeFaq } from "@/components/mobile/MobileHomeFaq";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { CA_FAQS } from "@/lib/content/stateFaqs";

type Props = {
  data: NationalHomeData;
};

const STATE_REGULATORS: Record<string, string> = {
  CA: "CDSS",
  OR: "Oregon DHS",
  WA: "DSHS",
  MN: "MDH",
  TX: "HHSC",
};

export function MobileNationalHomeView({ data }: Props) {
  const { totalFacilities, totalInspections, totalSevereCitations, states, topCities, sampleReviews, lastRefreshed } = data;
  const firstReview = sampleReviews[0] ?? null;

  const statItems = [
    { n: totalFacilities > 0 ? totalFacilities.toLocaleString() : "0", label: "Licensed memory care facilities indexed across 5 states", src: "Multi-state" },
    { n: totalInspections > 0 ? totalInspections.toLocaleString() : "0", label: "State inspection reports, parsed and dated", src: "Regulators", delta: "Updated regularly" },
    { n: totalSevereCitations > 0 ? totalSevereCitations.toLocaleString() : "0", label: "Severe deficiencies on file in the last 24 months", src: "5 states" },
    { n: "0", label: "Referral commissions, lead fees, or paid placements accepted from operators", src: "Policy", delta: "Since day one" },
  ];

  return (
    <>
      <MobileTopbar />

      <section className="m-hero">
        <div className="eyebrow">
          5 States · Vol. 01 · 2026
        </div>
        <h2>
          Memory care you can <em>trust,</em>{" "}
          <span className="ul">ranked by regulators.</span>
        </h2>
        <p className="deck">
          Public inspection data. No paid ads. No sales calls. Every claim sourced to a state record.
        </p>
      </section>

      <div className="m-illo">
        <Image
          src="/illustrations/family.png"
          alt="Illustrated family walking together — representing the families we help navigate memory care decisions"
          width={1200}
          height={900}
          className="h-full w-full object-cover"
          sizes="100vw"
          priority
        />
      </div>

      <MobileTrustBar />

      <section className="m-section tight">
        <div className="label">§ 01 · The Public Record</div>
        <h2>
          National facility data, <em>from 5 state regulators.</em>
        </h2>
      </section>
      <div className="m-stat-strip">
        {statItems.map((s, i) => (
          <div key={i} className="m-stat-card">
            <div className="src">
              [{String(i + 1).padStart(2, "0")}] {s.src}
            </div>
            <div className="n">{s.n}</div>
            {s.delta && <div className="delta">↑ {s.delta}</div>}
            <div className="lbl">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="m-section">
        <div className="label">§ 02 · States We Cover</div>
        <h2>
          Choose your <em>state.</em>
        </h2>
      </section>
      <div className="m-chips">
        {states.map((s) => (
          <Link key={s.stateCode} href={`/${s.stateSlug}`} className="m-chip">
            <span>{s.stateName}</span>
            <span className="n">{s.facilityCount > 0 ? s.facilityCount : "—"}</span>
            <span className="arrow" aria-hidden>→</span>
          </Link>
        ))}
      </div>
      <div className="px-[18px] pb-6">
        <Link
          href="/states"
          className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-rust underline underline-offset-4"
        >
          All covered states →
        </Link>
      </div>

      <section className="m-section tight" style={{ paddingBottom: 0 }}>
        <div className="label">§ 03 · Popular Cities</div>
        <h2>
          Top cities <em>by facility count.</em>
        </h2>
      </section>
      <div className="m-cities">
        {topCities.map((c) => (
          <Link key={`${c.stateCode}-${c.slug}`} href={`/${c.stateSlug}/${c.slug}`} className="m-city">
            <span className="nm">
              {c.name}
              <span className="ml-1 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.1em] text-ink-4">
                {c.stateCode}
              </span>
            </span>
            <span className="ct">{c.count} facilities →</span>
          </Link>
        ))}
      </div>

      <section className="m-section">
        <div className="label">§ 04 · How We Rank</div>
        <h2>
          Ranked on public record. <em>Transparent methodology.</em>
        </h2>
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2 px-[18px] -mx-[18px]">
          Each facility is ranked against peers in its state using publicly available inspection records from state licensing agencies.{" "}
          <Link href="/methodology" className="text-teal underline underline-offset-4">
            How we calculate rankings →
          </Link>
        </p>
      </section>

      <SyncedHomeSampleCardMobile />

      {firstReview && (
        <>
          <section className="m-section">
            <div className="label">§ 05 · Verified Family</div>
            <h2>
              From people who have actually <em>moved a parent in.</em>
            </h2>
          </section>
          <div className="m-review">
            <span className="stars" aria-hidden>
              {"★".repeat(firstReview.rating)}
              {"☆".repeat(Math.max(0, 5 - firstReview.rating))}
            </span>
            <p className="quote">{firstReview.body}</p>
            <div className="who">
              {firstReview.reviewer_name && <span className="name">{firstReview.reviewer_name}</span>}
              {(firstReview.facility_name || firstReview.facility_city) && (
                <span>
                  {firstReview.facility_name}
                  {firstReview.facility_city ? ` · ${firstReview.facility_city}` : ""}
                </span>
              )}
              <span className="verified">
                ✓ Identity verified ·{" "}
                {new Date(firstReview.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            </div>
          </div>
        </>
      )}

      <section className="m-section">
        <div className="label">§ 06 · Common Questions</div>
        <h2>
          What families <em>ask first.</em>
        </h2>
      </section>
      <MobileHomeFaq faqs={CA_FAQS.slice(0, 4)} />

      <div className="px-[18px] py-4 font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.06em]">
        <span className="inline-flex items-center gap-1.5 text-grade-a">
          <span className="live-dot" aria-hidden />
          {totalFacilities > 0 ? `${totalFacilities.toLocaleString()} facilities live` : "Live across 5 states"}
        </span>
        <span className="text-ink-4"> · CA · OR · WA · MN · TX</span>
      </div>

      <section className="m-section border-t-2 border-ink bg-rust text-paper px-[18px] py-10 -mx-0">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(1.5rem,5vw,2rem)] font-normal leading-tight tracking-[-0.015em] text-white">
          Find the right facility, <em>without the sales funnel.</em>
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-white/85">
          Compare peer rankings, read every dated citation. No operator is paying for placement here.
        </p>
        <Link
          href="/states"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-white/30 bg-ink px-5 py-2.5 text-[14px] font-medium text-paper no-underline"
        >
          Choose your state →
        </Link>
      </section>

      <MobileFooter lastRefreshed={lastRefreshed} />
    </>
  );
}
