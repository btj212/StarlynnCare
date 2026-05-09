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
import { getArticleThumbnail } from "@/lib/content/articleThumbnails";

const LIBRARY_PATH = "/library";
const libraryCanonical = canonicalFor(LIBRARY_PATH);
const PAGE_TITLE = "Editorial library — memory care guides";
const PAGE_DESC =
  "Decision guides, cost & payer literacy, inspection-record explainers, and clinical primers — every StarlynnCare editorial article in one index.";

export const metadata: Metadata = {
  title: `${PAGE_TITLE} | StarlynnCare`,
  description: PAGE_DESC,
  alternates: { canonical: libraryCanonical },
  openGraph: {
    title: `${PAGE_TITLE} | StarlynnCare`,
    description: PAGE_DESC,
    url: libraryCanonical,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PAGE_TITLE} | StarlynnCare`,
    description: PAGE_DESC,
  },
};

type ArticleCard = { title: string; desc: string; href: string };

const SECTION_DECISION: ArticleCard[] = [
  {
    title: "Memory care vs. assisted living",
    desc: "Regulation, staffing, environment of care, and cost — when dementia-specific programming matters.",
    href: "/memory-care-vs-assisted-living",
  },
  {
    title: "Memory care vs. nursing home (SNF)",
    desc: "RCFE memory care vs skilled nursing: licensing, Medicare framing, and tour questions.",
    href: "/library/memory-care-vs-nursing-home",
  },
  {
    title: "When is it time for memory care?",
    desc: "Safety-first decision framing for families balancing clinical signals and caregiver capacity.",
    href: "/library/when-is-it-time-for-memory-care",
  },
];

const SECTION_COSTS: ArticleCard[] = [
  {
    title: "What memory care costs in California",
    desc: "Regional medians, RCFE billing structure, Medicare/Medi-Cal limits, and hidden fees.",
    href: "/california/cost-guide",
  },
  {
    title: "Memory care costs by city & region",
    desc: "Benchmark monthly bands by metro — planning estimates, not facility quotes.",
    href: "/california/cost-by-city",
  },
  {
    title: "Medi-Cal & memory care",
    desc: "Room & board vs services, ALW context, and how to pair payer literacy with inspection data.",
    href: "/library/medi-cal-and-memory-care",
  },
];

const SECTION_RECORD: ArticleCard[] = [
  {
    title: "Type-A vs. Type-B deficiencies, explained",
    desc: "How California cites immediate-risk findings vs lesser violations — read the public record with confidence.",
    href: "/library/type-a-vs-type-b-deficiencies-explained",
  },
  {
    title: "California memory care glossary",
    desc: "RCFE, ALW, and licensing terms you will see on profiles and CDSS exports.",
    href: "/california/glossary",
  },
  {
    title: "37 questions to ask on a memory care tour",
    desc: "Universal printable checklist — translates across state regulators (CDSS, HHSC, OR DHS, WA DSHS, MN MDH).",
    href: "/library/37-questions-to-ask-on-a-memory-care-tour",
  },
];

const SECTION_CLINICAL: ArticleCard[] = [
  {
    title: "Dementia vs. Alzheimer’s vs. Lewy body",
    desc: "Non-diagnostic primer for caregivers — terminology, progression patterns, and why tours differ.",
    href: "/library/dementia-vs-alzheimers-vs-lewy-body",
  },
];

function ArticleGrid({ items }: { items: ArticleCard[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 list-none m-0 p-0">
      {items.map((a) => {
        const thumb = getArticleThumbnail(a.href);
        return (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex flex-col sm:flex-row gap-4 rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 no-underline hover:border-rust/35 transition-colors min-h-[7rem]"
            >
              {thumb ? (
                <div className="relative w-full sm:w-[148px] shrink-0 aspect-[4/3] overflow-hidden rounded border border-paper-rule bg-paper">
                  <Image
                    src={thumb.src}
                    alt={thumb.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 148px"
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <span className="font-[family-name:var(--font-display)] text-[19px] text-ink leading-snug">
                  {a.title}
                </span>
                <span className="text-[14.5px] leading-relaxed text-ink-2">{a.desc}</span>
                <span className="mt-auto font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-rust">
                  Read →
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function LibraryIndexPage() {
  const itemListEntries = [
    ...SECTION_DECISION,
    ...SECTION_COSTS,
    ...SECTION_RECORD,
    ...SECTION_CLINICAL,
  ].map((a) => ({
    name: a.title,
    url: canonicalFor(a.href),
  }));

  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Editorial library", url: libraryCanonical },
    ]),
    buildWebPageWithReviewer({
      name: PAGE_TITLE,
      url: libraryCanonical,
      description: PAGE_DESC,
    }),
    buildTopicCollectionPage({
      name: PAGE_TITLE,
      url: libraryCanonical,
      description: PAGE_DESC,
    }),
    buildSimpleLinkItemListSchema(PAGE_TITLE, libraryCanonical, itemListEntries),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[50vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-10 py-12 md:py-16">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Editorial library</span>
            </nav>
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block mb-4">
              § StarlynnCare · Guides &amp; explainers
            </p>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink m-0 max-w-[20ch]">
              Editorial library
            </h1>
            <p className="mt-5 text-[18px] leading-[1.55] text-ink-3 max-w-[62ch]">
              Everything we publish to help families read the{" "}
              <strong className="font-medium text-ink">same public inspection record</strong> we show on facility
              profiles — plus cost literacy and clinical framing when it affects tours and transitions.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-10 py-16 space-y-20">
          <section id="decision-guides">
            <SectionHead
              label="§ 1 · Decision guides"
              title={<>Choosing care settings <em>without the sales narrative.</em></>}
            />
            <ArticleGrid items={SECTION_DECISION} />
          </section>

          <section id="costs-payers">
            <SectionHead
              label="§ 2 · Costs & payers"
              title={<>Money, Medi-Cal, and <em>what quotes hide.</em></>}
            />
            <ArticleGrid items={SECTION_COSTS} />
          </section>

          <section id="public-record">
            <SectionHead
              label="§ 3 · Reading the public record"
              title={<>CDSS inspections, citations, and <em>tours that match reality.</em></>}
            />
            <ArticleGrid items={SECTION_RECORD} />
          </section>

          <section id="clinical-literacy">
            <SectionHead
              label="§ 4 · Clinical literacy"
              title={<>Diagnosis vocabulary <em>for families — not clinicians.</em></>}
            />
            <ArticleGrid items={SECTION_CLINICAL} />
          </section>

          <p className="font-[family-name:var(--font-mono)] text-[12px] text-ink-3 border-t border-paper-rule pt-10">
            Editorial standards and corrections:{" "}
            <Link href="/editorial-policy" className="text-teal underline underline-offset-4">
              Editorial policy →
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
