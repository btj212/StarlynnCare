import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildDefinedTermSchema,
  buildDefinedTermSetSchema,
} from "@/lib/seo/schema";
import { CALIFORNIA_MEMORY_CARE_GLOSSARY } from "@/lib/content/glossaryTerms";

const PAGE_PATH = "/california/glossary";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "California Memory Care Glossary — Plain-Language Definitions";
const DESC =
  "RCFE, CDSS, Type A/B deficiencies, level-of-care fees, Medi-Cal waiver basics, and other terms families encounter in licensing data — reviewed by a California RN.";
const DATE_PUBLISHED = "2026-05-02";

const TERM_SET_ID = `${canonicalUrl}#california-memory-care-glossary`;

export const metadata: Metadata = {
  title: `${TITLE} | StarlynnCare`,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
    url: canonicalUrl,
    type: "article",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
  },
};

export default function CaliforniaGlossaryPage() {
  const definedTerms = CALIFORNIA_MEMORY_CARE_GLOSSARY.flatMap((c) =>
    c.terms.map((t) =>
      buildDefinedTermSchema({
        name: t.name,
        description: t.definition,
        url: `${canonicalUrl}#${t.id}`,
        termSetId: TERM_SET_ID,
      }),
    ),
  );

  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "California", url: canonicalFor("/california") },
      { name: "Glossary", url: canonicalUrl },
    ]),
    buildDefinedTermSetSchema({
      id: TERM_SET_ID,
      name: "California memory care glossary",
      description:
        "Defined regulatory and care-delivery terms used on StarlynnCare facility profiles and editorial guides.",
    }),
    ...definedTerms,
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[900px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <Link href="/california" className="hover:text-teal transition-colors">
                California
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Glossary</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Reference · California edition
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,56px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5">
              Memory care terms, <em>in plain language.</em>
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">
              Anchored definitions you can link to from tours, discharge packets, or family group chats.
            </p>

            <div className="mt-10 max-w-[72ch]">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[900px] px-4 sm:px-6 md:px-10 py-14 space-y-16">
          {CALIFORNIA_MEMORY_CARE_GLOSSARY.map((cat) => (
            <section key={cat.slug} aria-labelledby={`cat-${cat.slug}`}>
              <h2
                id={`cat-${cat.slug}`}
                className="font-[family-name:var(--font-display)] text-[clamp(22px,3vw,30px)] text-ink mb-6"
              >
                {cat.title}
              </h2>
              <dl className="space-y-8 border-t border-paper-rule pt-8">
                {cat.terms.map((t) => (
                  <div key={t.id}>
                    <dt
                      id={t.id}
                      className="font-[family-name:var(--font-mono)] text-[13px] font-semibold uppercase tracking-[0.06em] text-rust scroll-mt-24"
                    >
                      <Link href={`${canonicalUrl}#${t.id}`} className="hover:text-teal">
                        {t.name}
                      </Link>
                    </dt>
                    <dd className="mt-2 text-[16px] leading-[1.75] text-ink-2">{t.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <p className="text-[14px] text-ink-3 pt-8 border-t border-paper-rule">
            <Link href="/editorial-policy" className="text-teal underline underline-offset-4 hover:text-teal/80">
              Editorial policy &amp; sourcing standards →
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
