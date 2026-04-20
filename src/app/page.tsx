import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { FacilityCarousel, type CarouselFacility } from "@/components/site/FacilityCarousel";
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
          <div className="mx-auto max-w-[1120px] px-6 py-16 md:px-8 md:py-24">
            <div className="grid gap-12 md:grid-cols-2 md:gap-16 md:items-center">

              {/* Left: headline + copy + CTAs */}
              <div>
                <p className="hero-enter flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
                  Your memory care resource
                </p>
                <h1 className="hero-enter-delay mt-4 font-[family-name:var(--font-serif)] text-4xl font-semibold leading-[1.12] tracking-tight text-navy md:text-5xl">
                  A clear place to start.
                  <br />
                  <em className="italic">Independent</em> records you can trust.
                </h1>
                <p className="hero-enter-delay mt-5 text-lg leading-relaxed text-slate">
                  Choosing memory care is heavy enough without guessing which
                  brochure is telling the truth. In a sea of brokers on
                  commission and websites that want your phone number,
                  StarlynnCare gives you the list you actually need — every
                  licensed memory care facility near you, with inspections,
                  citations, and analysis on each one.
                </p>
                <div className="hero-enter-delay mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/california/alameda-county"
                    className="inline-flex items-center justify-center rounded-md bg-teal px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-mid"
                  >
                    Open the list →
                  </Link>
                  <Link
                    href="/methodology"
                    className="inline-flex items-center justify-center text-sm font-medium text-slate hover:text-ink transition-colors"
                  >
                    Our Methodology
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
              {/* Source wordmarks */}
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

              {/* Live stats */}
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-navy tabular-nums">
                    {stats.facilities}
                  </p>
                  <p className="text-xs text-muted">facilities profiled</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-navy tabular-nums">
                    {stats.inspections}
                  </p>
                  <p className="text-xs text-muted">inspections indexed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600 tabular-nums">
                    {stats.typeACitations}
                  </p>
                  <p className="text-xs text-muted">Type A citations on file</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works — product vocabulary ─────────────────────────────── */}
        <section
          id="how-it-works"
          className="scroll-mt-16 border-b border-sc-border bg-warm-white"
        >
          <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
            <h2 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-navy md:text-4xl">
              Three steps. No hype.
            </h2>
            <p className="mt-3 max-w-2xl text-slate">
              We ingest public datasets, join them into one facility record, and
              run a quality-checked content chain — nothing publishes without
              citations.
            </p>

            <ol className="mt-14 grid gap-10 md:grid-cols-3">
              {/* Step 1: Ingest */}
              <li className="space-y-4">
                {/* Product fragment: license record chip */}
                <div className="inline-flex flex-col gap-1 rounded-lg border border-sc-border bg-white px-4 py-3 shadow-card text-xs font-mono">
                  <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-muted">
                    CA license record
                  </span>
                  <span className="font-medium text-ink">019201143</span>
                  <div className="flex gap-2 mt-0.5">
                    <span className="inline-flex items-center rounded-full bg-green-light text-green px-2 py-0.5 text-[10px] font-semibold font-sans">
                      Licensed
                    </span>
                    <span className="inline-flex items-center rounded-full bg-teal-light text-teal px-2 py-0.5 text-[10px] font-semibold font-sans">
                      RCFE · Memory care
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Ingest</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate">
                    California CDSS licensing records and CMS Care Compare data
                    — no aggregators, no scraping of marketing sites.
                  </p>
                </div>
              </li>

              {/* Step 2: Join & cite */}
              <li className="space-y-4">
                {/* Product fragment: inspection citation row */}
                <div className="inline-flex flex-col gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-3 shadow-card text-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Inspection record
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
                      Complaint
                    </span>
                    <span className="text-slate">Jul 30, 2024</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
                      Type A
                    </span>
                    <span className="font-mono text-slate">CCR §87355(e)</span>
                  </div>
                  <a
                    href="https://www.ccld.dss.ca.gov/transparencyapi/api/FacilityReports?facNum=019201143&inx=12"
                    className="text-[10px] text-teal hover:underline truncate"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    cdss.ca.gov · source ↗
                  </a>
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Join &amp; cite</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate">
                    One facility profile with structured inspection and deficiency
                    history. Each figure carries a source URL and an effective date.
                  </p>
                </div>
              </li>

              {/* Step 3: Quality gate */}
              <li className="space-y-4">
                {/* Product fragment: benchmark summary */}
                <div className="inline-flex flex-col gap-1.5 rounded-lg border border-sc-border bg-white px-4 py-3 shadow-card text-xs">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    At a glance
                  </span>
                  {[
                    { label: "Compliance", tier: "Mixed", cls: "bg-amber-light text-amber border border-amber/30" },
                    { label: "Severity", tier: "Concerns", cls: "bg-red-light text-red-600 border border-red-200" },
                    { label: "Complaints", tier: "Strong", cls: "bg-teal-light text-teal border border-teal/20" },
                  ].map(({ label, tier, cls }) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="text-slate">{label}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                        {tier}
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Quality gate</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate">
                    Generated summaries pass an automated review — uncited claims
                    and sales tone are rejected before anything goes live.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* ── What we're not ────────────────────────────────────────────────── */}
        <section className="bg-warm-white">
          <div className="mx-auto max-w-[680px] px-6 py-20 md:px-8 md:py-24">
            <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
              What we&apos;re not
            </h2>
            <ul className="mt-6 space-y-4 text-slate">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                Not a referral service — we don&apos;t sell your contact info.
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                Not paid placement — rankings reflect data, not sponsorships.
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                Not opinion blogs — when we add narrative, it stays factual and
                cited.
              </li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
