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
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/library/medi-cal-and-memory-care";
const canonicalUrl = canonicalFor(PAGE_PATH);
/** Display + JSON-LD headline */
const ARTICLE_HEADLINE =
  "Medi-Cal and memory care in California — what it actually covers, what it doesn't, and how the Assisted Living Waiver works";
const TITLE = "Medi-Cal & Memory Care in California — ALW Guide";
const DESC =
  "Medi-Cal and RCFE memory care in California: how the Assisted Living Waiver works, participating counties, SSI room-and-board, and share of cost.";
const DATE_PUBLISHED = "2026-05-04";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Will Medi-Cal pay for memory care in California?",
    a: "Yes, but almost always through one specific program — the Assisted Living Waiver — and only in approximately fifteen participating counties. ALW pays the services portion of memory care; the resident pays room and board from SSI/SSP. Standard Medi-Cal long-term care coverage applies to skilled nursing facilities, not RCFE memory care.",
  },
  {
    q: "What is the Assisted Living Waiver?",
    a: "A Medi-Cal Home and Community-Based Services waiver authorized under California Welfare and Institutions Code §14132.275 and administered by DHCS. It funds personal care, supervision, medication assistance, and dementia programming in participating RCFEs for residents who would otherwise qualify for nursing facility placement.",
  },
  {
    q: "How long are ALW waitlists?",
    a: "Variable by county. Historically a few months in some counties, more than two years in others. DHCS is the authoritative source; ask directly when you call.",
  },
  {
    q: "What is share of cost?",
    a: "The amount a Medi-Cal recipient is responsible for paying each month before Medi-Cal coverage activates. It applies when household income exceeds the program's maintenance need standard. The figure is recalculated monthly.",
  },
  {
    q: "Can I be on Medi-Cal and pay privately while I wait for ALW?",
    a: "Yes. A common path: apply for Medi-Cal, get on the ALW waitlist, and pay privately at a participating or non-participating facility in the meantime. When a slot opens, the family transitions if it makes sense to.",
  },
  {
    q: "What if my county isn't an ALW participating county?",
    a: "The waiver does not extend to non-participating counties. Options: relocate to a participating county (residency requirements apply), pursue alternative Medi-Cal programs that may offset some costs (IHSS, MSSP, PACE where available), or plan for private pay. Some families establish residency in a participating county to access ALW; the mechanics of that should be discussed with a benefits counselor or elder law attorney.",
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
      className="font-[family-name:var(--font-display)] font-normal text-[clamp(22px,3vw,32px)] leading-[1.1] tracking-[-0.01em] text-ink mt-16 mb-5 group/h2"
    >
      <a href={`#${id}`} className="no-underline text-ink hover:text-ink">
        {children}
        <span className="ml-2 font-[family-name:var(--font-mono)] text-[14px] text-rust/40 opacity-0 group-hover/h2:opacity-100 transition-opacity select-none" aria-hidden>#</span>
      </a>
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">{children}</div>
  );
}

