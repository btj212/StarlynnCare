import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { getArticlesForState, type RegistryArticle } from "@/lib/content/articleRegistry";
import { getStateHubConfig } from "@/lib/stateHubConfigs";
import { stateFromSlug } from "@/lib/states";

type PageProps = { params: Promise<{ state: string }> };

function resolveConfig(stateSlug: string) {
  const stateInfo = stateFromSlug(stateSlug);
  if (!stateInfo) return null;
  const config = getStateHubConfig(stateSlug);
  if (!config) return null;
  return { stateInfo, config };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const resolved = resolveConfig(stateSlug);
  if (!resolved) return { title: "Guides not found | StarlynnCare" };
  const { config } = resolved;
  const pagePath = `/${stateSlug}/guides`;
  const canonical = canonicalFor(pagePath);
  const title = `${config.stateName} memory care guides & explainers`;
  const desc = `Decision guides, licensing explainers, and inspection primers for ${config.stateName} memory care — sourced from ${config.regulatorAbbr} public records.`;
  return {
    title: `${title} | StarlynnCare`,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: `${title} | StarlynnCare`,
      description: desc,
      url: canonical,
      type: "website",
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
    },
    twitter: { card: "summary_large_image", title: `${title} | StarlynnCare`, description: desc },
  };
}

type SectionDef = {
  id: string;
  label: string;
  title: React.ReactNode;
  items: RegistryArticle[];
};

function ArticleCard({ article }: { article: RegistryArticle }) {
  const thumb = getArticleThumbnail(article.slug);
  return (
    <Link
      href={article.slug}
      className="flex flex-col sm:flex-row gap-4 rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 no-underline hover:border-rust/35 transition-colors min-h-[7rem]"
    >
      {thumb && (
        <div className="relative w-full sm:w-[148px] shrink-0 aspect-[4/3] overflow-hidden rounded border border-paper-rule bg-paper">
          <Image
            src={thumb.src}
            alt={thumb.alt}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 148px"
          />
        </div>
      )}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <span className="font-[family-name:var(--font-display)] text-[19px] text-ink leading-snug">
          {article.title}
        </span>
        <span className="text-[14.5px] leading-relaxed text-ink-2">{article.desc}</span>
        <span className="mt-auto font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-rust">
          Read →
        </span>
      </div>
    </Link>
  );
}

function ArticleGrid({ items }: { items: RegistryArticle[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 list-none m-0 p-0">
      {items.map((a) => (
        <li key={a.slug}>
          <ArticleCard article={a} />
        </li>
      ))}
    </ul>
  );
}

/** Group articles into editorial sections by primary tag. */
const TAG_SECTIONS: Array<{
  tag: string;
  id: string;
  label: string;
  title: React.ReactNode;
}> = [
  {
    tag: "decision",
    id: "decision-guides",
    label: "§ 1 · Decision guides",
    title: (
      <>
        Choosing care settings <em>without the sales narrative.</em>
      </>
    ),
  },
  {
    tag: "licensing",
    id: "licensing",
    label: "§ 2 · Licensing & regulation",
    title: (
      <>
        Reading the regulator&apos;s record, <em>in plain language.</em>
      </>
    ),
  },
  {
    tag: "costs",
    id: "costs-payers",
    label: "§ 3 · Costs & payers",
    title: (
      <>
        Money, waivers, and <em>what quotes hide.</em>
      </>
    ),
  },
  {
    tag: "inspection",
    id: "public-record",
    label: "§ 4 · Reading the public record",
    title: (
      <>
        Inspections, citations, and <em>tours that match reality.</em>
      </>
    ),
  },
  {
    tag: "clinical",
    id: "clinical-literacy",
    label: "§ 5 · Clinical literacy",
    title: (
      <>
        Diagnosis vocabulary <em>for families — not clinicians.</em>
      </>
    ),
  },
  {
    tag: "legal",
    id: "legal",
    label: "§ 6 · Legal & payer literacy",
    title: (
      <>
        Benefits, waivers, and <em>what the paperwork means.</em>
      </>
    ),
  },
];

export default async function StateGuidesPage({ params }: PageProps) {
  const { state: stateSlug } = await params;
  const resolved = resolveConfig(stateSlug);
  if (!resolved) notFound();
  const { config } = resolved;

  const articles = getArticlesForState(config.stateCode);

  // Deduplicate by slug (registry articles and stateArticles could overlap)
  const seen = new Set<string>();
  const allArticles: RegistryArticle[] = [];
  for (const a of articles) {
    if (!seen.has(a.slug)) {
      seen.add(a.slug);
      allArticles.push(a);
    }
  }

  // Build sections — only include sections that have at least one article
  const sections: SectionDef[] = TAG_SECTIONS.flatMap((s) => {
    const items = allArticles.filter((a) => a.tags.includes(s.tag as never));
    if (items.length === 0) return [];
    return [{ id: s.id, label: s.label, title: s.title, items }];
  });

  const pagePath = `/${stateSlug}/guides`;
  const canonical = canonicalFor(pagePath);
  const pageTitle = `${config.stateName} memory care guides & explainers`;
  const pageDesc = `Decision guides, licensing explainers, and inspection primers for ${config.stateName} memory care — sourced from ${config.regulatorAbbr} public records.`;

  const itemListEntries = allArticles.map((a) => ({
    name: a.title,
    url: canonicalFor(a.slug),
  }));

  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: config.stateName, url: canonicalFor(`/${stateSlug}`) },
      { name: "Guides & explainers", url: canonical },
    ]),
    buildWebPageWithReviewer({ name: pageTitle, url: canonical, description: pageDesc }),
    buildTopicCollectionPage({ name: pageTitle, url: canonical, description: pageDesc }),
    buildSimpleLinkItemListSchema(pageTitle, canonical, itemListEntries),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav countStateCode={config.stateCode} badge={config.stateName} ctaHref={`/${stateSlug}`} ctaLabel={`${config.stateName} memory care facilities`} />
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
              <Link href={`/${stateSlug}`} className="hover:text-teal transition-colors">
                {config.stateName}
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Guides &amp; explainers</span>
            </nav>
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block mb-4">
              § StarlynnCare {config.stateName} · Guides &amp; explainers
            </p>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink m-0 max-w-[22ch]">
              {config.stateName} memory care guides
            </h1>
            <p className="mt-5 text-[18px] leading-[1.55] text-ink-3 max-w-[62ch]">
              Everything we publish to help {config.stateName} families read the{" "}
              <strong className="font-medium text-ink">same public {config.regulatorAbbr} inspection record</strong> we show on
              facility profiles — plus licensing explainers and clinical framing when it affects tours and transitions.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 md:px-10 py-16 space-y-20">
          {sections.map((section) => (
            <section key={section.id} id={section.id}>
              <SectionHead label={section.label} title={section.title} />
              <ArticleGrid items={section.items} />
            </section>
          ))}

          {sections.length === 0 && (
            <p className="font-[family-name:var(--font-mono)] text-[13px] text-ink-3">
              Guides for {config.stateName} are coming soon.
            </p>
          )}

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
