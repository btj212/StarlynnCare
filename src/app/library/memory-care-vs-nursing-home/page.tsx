import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { EditorialHero } from "@/components/editorial/EditorialHero";
import { DataFootnote } from "@/components/editorial/DataFootnote";
import { LibraryCta } from "@/components/editorial/LibraryCta";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/library/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Memory care vs. nursing home — what's actually different, and how to tell which one your person needs";
const TITLE = "Memory Care vs. Nursing Home (SNF) in California (2026)";
const DESC =
  "RCFE memory care vs. skilled nursing: licensing differences, inspection databases, Medicare and Medi-Cal ALW payment rules, and tour questions by setting.";
const DATE_PUBLISHED = "2026-05-04";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Is memory care the same as a nursing home?",
    a: "No. In California, memory care is almost always provided in a Residential Care Facility for the Elderly (RCFE), which is a state-licensed residential setting under California Department of Social Services. A nursing home — a skilled nursing facility — is a federally certified medical setting under California Department of Public Health and CMS. Different licensure, different staffing, different funding.",
  },
  {
    q: "Can a memory care community admit someone who needs skilled nursing?",
    a: "Generally, no. RCFEs are licensed as non-medical settings. If a person's needs cross into territory that requires daily registered nurse assessment, IV therapy, ventilator support, or comparable skilled care, the appropriate setting is a SNF, possibly with a memory care unit. Some RCFEs accept residents on hospice (which adds a clinical layer through the hospice benefit), but that is a different arrangement from licensed skilled nursing.",
  },
  {
    q: "Will Medicare pay for memory care?",
    a: "No. Medicare does not cover long-term care in any residential setting, including memory care. Medicare Part A covers short-term, post-hospital skilled nursing in narrow windows. Medicare Part B covers some medical services regardless of setting. Neither pays for the room, meals, supervision, or memory-care programming that defines a memory care stay.",
  },
  {
    q: "What is the difference between Type A and Type B citations in California?",
    a: "Type A citations indicate an immediate threat to a resident's health, safety, or personal rights. Type B citations indicate a violation that would cause harm to a resident if not corrected. Both are public. Both appear in each California facility profile on this site, with the original CCL document linked. Our California memory care glossary explains the categories in detail.",
  },
  {
    q: "Where do I find inspection data for a California memory care facility?",
    a: "Community Care Licensing publishes the underlying records, but the search interface assumes you already know the facility's license number, and the documents are not designed for family use. That is the gap this site fills. Search any California city on this site to see every licensed memory care facility in that city with its inspection history rendered in plain language.",
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

export default function MemoryCareVsNursingHomePage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Memory care vs. nursing home", url: canonicalUrl },
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
              <span className="text-ink-3">Memory care vs. nursing home</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Decision guide · RCFE memory care vs SNF
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              Memory care vs. nursing home — what&apos;s actually different, and how to tell which one your person needs
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
            <EditorialHero
              src="/illustrations/beach-grandparent-grandchild.png"
              alt="Illustrated grandparent and grandchild walking together on the beach — representing the lifestyle and dignity questions families weigh when choosing between memory care and a nursing home"
              priority
            />
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <aside className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6 text-[16px] leading-[1.7] text-ink-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">
              The short version
            </p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>
                A <em>nursing home</em> (skilled nursing facility, SNF) is a medical setting. A <em>memory care</em>{" "}
                community in California is a residential setting (a Residential Care Facility for the Elderly, RCFE) with
                secured perimeters and dementia-specific programming.
              </li>
              <li>
                SNFs are federally regulated, surveyed by CMS, and rated publicly with stars on Care Compare. RCFEs are
                state-regulated by California&apos;s Community Care Licensing — the data exists, but it&apos;s harder for
                families to find. That gap is the reason this site exists.
              </li>
              <li>
                Medicare pays for SNF stays only in narrow, short windows. It does not pay for memory care. Long-term financing
                of memory care is almost always private pay or, in some California counties, Medi-Cal&apos;s Assisted Living
                Waiver.
              </li>
              <li>The right setting is determined by clinical needs and behavioral fit, not by which one feels safer in the abstract.</li>
            </ul>
          </aside>

          <H2 id="what-each-is">What each one actually is</H2>
          <Prose>
            <p>
              A <strong className="font-medium text-ink">skilled nursing facility</strong> — what most families call a
              &ldquo;nursing home&rdquo; — is a licensed medical setting. In California, SNFs are licensed by the California
              Department of Public Health and federally certified by the Centers for Medicare &amp; Medicaid Services (CMS) when
              they want to bill Medicare or Medi-Cal. They are required to maintain registered nurse coverage around the clock
              (with limited exceptions), they admit residents who need ongoing skilled clinical care, and they bill on a
              medical model — often by day, often through insurance. The standard staff mix is registered nurses, licensed
              vocational nurses, certified nursing assistants, plus rehabilitation therapists.
            </p>
            <p>
              A <strong className="font-medium text-ink">memory care community</strong> in California is something different.
              Almost all are Residential Care Facilities for the Elderly (RCFEs), licensed by the California Department of
              Social Services through the Community Care Licensing Division. RCFEs are explicitly{" "}
              <strong className="font-medium text-ink">non-medical</strong> facilities. They provide room, meals, activities,
              supervision, medication assistance, and help with the activities of daily living. They are not required to have
              nurses on staff at all hours, though many memory care communities choose to. What makes a community &ldquo;memory
              care&rdquo; specifically is some combination of a secured perimeter, dementia-specific programming, staff trained
              in dementia care under California Health and Safety Code §1569.626, and a population whose needs cluster around
              cognitive impairment rather than complex medical conditions.
            </p>
            <p>
              These are two different licensure regimes, two different staffing models, two different oversight regimes, and two
              different funding realities. A family choosing between them is not choosing between cheaper and more expensive,
              or between worse and better. They are choosing between two different kinds of care that exist for two different
              kinds of need.
            </p>
          </Prose>

          <H2 id="two-regulators">Two regulators, two very different public records</H2>
          <Prose>
            <p>
              This is the part of the comparison most directories will not make for you, and it is the part that matters most
              when you are trying to evaluate a specific facility.
            </p>
            <p>
              <strong className="font-medium text-ink">Skilled nursing facilities are surveyed by CMS, usually annually, and the results are published on Care Compare</strong>{" "}
              at medicare.gov/care-compare. Care Compare assigns a one-to-five-star Overall rating composed of three
              sub-ratings: Health Inspections, Staffing, and Quality Measures. Inspectors document any deficiency they find using
              a federal scope-and-severity matrix that runs from A (isolated, no actual harm) to L (widespread immediate jeopardy).
              The full survey report is downloadable. Staffing data — registered nurse hours per resident per day, certified
              nursing assistant hours per resident per day — is reported quarterly. None of this is hidden from families. It is
              just a lot to read.
            </p>
            <p>
              <strong className="font-medium text-ink">Residential Care Facilities for the Elderly are inspected by Community Care Licensing</strong>, and the data is also public, but it is presented in a way that does not invite family use. There is no star rating. There are no quality measures. Inspections happen on a cadence that has historically ranged from annual to once every five years, though recent state policy has tightened toward more frequent unannounced visits. Citations are categorized as{" "}
              <strong className="font-medium text-ink">Type A</strong> (immediate threat to resident health, safety, or personal rights) or{" "}
              <strong className="font-medium text-ink">Type B</strong> (would cause harm to a resident if not corrected). The reports themselves are available, but you have to know to look, and the search interface assumes you already know the facility&apos;s license number.
            </p>
            <p>
              What this means in practice: the SNF you might be considering for skilled care has a five-star summary an hour of
              internet research can decode. The memory care community you might be considering for residential care has a
              comparable inspection record sitting in a public database that almost no family ever opens.
            </p>
            <p>
              That gap is where this site lives. We pull every California memory care facility&apos;s inspection history directly
              from Community Care Licensing, normalize the citation data, and present it the way Care Compare presents SNF data —
              but without paid promotion of any kind. When you read a facility profile here, you are seeing the same source
              records the state inspector saw, organized for families instead of regulators.
            </p>
          </Prose>

          <H2 id="when-snf">When skilled nursing is the right setting</H2>
          <Prose>
            <p>
              There is no universal threshold, and nothing on this page is medical advice for your specific situation. There are,
              however, common patterns that geriatric clinicians and discharge planners look for. Skilled nursing tends to be the
              appropriate setting when one or more of the following apply: the person needs intravenous medication or fluids that
              cannot reasonably be managed in a residential setting; the person needs ventilator support, complex wound care, or
              daily skilled rehabilitation following a hospitalization; the person&apos;s medical status changes frequently enough
              that a registered nurse needs to assess and adjust care on a daily basis; or the person&apos;s behavioral expression
              of dementia has escalated to a point where a residential staffing model cannot safely support them.
            </p>
            <p>
              Memory care in an RCFE tends to be the appropriate setting when the person&apos;s primary need is cognitive support,
              supervision, and structured engagement; when their medical condition is reasonably stable and manageable with the
              medication assistance an RCFE can provide; when their behavioral expressions of dementia can be supported by trained
              dementia-care staff in a non-clinical environment; and when the goal of care is daily quality of life — purposeful
              activity, social contact, meals shared with others, dignity-preserving routines — rather than active medical
              treatment.
            </p>
            <p>
              Plenty of people move between these settings during the course of a dementia. A short SNF stay after a fall and a hip
              repair, then back to memory care. A move from memory care to SNF when behavioral expression escalates and a
              residential staffing model can no longer safely support them. A return from SNF to memory care after the precipitating
              event resolves. These are normal trajectories. The question to ask is not &ldquo;which one is better&rdquo; but
              &ldquo;which one fits the person, the diagnosis, and the moment.&rdquo;
            </p>
          </Prose>

          <H2 id="who-pays">Who pays for what</H2>
          <Prose>
            <p>
              This is the part of the comparison that most surprises families, and it is the part where assumptions formed by
              watching a parent&apos;s hospitalization decades ago are most likely to be wrong.
            </p>
            <p>
              <strong className="font-medium text-ink">Medicare</strong> pays for skilled nursing only in a narrow window. To
              qualify, the person must have had a qualifying hospital admission of at least three midnights as an inpatient
              (observation status does not count), and the SNF stay must begin within 30 days of that hospital discharge for a
              condition related to it. Medicare Part A then covers up to 100 days per benefit period: days 1 through 20 are covered
              fully, days 21 through 100 carry a daily coinsurance amount (well over $200 per day in 2026), and after day 100,
              Medicare stops paying altogether. Medicare does not pay for long-term custodial care in any setting. Medicare does
              not pay for memory care at all.
            </p>
            <p>
              <strong className="font-medium text-ink">Medi-Cal</strong> — California&apos;s Medicaid program — is a different story.
              For long-stay nursing home residents who meet the income and asset limits, Medi-Cal becomes the dominant payer for
              SNF care. The application is involved, the look-back period for asset transfers is real, and a share of cost is often
              required. For memory care in RCFEs, Medi-Cal does not provide broad coverage, but the{" "}
              <strong className="font-medium text-ink">Assisted Living Waiver</strong> (ALW) does cover the services portion of care
              in participating RCFEs in select California counties. Waitlists are common. The room and board portion is paid through
              the resident&apos;s SSI/SSP. ALW is the closest thing California has to a Medicaid memory care benefit, and for many
              families it is the only way to make a long memory care stay financially survivable. See{" "}
              <Link href="/library/medi-cal-and-memory-care" className="text-teal underline underline-offset-4">
                Medi-Cal and memory care
              </Link>{" "}
              for ALW navigation detail.
            </p>
            <p>
              <strong className="font-medium text-ink">Private pay</strong> is the dominant funding model for memory care in
              California. Quoted monthly rates in 2026 range from roughly $5,000 in lower-cost metros to over $15,000 in the
              highest-cost markets, often with a base rate plus a tiered care-level surcharge that grows as the person&apos;s needs
              grow. Many families use a combination of long-term care insurance (if it was purchased years before symptoms appeared),
              home equity, retirement savings, and family contribution. Veterans and surviving spouses of veterans may qualify for the
              VA&apos;s Aid and Attendance benefit, which can add several thousand dollars per month.
            </p>
            <p>
              The practical implication is this: if a family member is being discharged from a hospital to a SNF and someone tells
              you &ldquo;Medicare will cover it for a hundred days,&rdquo; that is technically true and almost always misleading. The
              100-day clock runs out faster than most families expect, and the day-21 coinsurance arrives at the worst possible time.
              If memory care is on the horizon at all, the financial planning conversation should start before the discharge, not after.
            </p>
          </Prose>

          <H2 id="tours">What to look for on a tour, by setting</H2>
          <Prose>
            <p>The questions you ask on a SNF tour and the questions you ask on a memory care tour are different because the operating models are different.</p>
            <p>
              <strong className="font-medium text-ink">On a skilled nursing tour</strong>, ask about the most recent CMS survey results and ask to see the deficiency report (you have a right to see it; it is also on Care Compare). Ask about RN coverage on nights and weekends. Ask the registered-nurse-hours-per-resident-day figure and compare it to the state and national averages on Care Compare. Ask how many of the current residents are short-stay rehabilitation patients versus long-stay residents — facilities heavily weighted toward short-stay rehab have a different culture than facilities serving primarily long-stay residents. Ask about hospital readmission rates and what the facility does to prevent them.
            </p>
            <p>
              <strong className="font-medium text-ink">On a memory care tour</strong>, ask about the most recent Community Care Licensing inspection and any open Type-A or Type-B citations from the last three years. Ask whether the staff-to-resident ratio you are quoted is for the day shift, the evening shift, or the awake-night shift — they are usually very different. Ask about staff training under California Health and Safety Code §1569.626 and how often refresher training happens. Ask how the community handles behavioral expressions of dementia — what do they do, and what do they call for help on. Ask what triggers a &ldquo;30-day notice&rdquo; — the legal mechanism by which a community can ask a resident to leave because their needs exceed what the community can provide.
            </p>
            <p>
              In both settings, ask to walk through during a meal. Ask to see the activity calendar and ask which activities actually run as scheduled. Ask the longest-tenured caregiver on the floor what they would change about the place if they could.
            </p>
          </Prose>

          <H2 id="starlynncare-records">How StarlynnCare uses these public records</H2>
          <Prose>
            <p>
              Every California memory care facility profile on this site is built from Community Care Licensing&apos;s primary records. We pull each facility&apos;s licensure status, inspection dates, citation history, and enforcement actions directly from CCL on a quarterly cadence, with same-day refreshes when major regulatory actions are posted. We render the citation data in plain language, but we link the original CCL document for every line, so you can verify any claim we make against the source.
            </p>
            <p>
              We do not accept payment from any facility listed. There is no premium tier, no sponsored placement, no commission for tour-bookings, no advertising relationship with any operator. The funding model is described in our{" "}
              <Link href="/editorial-policy" className="text-teal underline underline-offset-4">
                editorial policy
              </Link>
              . The reason that posture matters here, more than on most pages, is that the comparison between memory care and skilled nursing is a comparison most directories cannot make honestly because their revenue depends on placing residents into one specific setting.
            </p>
          </Prose>

          <DataFootnote source="Educational comparison · not individualized medical or legal advice" refreshed={DATE_PUBLISHED} />

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

          <div className="mt-12 pt-8 border-t border-paper-rule space-y-4 text-[15px] leading-relaxed text-ink-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
              Related on this site
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <Link href="/california/glossary" className="text-teal underline underline-offset-4">
                  California memory care glossary
                </Link>{" "}
                — plain-language definitions of citation types, regulatory terms, and care levels
              </li>
              <li>
                <Link href="/library/medi-cal-and-memory-care" className="text-teal underline underline-offset-4">
                  Medi-Cal and memory care in California
                </Link>{" "}
                — what the Assisted Living Waiver covers and how to find a participating facility
              </li>
              <li>
                <Link href="/california/cost-guide" className="text-teal underline underline-offset-4">
                  Cost of memory care in California
                </Link>{" "}
                — regional pricing bands, what drives the spread, and what private pay actually looks like
              </li>
              <li>
                <Link href="/california/37-questions-to-ask-on-a-tour" className="text-teal underline underline-offset-4">
                  37 questions to ask on a memory care tour
                </Link>{" "}
                — printable tour prompts organized by what you are trying to learn
              </li>
              <li>
                <Link href="/editorial-policy" className="text-teal underline underline-offset-4">
                  Editorial standards
                </Link>{" "}
                — how facility data is sourced, refreshed, reviewed, and how this site is funded
              </li>
            </ul>
            <p className="mt-8 text-[14px] text-ink-3">
              Last reviewed {DATE_PUBLISHED}. Author bio and credentials at{" "}
              <Link href="/about" className="text-teal underline underline-offset-4">
                About
              </Link>
              . This page describes how California regulates memory care and skilled nursing settings; it is not medical, legal, or financial advice for an individual person or facility.
            </p>
          </div>

          <LibraryCta stateSlug="california" stateName="California" />

          <div className="mt-10 flex flex-col gap-3 text-[14px] text-ink-3">
            <Link href="/memory-care-vs-assisted-living" className="text-teal underline underline-offset-4">
              Memory care vs. assisted living →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
