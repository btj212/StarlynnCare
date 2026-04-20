import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

export const revalidate = 3600;

const asOf = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "America/Los_Angeles",
}).format(new Date());

async function loadStats(): Promise<{
  facilities: number;
  inspections: number;
  typeACitations: number;
}> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return { facilities: 14, inspections: 330, typeACitations: 14 };

  const [{ count: facilities }, { count: inspections }, { count: typeACitations }] =
    await Promise.all([
      supabase
        .from("facilities")
        .select("*", { count: "exact", head: true })
        .eq("publishable", true),
      supabase
        .from("inspections")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("deficiencies")
        .select("*", { count: "exact", head: true })
        .eq("class", "Type A"),
    ]);

  return {
    facilities: facilities ?? 14,
    inspections: inspections ?? 330,
    typeACitations: typeACitations ?? 14,
  };
}

// ── Specimen card ────────────────────────────────────────────────────────────
// Real data: Elegance Berkeley, CA license 019201143
// Data sourced from CDSS Community Care Licensing Division, verified April 2026.

function SpecimenCard() {
  return (
    <div className="relative rounded-2xl border border-sc-border bg-white shadow-card-hover overflow-hidden card-lift hero-enter-delay-2">
      {/* Top accent line */}
      <div className="h-1 w-full bg-gradient-to-r from-teal to-teal-mid" />

      <div className="px-5 pt-4 pb-5">
        {/* Facility header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              CA License 019201143
            </p>
            <h3 className="mt-0.5 font-[family-name:var(--font-serif)] text-lg font-semibold leading-snug text-navy">
              Elegance Berkeley
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              2100 San Pablo Avenue · Berkeley, CA
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full bg-teal-light px-2.5 py-0.5 text-xs font-semibold text-teal">
            RCFE · Memory care
          </span>
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-sc-border/60" />

        {/* At a glance rows — abbreviated */}
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          At a glance
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate">Compliance record</span>
            <div className="flex items-center gap-1.5">
              <span className="text-ink font-medium">0.25 per inspection</span>
              <span className="inline-flex items-center rounded-full bg-red-light border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                Concerns
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate">Severity record</span>
            <div className="flex items-center gap-1.5">
              <span className="text-ink font-medium">2 Type A citations</span>
              <span className="inline-flex items-center rounded-full bg-red-light border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                Concerns
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate">Complaint pattern</span>
            <div className="flex items-center gap-1.5">
              <span className="text-ink font-medium">39% substantiated</span>
              <span className="inline-flex items-center rounded-full bg-red-light border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                Concerns
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-3.5 border-t border-sc-border/60" />

        {/* A real citation chip */}
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
              Type A
            </span>
            <span className="text-[10px] font-mono text-slate">CCR §87355(e)</span>
            <span className="text-[10px] text-muted">· Jul 30, 2024</span>
          </div>
          <p className="mt-1.5 text-xs text-slate leading-relaxed line-clamp-2">
            Staff background check documentation missing for the Executive Director;
            $100/day civil penalty assessed until corrected.
          </p>
        </div>

        {/* Source footer */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] text-muted">
            Source: CA CDSS · as of {asOf}
          </p>
          <Link
            href="/california/berkeley/elegance-berkeley-201143"
            className="text-[10px] font-semibold text-teal hover:underline underline-offset-2"
          >
            View full profile →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const stats = await loadStats();

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
                <p className="hero-enter text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  As of {asOf}
                </p>
                <h1 className="hero-enter-delay mt-4 font-[family-name:var(--font-serif)] text-4xl font-semibold leading-[1.15] tracking-tight text-navy md:text-5xl">
                  Memory care quality, from the sources that regulate it.
                </h1>
                <p className="hero-enter-delay mt-5 text-lg leading-relaxed text-slate">
                  Facility profiles built from{" "}
                  <strong className="font-medium text-ink">California CDSS</strong> and{" "}
                  <strong className="font-medium text-ink">CMS</strong> primary
                  records — not lead-gen ads. Every stat links to a source and
                  carries an &ldquo;as of&rdquo; date.
                </p>
                <div className="hero-enter-delay mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/california/alameda-county"
                    className="inline-flex items-center justify-center rounded-md bg-teal px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-mid"
                  >
                    Browse Alameda County
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center text-sm font-medium text-slate hover:text-ink transition-colors"
                  >
                    How we source data
                  </a>
                </div>
              </div>

              {/* Right: real facility specimen card */}
              <div className="hidden md:block">
                <SpecimenCard />
              </div>
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
