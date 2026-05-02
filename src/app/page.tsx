import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionHead } from "@/components/editorial/SectionHead";
import { StatBlock, type StatItem } from "@/components/editorial/StatBlock";
import { ZipSearch } from "@/components/site/ZipSearch";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { regionsForState } from "@/lib/regions";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { buildOrganizationSchema, buildWebSiteSchema, buildFaqSchemaFromPairs } from "@/lib/seo/schema";
import { HOME_FAQS } from "@/lib/content/homeFaqs";
import { MobileHomeView } from "@/components/mobile/MobileHomeView";
import type { HomeSampleFacility } from "@/components/home/homeSampleFacilityTypes";
import {
  SampleFacilityRotationProvider,
  SyncedHomeSampleCardDesktop,
} from "@/components/home/SampleFacilityRotation";
import { HomeFaq } from "@/components/home/HomeFaq";
import { MobileStickyCtaBar } from "@/components/mobile/MobileStickyCtaBar";
import type { CareCategory } from "@/lib/types";

export const revalidate = 3600;

/** Homepage §02 rotates through this many publishable facilities (hourly reshuffle). */
const SAMPLE_CARD_ROTATION_COUNT = 10;

/** Deterministic shuffle — same cohort for the ~1h ISR window. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  const out = [...items];
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const homeCanonical = canonicalFor("/");

export const metadata: Metadata = {
  alternates: { canonical: homeCanonical },
  openGraph: {
    url: homeCanonical,
    type: "website",
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

type CountyRow = {
  name: string;
  slug: string;
  count: number;
  cities: number;
};

type CityRow = { name: string; slug: string; count: number };

type HomeData = {
  stats: {
    facilities: number;
    inspections: number;
    severeCitations: number;
    lastRefreshed: string | null;
  };
  /** Rotating §02 sample cards — random cohort, reshuffled hourly */
  gradeCardFacilities: HomeSampleFacility[];
  counties: CountyRow[];
  topCities: CityRow[];
  sampleReviews: Array<{
    id: string;
    body: string;
    rating: number;
    reviewer_name: string | null;
    facility_name: string | null;
    facility_city: string | null;
    created_at: string;
  }>;
};

