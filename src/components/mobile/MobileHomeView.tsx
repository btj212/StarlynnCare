import Image from "next/image";
import Link from "next/link";
import type { StatItem } from "@/components/editorial/StatBlock";
import { MobileTopbar } from "@/components/mobile/MobileTopbar";
import { MobileTrustBar } from "@/components/mobile/MobileTrustBar";
import { MobileFacilityGradeCard, type MobileGradeFacility } from "@/components/mobile/MobileFacilityGradeCard";
import { MobileHomeFaq } from "@/components/mobile/MobileHomeFaq";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import type { FaqItem } from "@/lib/content/homeFaqs";

export type MobileCounty = { name: string; slug: string; count: number; cities: number };
export type MobileCity = { name: string; slug: string; count: number };

export type MobileEditorialCard = {
  kind: string;
  title: string;
  desc: string;
  meta: string;
  href: string | null;
  live: boolean;
};

export type MobileHomeReview = {
  id: string;
  body: string;
  rating: number;
  reviewer_name: string | null;
  facility_name: string | null;
  facility_city: string | null;
  created_at: string;
};

export function MobileHomeView({
  season,
  year,
  statItems,
  statFootnotes,
  counties,
  topCities,
  gradeCardFacility,
  firstReview,
  editorials,
  mobileFaqs,
  lastRefreshed,
  countyCountLive,
}: {
  season: string;
  year: number;
  statItems: StatItem[];
  statFootnotes: string[];
  counties: MobileCounty[];
  topCities: MobileCity[];
  gradeCardFacility: MobileGradeFacility | null;
  firstReview: MobileHomeReview | null;
  editorials: MobileEditorialCard[];
  mobileFaqs: FaqItem[];
  lastRefreshed: string | null;
  countyCountLive: number;
}) {
  return (
    <>
      <MobileTopbar />

      <section className="m-hero">
        <div className="eyebrow">
          California Edition · Vol. 02 · {season} {year}
        </div>
        <h1>
          The <em>best</em> memory care in California,{" "}
          <span className="ul">ranked by the state&apos;s own inspectors.</span>
        </h1>
        <p className="deck">
          No paid ads. No sales calls. Every claim sourced and dated to a public state record.
        </p>
      </section>

      <div className="m-illo">
        <Image
          src="/illustrations/family.png"
          alt="Illustrated family walking together — the only people imagery on StarlynnCare until verified family photography ships"
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
          The California facility data you need, <em>curated + analyzed for you.</em>
        </h2>
      </section>
      <div className="m-stat-strip">
        {statItems.map((s, i) => (
          <div key={i} className="m-stat-card">
            <div className="src">
              [{String(i + 1).padStart(2, "0")}] {s.src}
            </div>
            <div className="n">
              {s.n}
              {s.unit && <span style={{ fontSize: "0.55em", color: "var(--color-ink-3)" }}> {s.unit}</span>}
            </div>
            {s.delta && <div className="delta">↑ {s.delta}</div>}
            <div className="lbl">{s.label}</div>
          </div>
        ))}
      </div>
      {statFootnotes.length > 0 && (
        <div className="px-[18px] pb-4 font-[family-name:var(--font-mono)] text-[10.5px] leading-relaxed text-ink-3 tracking-[0.04em]">
          {statFootnotes.map((f, i) => (
            <span key={i} className="block">
              <span className="text-rust">▸</span> {f}
            </span>
          ))}
        </div>
      )}

      <section className="m-section">
        <div className="label">§ 02 · How We Grade</div>
        <h2>
          One letter grade. <em>Transparent scoring.</em>
        </h2>
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2 px-[18px] -mx-[18px]">
          Each facility receives a single A–F grade derived from weighted inspection signals tied to CDSS records.{" "}
          <Link href="/methodology" className="text-teal underline underline-offset-4">
            How we calculate this grade →
          </Link>
        </p>
      </section>

      {gradeCardFacility ? (
        <div className="px-0">
          <MobileFacilityGradeCard facility={gradeCardFacility} />
        </div>
      ) : (
        <div className="mx-[18px] border border-paper-rule bg-paper-2 p-8 text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink-4">
          Sample grade card loading…
        </div>
      )}

      <section className="m-section">
        <div className="label">§ 03 · Browse California</div>
        <h2>
          Start with your <em>county.</em>
        </h2>
      </section>
      <div className="m-chips">
        {counties.map((c) => (
          <Link key={c.slug} href={`/california/${c.slug}`} className="m-chip">
            <span>{c.name.replace(/ County$/i, "")}</span>
            <span className="n">{c.count}</span>
            <span className="arrow" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>

      <section className="m-section tight" style={{ paddingBottom: 0 }}>
        <div className="label" style={{ borderTop: "none", paddingTop: 0 }}>
          Popular cities
        </div>
      </section>
      <div className="m-cities">
        {topCities.map((c) => (
          <Link key={c.slug} href={`/california/${c.slug}`} className="m-city">
            <span className="nm">{c.name}</span>
            <span className="ct">{c.count} facilities →</span>
          </Link>
        ))}
      </div>
      <div className="px-[18px] pb-6">
        <Link
          href="/california"
          className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-rust underline underline-offset-4"
        >
          View all California counties →
        </Link>
      </div>

      <section className="m-section" id="browse">
        <div className="label">§ 04 · The Reports</div>
        <h2>
          An editorial desk for <em>memory care.</em>
        </h2>
      </section>
      <div className="m-ed-strip">
        {editorials.map((e, i) => {
          const isFeature = i === 0;
          const cardClass = isFeature ? "m-ed-card feature" : "m-ed-card";
          const inner = (
            <>
              {isFeature ? (
                <div className="ill">
                  <div className="title">
                    The State of
                    <br />
                    Memory Care
                    <br />
                    <em>in California</em>
                  </div>
                </div>
              ) : i === 1 ? (
                <div className="ill relative overflow-hidden">
                  <Image
                    src="/illustrations/family.png"
                    alt=""
                    fill
                    className="object-cover opacity-90"
                    sizes="85vw"
                  />
                </div>
              ) : (
                <div className="ill" />
              )}
              <div className="body">
                <div className="kind">{e.kind}</div>
                <h3>{e.title}</h3>
                <p>{e.desc.length > 120 ? `${e.desc.slice(0, 118)}…` : e.desc}</p>
                <div className="meta">
                  {e.meta}
                  {e.live ? " · Read →" : ""}
                </div>
              </div>
            </>
          );
          return e.live && e.href ? (
            <Link key={i} href={e.href} className={cardClass}>
              {inner}
            </Link>
          ) : (
            <div key={i} className={cardClass} aria-label={`Coming soon: ${e.title}`}>
              {inner}
            </div>
          );
        })}
      </div>

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
      <MobileHomeFaq faqs={mobileFaqs} />

      <div className="px-[18px] py-4 font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.06em]">
        <span className="inline-flex items-center gap-1.5 text-grade-a">
          <span className="live-dot" aria-hidden />
          Live across {countyCountLive > 0 ? `${countyCountLive} CA counties` : "CA"}
        </span>
        <span className="text-ink-4"> · Texas Q2 · Florida Q2</span>
      </div>

      <section className="m-section border-t-2 border-ink bg-rust text-paper px-[18px] py-10 -mx-0">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(1.5rem,5vw,2rem)] font-normal leading-tight tracking-[-0.015em] text-white">
          Find the right facility, <em>without the sales funnel.</em>
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-white/85">
          Search by ZIP, compare A–F grades, read every dated citation. No operator is paying for placement here.
        </p>
        <Link
          href="/california"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-white/30 bg-ink px-5 py-2.5 text-[14px] font-medium text-paper no-underline"
        >
          Browse California facilities →
        </Link>
      </section>

      <MobileFooter lastRefreshed={lastRefreshed} />
    </>
  );
}
