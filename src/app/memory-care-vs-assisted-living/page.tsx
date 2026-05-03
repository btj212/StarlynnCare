import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/memory-care-vs-assisted-living";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Memory Care vs. Assisted Living — How to Choose (2026)";
const DESC =
  "Regulation, physical environment, staffing, costs, and transition timing — a practical comparison for families navigating dementia care options in the U.S., reviewed by a California RN.";
const DATE_PUBLISHED = "2026-05-02";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Is memory care the same as assisted living?",
    a: "Not exactly. “Assisted living” usually describes a licensed residential setting that helps with ADLs and medications. “Memory care” is often a secured dementia-capable unit or programming layer inside assisted living — with higher staffing expectations and wander-management design.",
  },
  {
    q: "Which costs more, memory care or assisted living?",
    a: "In most markets, dedicated memory care units cost more than general assisted living in the same building or campus because of staffing ratios, programming, and physical security. Always compare itemized quotes including level-of-care fees.",
  },
  {
    q: "When should someone move from assisted living to memory care?",
    a: "Common triggers include unsafe wandering, repeated elopement risk, inability to participate safely in communal dining or activities, escalating behavioral expressions that general staffing cannot safely manage, or failed medication supervision — paired with documentation from clinicians.",
  },
  {
    q: "Does Medicare pay for memory care or assisted living?",
    a: "Medicare does not pay long-term room and board for either setting. It may cover short-term skilled nursing after qualifying hospitalization or outpatient medical care — not the monthly facility rent.",
  },
  {
    q: "How do I verify whether a building is truly secured for dementia?",
    a: "Ask for the tour route through secured doors, observe delayed-egress hardware where appropriate, review elopement protocols in writing, and cross-check inspection history for egress or supervision citations.",
  },
  {
    q: "Can a resident start in assisted living and transfer internally to memory care?",
    a: "Often yes, if the campus licenses both levels and has capacity. Internal transfers still require assessment, updated care plans, and sometimes higher monthly fees — confirm contract terms for rate locks and transfer fees.",
  },
  {
    q: "What questions matter most on a tour?",
    a: "Night staffing ratios, nurse coverage, medication error history in inspections, how behaviors are managed without unnecessary chemical restraint, and how the building coordinates with hospice or hospitals — use StarlynnCare’s 37-question checklist for a structured walkthrough.",
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
    type: "article",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
  },
};

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5"
    >
      {children}
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">{children}</div>
  );
}

export default function MemoryCareVsAssistedLivingPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Memory care vs. assisted living", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care vs. assisted living</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Decision guide · National framing, California inspection lens
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,56px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5">
              Memory care vs. assisted living — <em>what actually changes.</em>
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">
              The labels on the brochure do not always match the license, staffing, or physical environment.
              Here is how families can compare options without getting lost in marketing language.
            </p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <H2 id="definitions">1 · Definitions marketers blur</H2>
          <Prose>
            <p>
              <strong>Assisted living</strong> generally describes non-skilled residential care: medication
              reminders or administration within scope, help with bathing and dressing, meals, housekeeping,
              and supervision — often in studio or apartment-style buildings licensed under state-specific
              categories (in California, RCFEs are a common wrapper).
            </p>
            <p>
              <strong>Memory care</strong> is not a single nationwide license class. It usually refers to a{" "}
              <em>dementia-capable environment</em>: secured or delayed-egress perimeters, predictable routines,
              smaller dining cohorts, higher caregiver presence overnight, and staff trained in behavioral
              expression — bundled as a distinct wing or floor rate.
            </p>
            <p>
              Some operators market “memory care” without secured design or adequate staffing. Your tour
              questions and the facility&apos;s inspection history matter more than the logo above the door.
            </p>
          </Prose>

          <H2 id="comparison-table">2 · Side-by-side snapshot</H2>
          <div className="overflow-x-auto rounded-lg border border-paper-rule bg-paper-2">
            <table className="min-w-[640px] w-full text-left text-[14px] leading-snug">
              <thead>
                <tr className="border-b border-paper-rule bg-paper font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-rust">
                  <th className="px-4 py-3 font-semibold">Dimension</th>
                  <th className="px-4 py-3 font-semibold">General assisted living</th>
                  <th className="px-4 py-3 font-semibold">Dedicated memory care</th>
                </tr>
              </thead>
              <tbody className="text-ink-2">
                <tr className="border-b border-paper-rule align-top">
                  <td className="px-4 py-3 font-medium text-ink">Physical environment</td>
                  <td className="px-4 py-3">Open circulation, varied egress; suited to semi-independent residents.</td>
                  <td className="px-4 py-3">
                    Secured perimeter, simpler wayfinding, alarmed doors — reduces unsafe wandering risk.
                  </td>
                </tr>
                <tr className="border-b border-paper-rule align-top">
                  <td className="px-4 py-3 font-medium text-ink">Staffing philosophy</td>
                  <td className="px-4 py-3">Supports scheduled care tasks; less emphasis on continuous dementia cueing.</td>
                  <td className="px-4 py-3">
                    Higher expectations for cueing, redirection, dining assistance, and overnight checks.
                  </td>
                </tr>
                <tr className="border-b border-paper-rule align-top">
                  <td className="px-4 py-3 font-medium text-ink">Programming</td>
                  <td className="px-4 py-3">Broader activities calendar; may include mixed cognitive levels.</td>
                  <td className="px-4 py-3">
                    Failure-free programming, smaller groups, sensory-aware pacing.
                  </td>
                </tr>
                <tr className="border-b border-paper-rule align-top">
                  <td className="px-4 py-3 font-medium text-ink">Care planning</td>
                  <td className="px-4 py-3">Updates tied to functional changes; focus on ADLs.</td>
                  <td className="px-4 py-3">
                    Behavioral patterns, nutrition/hydration risks, medication supervision intensity.
                  </td>
                </tr>
                <tr className="border-b border-paper-rule align-top">
                  <td className="px-4 py-3 font-medium text-ink">Typical monthly cost</td>
                  <td className="px-4 py-3">Lower benchmark than secured memory care in the same market.</td>
                  <td className="px-4 py-3">
                    Premium for staffing + security + programming — verify LOC fees separately.
                  </td>
                </tr>
                <tr className="align-top">
                  <td className="px-4 py-3 font-medium text-ink">When it breaks down</td>
                  <td className="px-4 py-3">
                    Elopement risk, aggression toward peers, repeated med errors — assisted living may lack legal
                    staffing or physical controls.
                  </td>
                  <td className="px-4 py-3">
                    Still not clinical inpatient care — crises may require SNF or geriatric psych stabilization.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <DataFootnote source="Industry practice synthesis · not a statutory definition table" refreshed={DATE_PUBLISHED} />

          <H2 id="regulation">3 · Regulation & transparency</H2>
          <Prose>
            <p>
              Consumers rarely read Title 22 — but inspectors do. Whether you are evaluating assisted living or
              memory care, request the <strong>official facility identifier</strong> on the state license lookup
              and read recent deficiencies before you sign.
            </p>
            <p>
              On StarlynnCare&apos;s California profiles we emphasize{" "}
              <Link href="/library/type-a-vs-type-b-deficiencies-explained" className="text-teal underline underline-offset-4">
                Type A vs. Type B deficiencies
              </Link>{" "}
              because those classifications communicate immediate risk vs. systemic documentation failures — both are
              meaningful in dementia populations.
            </p>
          </Prose>

          <H2 id="clinical-triggers">4 · Clinical & safety triggers</H2>
          <Prose>
            <p>
              Moving from assisted living to memory care is rarely about one bad afternoon. Watch for clusters:
              documented wandering toward exits, weight loss from inability to sit through meals, medication errors
              tied to refusal behaviors, sundowning that overwhelms general staffing ratios, or aggression during
              transfers when osteoporotic fracture risk is high.
            </p>
            <p>
              Geriatricians and neurologists can document progression; your job on tour is to verify whether the{" "}
              <em>building&apos;s daily routines</em> match the emerging risk profile — not whether the lobby smells
              like cookies.
            </p>
          </Prose>

          <H2 id="costs">5 · Costs & contract traps</H2>
          <Prose>
            <p>
              Operators often quote <strong>base rent</strong> first. For dementia residents, the meaningful number
              is base plus <strong>level-of-care points</strong>, medication administration fees, incontinence
              supplies, and ancillary transportation. Ask for a modeled month-three bill, not a brochure grid.
            </p>
            <p>
              For California-specific ranges and payer basics, see our{" "}
              <Link href="/california/cost-guide" className="text-teal underline underline-offset-4">
                California memory care cost guide
              </Link>
              .
            </p>
          </Prose>

          <H2 id="family-dynamics">6 · Family dynamics & guilt</H2>
          <Prose>
            <p>
              Delaying a move does not preserve autonomy when judgment is impaired — it transfers burden to
              unpaid caregivers who face burnout and injury risk. Choosing secured memory care early enough to
              prevent catastrophic wandering or meal refusal is not abandonment; it is matching environment to
              neurobiology.
            </p>
            <p>
              Involve siblings through shared inspection records (cite StarlynnCare URLs, not rumors) so debate
              shifts from emotion to documented supervision capability.
            </p>
          </Prose>

          <H2 id="next-steps">7 · Practical next steps</H2>
          <Prose>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Tour twice — once daytime, once evening or weekend — before signing.
              </li>
              <li>
                Cross-check deficiencies on our facility pages against the administrator&apos;s verbal explanation.
              </li>
              <li>
                Use the{" "}
                <Link href="/california/37-questions-to-ask-on-a-tour" className="text-teal underline underline-offset-4">
                  37-question tour checklist
                </Link>{" "}
                so staff cannot steer only to scripted highlights.
              </li>
              <li>
                Bookmark terms you do not recognize in our{" "}
                <Link href="/california/glossary" className="text-teal underline underline-offset-4">
                  California glossary
                </Link>
                .
              </li>
            </ul>
          </Prose>

          <div className="mt-16 border-t border-paper-rule pt-12">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust mb-4">
              Frequently asked
            </p>
            <dl className="space-y-6">
              {FAQ_PAIRS.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold text-ink">{f.q}</dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-ink-2">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-12 flex flex-col gap-3 text-[14px] text-ink-3">
            <Link href="/california" className="text-teal underline underline-offset-4 hover:text-teal/80">
              Browse California memory care directories →
            </Link>
            <Link href="/editorial-policy" className="text-teal underline underline-offset-4 hover:text-teal/80">
              Editorial policy →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
