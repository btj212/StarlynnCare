import Image from "next/image";
import Link from "next/link";
import type { NationalHomeData } from "@/lib/data/nationalHome";
import { MobileTopbar } from "@/components/mobile/MobileTopbar";
import { MobileTrustBar } from "@/components/mobile/MobileTrustBar";
import { ZipSearch } from "@/components/site/ZipSearch";
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

const MIN_LIVE_THRESHOLD = 100;

export function MobileNationalHomeView({ data }: Props) {
  const { totalFacilities, totalInspections, totalSevereCitations, states, topCities, sampleReviews, lastRefreshed } = data;
  const liveStates = states.filter((s) => s.facilityCount >= MIN_LIVE_THRESHOLD);
  const pilotStates = states.filter((s) => s.facilityCount > 0 && s.facilityCount < MIN_LIVE_THRESHOLD);
  const reviewsToShow = sampleReviews.slice(0, 3);

  const statItems = [
    { n: totalFacilities > 0 ? totalFacilities.toLocaleString() : "0", label: `Licensed memory care facilities indexed across ${liveStates.length} states`, src: "Multi-state" },
    { n: totalInspections > 0 ? totalInspections.toLocaleString() : "0", label: "State inspection reports, parsed and dated", src: "Regulators", delta: "Updated regularly" },
    { n: totalSevereCitations > 0 ? totalSevereCitations.toLocaleString() : "0", label: "Severe deficiencies on file in the last 6 months", src: "State regulators" },
    { n: "0", label: "Referral commissions, lead fees, or paid placements accepted from operators", src: "Policy", delta: "Since day one" },
  ];

  return (
    <>
      <MobileTopbar />

      <section className="m-hero">
        <div className="eyebrow">
          {liveStates.length} States · Vol. 01 · 2026
        </div>
        <h1>
          Find memory care you can <em>trust,</em>{" "}
          ranked with regulator data.
        </h1>
        <p className="deck">
          Public inspection data. No paid ads. No sales calls. Every claim sourced to a state record.
        </p>
        <div className="mt-4">
          <ZipSearch variant="mobileShell" />
        </div>
      </section>

      <div className="m-illo" aria-hidden style={{ pointerEvents: "none" }}>
        <Image
          src="/illustrations/hallway-family-staff-conversation.png"
          alt=""
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
          National facility data, <em>from state regulators.</em>
        </h2>
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-ink-4 -mt-2 mb-3">
          swipe for more →
        </p>
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
        {/* TX hidden until full HHSC dataset is ingested — remove filter to restore */}
        {states.filter((s) => s.stateCode !== "TX").map((s) => (
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
      </section>

      <div className="m-illo" aria-hidden style={{ pointerEvents: "none" }}>
        <Image
          src="/illustrations/couch-grandmother-grandkids-reading.png"
          alt="Illustrated grandmother reading a book to two young grandchildren on a couch — representing the relationships dementia care planning aims to preserve"
          width={1200}
          height={900}
          className="h-full w-full object-cover"
          sizes="100vw"
        />
      </div>

      <div className="px-[18px] pt-5 pb-2">
        <p className="text-[14px] leading-relaxed text-ink-2">
          Each facility is ranked against peers in its state using publicly available inspection records from state licensing agencies.{" "}
          <Link href="/methodology" className="text-teal underline underline-offset-4">
            How we calculate rankings →
          </Link>
        </p>
      </div>

      <SyncedHomeSampleCardMobile />

      {reviewsToShow.length > 0 && (
        <>
          <section className="m-section">
            <div className="label">§ 05 · Verified Family</div>
            <h2>
              From people who have actually <em>moved a parent in.</em>
            </h2>
          </section>
          <div className="m-review-stack">
            {reviewsToShow.map((review) => (
              <div key={review.id} className="m-review">
                <span className="stars" aria-hidden>
                  {"★".repeat(review.rating)}
                  {"☆".repeat(Math.max(0, 5 - review.rating))}
                </span>
                <p className="quote">{review.body}</p>
                <div className="who">
                  {review.reviewer_name && <span className="name">{review.reviewer_name}</span>}
                  {(review.facility_name || review.facility_city) && (
                    <span>
                      {review.facility_name}
                      {review.facility_city ? ` · ${review.facility_city}` : ""}
                    </span>
                  )}
                  <span className="verified">
                    ✓ Identity verified ·{" "}
                    {new Date(review.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <section className="m-section">
        <div className="label">§ 06 · Common Questions</div>
        <h2>
          What families <em>ask first.</em>
        </h2>
      </section>
      <MobileHomeFaq faqs={CA_FAQS} />

      <div className="px-[18px] py-4 font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.06em]">
        <span className="inline-flex items-center gap-1.5 text-grade-a">
          <span className="live-dot" aria-hidden />
          {totalFacilities > 0 ? `${totalFacilities.toLocaleString()} facilities live` : `Live across ${liveStates.length} states`}
        </span>
        {liveStates.length > 0 && (
          <span className="text-ink-4"> · {liveStates.map((s) => s.stateCode).join(" · ")}</span>
        )}
        {pilotStates.length > 0 && (
          <span className="text-ink-4 text-[9px]"> · Pilot: {pilotStates.map((s) => `${s.stateCode} (${s.facilityCount})`).join(" · ")}</span>
        )}
      </div>

      <section className="m-cta">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(1.625rem,5.5vw,2.125rem)] font-normal leading-[1.05] tracking-[-0.015em] text-white">
          Find the right facility, <em>without the sales funnel.</em>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/85 max-w-[40ch]">
          Search by ZIP, compare peer rankings, read every dated citation. Free, forever, with no operator behind the recommendation.
        </p>
        <Link
          href="/states"
          className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-paper no-underline"
        >
          Search {totalFacilities > 0 ? totalFacilities.toLocaleString() : ""} facilities
          <span aria-hidden>→</span>
        </Link>
      </section>

      <MobileFooter lastRefreshed={lastRefreshed} />
    </>
  );
}
