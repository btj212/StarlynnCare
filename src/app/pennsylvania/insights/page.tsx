import type { Metadata } from "next";
import Image from "next/image";
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

export const revalidate = 3600;

const PAGE_PATH = "/pennsylvania/insights";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "PA memory care inspection insights — data analysis";
const DESC =
  "Data-driven analysis of Pennsylvania DHS OLTL inspection records — immediate-jeopardy trends, county comparisons, and facility size patterns across 354+ licensed memory care facilities.";

const STORIES = [
  {
    slug: "/pennsylvania/insights/pa-rural-home-highest-immediate-jeopardy",
    title: "A 48-bed rural PA home holds the state's highest immediate-jeopardy count",
    desc: "Penn Highlands Jefferson Manor in rural Brookville, Jefferson County recorded 21 immediate-jeopardy findings — more than any other memory care facility in Pennsylvania.",
    eyebrow: "Immediate jeopardy · Story A",
    image: {
      src: "/illustrations/pa-insights/rural-care-home-dusk-isolation.png",
      alt: "Illustrated rural care facility at the end of a long road at dusk, alone in open countryside",
    },
  },
  {
    slug: "/pennsylvania/insights/philadelphia-suburbs-worst-records",
    title: "Philadelphia's affluent suburbs have some of PA's worst memory care records",
    desc: "Chester and Montgomery counties, home to some of Pennsylvania's wealthiest ZIP codes, rank among the state's highest for deficiencies per facility — with collar-county IJ rates outpacing Pittsburgh metro.",
    eyebrow: "County comparison · Story B",
    image: {
      src: "/illustrations/pa-insights/affluent-suburban-residence-empty.png",
      alt: "Illustrated grand brick suburban residence with manicured landscaping and dark, empty windows",
    },
  },
  {
    slug: "/pennsylvania/insights/bigger-not-safer",
    title: "Bigger isn't safer: PA's largest memory care facilities average nearly 4× more severe citations",
    desc: "Pennsylvania facilities with 100+ beds average 5.1 severe findings per facility — nearly four times the rate of homes with fewer than 20 beds. Scale does not predict safety.",
    eyebrow: "Facility size analysis · Story C",
    image: {
      src: "/illustrations/pa-insights/large-facility-scale-lone-figure.png",
      alt: "Illustrated vast institutional building with rows of identical windows and a single small figure in the courtyard",
    },
  },
];

export const metadata: Metadata = {
  title: `${TITLE} | StarlynnCare`,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
    url: canonicalUrl,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: { card: "summary_large_image", title: `${TITLE} | StarlynnCare`, description: DESC },
};

export default function PaInsightsIndexPage() {
  const jsonLd = [
    buildWebPageWithReviewer({
      name: TITLE,
      url: canonicalUrl,
      description: DESC,
      datePublished: "2026-06-07",
    }),
    buildTopicCollectionPage({ name: TITLE, url: canonicalUrl, description: DESC }),
    buildSimpleLinkItemListSchema(
      "Pennsylvania memory care inspection insights",
      canonicalUrl,
      STORIES.map((s) => ({ name: s.title, url: canonicalFor(s.slug) })),
    ),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Pennsylvania", url: canonicalFor("/pennsylvania") },
      { name: "PA insights", url: canonicalUrl },
    ]),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        {/* Hero */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/pennsylvania" className="hover:text-teal transition-colors">Pennsylvania</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Insights</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              PA DHS OLTL inspection data · analysis
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              Pennsylvania memory care inspection insights
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <p className="mt-4 font-[family-name:var(--font-mono)] text-[12px] text-ink-4">
              Source: PA DHS OLTL · inspection record 2002–2026 · data as of June 7, 2026
            </p>
          </div>
        </div>

        {/* Story cards */}
        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <SectionHead
            label="§ 1 · Investigations"
            title={<>Three findings from Pennsylvania&apos;s inspection record</>}
          />

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STORIES.map((story) => (
              <Link
                key={story.slug}
                href={story.slug}
                className="flex flex-col gap-0 rounded-lg border border-paper-rule bg-paper-2 no-underline hover:border-rust/35 transition-colors overflow-hidden"
              >
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4/3" }}>
                  <Image
                    src={story.image.src}
                    alt={story.image.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="flex flex-col gap-3 px-5 py-5">
                  <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust">
                    {story.eyebrow}
                  </div>
                  <h2 className="font-[family-name:var(--font-display)] font-normal text-[clamp(16px,2vw,20px)] leading-[1.2] tracking-[-0.01em] text-ink m-0">
                    {story.title}
                  </h2>
                  <p className="text-[14px] leading-[1.65] text-ink-3 m-0">{story.desc}</p>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-teal mt-1">
                    Read the analysis →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-paper-rule">
            <p className="text-[15px] leading-[1.7] text-ink-3">
              All figures are drawn from public PA DHS OLTL inspection records made available
              through the{" "}
              <a
                href="https://www.dhs.pa.gov/Services/Licensing/Pages/OLTL-Facility-Search.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal underline underline-offset-2 hover:text-teal/70"
              >
                DHS Facility Search portal
              </a>
              . Individual facility profiles with full inspection histories are available on{" "}
              <Link href="/pennsylvania" className="text-teal underline underline-offset-2 hover:text-teal/70">
                StarlynnCare&apos;s Pennsylvania directory
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
