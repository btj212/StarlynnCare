import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StateMemoryCareStatsSection } from "@/components/data/StateMemoryCareStatsSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { loadStateMemoryCareStats } from "@/lib/data/stateMemoryCareStats";
import { canonicalFor } from "@/lib/seo/canonical";
import {
  buildBreadcrumbList,
  buildDatasetSchema,
  buildStateMemoryCareStatsDataset,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";
import { COVERED_STATES } from "@/lib/states";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

const DATA_PATH = "/data";
const dataCanonical = canonicalFor(DATA_PATH);
const STATE_COUNT = COVERED_STATES.length;
const dataDesc =
  "Inspection records behind StarlynnCare, with a live count for each state we cover.";
const dataTitle = `Dataset — Memory Care Inspection Records (${STATE_COUNT} States) | StarlynnCare`;

export const revalidate = 3600;

export const metadata: Metadata = {
  title: dataTitle,
  description: dataDesc,
  alternates: { canonical: dataCanonical },
  openGraph: {
    title: dataTitle,
    description: dataDesc,
    url: dataCanonical,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: dataTitle,
    description: dataDesc,
    images: ["/og-default.png"],
  },
};

export default async function DataPage() {
  const supabase = tryPublicSupabaseClient();
  let lastDatasetRefresh: string | null = null;
  const stateStats = supabase ? await loadStateMemoryCareStats(supabase) : null;
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
      name: dataTitle,
      url: dataCanonical,
      description: dataDesc,
    }),
    buildDatasetSchema({ pageUrl: dataCanonical, methodologyUrl }),
    ...(stateStats
      ? [
          buildStateMemoryCareStatsDataset({
            pageUrl: dataCanonical,
            stateNames: stateStats.rows.map((row) => row.name),
            cutoff: stateStats.cutoff,
            newestInspection: stateStats.rows.reduce<string | null>((latest, row) => {
              if (!row.newestInspection) return latest;
              if (!latest || row.newestInspection > latest) return row.newestInspection;
              return latest;
            }, null),
          }),
        ]
      : []),
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
            Memory Care Inspection Records — {STATE_COUNT} States
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate">
            StarlynnCare aggregates public regulatory data into facility-level
            profiles. This page describes the dataset that powers those
            profiles — what it contains, where it comes from, and how it is
            updated.
          </p>
        </article>

        <StateMemoryCareStatsSection stats={stateStats} />

        <article className="mx-auto max-w-[760px] px-6 pb-14 md:px-8 md:pb-20">
          <section className="mt-10 space-y-4 text-base leading-relaxed text-slate">
            <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
              Sources
            </h2>
            <p>
              Each row above names the state license office the count comes from.
              CMS Care Compare is used where a facility has a federal identifier.
            </p>
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
              Machine-readable bulk export is available in two formats:
            </p>
            <ul className="list-disc space-y-3 pl-5">
              <li>
                <strong className="text-ink">CSV — CC-BY download.</strong>{" "}
                A flat export of all publishable California facilities with license number, city, care
                category, last inspection date, and total deficiency count. Licensed{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  className="font-medium text-teal underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  CC BY 4.0
                </a>{" "}
                — attribution required, no share-alike restriction.{" "}
                <a
                  href="/api/export/ca-inspections"
                  className="font-medium text-teal underline-offset-2 hover:underline"
                >
                  Download CSV →
                </a>
              </li>
              <li>
                <strong className="text-ink">JSON — per-state API.</strong>{" "}
                Live JSON endpoint for each covered state:{" "}
                <code className="font-[family-name:var(--font-mono)] text-[13px] bg-paper-2 px-1.5 py-0.5 rounded">
                  /api/facilities/california
                </code>
                ,{" "}
                <code className="font-[family-name:var(--font-mono)] text-[13px] bg-paper-2 px-1.5 py-0.5 rounded">
                  /api/facilities/texas
                </code>
                , etc. Returns schema.org/Dataset-wrapped facility records with
                regulator verification URLs. CORS-open for third-party use.
              </li>
            </ul>
            <p className="text-[14px] text-ink-3 pt-2">
              Attribution: StarlynnCare, {lastDatasetRefresh ?? "2026"}.{" "}
              Source data: the state license offices named above.{" "}
              <Link href="/methodology" className="text-teal underline underline-offset-2 hover:underline">
                Methodology →
              </Link>
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
