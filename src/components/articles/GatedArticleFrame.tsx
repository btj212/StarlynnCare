import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { EditorialHero } from "@/components/editorial/EditorialHero";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { isArticleApproved } from "@/lib/content/articleReview";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";
import { buildArticleSchema, buildBreadcrumbList, buildFaqSchemaFromPairs } from "@/lib/seo/schema";
import type { FaqPair } from "@/components/articles/ArticleFaq";

type Crumb = { name: string; path: string };

type Props = {
  path: string;
  title: string;
  description: string;
  datePublished: string;
  eyebrow: string;
  heading: ReactNode;
  image: { src: string; alt: string };
  crumbs: Crumb[];
  nav?: {
    badge: string;
    countStateCode: string;
    ctaHref: string;
    ctaLabel: string;
    stateNavHref: string;
  };
  /** Must be the same pairs the body renders with ArticleFaq. */
  faq?: readonly FaqPair[];
  children: ReactNode;
};

export async function GatedArticleFrame({
  path,
  title,
  description,
  datePublished,
  eyebrow,
  heading,
  image,
  crumbs,
  nav,
  faq,
  children,
}: Props) {
  if (!(await isArticleApproved(path))) notFound();
  const canonical = canonicalFor(path);
  const jsonLd = [
    buildArticleSchema({
      headline: title,
      description,
      url: canonical,
      datePublished,
      image: `${SITE_ORIGIN}${image.src}`,
    }),
    buildBreadcrumbList(crumbs.map((crumb) => ({ name: crumb.name, url: canonicalFor(crumb.path) }))),
    ...(faq && faq.length > 0 ? [buildFaqSchemaFromPairs([...faq], canonical)] : []),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      {nav ? (
        <SiteNav
          badge={nav.badge}
          countStateCode={nav.countStateCode}
          ctaHref={nav.ctaHref}
          ctaLabel={nav.ctaLabel}
          stateNavHref={nav.stateNavHref}
        />
      ) : (
        <SiteNav />
      )}
      <main className="mx-auto max-w-[760px] px-6 py-12 md:py-16">
        <article>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink-4">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-tight text-navy md:text-5xl">
            {heading}
          </h1>
          <div className="mt-8">
            <AuthorByline bare />
          </div>
          <EditorialHero src={image.src} alt={image.alt} priority />
          <div className="mt-2">{children}</div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
