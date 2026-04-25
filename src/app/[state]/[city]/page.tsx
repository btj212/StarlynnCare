import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SmallHomesToggle } from "@/components/facility/SmallHomesToggle";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { regionFromSlug } from "@/lib/regions";
import type { CareCategory } from "@/lib/types";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ state: string; city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const CITY_INTRO: Record<string, { heading: string; body: string }> = {
  oakland: {
    heading: "Memory care in Oakland, CA — state records and inspection history",
    body:
      "Oakland is Alameda County's largest city and home to several state-licensed RCFEs specializing in memory care. California CDSS inspects these facilities annually; inspection reports and cited deficiencies appear on each profile page.",
  },
  berkeley: {
    heading: "Memory care in Berkeley, CA — CDSS inspection records",
    body:
      "Berkeley has two dedicated memory-care RCFEs — Silverado Senior Living and Elegance Berkeley — inspected at least annually by California CDSS evaluators. Deficiency citations, including those under Title 22 §87705, appear on each facility page.",
  },
  alameda: {
    heading: "Memory care in Alameda, CA — CDSS licensing and inspection data",
    body:
      "The city of Alameda is home to Oakmont of Mariner Point, an RCFE with a dedicated memory-care program. Licensing and inspection data are sourced from the CDSS Transparency API.",
  },
  fremont: {
    heading: "Memory care in Fremont, CA — Aegis, Brookdale, and more",
    body:
      "Fremont has the highest concentration of memory-care RCFEs in southern Alameda County, including Aegis Assisted Living, Aegis Gardens, and Brookdale North Fremont. Inspection histories — including any Type A citations — appear on each facility profile.",
  },
};

const CATEGORY_LABEL: Record<CareCategory, string> = {
  rcfe_memory_care: "RCFE · Memory care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF · Memory care",
  alf_general: "ALF",
  snf_general: "Nursing home",
  snf_dementia_scu: "Nursing home · Dementia SCU",
  ccrc: "CCRC",
  unknown: "Pending categorization",
};

type CapacityTier = "small" | "medium" | "large" | "unknown";

type FacilityCard = {
  id: string;
  name: string;
  city: string | null;
  city_slug: string;
  slug: string;
  street: string | null;
  beds: number | null;
  care_category: CareCategory;
  photo_url: string | null;
  serves_memory_care: boolean;
  memory_care_disclosure_filed: boolean;
  capacity_tier: CapacityTier;
};

type FacilityStats = {
  facility_id: string;
  inspections: number;
  type_a: number;
  type_b: number;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state: stateSlug, city: regionSlug } = await params;
  const region = regionFromSlug(stateSlug, regionSlug);
  if (!region) return { title: "Region not found | StarlynnCare" };
  const cityIntro = CITY_INTRO[regionSlug] ?? null;
  return {
    title: cityIntro
      ? `${cityIntro.heading} | StarlynnCare`
      : `Memory care in ${region.name}, ${region.state.name} | StarlynnCare`,
    description: cityIntro
      ? cityIntro.body.slice(0, 200)
      : `Memory care facility profiles in ${region.name}, built from state (CDSS) and federal (CMS) primary sources.`,
  };
}

// ── Card component ────────────────────────────────────────────────────────────

