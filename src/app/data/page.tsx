import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList, buildDatasetSchema, buildWebPageWithReviewer } from "@/lib/seo/schema";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

const DATA_PATH = "/data";
const dataCanonical = canonicalFor(DATA_PATH);
const dataDesc =
  "Overview of the California memory care inspection and quality dataset behind StarlynnCare — CDSS Community Care Licensing and CMS Care Compare.";

export const metadata: Metadata = {
  title: "Dataset — California Memory Care Inspection Records | StarlynnCare",
  description: dataDesc,
  alternates: { canonical: dataCanonical },
  openGraph: {
    title: "Dataset — California Memory Care Inspection Records | StarlynnCare",
    description: dataDesc,
    url: dataCanonical,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dataset — California Memory Care Inspection Records | StarlynnCare",
    description: dataDesc,
    images: ["/og-default.png"],
  },
};

export default async function DataPage() {
  const supabase = tryPublicSupabaseClient();
  let lastDatasetRefresh: string | null = null;
  if (supabase) {
    const { data } = await supabase
      .from("facilities")
      .select("updated_at")
      .eq("publishable", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = data as { updated_at: string } | null;
    lastDatasetRefresh = row?.updated_at
      ? new Date(row.updated_at).toISOString().split("T")[0]
      : null;
  }

  const methodologyUrl = canonicalFor("/methodology");
  const dataJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Dataset", url: dataCanonical },
    ]),
    buildWebPageWithReviewer({
      name: "California Memory Care Inspection & Quality Records",
      url: dataCanonical,
      description: dataDesc,
    }),
    buildDatasetSchema({ pageUrl: dataCanonical, methodologyUrl }),
  ];

  return (
    <>
      <JsonLd objects={dataJsonLd} />
      <SiteNav />
      <main className="border-b border-sc-border bg-warm-white">
        <article className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            <Link href="/" className="hover:text-teal transition-colors">
              StarlynnCare
            </Link>{" "}
            · Dataset
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight text-navy md:text-[2.75rem] md:leading-tight">
            California Memory Care Inspection &amp; Quality Records
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate">
            StarlynnCare aggregates public regulatory data into facility-level
            profiles. This page describes the dataset that powers those
            profiles — what it contains, where it comes from, and how it is
            updated.
          </p>

          <section className="mt-10 space-y-4 text-base leading-relaxed text-slate">
            <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
              Sources
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-ink">California CDSS Community Care Licensing</strong>{" "}
                — RCFE roster (open data), inspection reports and deficiency
                citations (transparency API), and related complaint outcomes
                where published.
              </li>
              <li>
                <strong className="text-ink">CMS Care Compare</strong> — federal
                quality and survey context for facilities with a CMS
                identifier.
              </li>
            </ul>
          </section>

          <section className="mt-10 space-y-4 text-base leading-relaxed text-slate">
            <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
              Variables covered
            </h2>
            <p>
              The dataset includes inspection dates, deficiency classes and
              codes, severity scores, complaint visit flags, licensed bed
              counts, license status, operator identity, and derived quality
              context shown on each profile. Exact field definitions and tier
              logic are documented in our methodology.
            </p>
            <p>
              <Link
                href="/methodology"
                className="font-medium text-teal underline-offset-2 hover:underline"
              >
                How we rate facilities →
              </Link>
            </p>
          </section>

          <section className="mt-10 space-y-4 text-base leading-relaxed text-slate">
            <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
              Refresh cadence
            </h2>
            <p>
              CDSS inspection and deficiency records are ingested on a recurring schedule in the
              production pipeline (weekly target). Facility roster rows last touched{" "}
              {lastDatasetRefresh ? (
                <strong className="text-navy">{lastDatasetRefresh}</strong>
              ) : (
                <span className="italic text-muted">(connect Supabase to display)</span>
              )}{" "}
              reflect the latest publishable profile sync — see{" "}
              <Link href="/methodology" className="font-medium text-teal underline-offset-2 hover:underline">
                methodology → ingest &amp; refresh
              </Link>
              .
            </p>
          </section>

          <section className="mt-10 space-y-4 text-base leading-relaxed text-slate">
            <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
              Access
            </h2>
            <p>
              Profiles on this site are the primary consumer of the dataset.
              Machine-readable bulk export may be offered later; the
              methodology page documents current ingest and refresh practices.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
