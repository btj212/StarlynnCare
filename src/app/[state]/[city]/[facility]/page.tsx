import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { regionFromSlug } from "@/lib/regions";
import { stateFromSlug } from "@/lib/states";
import { loadBenchmarks } from "@/lib/benchmarks";
import { BenchmarkRow } from "@/components/facility/BenchmarkRow";
import { QuickFacts } from "@/components/facility/QuickFacts";
import { TourQuestions } from "@/components/facility/TourQuestions";
import { RegulatoryBaseline } from "@/components/facility/RegulatoryBaseline";
import { QualitySnapshot } from "@/components/facility/QualitySnapshot";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import type { Facility, CareCategory } from "@/lib/types";

type FacilityContent = {
  headline?: string;
  intro?: string;
  memory_care_approach?: string;
  neighborhood?: string;
  what_families_should_know?: string;
  tour_questions?: string[];
  generated_at?: string;
  model?: string;
};

type InspectionRow = {
  id: string;
  inspection_date: string;
  inspection_type: string | null;
  is_complaint: boolean;
  complaint_id: string | null;
  total_deficiency_count: number | null;
  narrative_summary: string | null;
  source_url: string | null;
  raw_data: { outcome?: string; inspector_name?: string; narrative?: string } | null;
};

type DeficiencyRow = {
  id: string;
  inspection_id: string;
  class: string | null;   // "Type A" | "Type B"
  code: string | null;    // section cited, e.g. "87705(c)(5)"
  severity: number | null;
  immediate_jeopardy: boolean;
  description: string | null;
  inspector_narrative: string | null;
};

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ state: string; city: string; facility: string }>;
};

const CATEGORY_LABEL: Record<CareCategory, string> = {
  rcfe_memory_care: "Residential Care Facility for the Elderly (RCFE) · Memory Care",
  rcfe_general: "Residential Care Facility for the Elderly (RCFE)",
  alf_memory_care: "Assisted Living Facility (ALF) · Memory Care",
  alf_general: "Assisted Living Facility (ALF)",
  snf_general: "Skilled Nursing Facility (SNF)",
  snf_dementia_scu: "Skilled Nursing Facility (SNF) · Dementia Special Care Unit",
  ccrc: "Continuing Care Retirement Community (CCRC)",
  unknown: "Pending categorization",
};

const LICENSE_TYPE_INFO: Partial<Record<CareCategory, { title: string; body: string }>> = {
  rcfe_memory_care: {
    title: "What is an RCFE with Memory Care?",
    body: "A Residential Care Facility for the Elderly (RCFE) is a non-medical residential care home licensed by California CDSS under Health & Safety Code §1560. Residents receive help with daily living activities such as bathing, dressing, and medication management. An RCFE with a Memory Care designation is additionally required by California Title 22 (§87705 and §87706) to provide specialized staff training in dementia care, individualized care plans for residents with cognitive impairment, and appropriate supervision protocols — requirements that go beyond a standard RCFE license.",
  },
  rcfe_general: {
    title: "What is an RCFE?",
    body: "A Residential Care Facility for the Elderly (RCFE) is a non-medical residential care home licensed by California CDSS under Health & Safety Code §1560. Residents receive assistance with daily living activities such as bathing, dressing, meals, and medication management in a home-like setting. RCFEs are not hospitals or skilled nursing facilities — they do not provide round-the-clock medical care.",
  },
  alf_memory_care: {
    title: "What is an ALF with Memory Care?",
    body: "An Assisted Living Facility (ALF) provides residential care and personal assistance in a community setting. An ALF with a Memory Care designation maintains a dedicated program for residents living with Alzheimer's disease or other dementias, with specialized staff training, secured environments, and dementia-specific care protocols as required by state regulation.",
  },
  alf_general: {
    title: "What is an ALF?",
    body: "An Assisted Living Facility (ALF) provides residential care and personal assistance in a community setting. Residents receive help with daily activities while maintaining as much independence as possible. ALFs are not medical facilities — they do not provide the level of clinical care found in skilled nursing facilities.",
  },
  snf_general: {
    title: "What is a Skilled Nursing Facility (SNF)?",
    body: "A Skilled Nursing Facility (SNF) provides around-the-clock licensed nursing care. SNFs are licensed by California CDSS and also certified by the federal Centers for Medicare & Medicaid Services (CMS). They serve residents who need ongoing medical supervision, rehabilitation services, or complex care management that cannot be provided in a residential care setting.",
  },
  snf_dementia_scu: {
    title: "What is a Skilled Nursing Facility with a Dementia Special Care Unit?",
    body: "A Skilled Nursing Facility (SNF) with a Dementia Special Care Unit (SCU) provides around-the-clock licensed nursing care in a unit specifically designed for residents with Alzheimer's disease or related dementias. Federal and state regulations require the facility to disclose specific SCU practices, including programming, staffing, and physical environment — look for the facility's SCU disclosure form.",
  },
  ccrc: {
    title: "What is a CCRC?",
    body: "A Continuing Care Retirement Community (CCRC) offers multiple levels of care on a single campus — typically independent living, assisted living, and skilled nursing. Residents often enter under a long-term contract and can transition between care levels as their needs change. CCRCs in California are regulated by the California Department of Social Services.",
  },
};

