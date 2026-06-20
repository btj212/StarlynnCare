import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionHead } from "@/components/editorial/SectionHead";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import {
  buildBreadcrumbList,
  buildSimpleLinkItemListSchema,
  buildTopicCollectionPage,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";
import { RESEARCH_INDEX } from "@/lib/content/research";

const RESEARCH_PATH = "/research";
const researchCanonical = canonicalFor(RESEARCH_PATH);
const PAGE_TITLE = "StarlynnCare Research";
const PAGE_DESC =
  "Original analysis of state inspection records — chain operator scorecards, repeat citation patterns, cost vs. quality, and geographic equity across licensed memory care.";

export const metadata: Metadata = {
  title: `Research | StarlynnCare`,
  description: PAGE_DESC,
  alternates: { canonical: researchCanonical },
  openGraph: {
    title: `${PAGE_TITLE} | StarlynnCare`,
    description: PAGE_DESC,
    url: researchCanonical,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PAGE_TITLE} | StarlynnCare`,
    description: PAGE_DESC,
  },
};

export default function ResearchHubPage() {
  const flagship = RESEARCH_INDEX.filter((r) => r.kind === "flagship-report");
  const analyses = RESEARCH_INDEX.filter((r) => r.kind === "analysis");

  const itemListEntries = RESEARCH_INDEX.map((r) => ({
    name: r.title,
    url: canonicalFor(r.href),
  }));

  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Research", url: researchCanonical },
    ]),
    buildWebPageWithReviewer({
      name: PAGE_TITLE,
      url: researchCanonical,
      description: PAGE_DESC,
    }),
    buildTopicCollectionPage({
      name: PAGE_TITLE,
      url: researchCanonical,
      description: PAGE_DESC,
    }),
    buildSimpleLinkItemListSchema(PAGE_TITLE, researchCanonical, itemListEntries),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />

      <main className="min-h-[50vh]" style={{ background: "var(--color-paper)" }}>
        <div
          className="border-b border-paper-rule"
          style={{ background: "var(--color-paper-2)" }}
        >
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-10 py-12 md:py-16">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Research</span>
            </nav>
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block mb-4">
              § StarlynnCare · Original analysis
            </p>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink m-0 max-w-[20ch]">
              Research
            </h1>
            <p className="mt-5 text-[18px] leading-[1.55] text-ink-3 max-w-[64ch]">
              Original analysis of state inspection records — chain scorecards,
              repeat-citation patterns, cost vs quality, geographic equity, and
              inspection seasonality across licensed memory care facilities.
              All findings are derived from{" "}
              <Link
                href="/data"
                className="text-teal underline underline-offset-4 hover:text-teal/80"
              >
                the public dataset
              </Link>{" "}
              we publish under{" "}
              <Link
                href="/methodology"
                className="text-teal underline underline-offset-4 hover:text-teal/80"
              >
                a documented methodology
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-10 py-16 space-y-20">
          {flagship.length > 0 && (
            <section id="flagship">
              <SectionHead
                label="Featured report"
                title={
                  <>
                    Long-form investigations <em>built from the dataset.</em>
                  </>
                }
              />
              <ResearchGrid items={flagship} />
            </section>
          )}

          <section id="analyses">
            <SectionHead
              label="Analyses"
              title={
                <>
                  Standalone findings <em>from the inspection record.</em>
                </>
              }
            />
            <ResearchGrid items={analyses} />
          </section>

          <p className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3 border-t border-paper-rule pt-10">
            Methodology and source data:{" "}
            <Link
              href="/methodology"
              className="text-teal underline underline-offset-4"
            >
              How we rate facilities →
            </Link>{" "}
            ·{" "}
            <Link href="/data" className="text-teal underline underline-offset-4">
              Dataset overview →
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function ResearchGrid({ items }: { items: typeof RESEARCH_INDEX }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 list-none m-0 p-0">
      {items.map((r) => (
        <li key={r.href}>
          <Link
            href={r.href}
            className="flex flex-col gap-3 rounded-lg border border-paper-rule bg-paper-2 px-5 py-5 no-underline hover:border-rust/35 transition-colors h-full"
          >
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
                {r.scope}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[10.5px] tracking-[0.04em] text-ink-4">
                · {r.bylineDate}
              </span>
            </div>
            <span className="font-[family-name:var(--font-display)] text-[20px] text-ink leading-snug">
              {r.title}
            </span>
            <span className="text-[14.5px] leading-relaxed text-ink-2 max-w-[60ch]">
              {r.dek}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[12px] text-rust mt-auto">
              {r.headlineFinding}
            </span>
            <span className="mt-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-teal">
              Read →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
