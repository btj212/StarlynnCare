import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import type { Facility } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = tryPublicSupabaseClient();
  if (!supabase) {
    return {
      title: "Facility | StarlynnCare",
      description:
        "Memory care and nursing facility profile with inspection citations.",
    };
  }
  const { data: rows } = await supabase
    .from("facilities")
    .select("name, city, updated_at")
    .eq("state_code", "FL")
    .eq("slug", slug)
    .limit(1);

  const row = rows?.[0];
  if (!row) {
    return { title: "Facility not found | StarlynnCare" };
  }

  return {
    title: `${row.name} | StarlynnCare`,
    description: `Inspection-backed profile for ${row.name}${row.city ? ` in ${row.city}, FL` : ", Florida"}.`,
  };
}

function JsonLd({
  facility,
  canonicalUrl,
}: {
  facility: Facility | null;
  canonicalUrl: string;
}) {
  const structured = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "MedicalOrganization"],
    name: facility?.name ?? "Facility profile",
    url: canonicalUrl,
    address: facility
      ? {
          "@type": "PostalAddress",
          streetAddress: facility.street ?? undefined,
          addressLocality: facility.city ?? undefined,
          postalCode: facility.zip ?? undefined,
          addressRegion: "FL",
          addressCountry: "US",
        }
      : undefined,
    telephone: facility?.phone ?? undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structured),
      }}
    />
  );
}

export default async function FacilityPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = tryPublicSupabaseClient();

  if (!supabase) {
    return (
      <>
        <SiteNav />
        <main className="border-b border-sc-border bg-warm-white px-6 py-20 md:px-8">
          <div className="mx-auto max-w-[680px] rounded-lg border border-amber/30 bg-amber-light px-5 py-4 text-sm text-slate">
            <p className="font-semibold text-amber">Configuration</p>
            <p className="mt-2">
              Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (legacy
              NEXT_PUBLIC_SUPABASE_ANON_KEY still works).
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { data: matches, error } = await supabase
    .from("facilities")
    .select("*")
    .eq("state_code", "FL")
    .eq("slug", slug);

  if (error) {
    throw new Error(error.message);
  }

  if (!matches?.length) {
    notFound();
  }

  const facility = matches[0] as Facility;

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.starlynncare.com";
  const canonicalUrl = `${base.replace(/\/$/, "")}/facility/${slug}`;

  const asOfFormatted = facility.updated_at
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeZone: "America/New_York",
      }).format(new Date(facility.updated_at))
    : null;

  return (
    <>
      <JsonLd facility={facility} canonicalUrl={canonicalUrl} />
      <SiteNav />
      <main className="border-b border-sc-border bg-warm-white">
        <article className="mx-auto max-w-[680px] px-6 py-14 md:px-8 md:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Florida · Memory care transparency
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight text-navy md:text-[2.75rem] md:leading-tight">
            {facility.name}
          </h1>
          {(facility.street || facility.city || facility.zip) && (
            <p className="mt-4 text-slate leading-relaxed">
              {[facility.street, [facility.city, facility.zip].filter(Boolean).join(", ")]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {asOfFormatted && (
            <p className="mt-3 text-sm text-muted">
              Record last updated {asOfFormatted} (database field{" "}
              <code className="rounded bg-sc-border/60 px-1 py-0.5 font-mono text-xs">
                updated_at
              </code>
              ).
            </p>
          )}

          <section className="mt-12" aria-labelledby="snapshot-heading">
            <h2
              id="snapshot-heading"
              className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
            >
              Data snapshot
            </h2>
            <p className="mt-2 text-sm text-slate">
              Fields below fill in as ingestion completes. Empty fields mean no
              value stored yet—not an error.
            </p>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-sc-border bg-white p-4 shadow-card">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  License number
                </dt>
                <dd className="mt-2 font-medium text-ink">
                  {facility.license_number ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-sc-border bg-white p-4 shadow-card">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  CMS certification number
                </dt>
                <dd className="mt-2 font-medium text-ink">
                  {facility.cms_id ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-sc-border bg-white p-4 shadow-card">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Beds
                </dt>
                <dd className="mt-2 font-medium text-ink">
                  {facility.beds != null ? facility.beds : "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-sc-border bg-white p-4 shadow-card">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  CMS star rating (overall)
                </dt>
                <dd className="mt-2 font-medium text-ink">
                  {facility.cms_star_rating != null
                    ? `${facility.cms_star_rating} of 5`
                    : "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-sc-border bg-white p-4 shadow-card">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Last inspection date
                </dt>
                <dd className="mt-2 font-medium text-ink">
                  {facility.last_inspection_date ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-sc-border bg-white p-4 shadow-card">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Primary source URL (facility record)
                </dt>
                <dd className="mt-2 break-all text-sm">
                  {facility.source_url ? (
                    <a
                      href={facility.source_url}
                      className="font-medium text-teal underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {facility.source_url}
                    </a>
                  ) : (
                    <span className="text-ink">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-16" aria-labelledby="sources-heading">
            <h2
              id="sources-heading"
              className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
            >
              Sources
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              Every published stat will list CMS or state agency URLs and
              effective dates from the database. Sprint 2 wires live inspection
              and deficiency rows here.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate">
              <li className="flex gap-2">
                <span className="text-teal" aria-hidden>
                  ·
                </span>
                CMS Provider Information (dataset) — citation URL TBD per ingest
                run.
              </li>
              <li className="flex gap-2">
                <span className="text-teal" aria-hidden>
                  ·
                </span>
                Florida AHCA Health Finder — citation URL TBD per facility scrape.
              </li>
            </ul>
          </section>

          <p className="mt-14 text-center text-sm text-muted">
            <Link href="/florida" className="font-semibold text-teal hover:underline">
              ← Back to Florida index
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
