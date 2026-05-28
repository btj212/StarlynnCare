import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

// Not indexed — personal report page
export const metadata: Metadata = {
  title: "Pittsburgh Memory Care Report | StarlynnCare",
  description: "A personal facility comparison report for three Pittsburgh-area memory care communities.",
  robots: { index: false, follow: false },
};

// Revalidate every hour as backfill data continues loading
export const revalidate = 3600;

const FACILITY_IDS = [
  "d09010bf-0ac9-46eb-84cc-aef68a7edbc8", // Ridgecrest Personal Care & Memory Care
  "e22cbd1b-e41a-439d-b052-99f1ab4decab", // Vincentian Home
  "98a836b8-3a20-49e5-89e7-93debc6dcf1a", // Cumberland Crossing Manor
];

// DHS inspection portal links (directly from DB)
const DHS_URLS: Record<string, string> = {
  "d09010bf-0ac9-46eb-84cc-aef68a7edbc8":
    "https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/AzureInspVioltnReprtSearchResults?id=45217&facilityName=RIDGECREST+PERSONAL+CARE+%26+MEMORY+CARE",
  "e22cbd1b-e41a-439d-b052-99f1ab4decab":
    "https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/AzureInspVioltnReprtSearchResults?id=43153&facilityName=VINCENTIAN+HOME",
  "98a836b8-3a20-49e5-89e7-93debc6dcf1a":
    "https://www.humanservices.dhs.pa.gov/HUMAN_SERVICE_PROVIDER_DIRECTORY/Home/AzureInspVioltnReprtSearchResults?id=44616&facilityName=CUMBERLAND+CROSSING+MANOR",
};

type FacilityRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  zip: string | null;
  license_type: string | null;
  serves_memory_care: boolean;
  publishable: boolean;
  phone: string | null;
  mc_designation_type: string | null;
  legal_entity_name: string | null;
};

type InspectionRow = {
  id: string;
  facility_id: string;
  inspection_date: string;
  is_complaint: boolean;
  total_deficiency_count: number | null;
};

type DeficiencyRow = {
  id: string;
  inspection_id: string;
  code: string | null;
  severity: string | null;
  description: string | null;
  cited_date: string | null;
};

function formatPhone(raw: string | null): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function LicenseBadge({ type, mc }: { type: string | null; mc: boolean }) {
  const label = mc
    ? "Memory Care"
    : type?.includes("ASSISTED LIVING")
    ? "Assisted Living"
    : type?.includes("PERSONAL CARE")
    ? "Personal Care Home"
    : type ?? "Unknown";
  const color = mc
    ? "bg-teal/10 text-teal border-teal/30"
    : "bg-paper-2 text-ink-3 border-paper-rule";
  return (
    <span
      className={`inline-block border rounded px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] ${color}`}
    >
      {label}
    </span>
  );
}

