import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorialHero } from "@/components/editorial/EditorialHero";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { SeriousCitationsByState, SERIOUS_CITATIONS_ILLUSTRATION } from "@/components/articles/SeriousCitationsByState";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";
import { buildArticleSchema, buildBreadcrumbList } from "@/lib/seo/schema";
import { isArticleApproved, metadataForGatedArticle } from "@/lib/content/articleReview";

const PATH = "/research/memory-care-serious-citations-by-state";
const TITLE = "Serious citations at memory care homes, by state";
const DESCRIPTION =
  "Published memory care homes with a serious citation in the last 24 months, counted by state, with what each state's profile calls its top tag.";
const DATE_PUBLISHED = "2026-10-31";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForGatedArticle({
    path: PATH,
    title: TITLE,
    description: DESCRIPTION,
    image: SERIOUS_CITATIONS_ILLUSTRATION,
  });
}

export default async function SeriousCitationsByStatePage() {
  if (!(await isArticleApproved(PATH))) notFound();
  const canonical = canonicalFor(PATH);
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESCRIPTION,
      url: canonical,
      datePublished: DATE_PUBLISHED,
      image: `${SITE_ORIGIN}${SERIOUS_CITATIONS_ILLUSTRATION.src}`,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Research", url: canonicalFor("/research") },
      { name: TITLE, url: canonical },
    ]),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="mx-auto max-w-[1100px] px-6 py-12 md:py-16">
        <article>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink-4">
            Research
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-tight text-navy md:text-5xl">
            Serious citations at memory care homes, <em>by state</em>
          </h1>
          <div className="mt-8">
            <AuthorByline bare />
          </div>
          <div className="mt-8">
            <EditorialHero
              src={SERIOUS_CITATIONS_ILLUSTRATION.src}
              alt={SERIOUS_CITATIONS_ILLUSTRATION.alt}
              priority
            />
          </div>
          <div className="mt-10">
            <SeriousCitationsByState />
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
