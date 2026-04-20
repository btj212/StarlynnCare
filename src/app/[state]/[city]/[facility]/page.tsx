import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { regionFromSlug } from "@/lib/regions";
import { stateFromSlug } from "@/lib/states";
import type { Facility, CareCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.starlynncare.com";
  const canonicalUrl = `${base.replace(/\/$/, "")}/${state.slug}/${facility.city_slug}/${facility.slug}`;

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
              <div className="mt-3 rounded-lg border border-sc-border bg-white px-5 py-5 shadow-card">
                <p className="text-sm font-medium text-ink">Not yet indexed</p>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  Individual inspection and deficiency records are scraped in a
                  separate CDSS pipeline. This section will populate with dated
                  citations (including Type A/B classifications, scope, and
                  inspector narrative) as that pipeline runs.
                </p>
              </div>
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