function InspectionTimeline({ inspections }: { inspections: InspectionRow[] }) {
  if (inspections.length === 0) {
    return (
      <p className="text-[14px] text-ink-4 italic">
        No inspection records found in our database yet.
      </p>
    );
  }

  const sorted = [...inspections].sort(
    (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
  );
  const recent = sorted.slice(0, 8);

  return (
    <div className="space-y-1.5">
      {recent.map((insp) => (
        <div key={insp.id} className="flex items-baseline gap-3 text-[13.5px]">
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-4 w-[100px] shrink-0">
            {formatDate(insp.inspection_date)}
          </span>
          <span className="text-ink-3">
            {insp.is_complaint ? "Complaint investigation" : "Routine inspection"}
          </span>
          {insp.total_deficiency_count !== null && (
            <span
              className={`ml-auto font-[family-name:var(--font-mono)] text-[11px] ${
                insp.total_deficiency_count === 0 ? "text-teal" : "text-rust"
              }`}
            >
              {insp.total_deficiency_count === 0
                ? "Clean"
                : `${insp.total_deficiency_count} finding${insp.total_deficiency_count !== 1 ? "s" : ""}`}
            </span>
          )}
        </div>
      ))}
      {sorted.length > 8 && (
        <p className="text-[12px] text-ink-4 mt-2">
          + {sorted.length - 8} earlier inspection{sorted.length - 8 !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function DeficiencySummary({
  deficiencies,
  inspections,
  dataNote,
}: {
  deficiencies: DeficiencyRow[];
  inspections: InspectionRow[];
  dataNote: boolean;
}) {
  if (deficiencies.length === 0) {
    return (
      <div className="text-[14px] text-ink-3">
        {inspections.length > 0 ? (
          dataNote ? (
            <span className="italic text-ink-4">
              Deficiency detail is still being extracted from inspection PDFs — check back shortly.
            </span>
          ) : (
            <span className="text-teal font-medium">No deficiencies on record.</span>
          )
        ) : (
          <span className="italic text-ink-4">No data available.</span>
        )}
      </div>
    );
  }

  // Group by severity
  const bySeverity: Record<string, DeficiencyRow[]> = {};
  for (const d of deficiencies) {
    const key = d.severity ?? "Citation";
    bySeverity[key] = [...(bySeverity[key] ?? []), d];
  }

  return (
    <div className="space-y-3">
      {Object.entries(bySeverity).map(([sev, items]) => (
        <div key={sev}>
          <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-ink-4 mb-1">
            {sev} ({items.length})
          </p>
          <ul className="space-y-1.5">
            {items.slice(0, 4).map((d) => (
              <li key={d.id} className="text-[13.5px] leading-[1.55] text-ink-2 pl-3 border-l border-paper-rule">
                {d.description ?? "—"}
                {d.cited_date && (
                  <span className="ml-2 text-[11px] text-ink-4">
                    {formatDate(d.cited_date)}
                  </span>
                )}
              </li>
            ))}
            {items.length > 4 && (
              <li className="text-[12px] text-ink-4 pl-3">
                + {items.length - 4} more
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default async function BibliofangirlPage() {
  const supabase = createPublicSupabaseClient();

  // Fetch all 3 facilities
  const { data: facilitiesRaw } = await supabase
    .from("facilities")
    .select(
      "id, name, slug, city, zip, license_type, serves_memory_care, publishable, phone, mc_designation_type, legal_entity_name"
    )
    .in("id", FACILITY_IDS);

  // Fetch inspections for all 3
  const { data: inspectionsRaw } = await supabase
    .from("inspections")
    .select("id, facility_id, inspection_date, is_complaint, total_deficiency_count")
    .in("facility_id", FACILITY_IDS)
    .order("inspection_date", { ascending: false });

  // Fetch deficiencies
  const inspectionIds = (inspectionsRaw ?? []).map((i) => i.id);
  const { data: deficienciesRaw } =
    inspectionIds.length > 0
      ? await supabase
          .from("deficiencies")
          .select("id, inspection_id, code, severity, description, cited_date")
          .in("inspection_id", inspectionIds)
          .order("cited_date", { ascending: false })
      : { data: [] };

  const facilities = (facilitiesRaw ?? []) as FacilityRow[];
  const inspections = (inspectionsRaw ?? []) as InspectionRow[];
  const deficiencies = (deficienciesRaw ?? []) as DeficiencyRow[];

  // Preserve the order: Ridgecrest, Vincentian, Cumberland
  const ordered = FACILITY_IDS.map((id) => facilities.find((f) => f.id === id)).filter(
    Boolean
  ) as FacilityRow[];

  // Fallbacks for facilities that may not be readable (unpublished RLS)
  const fallbackFacilities: Record<string, Partial<FacilityRow>> = {
    "98a836b8-3a20-49e5-89e7-93debc6dcf1a": {
      id: "98a836b8-3a20-49e5-89e7-93debc6dcf1a",
      name: "Cumberland Crossing Manor",
      city: "Pittsburgh",
      zip: "15237",
      license_type: "ASSISTED LIVING",
      serves_memory_care: false,
      publishable: false,
      phone: "4126350798",
      mc_designation_type: null,
      legal_entity_name: "Cranberry Place",
    },
  };

  const displayFacilities = FACILITY_IDS.map((id) => {
    const found = ordered.find((f) => f.id === id);
    if (found) return found;
    const fb = fallbackFacilities[id];
    return fb ? (fb as FacilityRow) : null;
  }).filter(Boolean) as FacilityRow[];

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <GovernanceBar />
      <SiteNav />

      <main style={{ background: "var(--color-paper)" }} className="min-h-[60vh]">
        {/* Header */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-12">
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Personal report · Pittsburgh, PA
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(26px,4vw,42px)] leading-[1.1] tracking-[-0.02em] text-ink mt-3 mb-4">
              Three Pittsburgh memory care communities — what the state inspection record shows
            </h1>
            <p className="text-[16px] leading-[1.65] text-ink-3 max-w-[62ch]">
              A data pull from Pennsylvania DHS inspection records for{" "}
              <strong className="font-medium text-ink">Ridgecrest</strong>,{" "}
              <strong className="font-medium text-ink">Vincentian Home</strong>, and{" "}
              <strong className="font-medium text-ink">Cumberland Crossing Manor</strong> in
              Pittsburgh (15237). Pulled {today}.
            </p>
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] leading-[1.6] text-amber-800">
              <strong>Data status:</strong> Inspection dates and visit counts are current. Deficiency
              detail is still being extracted from PA DHS inspection PDFs — this page updates
              automatically as processing completes.
            </div>
          </div>
        </div>

        {/* Facility cards */}
        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-12 space-y-12">
          {displayFacilities.map((facility) => {
            const facilityInspections = inspections.filter(
              (i) => i.facility_id === facility.id
            );
            const facilityInspectionIds = facilityInspections.map((i) => i.id);
            const facilityDeficiencies = deficiencies.filter((d) =>
              facilityInspectionIds.includes(d.inspection_id)
            );
            const dhsUrl = DHS_URLS[facility.id];

            // Determine if deficiency data is still pending
            const hasParsedInspections = facilityInspections.some(
              (i) => i.total_deficiency_count !== null
            );
            const dataStillLoading =
              facilityInspections.length > 0 &&
              !hasParsedInspections &&
              facilityDeficiencies.length === 0;

            const mostRecent = facilityInspections[0]?.inspection_date ?? null;
            const complaintCount = facilityInspections.filter((i) => i.is_complaint).length;

            return (
              <section
                key={facility.id}
                className="rounded-xl border border-paper-rule overflow-hidden"
                style={{ background: "var(--color-paper)" }}
              >
                {/* Card header */}
                <div
                  className="px-6 py-5 border-b border-paper-rule"
                  style={{ background: "var(--color-paper-2)" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(20px,2.5vw,26px)] leading-[1.15] text-ink">
                        {facility.name}
                      </h2>
                      <p className="mt-1 text-[14px] text-ink-4">
                        {facility.city}, PA {facility.zip}
                        {facility.phone && (
                          <span className="ml-3 font-[family-name:var(--font-mono)] text-[11px]">
                            {formatPhone(facility.phone)}
                          </span>
                        )}
                      </p>
                    </div>
                    <LicenseBadge type={facility.license_type} mc={facility.serves_memory_care} />
                  </div>

                  {/* Key stats row */}
                  <div className="mt-4 flex flex-wrap gap-6">
                    <div>
                      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4">
                        Inspections on record
                      </p>
                      <p className="text-[22px] font-[family-name:var(--font-display)] text-ink mt-0.5">
                        {facilityInspections.length}
                      </p>
                    </div>
                    {mostRecent && (
                      <div>
                        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4">
                          Most recent
                        </p>
                        <p className="text-[16px] font-[family-name:var(--font-mono)] text-ink mt-1">
                          {formatDate(mostRecent)}
                        </p>
                      </div>
                    )}
                    {complaintCount > 0 && (
                      <div>
                        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4">
                          Complaint investigations
                        </p>
                        <p className="text-[22px] font-[family-name:var(--font-display)] text-rust mt-0.5">
                          {complaintCount}
                        </p>
                      </div>
                    )}
                    {facility.mc_designation_type && (
                      <div>
                        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4">
                          PA DHS designation
                        </p>
                        <p className="text-[13px] text-ink-2 mt-1">{facility.mc_designation_type}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="px-6 py-5 grid sm:grid-cols-2 gap-8">
                  {/* Inspection timeline */}
                  <div>
                    <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-ink-4 mb-3">
                      Inspection history
                    </p>
                    <InspectionTimeline inspections={facilityInspections} />
                  </div>

                  {/* Deficiency summary */}
                  <div>
                    <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-ink-4 mb-3">
                      Findings &amp; deficiencies
                    </p>
                    <DeficiencySummary
                      deficiencies={facilityDeficiencies}
                      inspections={facilityInspections}
                      dataNote={dataStillLoading}
                    />
                  </div>
                </div>

                {/* Card footer */}
                <div className="px-6 py-3 border-t border-paper-rule flex flex-wrap items-center gap-4 text-[12.5px] text-ink-4">
                  {facility.legal_entity_name && (
                    <span>Operator: {facility.legal_entity_name}</span>
                  )}
                  <span>License: {facility.license_type ?? "—"}</span>
                  {dhsUrl && (
                    <Link
                      href={dhsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-teal hover:underline"
                    >
                      View PA DHS inspection portal →
                    </Link>
                  )}
                </div>
              </section>
            );
          })}

          {/* How to read this */}
          <section className="border-t border-paper-rule pt-10">
            <h2 className="font-[family-name:var(--font-display)] font-normal text-[20px] text-ink mb-4">
              How to read this
            </h2>
            <div className="space-y-4 text-[15px] leading-[1.7] text-ink-2 max-w-[68ch]">
              <p>
                <strong className="font-medium text-ink">Inspection count and recency</strong> are
                the most reliable signals here. Pennsylvania DHS performs routine annual surveys of
                Personal Care Homes (PCH) and Assisted Living Residences (ALR) and also investigates
                complaints separately. A high inspection count with no complaint investigations is a
                positive pattern.
              </p>
              <p>
                <strong className="font-medium text-ink">Deficiency data</strong> is extracted from
                PA DHS inspection PDFs. This processing is ongoing — the numbers above will update as
                extraction completes. The DHS portal link on each card lets you see the source PDFs
                directly.
              </p>
              <p>
                <strong className="font-medium text-ink">Ridgecrest</strong> (Personal Care Home,
                Secure Dementia Care Unit designation) has been inspected 20 times since 2020,
                including frequent visits in 2024–2025. That frequency is higher than typical and
                warrants asking the admissions director whether any of those visits were
                complaint-driven.
              </p>
              <p>
                <strong className="font-medium text-ink">Vincentian Home</strong> is a long-standing
                non-profit (Vincentian Home Inc) with inspection history dating to 2010. As a PCH
                with a Secure Dementia Care Unit designation, it operates under the same PA DHS
                framework as Ridgecrest.
              </p>
              <p>
                <strong className="font-medium text-ink">Cumberland Crossing Manor</strong> is
                licensed as an Assisted Living facility (not a PCH) and does not have a memory care
                designation in our current data. The legal entity of record is{" "}
                <em>Cranberry Place</em> — worth clarifying on a tour whether the memory care
                programming is distinct from the general AL population.
              </p>
              <p>
                Questions to ask on tour regardless of which facility:{" "}
                <Link
                  href="/library/37-questions-to-ask-on-a-memory-care-tour"
                  className="text-teal underline underline-offset-4"
                >
                  37 questions to ask on a memory care tour →
                </Link>
              </p>
            </div>
          </section>

          <p className="text-[12px] text-ink-4 border-t border-paper-rule pt-6">
            Data sourced from Pennsylvania DHS Human Services Provider Directory inspection records.
            This page is not indexed by search engines and was prepared for a specific user inquiry.
            All data reflects the public PA DHS inspection record — StarlynnCare does not accept
            payment from facilities and does not alter inspection findings.
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