const STATE_AGENCY_LABEL: Record<string, string> = {
  CA: "California Dept. of Social Services · Community Care Licensing",
};

async function loadFacility(
  stateCode: string,
  citySlug: string,
  facilitySlug: string,
): Promise<{ facility: Facility | null; error: string | null; configured: boolean }> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return { facility: null, error: null, configured: false };

  const { data, error } = await supabase
    .from("facilities")
    .select("*")
    .eq("state_code", stateCode)
    .eq("city_slug", citySlug)
    .eq("slug", facilitySlug)
    .eq("publishable", true)
    .limit(1);

  if (error) return { facility: null, error: error.message, configured: true };
  const row = (data ?? [])[0] as Facility | undefined;
  return { facility: row ?? null, error: null, configured: true };
}

async function loadInspections(
  facilityId: string,
): Promise<{ inspections: InspectionRow[]; deficiencies: DeficiencyRow[] }> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return { inspections: [], deficiencies: [] };

  const { data: inspData } = await supabase
    .from("inspections")
    .select(
      "id, inspection_date, inspection_type, is_complaint, complaint_id, total_deficiency_count, narrative_summary, source_url, raw_data",
    )
    .eq("facility_id", facilityId)
    .order("inspection_date", { ascending: false })
    .limit(50);

  const inspections = (inspData ?? []) as InspectionRow[];
  if (!inspections.length) return { inspections: [], deficiencies: [] };

  const inspIds = inspections.map((i) => i.id);
  const { data: defData } = await supabase
    .from("deficiencies")
    .select(
      "id, inspection_id, class, code, severity, immediate_jeopardy, description, inspector_narrative",
    )
    .in("inspection_id", inspIds);

  return {
    inspections,
    deficiencies: (defData ?? []) as DeficiencyRow[],
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { state: stateSlug, city: citySlug, facility: facilitySlug } =
    await params;
  const state = stateFromSlug(stateSlug);
  if (!state) return { title: "Facility | StarlynnCare" };

  const { facility } = await loadFacility(state.code, citySlug, facilitySlug);
  if (!facility) return { title: "Facility not found | StarlynnCare" };

  return {
    title: `${facility.name} | StarlynnCare`,
    description: `Memory care profile for ${facility.name}${facility.city ? ` in ${facility.city}, ${state.name}` : ""}, built from state and federal primary sources.`,
  };
}

function JsonLd({
  facility,
  stateName,
  canonicalUrl,
}: {
  facility: Facility;
  stateName: string;
  canonicalUrl: string;
}) {
  const structured = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "MedicalOrganization"],
    name: facility.name,
    url: canonicalUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: facility.street ?? undefined,
      addressLocality: facility.city ?? undefined,
      postalCode: facility.zip ?? undefined,
      addressRegion: stateName,
      addressCountry: "US",
    },
    telephone: facility.phone ?? undefined,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }}
    />
  );
}

function FieldRow({
  label,
  value,
  missing,
}: {
  label: string;
  value?: string | number | null;
  missing?: string;
}) {
  const rendered =
    value === null || value === undefined || value === ""
      ? missing ?? "Not yet indexed"
      : String(value);
  const isMissing =
    value === null || value === undefined || value === "";
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-sc-border/60 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={
          isMissing
            ? "text-sm italic text-muted"
            : "text-sm font-medium text-ink"
        }
      >
        {rendered}
      </dd>
    </div>
  );
}

