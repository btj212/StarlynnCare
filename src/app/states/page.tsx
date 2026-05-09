import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList, buildWebPageWithReviewer } from "@/lib/seo/schema";
import { SectionHead } from "@/components/editorial/SectionHead";
import { COVERED_STATES } from "@/lib/states";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

export const revalidate = 3600;

const PAGE_CANONICAL = canonicalFor("/states");
const PAGE_TITLE = "Memory care by state | StarlynnCare";
const PAGE_DESC =
  "Inspection-backed memory care facility directories for California, Oregon, Washington, Minnesota, and Texas — sourced from each state's regulator.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: PAGE_CANONICAL },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESC,
    url: PAGE_CANONICAL,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
};

const STATE_DESCRIPTIONS: Record<string, string> = {
  CA: "CDSS · RCFE Memory Care · Annual unannounced inspections",
  OR: "Oregon DHS · Memory Care Endorsed ALFs & RCFs",
  WA: "DSHS · Specialized Dementia Care ALFs",
  MN: "MDH · ALF with Dementia Care license",
  TX: "HHSC · Alzheimer-certified assisted living",
};

async function getStateCounts(): Promise<Record<string, number>> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return {};
  const { data } = await supabase
    .from("facilities")
    .select("state_code")
    .eq("publishable", true);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const code = (row as { state_code: string }).state_code;
    counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}

export default async function StatesPage() {
  const counts = await getStateCounts();

  const stateJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "States we cover", url: PAGE_CANONICAL },
    ]),
    buildWebPageWithReviewer({
      name: PAGE_TITLE,
      url: PAGE_CANONICAL,
      description: PAGE_DESC,
    }),
  ];

  return (
    <>
      <JsonLd objects={stateJsonLd} />
      <GovernanceBar scope="national" />
      <SiteNav
        countStateCode={undefined}
        badge={undefined}
        ctaHref="/states"
        ctaLabel="memory care facilities nationwide"
        national
      />
      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-12">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-rust mb-3">
              All covered states · Memory care transparency
            </p>
            <h1
              className="font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink mb-4"
              style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1 }}
            >
              States we cover
            </h1>
            <p className="font-[family-name:var(--font-display)] italic text-[20px] leading-[1.4] text-ink-3 max-w-[50ch]">
              Each state below is indexed from its primary regulator. Only facilities with verified state-agency data are shown.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
          <SectionHead
            label="§ Covered states"
            title={<>Five states, <em>one editorial standard.</em></>}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COVERED_STATES.map((state) => {
              const count = counts[state.code] ?? 0;
              return (
                <Link
                  key={state.code}
                  href={`/${state.slug}`}
                  className="flex flex-col gap-3 border border-paper-rule p-6 no-underline text-ink hover:border-teal transition-colors"
                  style={{ background: "var(--color-paper-2)" }}
                >
                  <span className="font-[family-name:var(--font-display)] text-[28px] leading-none tracking-[-0.01em]">
                    {state.name}
                  </span>
                  {count > 0 && (
                    <span className="font-[family-name:var(--font-mono)] text-[13px] text-ink-3 tracking-[0.04em]">
                      <strong className="text-ink text-[18px] font-semibold">{count.toLocaleString()}</strong>{" "}
                      facilities indexed
                    </span>
                  )}
                  <p className="text-[12px] font-[family-name:var(--font-mono)] text-ink-4 tracking-[0.02em] leading-snug">
                    {STATE_DESCRIPTIONS[state.code] ?? "Public regulator data"}
                  </p>
                  <span className="mt-auto font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-teal">
                    Browse facilities →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
