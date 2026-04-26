import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { FacilityCarousel, type CarouselFacility } from "@/components/site/FacilityCarousel";
import { ZipSearch } from "@/components/site/ZipSearch";
import type { CareCategory } from "@/lib/types";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";
import { buildOrganizationSchema, buildWebSiteSchema } from "@/lib/seo/schema";

export const revalidate = 3600;

const homeCanonical = canonicalFor("/");

export const metadata: Metadata = {
  alternates: { canonical: homeCanonical },
  openGraph: {
    url: homeCanonical,
    type: "website",
  },
};

const STATE_SLUG: Record<string, string> = { CA: "california" };
const CAROUSEL_SIZE = 10;

type SnapshotGrade = {
  grade?: { letter: string; composite_percentile: number } | null;
  metrics?: {
    severity: { percentile: number };
    repeats: { percentile: number };
    frequency: { percentile: number };
  } | null;
};

async function loadHomeData(): Promise<{
  stats: { facilities: number; inspections: number; severeCitations: number };
  carouselFacilities: CarouselFacility[];
}> {
  const fallback = {
    stats: { facilities: 180, inspections: 2772, severeCitations: 943 },
    carouselFacilities: [],
  };

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return fallback;

  // 1. Publishable facilities with photos — all of them for the stats count
  const { data: rawFacilities } = await supabase
    .from("facilities")
    .select("id, name, city, care_category, photo_url, slug, city_slug, state_code")
    .eq("publishable", true)
    .not("photo_url", "is", null)
    .order("name");

  const facilities = (rawFacilities ?? []) as Array<{
    id: string; name: string; city: string | null;
    care_category: string; photo_url: string | null;
    slug: string; city_slug: string; state_code: string;
  }>;

  // 2. Trust-row counts
  const [inspCountRes, sevCountRes] = await Promise.all([
    supabase.from("inspections").select("*", { count: "exact", head: true }),
    supabase.from("deficiencies").select("*", { count: "exact", head: true }).gte("severity", 3),
  ]);

  const stats = {
    facilities: facilities.length || 180,
    inspections: inspCountRes.count ?? 2772,
    severeCitations: sevCountRes.count ?? 943,
  };

  if (!facilities.length) return { stats, carouselFacilities: [] };

  // 3. Pick CAROUSEL_SIZE random facilities for the hero card
  const shuffled = [...facilities].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, CAROUSEL_SIZE);

  // 4. Fetch quality snapshot for each in parallel — single RPC per facility
  const snapshots = await Promise.all(
    sample.map((f) =>
      supabase
        .rpc("facility_snapshot", { p_facility_id: f.id })
        .then(({ data }) => ({ id: f.id, snap: data as SnapshotGrade | null })),
    ),
  );
  const snapMap = new Map(snapshots.map(({ id, snap }) => [id, snap]));

  const carouselFacilities: CarouselFacility[] = sample.map((f) => {
    const snap = snapMap.get(f.id);
    return {
      id: f.id,
      name: f.name,
      city: f.city,
      care_category: f.care_category as CareCategory,
      photo_url: f.photo_url!,
      slug: f.slug,
      city_slug: f.city_slug,
      state_slug: STATE_SLUG[f.state_code] ?? f.state_code.toLowerCase(),
      grade: snap?.grade?.letter ?? null,
      composite: snap?.grade?.composite_percentile ?? null,
      sev_pct: snap?.metrics?.severity?.percentile ?? null,
      rep_pct: snap?.metrics?.repeats?.percentile ?? null,
      freq_pct: snap?.metrics?.frequency?.percentile ?? null,
    };
  });

  return { stats, carouselFacilities };
}


// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const { stats, carouselFacilities } = await loadHomeData();

  const homeJsonLd = [buildOrganizationSchema(), buildWebSiteSchema()];

  return (
    <>
      <JsonLd objects={homeJsonLd} />
      <SiteNav />
      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="border-b border-sc-border bg-warm-white overflow-hidden">
          <div className="mx-auto max-w-[1120px] px-6 py-14 md:px-8 md:py-20">
            <div className="grid gap-12 md:grid-cols-2 md:gap-16 md:items-center">

              {/* Left: headline + copy + CTAs */}
              <div>
                <h1 className="hero-enter font-[family-name:var(--font-serif)] text-3xl font-semibold leading-[1.15] tracking-tight text-navy md:text-4xl">
                  Real data + reviews of licensed{" "}
                  <span className="whitespace-nowrap">memory care</span>{" "}
                  facilities near you.
                  <span className="mt-2 block text-xl font-normal text-muted md:text-2xl">
                    No paid ads · No aggressive sales tactics.
                  </span>
                </h1>
                <div className="hero-enter-delay mt-5 text-lg leading-relaxed text-slate">
                  <p>
                    State inspection records, citation history, and verified
                    family experiences. Every claim sourced and dated.
                  </p>
                </div>
                <div className="hero-enter-delay mt-8 flex flex-col gap-3">
                  <ZipSearch />
                  <Link
                    href="/methodology"
                    className="inline-flex items-center text-sm font-medium text-slate underline underline-offset-2 decoration-slate/40 hover:text-ink hover:decoration-ink/40 transition-colors"
                  >
                    See how we rate facilities
                  </Link>
                  <p
                    id="governance-home"
                    className="max-w-md text-sm leading-relaxed text-slate border-l-2 border-teal/40 pl-4"
                  >
                    {GOVERNANCE_24_WORDS}
                  </p>
                </div>
              </div>

              {/* Right: rotating facility carousel */}
              {carouselFacilities.length > 0 && (
                <div className="hidden md:block">
                  <FacilityCarousel facilities={carouselFacilities} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Trust / stats row ─────────────────────────────────────────────── */}
        <section className="border-b border-sc-border bg-white">
          <div className="mx-auto max-w-[1120px] px-6 py-8 md:px-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted shrink-0">
                  Source data
                </p>
                <span className="inline-flex items-center gap-1.5 rounded border border-sc-border bg-warm-white px-3 py-1 text-xs font-semibold text-slate">
                  <span className="h-2 w-2 rounded-full bg-teal" aria-hidden />
                  CA CDSS · Community Care Licensing
                </span>
                <span className="inline-flex items-center gap-1.5 rounded border border-sc-border bg-warm-white px-3 py-1 text-xs font-semibold text-slate">
                  <span className="h-2 w-2 rounded-full bg-navy" aria-hidden />
                  CMS Care Compare
                </span>
                <Link
                  href="/data"
                  className="inline-flex items-center gap-1.5 rounded border border-teal/30 bg-teal-light/50 px-3 py-1 text-xs font-semibold text-teal hover:bg-teal-light transition-colors"
                >
                  Dataset overview
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-navy tabular-nums">{stats.facilities}</p>
                  <p className="text-xs text-muted">facilities profiled</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-navy tabular-nums">{stats.inspections}</p>
                  <p className="text-xs text-muted">inspections indexed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600 tabular-nums">{stats.severeCitations}</p>
                  <p className="text-xs text-muted">severe violations on file</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── What you get ──────────────────────────────────────────────────── */}
        <section id="how-it-works" className="scroll-mt-16 bg-warm-white">
          <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
            <h2 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-navy md:text-4xl">
              What you get on every facility report
            </h2>

            <div className="mt-12 divide-y divide-sc-border">

              <div className="grid gap-3 py-10 md:grid-cols-[14rem_1fr] md:gap-12">
                <h3 className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
                  The inspection record.
                </h3>
                <p className="text-base leading-relaxed text-slate">
                  State citations, deficiency history, corrective actions
                  filed. The things the tour won&rsquo;t bring up.
                </p>
              </div>

              <div className="grid gap-3 py-10 md:grid-cols-[14rem_1fr] md:gap-12">
                <h3 className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
                  The questions to bring on the tour.
                </h3>
                <p className="text-base leading-relaxed text-slate">
                  A checklist for this specific facility — staff ratios,
                  skin-check protocols, shower frequency, activity director
                  workload. The things families wish they&rsquo;d asked first.
                </p>
              </div>

              <div className="grid gap-3 py-10 md:grid-cols-[14rem_1fr] md:gap-12">
                <h3 className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
                  The ombudsman contact.
                </h3>
                <p className="text-base leading-relaxed text-slate">
                  The state-mandated family advocate assigned to every
                  facility. Most families don&rsquo;t know they exist. One
                  click to reach them.
                </p>
              </div>

            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