function FacilityCard({
  f,
  stats,
  href,
}: {
  f: FacilityCard;
  stats: FacilityStats | undefined;
  href: string;
}) {
  const hasTypeA = (stats?.type_a ?? 0) > 0;
  const hasTypeB = !hasTypeA && (stats?.type_b ?? 0) > 0;

  return (
    <Link
      href={href}
      className={`group flex flex-col overflow-hidden rounded-xl border bg-white shadow-card card-lift ${
        hasTypeA
          ? "border-red-200"
          : hasTypeB
          ? "border-orange-200"
          : "border-sc-border"
      }`}
    >
      {f.photo_url ? (
        <div className="relative h-36 w-full overflow-hidden bg-sc-border/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.photo_url}
            alt={`Exterior of ${f.name}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
          {hasTypeA && (
            <span className="absolute top-2 left-2 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white shadow-sm">
              Type A on file
            </span>
          )}
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center bg-sc-border/20">
          <svg
            className="h-10 w-10 text-sc-border"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"
            />
          </svg>
        </div>
      )}

      <div className="flex flex-1 flex-col p-4 gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-ink leading-snug group-hover:text-teal transition-colors">
              {f.name}
            </p>
            {f.city && (
              <p className="mt-0.5 text-xs text-muted">
                {f.city}{f.beds != null ? ` · ${f.beds} beds` : ""}
              </p>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full bg-teal-light px-2.5 py-0.5 text-[10px] font-semibold text-teal">
            {CATEGORY_LABEL[f.care_category]}
          </span>
        </div>

        {stats && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-muted">
              {stats.inspections} inspection{stats.inspections !== 1 ? "s" : ""} on file
            </span>
            {stats.type_a > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100">
                  Type A
                </span>
                {stats.type_a}
              </span>
            )}
            {stats.type_a === 0 && stats.type_b > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-orange-600">
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-orange-50">
                  Type B
                </span>
                {stats.type_b}
              </span>
            )}
            {stats.type_a === 0 && stats.type_b === 0 && (
              <span className="text-teal font-medium">No citations on file</span>
            )}
          </div>
        )}

        <p className="mt-auto pt-1 text-xs font-semibold text-teal group-hover:underline underline-offset-2">
          View full profile →
        </p>
      </div>
    </Link>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-sc-border pb-3">
      <h2 className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
        {title}
      </h2>
      <span className="text-sm text-muted tabular-nums">{count}</span>
    </div>
  );
}

// ── Card grid ─────────────────────────────────────────────────────────────────

function FacilityGrid({
  facilities,
  statsMap,
  stateSlug,
}: {
  facilities: FacilityCard[];
  statsMap: Map<string, FacilityStats>;
  stateSlug: string;
}) {
  return (
    <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {facilities.map((f) => (
        <FacilityCard
          key={f.id}
          f={f}
          stats={statsMap.get(f.id)}
          href={`/${stateSlug}/${f.city_slug}/${f.slug}`}
        />
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function RegionPage({ params, searchParams }: PageProps) {
  const { state: stateSlug, city: regionSlug } = await params;
  const { show } = await searchParams;
  const showSmall = show === "small";

  const region = regionFromSlug(stateSlug, regionSlug);
  if (!region) notFound();

  const supabase = tryPublicSupabaseClient();
  let facilities: FacilityCard[] = [];
  let statsMap = new Map<string, FacilityStats>();
  let fetchError: string | null = null;

  if (!supabase) {
    fetchError = "Supabase is not configured.";
  } else {
    const { data, error } = await supabase
      .from("facilities")
      .select(
        "id, name, city, city_slug, slug, street, beds, care_category, photo_url, serves_memory_care, memory_care_disclosure_filed, capacity_tier"
      )
      .eq("state_code", region.state.code)
      .eq("publishable", true)
      .in("city_slug", region.citySlugs as unknown as string[])
      .order("name", { ascending: true });

    if (error) {
      fetchError = error.message;
    } else {
      facilities = (data ?? []) as FacilityCard[];

      if (facilities.length > 0) {
        const ids = facilities.map((f) => f.id);
        const { data: inspData } = await supabase
          .from("inspections")
          .select("id, facility_id")
          .in("facility_id", ids);

        const inspIds = (inspData ?? []).map((i) => i.id);
        const inspByFacility = new Map<string, number>();
        for (const i of inspData ?? []) {
          inspByFacility.set(i.facility_id, (inspByFacility.get(i.facility_id) ?? 0) + 1);
        }

        const { data: defData } = await supabase
          .from("deficiencies")
          .select("inspection_id, class")
          .in("inspection_id", inspIds.length ? inspIds : ["__none__"]);

        const inspFacMap = new Map<string, string>();
        for (const i of inspData ?? []) inspFacMap.set(i.id, i.facility_id);

        const typeAByFacility = new Map<string, number>();
        const typeBByFacility = new Map<string, number>();
        for (const d of defData ?? []) {
          const fid = inspFacMap.get(d.inspection_id);
          if (!fid) continue;
          if (d.class === "Type A")
            typeAByFacility.set(fid, (typeAByFacility.get(fid) ?? 0) + 1);
          if (d.class === "Type B")
            typeBByFacility.set(fid, (typeBByFacility.get(fid) ?? 0) + 1);
        }

        for (const fac of facilities) {
          statsMap.set(fac.id, {
            facility_id: fac.id,
            inspections: inspByFacility.get(fac.id) ?? 0,
            type_a: typeAByFacility.get(fac.id) ?? 0,
            type_b: typeBByFacility.get(fac.id) ?? 0,
          });
        }
      }
    }
  }

  const cityIntro = CITY_INTRO[regionSlug] ?? null;

  // ── Grouping by tier + memory-care signal ──────────────────────────────────
  // mcSignal: memory_care_disclosure_filed (canonical) OR serves_memory_care (name-regex fallback)
  const mcFacilities = facilities.filter(
    (f) => f.memory_care_disclosure_filed || f.serves_memory_care
  );
  const nonMcLargerFacilities = facilities.filter(
    (f) =>
      !f.memory_care_disclosure_filed &&
      !f.serves_memory_care &&
      f.capacity_tier !== "small"
  );
  const smallFacilities = facilities.filter((f) => f.capacity_tier === "small");

  const mcLarge = mcFacilities.filter((f) => f.capacity_tier === "large");
  const mcMedium = mcFacilities.filter(
    (f) => f.capacity_tier === "medium" || f.capacity_tier === "unknown"
  );
  const mcSmall = mcFacilities.filter((f) => f.capacity_tier === "small");

  const visibleCount =
    mcLarge.length +
    mcMedium.length +
    nonMcLargerFacilities.length +
    (showSmall ? smallFacilities.length + mcSmall.length : 0);
  const hiddenSmallCount = showSmall
    ? 0
    : smallFacilities.length + mcSmall.length;

  const totalCount = facilities.length;

  return (
    <>
      <SiteNav />
      <main className="min-h-[60vh] border-b border-sc-border bg-warm-white">
        <div className="mx-auto max-w-[1120px] px-6 py-10 md:px-8 md:py-14">

          {/* ── Header ── */}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <Link href={`/${region.state.slug}`} className="hover:text-teal">
              {region.state.name}
            </Link>{" "}
            · Memory care transparency
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-serif)] text-3xl font-semibold tracking-tight text-navy md:text-4xl md:leading-tight">
            {cityIntro ? cityIntro.heading : `Memory care in ${region.name}`}
          </h1>
          {cityIntro && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">
              {cityIntro.body}
            </p>
          )}

          {/* ── Coverage strip + small-homes toggle ── */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-teal/20 bg-teal-light/50 px-4 py-3 text-sm">
            <span className="text-slate">
              <strong className="font-semibold text-ink">{visibleCount}</strong>{" "}
              {visibleCount === 1 ? "facility" : "facilities"} with verified CDSS records
              {hiddenSmallCount > 0 && (
                <span className="ml-1 text-muted">
                  · {hiddenSmallCount} small care home{hiddenSmallCount !== 1 ? "s" : ""} hidden
                </span>
              )}
            </span>
            {totalCount > 0 && (
              <Suspense>
                <SmallHomesToggle hiddenCount={hiddenSmallCount} />
              </Suspense>
            )}
            <span className="w-full text-xs text-muted sm:w-auto sm:ml-auto">
              Profiles hidden until state-agency data is confirmed
            </span>
          </div>

          {/* ── Error state ── */}
          {fetchError && (
            <div className="mt-8 rounded-lg border border-amber/30 bg-amber-light px-5 py-4 text-sm">
              <p className="font-semibold text-amber">Configuration</p>
              <p className="mt-2 text-slate">{fetchError}</p>
            </div>
          )}

          {/* ── Empty state ── */}
          {!fetchError && totalCount === 0 && (
            <div className="mt-10 rounded-lg border border-sc-border bg-white px-6 py-10 shadow-card">
              <p className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
                No facilities published yet
              </p>
              <p className="mt-3 max-w-xl text-slate leading-relaxed">
                The CDSS ingest for {region.name} has not yet produced
                verifiable records. This page will populate once the scraper
                run completes.
              </p>
            </div>
          )}

          {/* ── Group 1: Memory care · 50+ beds ── */}
          {!fetchError && mcLarge.length > 0 && (
            <section className="mt-10" aria-labelledby="mc-large-heading">
              <SectionHeading
                title="Memory care · 50+ beds"
                count={mcLarge.length}
              />
              <p className="mt-2 text-xs text-muted">
                Community-style facilities (purpose-built buildings, common in regional chains).
              </p>
              <FacilityGrid
                facilities={mcLarge}
                statsMap={statsMap}
                stateSlug={region.state.slug}
              />
            </section>
          )}

          {/* ── Group 2: Memory care · 7–49 beds ── */}
          {!fetchError && mcMedium.length > 0 && (
            <section className="mt-10" aria-labelledby="mc-medium-heading">
              <SectionHeading
                title="Memory care · 7–49 beds"
                count={mcMedium.length}
              />
              <p className="mt-2 text-xs text-muted">
                Small to medium freestanding RCFEs with a memory-care program.
              </p>
              <FacilityGrid
                facilities={mcMedium}
                statsMap={statsMap}
                stateSlug={region.state.slug}
              />
            </section>
          )}

          {/* ── Group 3: Other 7+ bed facilities (no mc signal) ── */}
          {!fetchError && nonMcLargerFacilities.length > 0 && (
            <section className="mt-10" aria-labelledby="other-heading">
              <SectionHeading
                title="Other licensed RCFEs (7+ beds)"
                count={nonMcLargerFacilities.length}
              />
              <p className="mt-2 text-xs text-muted">
                Licensed and inspected — no confirmed memory-care program on file.
              </p>
              <FacilityGrid
                facilities={nonMcLargerFacilities}
                statsMap={statsMap}
                stateSlug={region.state.slug}
              />
            </section>
          )}

          {/* ── Group 4: Small residential care homes (≤6 beds) — only with ?show=small ── */}
          {!fetchError && showSmall && (mcSmall.length > 0 || smallFacilities.length > 0) && (
            <section className="mt-10" aria-labelledby="small-heading">
              <SectionHeading
                title="Small residential care homes (≤6 beds)"
                count={mcSmall.length + smallFacilities.length}
              />
              <p className="mt-2 text-xs text-muted">
                Single-family-home conversions. Owner-operated. Less state inspector
                attention by design — inspect the home yourself before committing.
              </p>
              <FacilityGrid
                facilities={[...mcSmall, ...smallFacilities]}
                statsMap={statsMap}
                stateSlug={region.state.slug}
              />
            </section>
          )}

        </div>
      </main>
      <SiteFooter />
    </>
  );
}
