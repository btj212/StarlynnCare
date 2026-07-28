import Image from "next/image";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { ShareBar } from "@/components/insights/ShareBar";

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface ArticleLayoutProps {
  /** Short eyebrow label (rust mono bar at top of hero). */
  eyebrow: string;
  headline: string;
  /** Deck/sub-headline paragraph. */
  dek: string;
  /** ISO date string for last reviewed. */
  lastReviewed: string;
  /** Canonical URL for the ShareBar. */
  canonicalUrl: string;
  /** Breadcrumb items. The last item is the current page (no href rendered as link). */
  breadcrumbs: BreadcrumbItem[];
  children: React.ReactNode;
  /** Optional sources section rendered at the bottom of the article. */
  sources?: React.ReactNode;
  /** Optional hero image displayed as a full-width banner between the header and body. */
  heroImage?: { src: string; alt: string };
}

/**
 * Shared layout wrapper for PA insights story pages.
 * Matches the existing article template from memory-care-licensing/page.tsx,
 * adding a ShareBar and sources footer slot.
 * Clearing visual: soft masthead; copy and offer placement unchanged.
 */
export function ArticleLayout({
  eyebrow,
  headline,
  dek,
  lastReviewed,
  canonicalUrl,
  breadcrumbs,
  children,
  sources,
  heroImage,
}: ArticleLayoutProps) {
  const allButLast = breadcrumbs.slice(0, -1);
  const current = breadcrumbs[breadcrumbs.length - 1];

  return (
    <>
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh]" style={{ background: "var(--color-clearing-bg)" }}>
        {/* Hero header */}
        <div
          className="border-b border-clearing-rule"
          style={{
            background:
              "linear-gradient(180deg, var(--color-clearing-tint) 0%, var(--color-clearing-bg) 100%)",
          }}
        >
          <div className="mx-auto max-w-[860px] px-4 py-14 sm:px-6 md:px-[60px]">
            {/* Breadcrumb */}
            <nav
              className="mb-6 flex flex-wrap items-center gap-1.5 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-4"
              aria-label="Breadcrumb"
            >
              {allButLast.map((crumb) => (
                <span key={crumb.href} className="flex items-center gap-1.5">
                  <Link href={crumb.href} className="transition-colors hover:text-teal">
                    {crumb.label}
                  </Link>
                  <span aria-hidden>›</span>
                </span>
              ))}
              <span className="text-ink-3">{current.label}</span>
            </nav>

            {/* Eyebrow */}
            <div className="mb-3">
              <span className="clearing-chip">{eyebrow}</span>
            </div>

            {/* Headline */}
            <h1 className="mt-3 mb-5 font-[family-name:var(--font-display)] text-[clamp(28px,4.5vw,44px)] font-normal leading-[1.08] tracking-[-0.02em] text-ink">
              {headline}
            </h1>

            {/* Dek */}
            <p className="max-w-[62ch] text-[18px] leading-[1.6] text-ink-3">{dek}</p>

            {/* Author + share */}
            <div className="mt-8">
              <AuthorByline lastReviewed={lastReviewed} className="border-b-0 pb-0 mb-0" />
            </div>
            <ShareBar url={canonicalUrl} title={headline} />
          </div>
        </div>

        {/* Hero image */}
        {heroImage && (
          <div
            className="relative w-full overflow-hidden border-b border-clearing-rule"
            style={{ aspectRatio: "16/7" }}
          >
            <Image
              src={heroImage.src}
              alt={heroImage.alt}
              fill
              className="object-cover"
              sizes="(max-width: 860px) 100vw, 860px"
              priority
            />
          </div>
        )}

        {/* Article body */}
        <div className="mx-auto max-w-[860px] px-4 py-14 sm:px-6 md:px-[60px]">
          {children}

          {sources && (
            <div className="mt-16 rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-5 py-6 pt-8 shadow-[var(--shadow-card)] sm:px-6">
              <p className="mb-4 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Sources
              </p>
              <div className="space-y-2 font-[family-name:var(--font-sans)] text-[13px] leading-[1.6] text-ink-4">
                {sources}
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