export default function MediCalMemoryCarePage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Medi-Cal & memory care", url: canonicalUrl },
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
            <nav className="flex flex-wrap gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4">
              <Link href="/" className="hover:text-teal transition-colors">
                Home
              </Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Medi-Cal &amp; memory care</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              California payer literacy · RN-reviewed
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
            <EditorialHero
              src="/illustrations/garden-elderly-man-tending-flowers.png"
              alt="Illustrated older gentleman tending flowers in a garden — representing the daily activities and independence that residential memory care, supported in part by Medi-Cal, aims to preserve"
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
                Medicare does not pay for memory care in California. It is the most common assumption families bring into
                this conversation, and it is the one that costs the most when it turns out to be wrong.
              </li>
              <li>
                Medi-Cal does pay for some memory care in California, but almost always through one specific program — the{" "}
                <strong className="font-medium text-ink">Assisted Living Waiver (ALW)</strong> — which exists in
                approximately fifteen counties and operates with waitlists.
              </li>
              <li>
                ALW pays the <em>services</em> portion of memory care at a state-set rate. The <em>room and board</em>{" "}
                portion is paid by the resident from SSI/SSP. The all-in cost to a qualifying family is typically a
                fraction of private-pay memory care.
              </li>
              <li>
                Eligibility for Medi-Cal, getting onto the ALW waitlist, and finding a participating facility are three
                separate processes. Treating them as a sequence loses months. Run them in parallel.
              </li>
              <li>
                For care that needs a skilled nursing facility (SNF) rather than memory care, Medi-Cal&apos;s long-term
                care coverage operates under a different and broader benefit. Different program, different math.
              </li>
            </ul>
          </aside>

          <H2 id="what-medi-cal-covers">What Medi-Cal actually covers in memory care</H2>
          <Prose>
            <p>
              Medi-Cal — California&apos;s implementation of Medicaid — does not have a single benefit called
              &ldquo;memory care.&rdquo; What it has is a set of long-term care programs, and memory care families end up
              touching one or more of them depending on the setting and the person&apos;s medical needs.
            </p>
            <p>
              For <strong className="font-medium text-ink">skilled nursing</strong>, Medi-Cal long-term care coverage is
              well-established. A resident who meets the income and asset criteria, and who is placed in a Medi-Cal-certified
              SNF, can have most of the cost covered by the program for as long as the medical need persists. This is the path
              most families have heard about, even if they haven&apos;t navigated it.
            </p>
            <p>
              For <strong className="font-medium text-ink">memory care in a Residential Care Facility for the Elderly (RCFE)</strong>
              , Medi-Cal does not provide broad coverage. RCFEs are state-licensed residential settings, not federally certified
              medical providers, and the standard Medi-Cal long-term care benefit does not extend to them by default. The
              exception, and the reason this page exists, is the{" "}
              <strong className="font-medium text-ink">Assisted Living Waiver</strong> — a Home and Community-Based Services
              waiver authorized under California Welfare and Institutions Code §14132.275 and administered by the Department of
              Health Care Services (DHCS). ALW covers a defined set of personal care, supervision, and medication assistance
              services in participating RCFEs in participating counties.
            </p>
            <p>
              A few adjacent programs come up in the same conversations and are worth naming so they don&apos;t get
              conflated. <strong className="font-medium text-ink">In-Home Supportive Services (IHSS)</strong> can offset
              informal memory care at home by paying a family or hired caregiver, but it does not cover RCFE placement.{" "}
              <strong className="font-medium text-ink">Multipurpose Senior Services Program (MSSP)</strong> offers care
              coordination for at-risk older adults staying at home.{" "}
              <strong className="font-medium text-ink">Program of All-Inclusive Care for the Elderly (PACE)</strong> is a
              fully integrated medical and social program available in select areas. These are real options for some families.
              None of them are the same as ALW, and none of them pay an RCFE for memory care.
            </p>
            <p>
              When someone tells a family &ldquo;Medi-Cal will cover this,&rdquo; the question to ask back is{" "}
              <em>which Medi-Cal benefit, in which setting, with what waitlist</em>. The answer is almost always ALW.
            </p>
          </Prose>

          <H2 id="alw-plain-language">The Assisted Living Waiver, in plain language</H2>
          <Prose>
            <p>
              ALW is the closest thing California has to a Medicaid memory care benefit. Understanding how it actually works
              is the difference between a family that gets enrolled within months and a family that waits two years for a slot
              they didn&apos;t realize they needed to ask for.
            </p>
            <p>
              <strong className="font-medium text-ink">Where it operates.</strong> ALW is available in approximately
              fifteen California counties as of this writing, including{" "}
              <Link href="/california/alameda-county" className="text-teal underline underline-offset-4">Alameda</Link>
              , Contra Costa, Fresno, Kern, Los Angeles,
              Orange, Riverside, Sacramento, San Bernardino, San Diego, San Francisco, San Joaquin, San Mateo, Santa Clara,
              and Sonoma. The state has periodically proposed expansion. The current participating-county list lives on the DHCS
              ALW page and should always be checked there before relying on what any directory (including this one) says about
              a specific county.
            </p>
            <p>
              <strong className="font-medium text-ink">How a family gets in.</strong> A person must first qualify for
              full-scope Medi-Cal — the financial side. They must then meet the level-of-care criteria for nursing facility
              placement, which sounds counterintuitive for memory care but is the federal hoop the waiver structure requires.
              They are then placed on the ALW waitlist managed by DHCS. Wait times vary by county and have historically ranged
              from a few months to over two years. Once a slot opens, the resident chooses among participating facilities in
              their county.
            </p>
            <p>
              <strong className="font-medium text-ink">What ALW pays.</strong> The waiver pays the facility a daily services
              rate set by the state, sorted into tiers based on the resident&apos;s care needs. This covers personal care,
              supervision, medication assistance, and the dementia-specific programming components of memory care. It does{" "}
              <strong className="font-medium text-ink">not</strong> cover room and board. Room and board is paid by the
              resident from their SSI/SSP benefit, which is capped at a state-set figure — roughly $1,200 per month in 2026,
              adjusted annually.
            </p>
            <p>
              <strong className="font-medium text-ink">What this means for the family&apos;s actual monthly bill.</strong> A
              resident on ALW in a participating memory care facility typically pays the SSI room-and-board portion plus a
              small share-of-cost contribution if their income exceeds the threshold. The total out-of-pocket figure is
              usually in the $1,500 to $2,500 per month range — compared to $5,000 to $15,000 per month for the same facility on
              private pay. The state pays the difference directly to the facility.
            </p>
            <p>
              <strong className="font-medium text-ink">Why not every facility participates.</strong> ALW is voluntary for
              facilities. The state&apos;s services rate is below most facilities&apos; published private-pay rates, so
              participation is a margin decision. Facilities that participate often cap their ALW resident count at a specific
              number of beds. The practical implication: even in an ALW-participating county, the universe of facilities that
              will accept an ALW resident is meaningfully smaller than the full RCFE roster.
            </p>
          </Prose>

          <H2 id="when-alw-fits">When ALW is the right path, and when it isn&apos;t</H2>
          <Prose>
            <p>
              There is no universal threshold, and nothing on this page is medical, financial, or legal advice for your
              specific situation. There are, however, common patterns that help families identify whether ALW is worth pursuing
              as the primary path.
            </p>
            <p>
              ALW tends to be the right path when the person needs assisted-living-level memory care rather than skilled
              nursing; when the family lives in (or can establish residency in) a participating county; when the household
              income and assets are at or near Medi-Cal eligibility limits or can be planned toward them; when the family can
              tolerate a wait; and when they are willing to choose among the subset of facilities that participate.
            </p>
            <p>
              ALW tends to be the wrong path, or at least not the only path, when the person needs skilled nursing rather than
              residential memory care — that is a different Medi-Cal benefit. It is also a poor fit when placement is medically
              urgent and waiting is not viable; when the family is not in a participating county and is not in a position to
              relocate; when household income and assets are well above Medi-Cal limits and asset planning is not on the table;
              or when the family has already identified a specific facility that does not participate and is unwilling to
              consider alternatives.
            </p>
            <p>
              A common middle-ground move is to apply for Medi-Cal and request placement on the ALW waitlist while paying
              privately at a participating or non-participating facility. If a slot opens at a participating facility while
              the resident is in a non-participating one, the family then makes a transition decision. This is a real strategy,
              not a workaround, and it is the most common path for families who can afford private pay short-term but cannot
              sustain it for years.
            </p>
          </Prose>

          <H2 id="financial-mechanics">The financial mechanics (share of cost, room and board, and what facilities still quote)</H2>
          <Prose>
            <p>
              Three pieces of vocabulary do most of the work in this conversation, and they are worth understanding before any
              phone call with an eligibility worker or a facility&apos;s admissions director.
            </p>
            <p>
              <strong className="font-medium text-ink">Share of Cost (SOC)</strong> is the amount a Medi-Cal recipient pays
              each month before Medi-Cal begins paying. It applies when household income exceeds the program&apos;s maintenance
              need standard, which for an individual is several hundred dollars per month. The SOC must be incurred (paid or
              owed for medical or care services) before the Medi-Cal coverage activates that month. The math is recalculated
              each month. For families with a working spouse or pension income, SOC is often the deciding variable in whether
              ALW is workable.
            </p>
            <p>
              <strong className="font-medium text-ink">Room and board</strong> is the housing-and-meals portion of an RCFE bill.
              ALW does not cover it. The resident pays it from SSI/SSP, capped at the state-set rate. For families used to seeing
              a single all-in monthly figure on a private-pay quote, the carve-out between services (covered by ALW) and room
              and board (covered by the resident) is unfamiliar and important.
            </p>
            <p>
              <strong className="font-medium text-ink">A&amp;D FPL</strong> — the Aged &amp; Disabled Federal Poverty Level
              program — is a separate Medi-Cal pathway that, for individuals 65 or older or with a qualifying disability,
              provides full Medi-Cal without share of cost up to 138 percent of the federal poverty level. It is the most
              under-explained Medi-Cal door for memory care families, and worth asking your eligibility worker about by name.
            </p>
            <p>
              <strong className="font-medium text-ink">What facilities still quote.</strong> A participating facility&apos;s
              published monthly rate is its private-pay rate. The ALW combination of state-paid services plus resident-paid
              room and board is a different number, and a facility&apos;s marketing or admissions staff will not always
              volunteer it. The right question on a tour is direct: &ldquo;Do you accept the Assisted Living Waiver, how many
              ALW residents do you currently serve, and what would the all-in monthly cost look like for an ALW resident at the
              care tier this person would need?&rdquo;
            </p>
          </Prose>

          <H2 id="what-to-ask">What to ask, and who to ask</H2>
          <Prose>
            <p>Three different conversations carry the weight of this process. The questions are different in each.</p>
            <p>
              <strong className="font-medium text-ink">With your county Medi-Cal eligibility worker:</strong> What is my
              expected share of cost given the household income? Do I qualify under A&amp;D FPL? What documentation is needed
              for the long-term care application, and what triggers the asset look-back? Can I be enrolled in Medi-Cal while I
              wait for an ALW slot?
            </p>
            <p>
              <strong className="font-medium text-ink">With DHCS or the ALW intake line:</strong> Is my county participating?
              What is the current waitlist length? How is priority determined? Can I get on the waitlist before placement is
              urgent?
            </p>
            <p>
              <strong className="font-medium text-ink">With a facility&apos;s admissions director (not the marketing director):</strong>{" "}
              Do you accept ALW? How many ALW residents are currently served? What is your historical wait for an ALW bed? Will
              you hold a private-pay placement and convert to ALW when a slot opens?
            </p>
            <p>
              Ask the longest-tenured caregiver on the floor what they would change about the place if they could. The answer
              is the same diagnostic on a Medi-Cal-funded tour as on a private-pay tour, and it cuts through marketing in
              either direction.
            </p>
          </Prose>

          <H2 id="starlynncare-records">How StarlynnCare uses these public records</H2>
          <Prose>
            <p>
              The participating-facility list for ALW is published by DHCS. We cross-reference DHCS&apos;s list against the
              Community Care Licensing roster on the same quarterly cadence we refresh the rest of the California facility data,
              and surface ALW participation as a data point on each facility profile where it applies. Where waitlist data is
              available at the county level, we link to it directly rather than republishing it, because the underlying numbers
              shift more often than a static page can keep accurate.
            </p>
            <p>
              The reason the no-payment posture matters here specifically is that participating facilities operate on tighter
              margins than private-pay-only facilities, and a directory that took referral fees from operators would have an
              incentive to under-represent ALW participation as an option. We do not. The full funding model is in our{" "}
              <Link href="/editorial-policy" className="text-teal underline underline-offset-4">
                editorial policy
              </Link>
              .
            </p>
          </Prose>

          <DataFootnote
            source="Educational overview · consult DHCS, county Medi-Cal, or a certified benefits advisor for eligibility"
            refreshed={DATE_PUBLISHED}
            note="Policies and county participation change. Verify ALW county lists and rates on the official DHCS site before making financial decisions."
          />

          <div className="mt-16 border-t border-paper-rule pt-12 space-y-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust">
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
                <Link href="/library/memory-care-vs-nursing-home" className="text-teal underline underline-offset-4">
                  Memory care vs. nursing home
                </Link>{" "}
                — how the two settings differ regulatorily and financially
              </li>
              <li>
                <Link href="/california/cost-guide" className="text-teal underline underline-offset-4">
                  Cost of memory care in California
                </Link>{" "}
                — private-pay regional bands and what drives the spread
              </li>
              <li>
                <Link href="/california/glossary" className="text-teal underline underline-offset-4">
                  California memory care glossary
                </Link>{" "}
                — plain-language definitions of citation types, regulatory terms, and care levels
              </li>
              <li>
                <Link href="/california/37-questions-to-ask-on-a-tour" className="text-teal underline underline-offset-4">
                  37 questions to ask on a memory care tour
                </Link>{" "}
                — printable tour prompts including ALW-specific questions
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
              . This page describes how California&apos;s Medi-Cal program covers memory care; it is not medical, legal, or
              financial advice for an individual person or facility.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
