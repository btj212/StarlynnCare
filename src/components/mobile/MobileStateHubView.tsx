import Link from "next/link";
import Image from "next/image";
import type { StateHubData } from "@/lib/data/stateHub";
import type { StateHubConfig } from "@/lib/stateHubConfigs/types";
import { buildStateStatItems } from "@/lib/stateHubConfigs/types";
import { getSeasonAndYear } from "@/lib/data/stateHub";
import { MobileTopbar } from "@/components/mobile/MobileTopbar";
import { MobileTrustBar } from "@/components/mobile/MobileTrustBar";
import { ZipSearch } from "@/components/site/ZipSearch";
import { MobileHomeFaq } from "@/components/mobile/MobileHomeFaq";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import {
  SyncedHomeSampleCardMobile,
} from "@/components/home/SampleFacilityRotation";
import { getArticleThumbnail } from "@/lib/content/articleThumbnails";

type Props = {
  data: StateHubData;
  config: StateHubConfig;
};

export function MobileStateHubView({ data, config }: Props) {
  const { season, year } = getSeasonAndYear();
  const { stateName, stateSlug, stateCode, edition, showZipSearch } = config;
  const statItems = buildStateStatItems(data.stats, config);
  const { counties, topCities, stats, sampleReviews } = data;
  const reviewsToShow = sampleReviews.slice(0, 3);

  return (
    <>
      <MobileTopbar stateCode={stateCode} />

      <section className="m-hero">
        <div className="eyebrow">
          {stateName} Edition · {edition} · {season} {year}
        </div>
        <h1>
          The <em>best</em> memory care in {stateName},{" "}
          <span className="ul">ranked by the state&apos;s own inspectors.</span>
        </h1>
        <p className="deck">
          No paid ads. No sales calls. Every claim sourced and dated to a public state record.
        </p>
        {showZipSearch && (
          <div className="mt-4">
            <ZipSearch variant="mobileShell" />
          </div>
        )}
      </section>

      <div className="m-illo">
        <Image
          src="/illustrations/family.png"
          alt={`Illustrated family walking together — representing families navigating memory care decisions in ${stateName}`}
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
          The {stateName} facility data you need, <em>curated + analyzed for you.</em>
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
            <div className="n">
              {s.n}
              {s.unit && <span style={{ fontSize: "0.55em", color: "var(--color-ink-3)" }}> {s.unit}</span>}
            </div>
            {s.delta && <div className="delta">↑ {s.delta}</div>}
            <div className="lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {showZipSearch && (
        <section className="m-section">
          <div className="label">§ 02 · How We Rank</div>
          <h2>
            Ranked on public record. <em>Transparent methodology.</em>
          </h2>
          <p className="mb-4 text-[14px] leading-relaxed text-ink-2 px-[18px] -mx-[18px]">
            Each facility is ranked against peers in its state using publicly available state inspection records.{" "}
            <Link href="/methodology" className="text-teal underline underline-offset-4">
              How we calculate rankings →
            </Link>
          </p>
        </section>
      )}

      {!showZipSearch && (
        <section className="m-section">
          <div className="label">§ 02 · How We Rank</div>
          <h2>
            Ranked on public record. <em>Transparent methodology.</em>
          </h2>
          <p className="mb-4 text-[14px] leading-relaxed text-ink-2 px-[18px] -mx-[18px]">
            Each facility is ranked against peers in {stateName} using publicly available inspection records.{" "}
            <Link href="/methodology" className="text-teal underline underline-offset-4">
              How we calculate rankings →
            </Link>
          </p>
        </section>
      )}

      <SyncedHomeSampleCardMobile />

      {counties.length > 0 && (
        <>
          <section className="m-section">
            <div className="label">§ 03 · Browse {stateName}</div>
            <h2>
              Start with your <em>county.</em>
            </h2>
          </section>
          <div className="m-chips">
            {counties.map((c) => (
              <Link key={c.slug} href={`/${stateSlug}/${c.slug}`} className="m-chip">
                <span>{c.name.replace(/ County$/i, "")}</span>
                <span className="n">{c.count}</span>
                <span className="arrow" aria-hidden>
                  →
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {topCities.length > 0 && (
        <>
          <section className="m-section tight" style={{ paddingBottom: 0 }}>
            <div className="label" style={{ borderTop: "none", paddingTop: 0 }}>
              Popular cities
            </div>
          </section>
          <div className="m-cities">
            {topCities.map((c) => (
              <Link
                key={c.slug}
                href={`/${c.stateSlug ?? stateSlug}/${c.slug}`}
                className="m-city"
              >
                <span className="nm">{c.name}</span>
                <span className="ct">{c.count} facilities →</span>
              </Link>
            ))}
          </div>
          <div className="px-[18px] pb-6">
            <Link
              href={`/${stateSlug}`}
              className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-rust underline underline-offset-4"
            >
              View all {stateName} counties →
            </Link>
          </div>
        </>
      )}

      <section className="m-section" id="browse">
        <div className="label">§ 04 · The Reports</div>
        <h2>
          An editorial desk for <em>memory care.</em>
        </h2>
      </section>
      <div className="m-ed-strip">
        {config.editorialCards.map((e, i) => {
          const isFeature = i === 0;
          const cardClass = isFeature ? "m-ed-card feature" : "m-ed-card";
          const thumb = !isFeature ? getArticleThumbnail(e.href) : null;
          const inner = (
            <>
              {isFeature ? (
                <div className="ill">
                  <div className="title">
                    {e.title}
                  </div>
                </div>
              ) : thumb ? (
                <div className="ill relative overflow-hidden">
                  <Image
                    src={thumb.src}
                    alt={thumb.alt}
                    fill
                    className="object-cover"
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
            <Link key={e.href} href={e.href} className={cardClass}>
              {inner}
            </Link>
          ) : (
            <div key={e.title} className={cardClass} aria-label={`Coming soon: ${e.title}`}>
              {inner}
            </div>
          );
        })}
      </div>

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
      <MobileHomeFaq faqs={config.faqs} />

      <div className="px-[18px] py-4 font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.06em]">
        <span className="inline-flex items-center gap-1.5 text-grade-a">
          <span className="live-dot" aria-hidden />
          Live across {counties.length > 0 ? `${counties.length} ${stateCode} counties` : stateName}
        </span>
        <span className="text-ink-4"> · {stats.facilities.toLocaleString()} facilities indexed</span>
      </div>

      <section className="m-cta">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-[clamp(1.625rem,5.5vw,2.125rem)] font-normal leading-[1.05] tracking-[-0.015em] text-white">
          Find the right facility, <em>without the sales funnel.</em>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/85 max-w-[40ch]">
          Search by ZIP, compare peer rankings, read every dated citation. Free, forever, with no operator behind the recommendation.
        </p>
        <Link
          href={`/${stateSlug}/facilities`}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-paper no-underline"
        >
          Search {stats.facilities.toLocaleString()} {stateName} facilities
          <span aria-hidden>→</span>
        </Link>
      </section>

      <MobileFooter lastRefreshed={data.stats.lastRefreshed} />
    </>
  );
}
