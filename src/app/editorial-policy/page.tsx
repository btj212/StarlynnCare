import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";
import { buildBreadcrumbList, buildWebPageWithReviewer } from "@/lib/seo/schema";

const PAGE_PATH = "/editorial-policy";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Editorial Policy — Sourcing, Corrections & Conflicts";
const DESC =
  "How StarlynnCare cites primary records, handles corrections within five business days, discloses conflicts of interest, and refreshes editorial versus inspection data.";

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
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
  },
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 scroll-mt-24" aria-labelledby={id}>
      <h2
        id={id}
        className="font-[family-name:var(--font-display)] text-[clamp(22px,3vw,30px)] text-ink mb-4"
      >
        {title}
      </h2>
      <div className="space-y-4 text-[16px] leading-[1.75] text-ink-2 max-w-[72ch]">{children}</div>
    </section>
  );
}

export default function EditorialPolicyPage() {
  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Editorial policy", url: canonicalUrl },
    ]),
    buildWebPageWithReviewer({
      name: `${TITLE} | StarlynnCare`,
      url: canonicalUrl,
      description: DESC,
    }),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[800px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Editorial policy</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Governance
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5">
              Editorial policy
            </h1>
            <p className="text-[17px] leading-relaxed text-ink-3 max-w-[62ch]">{DESC}</p>
            <p className="mt-6 text-[13px] font-[family-name:var(--font-mono)] text-rust leading-relaxed max-w-[62ch]">
              {GOVERNANCE_24_WORDS}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[800px] px-4 sm:px-6 md:px-10 py-14">
          <Section id="sourcing" title="Primary sourcing standards">
            <p>
              StarlynnCare grounds facility profiles in <strong>California CDSS Community Care Licensing</strong>{" "}
              records — deficiency narratives, complaint outcomes where published, and facility characteristics
              matched to official license identifiers. Where applicable we augment with{" "}
              <strong>CMS Care Compare</strong> data for SNF-adjacent contexts, clearly labeled when present.
            </p>
            <p>
              Editorial guides (cost benchmarks, glossaries, tour checklists) cite statute or recognized public
              datasets where numeric claims appear — see the sourced footnotes on pillar pages. We do not fabricate
              inspection outcomes, ratings, or licensure status.
            </p>
            <p>
              NIH, Genworth, and state agency landing pages may inform educational framing; they do not replace
              facility-specific verification on tour.
            </p>
          </Section>

          <Section id="corrections" title="Corrections & reader feedback">
            <p>
              We commit to acknowledging factual corrections related to licensing data, addresses, or cited
              inspection dates within <strong>five business days</strong> of verifiable notice at{" "}
              <a href="mailto:hello@starlynncare.com" className="text-teal underline underline-offset-4">
                hello@starlynncare.com
              </a>
              . Substantive corrections appear on the affected page with an updated review stamp when clinical
              editorial content is involved.
            </p>
            <p>
              Opinion disagreements with operators are expected; factual disputes require primary-source
              documentation (e.g., revised CCLD export or signed admission agreement contemporaneous to the claim).
            </p>
          </Section>

          <Section id="coi" title="Conflict of interest">
            <p>
              StarlynnCare does not accept referral commissions, lead bonuses, or paid placement fees from
              facility operators. Sponsorship language cannot appear adjacent to graded profiles or directory
              rankings.
            </p>
            <p>
              Founders hold no equity interests in licensed operators reviewed on this site. Future partnerships
              (research grants, foundation funding) will be disclosed here if they could materially influence
              methodology.
            </p>
          </Section>

          <Section id="cadence" title="Refresh cadence">
            <p>
              <strong>Inspection & licensing data:</strong> ingested on a weekly cadence where upstream APIs and
              scraping jobs remain stable — see footer “Last data refresh.”
            </p>
            <p>
              <strong>Editorial pillars</strong> (cost guides, glossary, tour tools): reviewed at least{" "}
              <strong>quarterly</strong> for statutory or payer-program changes; urgent fixes ship outside that
              cycle when regulations change mid-quarter.
            </p>
          </Section>

          <div className="mt-14 pt-8 border-t border-paper-rule text-[14px] text-ink-3 flex flex-col gap-2">
            <Link href="/methodology" className="text-teal underline underline-offset-4 hover:text-teal/80">
              Methodology — how facility metrics are computed →
            </Link>
            <Link href="/about" className="text-teal underline underline-offset-4 hover:text-teal/80">
              About the founders →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
