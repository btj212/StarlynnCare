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
import type { Facility, CareCategory } from "@/lib/types";

type FacilityContent = {
  headline?: string;
  intro?: string;
  memory_care_approach?: string;
  neighborhood?: string;
  what_families_should_know?: string;
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
  rcfe_memory_care: "RCFE · Memory care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF · Memory care",
  alf_general: "ALF",
  snf_general: "Skilled nursing",
  snf_dementia_scu: "Skilled nursing · Dementia Special Care Unit",
  ccrc: "Continuing Care Retirement Community",
  unknown: "Pending categorization",
};

const STATE_AGENCY_LABEL: Record<string, string> = {
  CA: "California CDSS · Community Care Licensing Division",
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
      "id, inspection_date, inspection_type, is_complaint, complaint_id, total_deficiency_count, narrative_summary, raw_data",
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

  const totalDeficiencies = deficiencies.length;
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
            {facility.memory_care_designation && (
              <span className="text-sm text-slate">
                {facility.memory_care_designation}
              </span>
            )}
          </div>

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
                {facility.photo_attribution ?? "© Google Street View"} ·{" "}
                Exterior view only — not a facility-provided image
              </p>
            </div>
          )}

          {/* ───────────────────────── At a glance dashboard ────────────────────── */}
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
                  label="Compliance record"
                  explanation="Deficiencies per routine inspection"
                  thisValue={
                    benchmarks.deficienciesPerInspection.value.toFixed(2) +
                    " per inspection"
                  }
                  context={`County median: ${benchmarks.deficienciesPerInspection.countyMedian.toFixed(2)}`}
                  tier={benchmarks.deficienciesPerInspection.tier}
                />
                <BenchmarkRow
                  label="Severity record"
                  explanation="Type A citations indicate actual or imminent harm"
                  thisValue={
                    benchmarks.typeACount.value === 0
                      ? "No Type A citations"
                      : `${benchmarks.typeACount.value} Type A citation${benchmarks.typeACount.value === 1 ? "" : "s"}`
                  }
                  context={`County range: ${benchmarks.typeACount.countyRange[0]}–${benchmarks.typeACount.countyRange[1]}`}
                  tier={benchmarks.typeACount.tier}
                />
                <BenchmarkRow
                  label="Dementia-care specificity"
                  explanation="Whether CDSS cited §87705 or §87706 (dementia-care regulations) in the last 5 years"
                  thisValue={
                    benchmarks.dementiaCitation.hasCitation
                      ? benchmarks.dementiaCitation.mostRecentDate
                        ? `Citation on file — most recent ${new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(benchmarks.dementiaCitation.mostRecentDate + "T12:00:00"))}`
                        : "Citation on file"
                      : "No dementia-care citations in past 5 years"
                  }
                  tier="informational"
                />
                <BenchmarkRow
                  label="Complaint pattern"
                  explanation="Share of complaints that CDSS found to be substantiated"
                  thisValue={
                    benchmarks.complaintSubstantiation.value === null
                      ? "No complaints with a recorded outcome"
                      : `${Math.round(benchmarks.complaintSubstantiation.value * 100)}% substantiated (${benchmarks.complaintSubstantiation.substantiated} of ${benchmarks.complaintSubstantiation.total})`
                  }
                  context={
                    benchmarks.complaintSubstantiation.value !== null
                      ? `County avg: ${Math.round(benchmarks.complaintSubstantiation.countyAvg * 100)}%`
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

          {/* ─────────────────────────── AI-generated content ─────────────────────── */}
          {content && (
            <div className="mt-12 space-y-10">
              {content.intro && (
                <section aria-labelledby="about-heading">
                  <h2
                    id="about-heading"
                    className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
                  >
                    About this facility
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-slate">
                    {content.intro}
                  </p>
                </section>
              )}

              {content.memory_care_approach && (
                <section aria-labelledby="mc-heading">
                  <h2
                    id="mc-heading"
                    className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
                  >
                    Memory care approach
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-slate">
                    {content.memory_care_approach}
                  </p>
                </section>
              )}

              {content.neighborhood && (
                <section aria-labelledby="location-heading">
                  <h2
                    id="location-heading"
                    className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
                  >
                    Location &amp; neighborhood
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-slate">
                    {content.neighborhood}
                  </p>
                </section>
              )}

              {content.what_families_should_know && (
                <section
                  aria-labelledby="families-heading"
                  className="rounded-lg border border-teal/20 bg-teal-light/50 px-6 py-6"
                >
                  <h2
                    id="families-heading"
                    className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy"
                  >
                    What families should know
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate">
                    {content.what_families_should_know}
                  </p>
                </section>
              )}
            </div>
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

                    // Deficiency count label + color based on worst severity
                    const defLabel =
                      defs.length === 0
                        ? null
                        : defs.length === 1
                        ? "1 deficiency"
                        : `${defs.length} deficiencies`;
                    const defBadgeClass = hasTypeA
                      ? "text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5"
                      : hasTypeB
                      ? "text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-0.5"
                      : "text-xs font-medium text-muted";

                    return (
                      <details
                        key={insp.id}
                        className={`group rounded-lg border bg-white shadow-card ${
                          hasTypeA
                            ? "border-red-200"
                            : hasTypeB
                            ? "border-orange-200"
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
                          )}
                        </summary>

                        {hasBody && (
                          <div className="border-t border-sc-border/50 px-5 py-4 space-y-3">
                            {inspector && (
                              <p className="text-xs text-muted">
                                Inspector:{" "}
                                <span className="text-ink">{inspector}</span>
                              </p>
                            )}

                            {/* Outcome explanation for complaints with no deficiencies */}
                            {outcome && defs.length === 0 && (
                              <p
                                className={
                                  outcome === "Substantiated"
                                    ? "text-sm font-semibold text-red-600"
                                    : "text-sm text-slate"
                                }
                              >
                                {outcome === "Unsubstantiated"
                                  ? "Unsubstantiated — CDSS investigated and did not find violations."
                                  : outcome === "Substantiated"
                                  ? "Substantiated — CDSS found violations related to this complaint."
                                  : `Outcome: ${outcome}`}
                              </p>
                            )}

                            {/* AI summary — shown first if available */}
                            {summary && (
                              <p className="text-sm text-slate leading-relaxed">
                                {summary}
                              </p>
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
                                      <p className="text-sm text-slate leading-relaxed">
                                        {def.description.length > 350
                                          ? def.description.slice(0, 350) +
                                            "…"
                                          : def.description}
                                      </p>
                                    )}
                                    {def.inspector_narrative && (
                                      <p className="mt-2 text-sm text-ink leading-relaxed">
                                        {def.inspector_narrative.length > 500
                                          ? def.inspector_narrative.slice(
                                              0,
                                              500,
                                            ) + "…"
                                          : def.inspector_narrative}
                                      </p>
                                    )}
                                  </div>
                                ))}
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

          {/* ─────────────────────────────── Sources ─────────────────────────────── */}
          <section className="mt-14" aria-labelledby="sources-heading">
            <h2
              id="sources-heading"
              className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
            >
              Sources
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              StarlynnCare lists only the primary sources actually used to
              produce this record.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate">
              {facility.source_url && (
                <li className="flex gap-2">
                  <span className="text-teal" aria-hidden>·</span>
                  <a
                    href={facility.source_url}
                    className="break-all font-medium text-teal underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {facility.source_url}
                  </a>
                </li>
              )}
              {!facility.source_url && (
                <li className="italic text-muted">
                  Source URL will appear once the scrape run logs it.
                </li>
              )}
            </ul>
          </section>

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
