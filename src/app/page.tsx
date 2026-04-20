import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { FacilityCarousel, type CarouselFacility } from "@/components/site/FacilityCarousel";
import { ZipSearch } from "@/components/site/ZipSearch";
import type { BenchmarkTier } from "@/lib/benchmarks";

export const revalidate = 3600;

// ── Batch benchmark helpers ───────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}
function tier(v: number, p33: number, p66: number): BenchmarkTier {
  return v <= p33 ? "strong" : v <= p66 ? "mixed" : "concerns";
}

async function loadHomeData(): Promise<{
  stats: { facilities: number; inspections: number; typeACitations: number };
  carouselFacilities: CarouselFacility[];
}> {
  const fallback = {
    stats: { facilities: 14, inspections: 330, typeACitations: 14 },
    carouselFacilities: [],
  };

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return fallback;

  // 1. All publishable facilities with photos
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

  const facIds = facilities.map((f) => f.id);

  // 2. Counts for trust row
  const [inspCountRes, typeACountRes] = await Promise.all([
    supabase.from("inspections").select("*", { count: "exact", head: true }),
    supabase.from("deficiencies").select("*", { count: "exact", head: true }).eq("class", "Type A"),
  ]);

  const stats = {
    facilities: facilities.length || 14,
    inspections: inspCountRes.count ?? 330,
    typeACitations: typeACountRes.count ?? 14,
  };

  if (!facilities.length) return { stats, carouselFacilities: [] };

  // 3. All inspections for benchmark computation
  const { data: inspData } = await supabase
    .from("inspections")
    .select("id, facility_id, is_complaint, raw_data")
    .in("facility_id", facIds);
  const inspList = inspData ?? [];

  // 4. All deficiencies
  const inspIds = inspList.map((i: { id: string }) => i.id);
  const { data: defData } = await supabase
    .from("deficiencies")
    .select("inspection_id, class")
    .in("inspection_id", inspIds.length ? inspIds : ["__none__"]);
  const defList = defData ?? [];

  // 5. Compute per-facility stats
  type FStats = {
    nonComplaintInsp: number;
    defCount: number;
    typeACount: number;
    complaintsWithOutcome: number;
    substantiated: number;
  };
  const statsMap = new Map<string, FStats>();
  for (const f of facilities) {
    statsMap.set(f.id, {
      nonComplaintInsp: 0, defCount: 0, typeACount: 0,
      complaintsWithOutcome: 0, substantiated: 0,
    });
  }

  const defByInsp = new Map<string, { class: string | null }[]>();
  for (const d of defList as { inspection_id: string; class: string | null }[]) {
    const list = defByInsp.get(d.inspection_id) ?? [];
    list.push(d);
    defByInsp.set(d.inspection_id, list);
  }

  for (const insp of inspList as { id: string; facility_id: string; is_complaint: boolean; raw_data: unknown }[]) {
    const s = statsMap.get(insp.facility_id);
    if (!s) continue;
    const defs = defByInsp.get(insp.id) ?? [];
    if (!insp.is_complaint) {
      s.nonComplaintInsp++;
      s.defCount += defs.length;
    }
    for (const d of defs) {
      if (d.class === "Type A") s.typeACount++;
    }
    if (insp.is_complaint) {
      const outcome = (insp.raw_data as { outcome?: string } | null)?.outcome;
      if (outcome) {
        s.complaintsWithOutcome++;
        if (outcome === "Substantiated") s.substantiated++;
      }
    }
  }

  // 6. County distributions → percentile thresholds
  const allStats = Array.from(statsMap.values());
  const dpiVals = allStats
    .map((s) => (s.nonComplaintInsp > 0 ? s.defCount / s.nonComplaintInsp : 0))
    .sort((a, b) => a - b);
  const typeAVals = allStats.map((s) => s.typeACount).sort((a, b) => a - b);
  const complaintRates = allStats
    .filter((s) => s.complaintsWithOutcome > 0)
    .map((s) => s.substantiated / s.complaintsWithOutcome)
    .sort((a, b) => a - b);

  const dpiP33 = percentile(dpiVals, 33);
  const dpiP66 = percentile(dpiVals, 66);
  const typeAP33 = percentile(typeAVals, 33);
  const typeAP66 = percentile(typeAVals, 66);
  const cmpP33 = percentile(complaintRates, 33);
  const cmpP66 = percentile(complaintRates, 66);

  const STATE_SLUG: Record<string, string> = { CA: "california" };

  const carouselFacilities: CarouselFacility[] = facilities
    .filter((f) => !!f.photo_url)
    .map((f) => {
      const s = statsMap.get(f.id)!;
      const dpi = s.nonComplaintInsp > 0 ? s.defCount / s.nonComplaintInsp : 0;
      const cmpRate = s.complaintsWithOutcome > 0
        ? s.substantiated / s.complaintsWithOutcome
        : null;
      return {
        id: f.id,
        name: f.name,
        city: f.city,
        care_category: f.care_category as CarouselFacility["care_category"],
        photo_url: f.photo_url!,
        slug: f.slug,
        city_slug: f.city_slug,
        state_slug: STATE_SLUG[f.state_code] ?? f.state_code.toLowerCase(),
        inspections: s.nonComplaintInsp + s.complaintsWithOutcome,
        type_a: s.typeACount,
        dpi,
        dpi_tier: tier(dpi, dpiP33, dpiP66),
        type_a_tier: tier(s.typeACount, typeAP33, typeAP66),
        complaint_rate: cmpRate,
        complaint_substantiated: s.substantiated,
        complaint_total: s.complaintsWithOutcome,
        complaint_tier: cmpRate !== null ? tier(cmpRate, cmpP33, cmpP66) : "informational",
      };
    });

  return { stats, carouselFacilities };
}


// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const { stats, carouselFacilities } = await loadHomeData();

  return (
    <>
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
                  <p className="text-2xl font-bold text-red-600 tabular-nums">{stats.typeACitations}</p>
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
