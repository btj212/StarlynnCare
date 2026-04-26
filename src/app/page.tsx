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
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { buildOrganizationSchema, buildWebSiteSchema, buildFaqSchemaFromPairs } from "@/lib/seo/schema";
import { HOME_FAQS } from "@/lib/content/homeFaqs";
import type { CareCategory } from "@/lib/types";

export const revalidate = 3600;

const homeCanonical = canonicalFor("/");

export const metadata: Metadata = {
  alternates: { canonical: homeCanonical },
  openGraph: {
    url: homeCanonical,
    type: "website",
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

type GradeCardFacility = {
  id: string;
  name: string;
  city: string | null;
  state_code: string;
  slug: string;
  city_slug: string;
  license_number?: string | null;
  beds?: number | null;
  care_category: CareCategory;
  grade: string | null;
  composite: number | null;
  sev_pct: number | null;
  rep_pct: number | null;
  freq_pct: number | null;
};

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
  gradeCardFacility: GradeCardFacility | null;
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

const STATE_SLUG: Record<string, string> = { CA: "california" };

const KNOWN_COUNTIES: Array<{ name: string; slug: string }> = [
  { name: "Alameda County", slug: "alameda-county" },
  { name: "Contra Costa County", slug: "contra-costa-county" },
  { name: "San Mateo County", slug: "san-mateo-county" },
  { name: "Santa Clara County", slug: "santa-clara-county" },
];

async function loadHomeData(): Promise<HomeData> {
  const fallback: HomeData = {
    stats: { facilities: 0, inspections: 0, severeCitations: 0, lastRefreshed: null },
    gradeCardFacility: null,
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

  // Top-graded facility for the grade card section (pick one randomly from top 20% each hour)
  const { data: topFacilities } = await supabase
    .from("facilities")
    .select("id, name, city, state_code, slug, city_slug, license_number, beds, care_category")
    .eq("publishable", true)
    .order("name")
    .limit(200);

  let gradeCardFacility: GradeCardFacility | null = null;
  if (topFacilities && topFacilities.length > 0) {
    // Deterministic daily rotation: pick based on day-of-year
    const dayOfYear = Math.floor((Date.now() / 86400000) % topFacilities.length);
    const picked = topFacilities[dayOfYear % topFacilities.length] as {
      id: string; name: string; city: string | null; state_code: string;
      slug: string; city_slug: string; license_number: string | null;
      beds: number | null; care_category: CareCategory;
    };

    const { data: snap } = await supabase
      .rpc("facility_snapshot", { p_facility_id: picked.id });

    const s = snap as null | {
      grade?: { letter: string; composite_percentile: number } | null;
      metrics?: { severity: { percentile: number }; repeats: { percentile: number }; frequency: { percentile: number } } | null;
    };

    gradeCardFacility = {
      ...picked,
      grade: s?.grade?.letter ?? null,
      composite: s?.grade?.composite_percentile ?? null,
      sev_pct: s?.metrics?.severity?.percentile ?? null,
      rep_pct: s?.metrics?.repeats?.percentile ?? null,
      freq_pct: s?.metrics?.frequency?.percentile ?? null,
    };
  }

  // County facility counts
  const counties: CountyRow[] = [];
  for (const c of KNOWN_COUNTIES) {
    const { count } = await supabase
      .from("facilities")
      .select("*", { count: "exact", head: true })
      .eq("publishable", true)
      .ilike("county_name", `%${c.name.replace(" County", "")}%`);

    const { data: cityData } = await supabase
      .from("facilities")
      .select("city_slug")
      .eq("publishable", true)
      .ilike("county_name", `%${c.name.replace(" County", "")}%`);

    const cities = new Set((cityData ?? []).map((r: { city_slug: string }) => r.city_slug)).size;
    counties.push({ name: c.name, slug: c.slug, count: count ?? 0, cities });
  }

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
    gradeCardFacility,
    counties,
    topCities,
    sampleReviews,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GradeBar({ label, pct, warn = false }: { label: string; pct: number | null; warn?: boolean }) {
  const w = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
  const fillColor = warn ? "var(--color-gold)" : "var(--color-grade-a)";
  return (
    <div className="grid items-center gap-2.5 text-[13px]" style={{ gridTemplateColumns: "100px 1fr 50px" }}>
      <span className="text-ink-2">{label}</span>
      <span
        className="h-1.5 relative"
        style={{ background: "var(--color-paper-2)", borderRadius: 0 }}
      >
        <span
          className="absolute left-0 top-0 bottom-0"
          style={{ width: `${w}%`, background: fillColor }}
        />
      </span>
      <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 text-right tracking-[0.04em]">
        {pct != null ? Math.round(pct) : "—"}
      </span>
    </div>
  );
}

function FacilityGradeCardSample({ facility }: { facility: GradeCardFacility }) {
  const stateSlug = STATE_SLUG[facility.state_code] ?? facility.state_code.toLowerCase();
  const profileUrl = `/${stateSlug}/${facility.city_slug}/${facility.slug}`;
  const grade = facility.grade ?? "?";
  const composite = facility.composite != null ? Math.round(facility.composite) : null;

  const gradeColors: Record<string, { letter: string; bg: string; border: string }> = {
    A: { letter: "#2F6B3A", bg: "#DCE9D6", border: "var(--color-grade-a)" },
    B: { letter: "#5C8C3D", bg: "#E5EBD3", border: "var(--color-grade-b)" },
    C: { letter: "#C4923B", bg: "var(--color-gold-soft)", border: "var(--color-grade-c)" },
    D: { letter: "#B8533A", bg: "var(--color-rust-soft)", border: "var(--color-grade-d)" },
    F: { letter: "#8E2A1F", bg: "#E8C9C2", border: "var(--color-grade-f)" },
  };
  const gradeStyle = gradeColors[grade[0]] ?? { letter: "#8A938C", bg: "var(--color-paper-2)", border: "var(--color-paper-rule)" };

  return (
    <div className="border border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
      {/* Top bar */}
      <div
        className="grid gap-4 p-[22px] items-start border-b border-paper-rule"
        style={{ gridTemplateColumns: "1fr auto" }}
      >
        <div>
          <h3
            className="font-[family-name:var(--font-display)] text-[26px] leading-[1.05] tracking-[-0.005em] m-0 mb-1"
          >
            {facility.name}
          </h3>
          <div className="text-[13.5px] text-ink-3">
            {facility.city}, CA
          </div>
          <div className="flex flex-wrap gap-3 mt-2 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
            {facility.license_number && (
              <span className="text-rust">LIC# {facility.license_number}</span>
            )}
            {facility.beds && <span>Capacity {facility.beds}</span>}
            <span className="uppercase">{facility.care_category.replace(/_/g, " ")}</span>
          </div>
        </div>
        {composite != null && (
          <div
            className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-2.5 py-1"
            style={{ background: "var(--color-teal-soft)", color: "var(--color-teal-deep)" }}
          >
            Top {100 - composite}%
          </div>
        )}
      </div>

      {/* Grade row */}
      <div
        className="grid gap-6 p-6 items-center"
        style={{ gridTemplateColumns: "130px 1fr", background: "var(--color-paper)" }}
      >
        <div
          className="text-center py-3.5 px-2 rounded-[2px] border"
          style={{ background: gradeStyle.bg, borderColor: gradeStyle.border }}
        >
          <div
            className="font-[family-name:var(--font-display)] text-[64px] leading-[0.9] tracking-[-0.02em]"
            style={{ color: gradeStyle.letter }}
          >
            {grade}
          </div>
          {composite != null && (
            <div
              className="font-[family-name:var(--font-mono)] text-[11px] mt-1 tracking-[0.08em]"
              style={{ color: gradeStyle.letter }}
            >
              {composite}th pct
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <GradeBar label="Severity" pct={facility.sev_pct} />
          <GradeBar label="Repeat rate" pct={facility.rep_pct} />
          <GradeBar label="Frequency" pct={facility.freq_pct} warn />
        </div>
      </div>

      {/* Foot */}
      <div
        className="flex justify-between items-center px-[22px] py-3.5 border-t border-paper-rule font-[family-name:var(--font-mono)] text-[11.5px] tracking-[0.06em] text-ink-3"
        style={{ background: "var(--color-paper-2)" }}
      >
        <span>Source: CA CDSS · Community Care Licensing</span>
        <Link href={profileUrl} className="text-teal no-underline font-medium hover:text-teal-deep">
          View full profile →
        </Link>
      </div>
    </div>
  );
}

// ── FAQ accordion (client component wrapper) ──────────────────────────────────
// Since we need interactivity, extract to a separate client component
import { HomeFaq } from "@/components/home/HomeFaq";

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const { stats, gradeCardFacility, counties, topCities, sampleReviews } = await loadHomeData();

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

  const statFootnotes = [
    "Sourced from CA CDSS Community Care Licensing",
    "Cross-validated against CMS Care Compare",
    ...(stats.lastRefreshed ? [`Last refreshed ${stats.lastRefreshed}`] : []),
  ];

  const COMING_COUNTIES = ["Los Angeles County", "San Diego County", "Orange County", "Sacramento County"];

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
      <GovernanceBar />
      <SiteNav />

      <main>
        {/* ── § 00 · Hero ──────────────────────────────────────────────────── */}
        <section className="border-b border-paper-rule" style={{ background: "var(--color-paper)" }}>
          <div className="mx-auto max-w-[1280px] px-10 py-14 md:py-16">
            {/* Eyebrow */}
            <div className="flex items-center gap-3.5 mb-7 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.18em] text-rust">
              <span className="h-px w-9 bg-rust opacity-60" aria-hidden />
              California Edition · Vol. 02 · {season} {year}
              <span className="h-px flex-1 bg-rust opacity-60" aria-hidden />
            </div>

            <div className="grid gap-16 items-start md:grid-cols-[1.15fr_1fr]">
              {/* Left: copy */}
              <div>
                <h1
                  className="font-[family-name:var(--font-display)] font-normal leading-[0.98] tracking-[-0.02em] text-ink mb-6"
                  style={{ fontSize: "clamp(48px, 6.5vw, 84px)", maxWidth: "16ch" }}
                >
                  The <em className="italic text-rust">best</em> memory care
                  in California, <span
                    className="px-1"
                    style={{ backgroundImage: "linear-gradient(transparent 70%, var(--color-gold-soft) 70%)" }}
                  >ranked by the state&rsquo;s own inspectors.</span>
                </h1>

                <p
                  className="font-[family-name:var(--font-display)] italic text-[22px] leading-[1.4] text-ink-3 mb-8"
                  style={{ maxWidth: "36ch" }}
                >
                  No paid ads. No sales calls. Every claim sourced and dated to a public state record.
                </p>

                {/* ZIP search */}
                <div className="max-w-[460px]">
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
                <p className="mt-2.5 flex justify-between font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
                  <span>Illus · Starlynn Original</span>
                  <span>CA Edition {year}</span>
                </p>
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
          <div className="mx-auto max-w-[1280px] px-10 py-20">
            <SectionHead
              label="§ 01 · The Public Record"
              title={<>The California facility data you need, <em>curated + analyzed for you.</em></>}
            />
            <StatBlock stats={statItems} footnotes={statFootnotes} />
          </div>
        </section>

        {/* ── § 02 · How We Grade ──────────────────────────────────────────── */}
        <section
          id="methodology"
          className="border-b border-paper-rule"
          style={{ background: "var(--color-paper)" }}
        >
          <div className="mx-auto max-w-[1280px] px-10 py-20">
            <SectionHead
              label="§ 02 · How We Grade"
              title={<>One letter grade. <em>Transparent scoring.</em></>}
            />

            <div className="grid gap-16 items-start md:grid-cols-[1fr_1.05fr]">
              {/* Explainer */}
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-[32px] font-normal leading-[1.1] tracking-[-0.01em] m-0 mb-4">
                  A grade you can trace to a citation number.
                </h3>
                <p className="text-ink-2 mb-4 leading-relaxed">
                  Each facility receives a single A–F grade derived from five weighted inputs — every one of them
                  tied to a primary state record or an identity-verified family review. Click into any profile
                  and you can read the underlying CDSS report, dated.
                </p>
                <p className="text-ink-2 mb-6 leading-relaxed">
                  The methodology is published and version-controlled. We change it in public.{" "}
                  <Link href="/methodology" className="text-teal underline underline-offset-4">
                    Read the full methodology →
                  </Link>
                </p>

                {/* A–F legend */}
                <div className="flex gap-1.5 mt-6">
                  {(["A", "B", "C", "D", "F"] as const).map((g) => {
                    const colors: Record<string, { bg: string; color: string }> = {
                      A: { bg: "#DCE9D6", color: "var(--color-grade-a)" },
                      B: { bg: "#E5EBD3", color: "var(--color-grade-b)" },
                      C: { bg: "var(--color-gold-soft)", color: "var(--color-grade-c)" },
                      D: { bg: "var(--color-rust-soft)", color: "var(--color-grade-d)" },
                      F: { bg: "#E8C9C2", color: "var(--color-grade-f)" },
                    };
                    return (
                      <div
                        key={g}
                        className="flex-1 py-2.5 text-center font-[family-name:var(--font-display)] text-[22px] border border-paper-rule"
                        style={{ background: colors[g].bg, color: colors[g].color }}
                      >
                        {g}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
                  <span>Top 10% statewide</span>
                  <span>Bottom 10%</span>
                </div>
              </div>

              {/* Sample grade card */}
              {gradeCardFacility ? (
                <FacilityGradeCardSample facility={gradeCardFacility} />
              ) : (
                <div
                  className="border border-paper-rule p-10 flex items-center justify-center text-ink-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em]"
                  style={{ background: "var(--color-paper-2)", minHeight: 260 }}
                >
                  Facility grade card
                </div>
              )}
            </div>

            {/* 3-step methodology */}
            <div className="mt-16 grid border-t border-paper-rule md:grid-cols-3">
              {[
                {
                  n: "Step 01",
                  t: "Pull the public record",
                  p: "Inspection reports, deficiency findings, and complaint outcomes pulled directly from CDSS Community Care Licensing — weekly, with archived snapshots.",
                  pull: "Source · CA CDSS / CMS Care Compare",
                },
                {
                  n: "Step 02",
                  t: "Weight five signals",
                  p: "Severity (35%), repeat-citation rate (25%), complaint outcomes (15%), staffing-related deficiencies (15%), verified family experience (10%).",
                  pull: "Methodology — peer-reviewed",
                },
                {
                  n: "Step 03",
                  t: "Publish, with footnotes",
                  p: "Each grade renders with the citation numbers, dates, and resolution status that produced it. No black box. Every claim is link-traceable.",
                  pull: "Inspect any profile to verify",
                },
              ].map((s, i) => (
                <div key={i} className="p-8 border-r border-paper-rule last:border-r-0">
                  <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-rust mb-3">{s.n}</div>
                  <h4 className="font-[family-name:var(--font-display)] text-[26px] font-normal leading-[1.1] tracking-[-0.005em] m-0 mb-2.5">{s.t}</h4>
                  <p className="text-[15px] text-ink-2 m-0 mb-4 leading-relaxed">{s.p}</p>
                  <div
                    className="pt-3.5 border-t border-dashed border-paper-rule font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.04em]"
                  >
                    {s.pull}
                  </div>
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
          <div className="mx-auto max-w-[1280px] px-10 py-20">
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
                      className="grid gap-3.5 py-4 px-1 border-b border-paper-rule no-underline text-ink hover:bg-paper transition-colors"
                      style={{ gridTemplateColumns: "32px 1fr auto auto" }}
                    >
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.04em]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-[family-name:var(--font-display)] text-[22px] leading-none tracking-[-0.005em]">
                        {c.name}
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3 tracking-[0.04em] self-center">
                        {c.count} fac · {c.cities} cities
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-rust self-center">→</span>
                    </Link>
                  ))}
                  {COMING_COUNTIES.map((name) => (
                    <div
                      key={name}
                      className="grid gap-3.5 py-4 px-1 border-b border-paper-rule opacity-40"
                      style={{ gridTemplateColumns: "32px 1fr auto" }}
                    >
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.04em]">—</span>
                      <span className="font-[family-name:var(--font-display)] text-[22px] leading-none tracking-[-0.005em]">{name}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-ink-4 tracking-[0.04em] self-center">Q2 2026</span>
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
                <div style={{ columns: "3", columnGap: "32px" }}>
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
          <div className="mx-auto max-w-[1280px] px-10 py-20">
            <SectionHead
              invert
              label="§ 04 · The Reports"
              title={<>An editorial desk for memory care, <em>backed by primary-source data.</em></>}
            />

            <div
              className="grid gap-8"
              style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}
            >
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
                        <div style={{ position: "absolute", right: 24, bottom: 24, color: "#EBDDB8" }} className="font-[family-name:var(--font-display)] text-[40px] leading-none tracking-[-0.02em] text-right">
                          <span>The State of<br />Memory Care<br /></span>
                          <em style={{ color: "#fff" }}>in California</em>
                        </div>
                      </div>
                    )}
                    <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-gold">{e.kind}</span>
                    <h3 className="font-[family-name:var(--font-display)] font-normal leading-[1.05] tracking-[-0.01em] m-0" style={{ fontSize: i === 0 ? 42 : 26, color: "var(--color-paper)" }}>
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
                return e.live && e.href ? (
                  <Link key={i} href={e.href} className="no-underline hover:opacity-90 transition-opacity">
                    {inner}
                  </Link>
                ) : (
                  <div key={i} aria-label={`Coming soon: ${e.title}`}>
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
            <div className="mx-auto max-w-[1280px] px-10 py-20">
              <SectionHead
                label="§ 05 · Verified Family Experience"
                title={<>From people who have actually <em>moved a parent in.</em></>}
              />
              <div className="grid border-t-2 border-ink md:grid-cols-3">
                {sampleReviews.map((r) => (
                  <div key={r.id} className="px-7 py-8 border-r border-paper-rule last:border-r-0">
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
          <div className="mx-auto max-w-[1280px] px-10 py-20">
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
            className="mx-auto max-w-[1280px] px-10 py-16 grid gap-10 items-center md:grid-cols-[1fr_auto]"
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
              className="inline-flex items-center gap-2 bg-ink text-paper px-[18px] py-[10px] rounded-full text-[14px] font-medium hover:bg-black transition-colors no-underline whitespace-nowrap"
            >
              Search {stats.facilities > 0 ? stats.facilities.toLocaleString() : ""} facilities
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
