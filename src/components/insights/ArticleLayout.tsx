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
}

/**
 * Shared layout wrapper for PA insights story pages.
 * Matches the existing article template from memory-care-licensing/page.tsx,
 * adding a ShareBar and sources footer slot.
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
}: ArticleLayoutProps) {
  const allButLast = breadcrumbs.slice(0, -1);
  const current = breadcrumbs[breadcrumbs.length - 1];

  return (
    <>
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        {/* Hero header */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            {/* Breadcrumb */}
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              {allButLast.map((crumb) => (
                <span key={crumb.href} className="flex items-center gap-1.5">
                  <Link href={crumb.href} className="hover:text-teal transition-colors">
                    {crumb.label}
                  </Link>
                  <span aria-hidden>›</span>
                </span>
              ))}
              <span className="text-ink-3">{current.label}</span>
            </nav>

            {/* Eyebrow */}
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              {eyebrow}
            </div>

            {/* Headline */}
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {headline}
            </h1>

            {/* Dek */}
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{dek}</p>

            {/* Author + share */}
            <div className="mt-8">
              <AuthorByline lastReviewed={lastReviewed} className="border-b-0 pb-0 mb-0" />
            </div>
            <ShareBar url={canonicalUrl} title={headline} />
          </div>
        </div>

        {/* Article body */}
        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          {children}

          {sources && (
            <div className="mt-16 pt-8 border-t border-paper-rule">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink-4 mb-4">
                Sources
              </p>
              <div className="font-[family-name:var(--font-mono)] text-[12px] text-ink-4 space-y-2 leading-[1.6]">
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