async function loadHomeData(): Promise<HomeData> {
  const fallback: HomeData = {
    stats: { facilities: 0, inspections: 0, severeCitations: 0, lastRefreshed: null },
    gradeCardFacilities: [],
    counties: [],
    topCities: [],
    sampleReviews: [],
  };

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return fallback;

  const [facRes, inspRes, sevRes, refreshRes] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }).eq("publishable", true),
    supabase.from("inspections").select("*", { count: "exact", head: true }),
    supabase.from("deficiencies").select("*", { count: "exact", head: true }).gte("severity", 3),
    supabase.from("facilities").select("updated_at").eq("publishable", true).order("updated_at", { ascending: false }).limit(1).single(),
  ]);

  const facilityCount = facRes.count ?? 0;
  const inspCount = inspRes.count ?? 0;
  const sevCount = sevRes.count ?? 0;
  const lastUpdated = refreshRes.data?.updated_at as string | null;
  const lastRefreshed = lastUpdated
    ? new Date(lastUpdated).toISOString().split("T")[0]
    : null;

  const { data: idRows } = await supabase
    .from("facilities")
    .select("id")
    .eq("publishable", true);

  const allIds = (idRows ?? []).map((r: { id: string }) => r.id);
  const hourSeed = Math.floor(Date.now() / 3600000);
  const pickedIds = seededShuffle(allIds, hourSeed).slice(0, SAMPLE_CARD_ROTATION_COUNT);

  let gradeCardFacilities: HomeSampleFacility[] = [];
  if (pickedIds.length > 0) {
    const { data: pickedRows } = await supabase
      .from("facilities")
      .select(
        "id, name, city, state_code, slug, city_slug, license_number, beds, care_category",
      )
      .in("id", pickedIds);

    const rowById = new Map(
      (pickedRows ?? []).map((r) => [r.id as string, r]),
    );
    const ordered = pickedIds
      .map((id) => rowById.get(id))
      .filter((r): r is NonNullable<typeof r> => r != null);

    gradeCardFacilities = (
      await Promise.all(
        ordered.map(async (picked) => {
          const { data: snap } = await supabase.rpc("facility_snapshot", {
            p_facility_id: picked.id,
          });
          const s = snap as null | {
            grade?: { letter: string; composite_percentile: number } | null;
            metrics?: {
              severity: { percentile: number };
              repeats: { percentile: number };
              frequency: { percentile: number };
            } | null;
          };
          return {
            ...picked,
            care_category: picked.care_category as CareCategory,
            grade: s?.grade?.letter ?? null,
            composite: s?.grade?.composite_percentile ?? null,
            sev_pct: s?.metrics?.severity?.percentile ?? null,
            rep_pct: s?.metrics?.repeats?.percentile ?? null,
            freq_pct: s?.metrics?.frequency?.percentile ?? null,
          } satisfies HomeSampleFacility;
        }),
      )
    ).filter(Boolean);
  }

  // County facility counts — align with `regions.ts` citySlug memberships (no DB county column)
  const { data: tierRows } = await supabase
    .from("facilities")
    .select("city_slug, capacity_tier")
    .eq("state_code", "CA")
    .eq("publishable", true);

  const countsByCity = new Map<string, number>();
  const smallCountsByCity = new Map<string, number>();
  for (const row of tierRows ?? []) {
    const slug = (row as { city_slug: string | null }).city_slug ?? "";
    const tier =
      (row as { capacity_tier: string | null }).capacity_tier ?? "unknown";
    if (!slug) continue;
    if (tier === "small") {
      smallCountsByCity.set(slug, (smallCountsByCity.get(slug) ?? 0) + 1);
    } else {
      countsByCity.set(slug, (countsByCity.get(slug) ?? 0) + 1);
    }
  }

  const counties: CountyRow[] = regionsForState("CA")
    .filter((r) => r.kind === "county")
    .map((region) => {
      const nMediumPlus = region.citySlugs.reduce(
        (acc, s) => acc + (countsByCity.get(s) ?? 0),
        0,
      );
      const nSmall = region.citySlugs.reduce(
        (acc, s) => acc + (smallCountsByCity.get(s) ?? 0),
        0,
      );
      const citiesWithData = region.citySlugs.filter(
        (s) =>
          (countsByCity.get(s) ?? 0) > 0 ||
          (smallCountsByCity.get(s) ?? 0) > 0,
      ).length;
      return {
        name: region.name,
        slug: region.slug,
        count: nMediumPlus + nSmall,
        cities: citiesWithData,
      };
    });

  // Top cities by facility count
  const { data: cityRows } = await supabase
    .from("facilities")
    .select("city, city_slug")
    .eq("publishable", true);

  const cityMap = new Map<string, { name: string; slug: string; count: number }>();
  for (const r of cityRows ?? []) {
    if (!r.city_slug) continue;
    const existing = cityMap.get(r.city_slug);
    if (existing) { existing.count++; }
    else { cityMap.set(r.city_slug, { name: r.city ?? r.city_slug, slug: r.city_slug, count: 1 }); }
  }
  const topCities = Array.from(cityMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  // Sample reviews (3 most recent published)
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, body, rating, reviewer_name, created_at, facility_id")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(3);

  const sampleReviews: HomeData["sampleReviews"] = [];
  for (const r of reviewRows ?? []) {
    const { data: fac } = await supabase
      .from("facilities")
      .select("name, city")
      .eq("id", r.facility_id)
      .single();
    sampleReviews.push({
      id: r.id,
      body: r.body,
      rating: r.rating,
      reviewer_name: r.reviewer_name ?? null,
      facility_name: fac?.name ?? null,
      facility_city: fac?.city ?? null,
      created_at: r.created_at,
    });
  }

  return {
    stats: { facilities: facilityCount, inspections: inspCount, severeCitations: sevCount, lastRefreshed },
    gradeCardFacilities,
    counties,
    topCities,
    sampleReviews,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const { stats, gradeCardFacilities, counties, topCities, sampleReviews } = await loadHomeData();

  const homeJsonLd = [
    buildOrganizationSchema(),
    buildWebSiteSchema(),
    buildFaqSchemaFromPairs(HOME_FAQS, homeCanonical),
  ];

  const season = (() => {
    const m = new Date().getMonth();
    if (m < 3) return "Winter";
    if (m < 6) return "Spring";
    if (m < 9) return "Summer";
    return "Fall";
  })();
  const year = new Date().getFullYear();

  const statItems: StatItem[] = [
    {
      n: stats.facilities > 0 ? stats.facilities.toLocaleString() : "0",
      label: "Licensed memory care facilities indexed across California",
      src: "CDSS",
    },
    {
      n: stats.inspections > 0 ? stats.inspections.toLocaleString() : "0",
      label: "State inspection reports, parsed and dated",
      src: "CDSS / CMS",
      delta: "Updated weekly",
    },
    {
      n: stats.severeCitations > 0 ? stats.severeCitations.toLocaleString() : "0",
      label: "Severe (Type-A & Type-B) deficiencies on file in the last 24 months",
      src: "CDSS",
    },
    {
      n: "0",
      label: "Referral commissions, lead fees, or paid placements accepted from operators",
      src: "Policy",
      delta: "Since day one",
    },
  ];

  const COMING_COUNTIES: string[] = [];

  const EDITORIAL_CARDS = [
    {
      kind: "Annual Data Report · 2026",
      title: "The State of Memory Care in California",
      desc: "Year-over-year analysis of inspection reports across licensed facilities — deficiency rates by county, severity trends, and the operators with the cleanest and most concerning records.",
      meta: "Coming April 2026 · Free download",
      href: "/data",
      live: true,
    },
    {
      kind: "Regulator Primer",
      title: "How memory care is regulated in California",
      desc: "A plain-language guide to CDSS Community Care Licensing — what they inspect, when, and what each citation type actually means for residents.",
      meta: "Coming May 2026 · 14 min read",
      href: null,
      live: false,
    },
    {
      kind: "Cost Breakdown",
      title: "What memory care actually costs in California, by region",
      desc: "Median monthly cost from operator submissions and licensing data. Plus what's covered by Medi-Cal, what isn't, and the line-item fees families miss.",
      meta: "Coming June 2026 · 9 min read",
      href: null,
      live: false,
    },
    {
      kind: "Explainer",
      title: "Type-A vs. Type-B deficiencies, explained",
      desc: "The two-letter difference that separates a paperwork lapse from a citation that put a resident at immediate risk.",
      meta: "Coming Q2 2026 · 6 min read",
      href: null,
      live: false,
    },
    {
      kind: "Tour Checklist",
      title: "37 questions to ask on a memory care tour",
      desc: "What to ask the executive director, the night-shift staff, and the resident families you meet in the hallway.",
      meta: "Coming Q2 2026 · Printable PDF",
      href: null,
      live: false,
    },
    {
      kind: "Coverage Guide",
      title: "Does Medicare cover memory care? (Mostly, no.)",
      desc: "A clear-eyed walkthrough of what Medicare, Medi-Cal, VA benefits, and long-term care insurance actually pay for.",
      meta: "Coming Q3 2026 · 11 min read",
      href: null,
      live: false,
    },
  ];

  return (
    <>
      <JsonLd objects={homeJsonLd} />

      <SampleFacilityRotationProvider facilities={gradeCardFacilities}>
        <div className="m-app md:hidden">
          <MobileHomeView
            season={season}
            year={year}
            statItems={statItems}
            counties={counties}
            topCities={topCities}
            firstReview={sampleReviews[0] ?? null}
            editorials={EDITORIAL_CARDS}
            mobileFaqs={HOME_FAQS.slice(0, 4)}
            lastRefreshed={stats.lastRefreshed}
            countyCountLive={counties.length}
          />
        </div>
        <MobileStickyCtaBar />

        <div className="hidden md:block">
        <GovernanceBar />
        <SiteNav />

        <main>
        {/* ── § 00 · Hero ──────────────────────────────────────────────────── */}
        <section className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14 md:py-16">
            {/* Eyebrow */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 sm:mb-7 font-[family-name:var(--font-mono)] text-[10.5px] sm:text-[11.5px] uppercase tracking-[0.18em] text-rust">
              <span className="h-px w-6 sm:w-9 shrink-0 bg-rust opacity-60" aria-hidden />
              <span className="min-w-0 flex-1 basis-[min(100%,14rem)] sm:flex-none sm:basis-auto">
                California Edition · Vol. 02 · {season} {year}
              </span>
              <span className="h-px min-w-[2rem] flex-1 basis-0 bg-rust opacity-60 max-sm:hidden" aria-hidden />
            </div>

            <div className="grid gap-10 md:gap-16 items-start md:grid-cols-[1.15fr_1fr]">
              {/* Left: copy */}
              <div>
                <h1
                  className="font-[family-name:var(--font-display)] font-normal leading-[0.98] tracking-[-0.02em] text-ink mb-5 sm:mb-6 max-w-none md:max-w-[16ch]"
                  style={{ fontSize: "clamp(32px, 5vw + 0.5rem, 84px)" }}
                >
                  The <em className="italic text-rust">best</em> memory care
                  in California, <span
                    className="px-1"
                    style={{ backgroundImage: "linear-gradient(transparent 70%, var(--color-gold-soft) 70%)" }}
                  >ranked by the state&rsquo;s own inspectors.</span>
                </h1>

                <p className="font-[family-name:var(--font-display)] italic text-[18px] sm:text-[22px] leading-[1.45] text-ink-3 mb-6 sm:mb-8 max-w-[40ch]">
                  No paid ads. No sales calls. Every claim sourced and dated to a public state record.
                </p>

                {/* ZIP search */}
                <div className="w-full max-w-[460px] min-w-0">
                  <ZipSearch variant="editorial" />
                </div>

                {/* Coverage line */}
                <div className="mt-3.5 flex flex-wrap items-center gap-3 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.08em] text-ink-3">
                  <span className="flex items-center gap-1.5 text-grade-a">
                    <span className="live-dot" aria-hidden />
                    Live across {counties.length > 0 ? `${counties.length} CA counties` : "CA"}
                  </span>
                  <span className="text-ink-4">· Texas Q2 · Florida Q2</span>
                </div>
              </div>

              {/* Right: illustration */}
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

        {/* ── § 01 · The Public Record ─────────────────────────────────────── */}
        <section
          id="data"
          className="border-b border-paper-rule"
          style={{ background: "var(--color-paper-2)" }}
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
            <SectionHead
              label="§ 01 · The Public Record"
              title={<>The California facility data you need, <em>curated + analyzed for you.</em></>}
            />
            <StatBlock stats={statItems} />
          </div>
        </section>

        {/* ── § 02 · The Record ───────────────────────────────────────────── */}
        <section
          id="methodology"
          className="border-b border-paper-rule"
          style={{ background: "var(--color-paper)" }}
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
            <SectionHead
              label="§ 02 · The Record"
              title={<>Five data signals. <em>Compared to peers.</em></>}
            />

            <div className="grid gap-10 md:gap-16 items-start md:grid-cols-[1fr_1.05fr]">
              {/* Explainer */}
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[32px] font-normal leading-[1.1] tracking-[-0.01em] m-0 mb-4">
                  Data you can trace to a citation number.
                </h3>
                <p className="text-ink-2 mb-4 leading-relaxed">
                  Each facility shows its inspection record for the past five years directly from California CDSS — every citation, severity level, and repeat violation. We compare each facility against hundreds of similar California facilities so you can see what&apos;s normal and what stands out.
                </p>
                <p className="text-ink-2 mb-6 leading-relaxed">
                  The methodology is published and version-controlled. We change it in public.{" "}
                  <Link href="/methodology" className="text-teal underline underline-offset-4">
                    Read the full methodology →
                  </Link>
                </p>
              </div>

              {/* Sample facility card (10-facility cohort, auto-rotates) */}
              <SyncedHomeSampleCardDesktop />
            </div>

            {/* 3-step methodology */}
            <div className="mt-16 grid grid-cols-1 border-t border-paper-rule md:grid-cols-3">
              {[
                {
                  n: "Step 01",
                  t: "Pull the public record",
                  p: "Inspection reports, deficiency findings, and complaint outcomes pulled directly from CDSS Community Care Licensing — weekly, with archived snapshots.",
                },
                {
                  n: "Step 02",
                  t: "Compare to peers",
                  p: "Each facility's citations are benchmarked against similar California facilities — same license type, comparable bed count, same 36-month window.",
                },
                {
                  n: "Step 03",
                  t: "Publish, with footnotes",
                  p: "Each profile shows citation numbers, dates, and severity levels. No black box. Every data point links to its source record.",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className="p-6 sm:p-8 border-b border-paper-rule last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
                >
                  <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-rust mb-3">{s.n}</div>
                  <h4 className="font-[family-name:var(--font-display)] text-[26px] font-normal leading-[1.1] tracking-[-0.005em] m-0 mb-2.5">{s.t}</h4>
                  <p className="text-[15px] text-ink-2 m-0 leading-relaxed">{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── § 03 · Browse California ─────────────────────────────────────── */}
        <section
          id="browse"
          className="border-b border-paper-rule"
          style={{ background: "var(--color-paper-2)" }}
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
            <SectionHead
              label="§ 03 · Browse California"
              title={<>Start with your county, <em>or jump to your city.</em></>}
            />

            <div className="grid gap-12 items-start md:grid-cols-[1.2fr_2fr]">
              {/* Counties */}
              <div>
                <p className="smallcaps mb-3.5">By county · {counties.length} live</p>
                <div className="flex flex-col">
                  {counties.map((c, i) => (
                    <Link
                      key={c.slug}
                      href={`/california/${c.slug}`}
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
                  {COMING_COUNTIES.map((name) => (
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
                  href="/california"
                  className="inline-block mt-4 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-rust underline underline-offset-4"
                >
                  View all California counties →
                </Link>
              </div>

              {/* Top cities */}
              <div>
                <p className="smallcaps mb-3.5">Popular cities · By facility count</p>
                <div className="columns-1 sm:columns-2 lg:columns-3 [column-gap:2rem]">
                  {topCities.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/california/${c.slug}`}
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

        {/* ── § 04 · The Reports ───────────────────────────────────────────── */}
        <section
          id="editorial"
          className="border-b border-paper-rule"
          style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
            <SectionHead
              invert
              label="§ 04 · The Reports"
              title={<>An editorial desk for memory care, <em>backed by primary-source data.</em></>}
            />

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
              {EDITORIAL_CARDS.map((e, i) => {
                const inner = (
                  <div className={`flex flex-col gap-3.5 border-t pt-6 ${e.live ? "opacity-100" : "opacity-70"}`} style={{ borderColor: "rgba(255,255,255,0.2)" }}>
                    {i === 0 && (
                      <div
                        className="relative mb-2"
                        style={{ aspectRatio: "4/3", background: "linear-gradient(135deg, #2a3a30 0%, #1A2620 100%)", overflow: "hidden" }}
                      >
                        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(196,146,59,0.06) 0 14px, transparent 14px 28px)" }} />
                        <div style={{ position: "absolute", left: 24, top: 24 }} className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-gold">
                          STARLYNN ANNUAL · {year}
                        </div>
                        <div
                          className="absolute right-4 bottom-4 sm:right-6 sm:bottom-6 md:right-8 md:bottom-8 font-[family-name:var(--font-display)] text-[28px] sm:text-[36px] md:text-[40px] leading-none tracking-[-0.02em] text-right"
                          style={{ color: "#EBDDB8" }}
                        >
                          <span>The State of<br />Memory Care<br /></span>
                          <em style={{ color: "#fff" }}>in California</em>
                        </div>
                      </div>
                    )}
                    <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-gold">{e.kind}</span>
                    <h3
                      className={`font-[family-name:var(--font-display)] font-normal leading-[1.05] tracking-[-0.01em] m-0 text-paper ${
                        i === 0 ? "text-[clamp(1.5rem,4.5vw,2.625rem)]" : "text-[1.375rem] sm:text-[1.625rem]"
                      }`}
                    >
                      {e.title}
                    </h3>
                    <p className="text-[14.5px] leading-[1.5] m-0" style={{ color: "rgba(255,255,255,0.72)" }}>
                      {e.desc}
                    </p>
                    <div className="mt-auto font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em]" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {e.meta} {e.live ? "· Read →" : ""}
                    </div>
                  </div>
                );
                const spanCls = i === 0 ? "md:col-span-2 xl:col-span-1" : "";
                return e.live && e.href ? (
                  <Link
                    key={i}
                    href={e.href}
                    className={`no-underline hover:opacity-90 transition-opacity min-w-0 ${spanCls}`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={i} className={`min-w-0 ${spanCls}`} aria-label={`Coming soon: ${e.title}`}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── § 05 · Verified Family Experience ───────────────────────────── */}
        {sampleReviews.length > 0 && (
          <section className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
              <SectionHead
                label="§ 05 · Verified Family Experience"
                title={<>From people who have actually <em>moved a parent in.</em></>}
              />
              <div className="grid grid-cols-1 divide-y divide-paper-rule border-t-2 border-ink md:grid-cols-3 md:divide-x md:divide-y-0">
                {sampleReviews.map((r) => (
                  <div key={r.id} className="px-4 py-7 sm:px-7 sm:py-8 min-w-0">
                    <p
                      className="font-[family-name:var(--font-display)] text-[22px] leading-[1.3] tracking-[-0.005em] text-ink m-0 mb-5"
                      style={{ position: "relative" }}
                    >
                      <span
                        aria-hidden
                        className="font-[family-name:var(--font-display)] text-[56px] leading-none text-rust"
                        style={{ verticalAlign: "-22px", marginRight: 4 }}
                      >
                        &ldquo;
                      </span>
                      {r.body}
                    </p>
                    <div
                      className="flex flex-col gap-1 border-t border-paper-rule pt-3.5 font-[family-name:var(--font-mono)] text-[11.5px] tracking-[0.06em] text-ink-3"
                    >
                      <span className="text-gold text-[14px] tracking-[2px]">
                        {"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}
                      </span>
                      {r.reviewer_name && (
                        <span className="text-ink font-medium tracking-[0.04em]">{r.reviewer_name}</span>
                      )}
                      {r.facility_name && (
                        <span>{r.facility_name}{r.facility_city ? ` · ${r.facility_city}` : ""}</span>
                      )}
                      <span className="text-grade-a">
                        ✓ Identity verified · {new Date(r.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── § 06 · FAQ ───────────────────────────────────────────────────── */}
        <section
          id="faq"
          className="border-b border-paper-rule"
          style={{ background: "var(--color-paper)" }}
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
            <SectionHead
              label="§ 06 · Common Questions"
              title={<>What families and clinicians <em>ask us first.</em></>}
            />
            <HomeFaq faqs={HOME_FAQS} />
          </div>
        </section>

        {/* ── CTA strip ────────────────────────────────────────────────────── */}
        <section style={{ background: "var(--color-rust)", borderTop: 0 }}>
          <div
            className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-16 grid gap-10 items-center md:grid-cols-[1fr_auto]"
          >
            <div>
              <h2
                className="font-[family-name:var(--font-display)] font-normal leading-[1.05] tracking-[-0.015em] m-0 text-white"
                style={{ fontSize: "clamp(32px, 3.5vw, 48px)" }}
              >
                Find the right facility, <em>without the sales funnel.</em>
              </h2>
              <p className="mt-2.5 text-[17px] text-white/85 max-w-[50ch]">
                Search by ZIP, compare A–F grades, read every dated citation. Free, forever, with no operator behind the recommendation.
              </p>
            </div>
            <Link
              href="/california"
              className="inline-flex w-full sm:w-auto justify-center items-center gap-2 bg-ink text-paper px-[18px] py-[10px] rounded-full text-[14px] font-medium hover:bg-black transition-colors no-underline whitespace-nowrap"
            >
              Search {stats.facilities > 0 ? stats.facilities.toLocaleString() : ""} facilities
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
        </main>

        <SiteFooter />
      </div>
      </SampleFacilityRotationProvider>
    </>
  );
}