export default async function FacilityPage({ params }: PageProps) {
  const { state: stateSlug, city: regionSlug, facility: facilitySlug } =
    await params;
  const state = stateFromSlug(stateSlug);
  if (!state) notFound();

  // Region is mostly for breadcrumbs; the actual DB lookup uses city_slug from the URL.
  // A URL like /california/alameda-county/xxx should NOT resolve a facility (facilities
  // are stored under city slugs, not county slugs), so this will 404 naturally via
  // the publishable lookup below.
  const region = regionFromSlug(stateSlug, regionSlug);

  const { facility, error, configured } = await loadFacility(
    state.code,
    regionSlug,
    facilitySlug,
  );

  if (!configured) {
    return (
      <>
        <SiteNav />
        <main className="border-b border-sc-border bg-warm-white px-6 py-20 md:px-8">
          <div className="mx-auto max-w-[680px] rounded-lg border border-amber/30 bg-amber-light px-5 py-4 text-sm text-slate">
            <p className="font-semibold text-amber">Configuration</p>
            <p className="mt-2">
              Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (error) throw new Error(error);
  if (!facility) notFound();

  const [{ inspections, deficiencies }, benchmarks] = await Promise.all([
    loadInspections(facility.id),
    loadBenchmarks(facility.id, state.code),
  ]);

  // Group deficiencies by inspection
  const defByInspection = new Map<string, DeficiencyRow[]>();
  for (const d of deficiencies) {
    const existing = defByInspection.get(d.inspection_id) ?? [];
    existing.push(d);
    defByInspection.set(d.inspection_id, existing);
  }

  // Substantiated complaints with no deficiency records in DB are scraper gaps —
  // the citation lives on a separate LIC 9099D sub-page. Count them as 1 deficiency each.
  const substantiatedWithMissingDefs = inspections.filter(
    (i) => i.is_complaint &&
      i.raw_data?.outcome === "Substantiated" &&
      (defByInspection.get(i.id) ?? []).length === 0,
  );

  const totalDeficiencies = deficiencies.length + substantiatedWithMissingDefs.length;
  const typeACount = deficiencies.filter((d) => d.class === "Type A").length;
  const dementiaCitations = deficiencies.filter((d) =>
    /8770[56]/.test(d.code ?? ""),
  ).length;

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.starlynncare.com";
  const canonicalUrl = `${base.replace(/\/$/, "")}/${state.slug}/${facility.city_slug}/${facility.slug}`;

  const content: FacilityContent | null = facility.content ?? null;

  const asOfFormatted = facility.updated_at
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeZone: "America/Los_Angeles",
      }).format(new Date(facility.updated_at))
    : null;

  const hasFederal = !!facility.cms_id;
  const hasState = !!facility.license_number;
  const stateAgency = STATE_AGENCY_LABEL[state.code] ?? `${state.name} state regulator`;

  const backHref = region
    ? `/${state.slug}/${region.slug}`
    : `/${state.slug}/${facility.city_slug}`;
  const backLabel = region ? region.name : facility.city ?? state.name;

  return (
    <>
      <JsonLd
        facility={facility}
        stateName={state.name}
        canonicalUrl={canonicalUrl}
      />
      <SiteNav />
      <main className="border-b border-sc-border bg-warm-white">
        <article className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            <Link href={`/${state.slug}`} className="hover:text-teal">
              {state.name}
            </Link>{" "}
            ·{" "}
            <Link href={backHref} className="hover:text-teal">
              {backLabel}
            </Link>
          </p>

          <h1 className="mt-4 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight text-navy md:text-[2.75rem] md:leading-tight">
            {facility.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-teal-light px-3 py-1 text-xs font-semibold text-teal">
              {CATEGORY_LABEL[facility.care_category]}
            </span>
          </div>

          {LICENSE_TYPE_INFO[facility.care_category] && (
            <details className="mt-3 group">
              <summary className="cursor-pointer list-none text-xs text-muted hover:text-teal transition-colors inline-flex items-center gap-1 select-none">
                <svg
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
                {LICENSE_TYPE_INFO[facility.care_category]!.title}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate max-w-prose pl-4 border-l-2 border-sc-border">
                {LICENSE_TYPE_INFO[facility.care_category]!.body}
              </p>
            </details>
          )}

          {(facility.street || facility.city || facility.zip) && (
            <p className="mt-4 text-slate leading-relaxed">
              {[
                facility.street,
                [facility.city, facility.zip].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {asOfFormatted && (
            <p className="mt-3 text-sm text-muted">
              Record last updated {asOfFormatted}.
            </p>
          )}

          {/* ──────────────────────────── Exterior photo ─────────────────────────── */}
          {facility.photo_url && (
            <div className="mt-8 overflow-hidden rounded-xl border border-sc-border shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={facility.photo_url}
                alt={`Exterior view of ${facility.name}`}
                width={800}
                height={500}
                className="w-full object-cover"
                loading="lazy"
              />
              <p className="px-4 py-2 text-xs text-muted bg-warm-white border-t border-sc-border/60">
                {facility.photo_attribution ?? "© Google Street View"}
              </p>
            </div>
          )}

          {/* ───────────────────────── At a glance dashboard ────────────────────── */}
          <QuickFacts
            facility={facility}
            lastInspectionDate={
              inspections.find((i) => !i.is_complaint)?.inspection_date ?? null
            }
          />

          {/* ─────────────────────────── Quality snapshot ────────────────────────── */}
          <QualitySnapshot facilityId={facility.id} />

          {benchmarks && (
            <section className="mt-10" aria-labelledby="glance-heading">
              <h2
                id="glance-heading"
                className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
              >
                At a glance
              </h2>
              <p className="mt-1 text-sm text-muted">
                Four independent signals drawn from state inspection records.
                No composite score — each metric tells a different part of the
                story.
              </p>
              <div className="mt-4 rounded-lg border border-sc-border bg-white px-5 pt-2 pb-4 shadow-card">
                <BenchmarkRow
                  label="Violations per visit"
                  explanation="How many citations inspectors found per routine visit, on average"
                  thisValue={
                    benchmarks.deficienciesPerInspection.value.toFixed(2) +
                    " citations per inspection"
                  }
                  context={`County median: ${benchmarks.deficienciesPerInspection.countyMedian.toFixed(2)} citations`}
                  tier={benchmarks.deficienciesPerInspection.tier}
                />
                <BenchmarkRow
                  label="Severe violations"
                  explanation="Violations where the state found actual or imminent risk of harm to a resident (called 'Type A' in state records)"
                  thisValue={
                    benchmarks.typeACount.value === 0
                      ? "No severe violations on file"
                      : `${benchmarks.typeACount.value} severe violation${benchmarks.typeACount.value === 1 ? "" : "s"} (Type A)`
                  }
                  context={`County range: ${benchmarks.typeACount.countyRange[0]}–${benchmarks.typeACount.countyRange[1]} severe violations`}
                  tier={benchmarks.typeACount.tier}
                />
                <BenchmarkRow
                  label="Memory care rule violations"
                  explanation="Whether the state cited this facility for violating dementia-specific care regulations (§87705 or §87706) in the last 5 years"
                  thisValue={
                    benchmarks.dementiaCitation.hasCitation
                      ? benchmarks.dementiaCitation.mostRecentDate
                        ? `Cited — most recent ${new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(benchmarks.dementiaCitation.mostRecentDate + "T12:00:00"))}`
                        : "Memory care rule violation on file"
                      : "No memory care rule violations in past 5 years"
                  }
                  tier="informational"
                />
                <BenchmarkRow
                  label="Complaints filed"
                  explanation="Of all complaints submitted to the state, how many were investigated and confirmed"
                  thisValue={
                    benchmarks.complaintSubstantiation.total === 0
                      ? "No complaints filed"
                      : `${benchmarks.complaintSubstantiation.substantiated} of ${benchmarks.complaintSubstantiation.total} complaint${benchmarks.complaintSubstantiation.total === 1 ? "" : "s"} substantiated`
                  }
                  context={
                    benchmarks.complaintSubstantiation.total > 0
                      ? `County avg: ${Math.round(benchmarks.complaintSubstantiation.countyAvg * 100)}% substantiation rate`
                      : undefined
                  }
                  tier={benchmarks.complaintSubstantiation.tier}
                />

                {/* Methodology footnote — clearly separate from the tier badges */}
                <div className="mt-3 flex items-center gap-1.5 border-t border-sc-border/40 pt-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5 shrink-0 text-blue-400"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <Link
                    href="/methodology"
                    className="text-xs text-blue-500 hover:text-blue-600 underline-offset-2 hover:underline"
                  >
                    How we calculate these ratings
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* ─────────────────────────── Regulatory baseline ────────────── */}
          <RegulatoryBaseline facility={facility} />

          {/* ─────────────────────────── AI content ─────────────────── */}
          {/* Only show structured tour questions — generic AI paragraphs removed */}
          {content?.tour_questions && content.tour_questions.length > 0 && (
            <TourQuestions
              questions={content.tour_questions}
              facilityName={facility.name}
            />
          )}

          {/* ─────────────────────────────── State card ─────────────────────────────── */}
          <section className="mt-12" aria-labelledby="state-heading">
            <div className="flex items-baseline justify-between">
              <h2
                id="state-heading"
                className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
              >
                State records
              </h2>
              <span className="text-xs uppercase tracking-wide text-muted">
                {stateAgency}
              </span>
            </div>

            {hasState ? (
              <dl className="mt-6 rounded-lg border border-sc-border bg-white px-5 py-2 shadow-card">
                <FieldRow label="License number" value={facility.license_number} />
                <FieldRow label="License type" value={facility.license_type} />
                <FieldRow label="License status" value={facility.license_status} />
                <FieldRow
                  label="License expires"
                  value={facility.license_expiration}
                />
                <FieldRow label="Licensed beds" value={facility.beds} />
                <FieldRow label="Operator" value={facility.operator_name} />
              </dl>
            ) : (
              <div className="mt-6 rounded-lg border border-sc-border bg-white px-5 py-6 shadow-card">
                <p className="text-sm font-semibold text-ink">
                  Not yet indexed
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  CDSS licensing data for this facility has not been scraped
                  yet. Inspection citations, complaint summaries, and LIC 9099
                  records will appear here once the {state.name} ingest run
                  completes for this facility.
                </p>
              </div>
            )}

            <section className="mt-6" aria-labelledby="inspections-heading">
              <h3
                id="inspections-heading"
                className="text-sm font-semibold uppercase tracking-wide text-muted"
              >
                Inspections &amp; citations
              </h3>

              {inspections.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {/* Summary strip */}
                  <div className="flex flex-wrap gap-6 rounded-lg border border-sc-border bg-white px-5 py-4 shadow-card">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-navy">{inspections.length}</p>
                      <p className="mt-0.5 text-xs text-muted">reports on file</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-navy">{totalDeficiencies}</p>
                      <p className="mt-0.5 text-xs text-muted">total deficiencies</p>
                    </div>
                    {typeACount > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{typeACount}</p>
                        <p className="mt-0.5 text-xs text-muted">Type A (actual harm)</p>
                      </div>
                    )}
                    {dementiaCitations > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-amber-600">{dementiaCitations}</p>
                        <p className="mt-0.5 text-xs text-muted">dementia-care citations</p>
                      </div>
                    )}
                  </div>

                  {/* Per-inspection cards */}
                  {inspections.map((insp) => {
                    const defs = defByInspection.get(insp.id) ?? [];
                    const outcome = insp.raw_data?.outcome;
                    const inspector = insp.raw_data?.inspector_name;
                    // Strip leading CDSS page-number sequences ("1 2 3 4 ... 32 ")
                    // These are form line numbers embedded by the CDSS HTML export.
                    const rawNarrative = (insp.raw_data?.narrative ?? "")
                      .replace(/^(\d+\s+)+/, "")
                      .replace(/^\*\*\*report continues from LIC9099\*\*\*\s*/i, "")
                      .trim();
                    const summary = insp.narrative_summary ?? null;
                    const hasBody =
                      defs.length > 0 ||
                      !!inspector ||
                      !!rawNarrative ||
                      !!summary ||
                      !!outcome;
                    const dateFormatted = insp.inspection_date
                      ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
                          new Date(insp.inspection_date + "T12:00:00"),
                        )
                      : insp.inspection_date;

                    // Determine worst deficiency class for header callout
                    const hasTypeA = defs.some((d) => d.class === "Type A");
                    const hasTypeB = defs.some((d) => d.class === "Type B");
                    // Substantiated complaints with no DB deficiency records = scraper gap
                    const isSubstantiatedGap =
                      insp.is_complaint &&
                      insp.raw_data?.outcome === "Substantiated" &&
                      defs.length === 0;

                    // Deficiency count label + color based on worst severity
                    const defLabel =
                      isSubstantiatedGap
                        ? "Citation on file"
                        : defs.length === 0
                        ? null
                        : defs.length === 1
                        ? "1 deficiency"
                        : `${defs.length} deficiencies`;
                    const defBadgeClass = hasTypeA
                      ? "text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5"
                      : hasTypeB
                      ? "text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-0.5"
                      : isSubstantiatedGap
                      ? "text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5"
                      : "text-xs font-medium text-muted";

                    return (
                      <details
                        key={insp.id}
                        className={`group rounded-lg border bg-white shadow-card ${
                          hasTypeA
                            ? "border-red-200"
                            : hasTypeB
                            ? "border-orange-200"
                            : isSubstantiatedGap
                            ? "border-amber-200"
                            : "border-sc-border"
                        }`}
                      >
                        <summary
                          className={`flex list-none items-center justify-between px-5 py-3.5 gap-3 ${hasBody ? "cursor-pointer" : "cursor-default"}`}
                        >
                          {/* Left cluster: visit type + date + outcome + severity badges */}
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span
                              className={
                                insp.is_complaint
                                  ? "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700"
                                  : insp.inspection_type === "other"
                                  ? "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600"
                                  : "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-teal-light text-teal"
                              }
                            >
                              {insp.is_complaint
                                ? "Complaint"
                                : insp.inspection_type === "other"
                                ? "Other visit"
                                : "Inspection"}
                            </span>
                            <span className="text-sm font-medium text-ink">{dateFormatted}</span>
                            {outcome && (
                              <span
                                className={
                                  outcome === "Substantiated"
                                    ? "text-xs font-semibold text-red-600"
                                    : "text-xs text-muted"
                                }
                              >
                                · {outcome}
                              </span>
                            )}
                            {/* Severity callout — visible without expanding */}
                            {hasTypeA && (
                              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700">
                                Type A
                              </span>
                            )}
                            {!hasTypeA && hasTypeB && (
                              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-orange-50 text-orange-600">
                                Type B
                              </span>
                            )}
                          </div>

                          {/* Right: deficiency count, colored by severity */}
                          {defLabel ? (
                            <span className={`shrink-0 ${defBadgeClass}`}>
                              {defLabel}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs text-muted/60">
                              No deficiencies
                            </span>
                          )}                        </summary>

                        {hasBody && (
                          <div className="border-t border-sc-border/50 px-5 py-4 space-y-3">
                            {inspector && (
                              <p className="text-xs text-muted">
                                Inspector:{" "}
                                <span className="text-ink">{inspector}</span>
                              </p>
                            )}

                            {/* Outcome explanation for complaints */}
                            {outcome && (defs.length === 0 || isSubstantiatedGap) && (
                              <p
                                className={
                                  outcome === "Substantiated"
                                    ? "text-sm font-semibold text-amber-700"
                                    : "text-sm text-slate"
                                }
                              >
                                {outcome === "Unsubstantiated"
                                  ? "Unsubstantiated — the California Department of Social Services (CDSS) investigated and did not find a violation."
                                  : outcome === "Substantiated"
                                  ? "Substantiated — CDSS found a violation and issued a citation. Full citation details are on file with the state."
                                  : outcome === "Mixed"
                                  ? "Mixed — CDSS found some allegations substantiated and others unsubstantiated during this investigation."
                                  : `Outcome: ${outcome}`}
                              </p>
                            )}

                            {/* AI summary — shown first if available */}
                            {summary && (
                              <div className="rounded-md border border-teal/20 bg-teal-light/35 px-3 py-2.5">
                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal">
                                  Plain-language summary
                                </p>
                                <p className="text-sm leading-relaxed text-slate">
                                  {summary}
                                </p>
                              </div>
                            )}

                            {/* Raw inspector narrative — always available, nested under disclosure */}
                            {rawNarrative && (
                              <details className="mt-1">
                                <summary className="cursor-pointer list-none text-xs font-medium text-teal hover:underline underline-offset-2">
                                  {summary ? "View full inspector notes" : "Inspector notes"}
                                </summary>
                                <p className="mt-2 text-sm text-slate leading-relaxed whitespace-pre-line border-l-2 border-sc-border pl-3">
                                  {rawNarrative}
                                </p>
                              </details>
                            )}

                            {/* Deficiency entries */}
                            {defs.length > 0 && (
                              <div className="space-y-4 pt-1">
                                {defs.map((def, di) => (
                                  <div
                                    key={def.id}
                                    className={
                                      di > 0
                                        ? "pt-4 border-t border-sc-border/40"
                                        : ""
                                    }
                                  >
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <span
                                        className={
                                          def.class === "Type A"
                                            ? "inline-flex items-center rounded px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700"
                                            : "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-orange-50 text-orange-600"
                                        }
                                      >
                                        {def.class ?? "Deficiency"}
                                      </span>
                                      {def.code && (
                                        <span className="text-xs font-mono text-slate">
                                          CCR §{def.code}
                                        </span>
                                      )}
                                      {def.immediate_jeopardy && (
                                        <span className="text-xs font-bold text-red-700 uppercase">
                                          Immediate jeopardy
                                        </span>
                                      )}
                                    </div>
                                    {def.description && (
                                      <div className="mt-2 rounded border-l-[3px] border-slate-300 bg-slate-50 px-3 py-2">
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                          Regulation
                                        </p>
                                        <p className="text-xs italic leading-relaxed text-slate">
                                          {def.description.length > 350
                                            ? def.description.slice(0, 350) + "…"
                                            : def.description}
                                        </p>
                                      </div>
                                    )}
                                    {def.inspector_narrative && (
                                      <div className="mt-2 rounded border-l-[3px] border-amber-400 bg-amber-50/60 px-3 py-2">
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                                          Inspector finding
                                        </p>
                                        <p className="text-sm leading-relaxed text-ink">
                                          {def.inspector_narrative.length > 500
                                            ? def.inspector_narrative.slice(0, 500) + "…"
                                            : def.inspector_narrative}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Link to official CDSS report */}
                            {insp.source_url && (
                              <div className="mt-3 border-t border-sc-border/40 pt-3">
                                <a
                                  href={insp.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-teal hover:underline underline-offset-2"
                                >
                                  View official CDSS report
                                  <svg aria-hidden className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0113.75 17h-8.5A2.25 2.25 0 013 14.75v-8.5A2.25 2.25 0 015.25 4h4a.75.75 0 010 1.5h-4a.75.75 0 00-.75.75zm6.5-3a.75.75 0 000 1.5h2.69l-6.72 6.72a.75.75 0 001.06 1.06l6.72-6.72v2.69a.75.75 0 001.5 0V2.75a.75.75 0 00-.75-.75h-4.5z" clipRule="evenodd" />
                                  </svg>
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-sc-border bg-white px-5 py-5 shadow-card">
                  <p className="text-sm font-medium text-ink">Not yet indexed</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate">
                    Individual inspection and deficiency records are scraped in a
                    separate CDSS pipeline. This section will populate with dated
                    citations (including Type A/B classifications, scope, and
                    inspector narrative) as that pipeline runs.
                  </p>
                </div>
              )}
            </section>
          </section>

          {/* ─────────────────────────────── Federal card ─────────────────────────────── */}
          <section className="mt-12" aria-labelledby="federal-heading">
            <div className="flex items-baseline justify-between">
              <h2
                id="federal-heading"
                className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
              >
                Federal summary
              </h2>
              <span className="text-xs uppercase tracking-wide text-muted">
                CMS Care Compare
              </span>
            </div>

            {hasFederal ? (
              <dl className="mt-6 rounded-lg border border-sc-border bg-white px-5 py-2 shadow-card">
                <FieldRow
                  label="CMS certification number (CCN)"
                  value={facility.cms_id}
                />
                <FieldRow
                  label="Overall star rating"
                  value={
                    facility.cms_star_rating != null
                      ? `${facility.cms_star_rating} of 5`
                      : null
                  }
                />
                <FieldRow
                  label="Last inspection (CMS)"
                  value={facility.last_inspection_date}
                />
                <FieldRow
                  label="Ownership type"
                  value={facility.ownership_type}
                />
              </dl>
            ) : (
              <div className="mt-6 rounded-lg border border-sc-border bg-white px-5 py-6 shadow-card">
                <p className="text-sm font-semibold text-ink">
                  Not a CMS-certified facility
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  California RCFEs (residential care facilities for the elderly)
                  are licensed by the state, not by CMS. CMS data only applies
                  to skilled nursing facilities or to CCRCs that operate a
                  licensed SNF wing.
                </p>
              </div>
            )}
          </section>

          {/* Sources section hidden — primary source URL available in state records */}

          {/* ── Family reviews ──────────────────────────────────────── */}
          <div className="mt-14 border-t border-sc-border pt-14">
            <ReviewsSection facilityId={facility.id} />
          </div>

          <p className="mt-14 text-center text-sm text-muted">
            <Link
              href={backHref}
              className="font-semibold text-teal hover:underline"
            >
              ← Back to {backLabel}
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
