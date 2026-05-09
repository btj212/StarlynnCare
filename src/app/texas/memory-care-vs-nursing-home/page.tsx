import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { EditorialHero } from "@/components/editorial/EditorialHero";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/texas/memory-care-vs-nursing-home";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Memory care vs. nursing home in Texas — what's actually different, and how to tell which one your person needs";
const TITLE = "Memory Care vs. Nursing Home (SNF) in Texas (2026)";
const DESC =
  "ALF memory care vs. skilled nursing in Texas: HHSC licensing vs CMS certification, Care Compare vs HHSC LTCR inspections, Medicare short-stay rules, STAR+PLUS Medicaid waiver, and tour questions for Texas families.";
const DATE_PUBLISHED = "2026-05-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Is memory care the same as a nursing home in Texas?",
    a: "No. In Texas, memory care for Alzheimer's and dementia is almost always provided in an Assisted Living Facility (ALF) with Alzheimer Certification, which is a state-licensed residential setting under Texas HHSC. A nursing home — a skilled nursing facility (SNF) — is a federally certified medical setting under the Centers for Medicare & Medicaid Services (CMS) and Texas HHSC. Different licensure, different staffing models, different funding sources.",
  },
  {
    q: "Will Medicare pay for memory care in Texas?",
    a: "No. Medicare does not cover long-term residential care in any setting, including Texas ALFs providing memory care. Medicare Part A covers short-term, post-hospital skilled nursing in narrow windows (typically up to 100 days with a qualifying hospital stay). Medicare Part B covers some medical services regardless of setting. Neither pays for the room, meals, supervision, or memory-care programming that defines a long-term ALF stay.",
  },
  {
    q: "Can Medicaid pay for memory care in Texas?",
    a: "Potentially, through the STAR+PLUS Home and Community Based Services (HCBS) waiver, which can cover personal care services in an ALF. However, the STAR+PLUS ALF benefit does not cover room and board — only the personal assistance services layered on top. Many Texas ALFs do not accept STAR+PLUS at all, and waitlists exist. The majority of long-term memory care in Texas is private pay. Consult a Texas benefits counselor at the Area Agency on Aging for your region before assuming STAR+PLUS will cover an ALF stay.",
  },
  {
    q: "What is the difference between HHSC LTCR inspections and CMS surveys?",
    a: "Texas ALFs (including memory care communities) are inspected by HHSC Long-Term Care Regulation (LTCR) on an annual cycle, plus complaint investigations. Texas skilled nursing facilities are surveyed by CMS through the Texas HHSC survey agency, with results published on CMS Care Compare (the star-rating site). The two inspection systems are separate — you cannot compare an ALF's HHSC LTCR inspection history to a SNF's Care Compare rating on the same scale. StarlynnCare shows HHSC LTCR inspection data for Texas ALFs on each facility profile.",
  },
  {
    q: "Can a Texas ALF admit someone who needs skilled nursing care?",
    a: "No. Texas ALFs — including Alzheimer-certified Type B facilities — are residential, non-medical settings. If a resident's needs require daily registered nurse assessment, IV therapy, wound care, ventilator support, or other skilled clinical interventions, the appropriate setting is a skilled nursing facility. Some ALFs accept residents on hospice (which adds clinical services through the Medicare hospice benefit), but that arrangement is distinct from licensed skilled nursing.",
  },
  {
    q: "Where can I find HHSC inspection data for a Texas memory care facility?",
    a: "HHSC LTCR publishes inspection findings at hhs.texas.gov/long-term-care/assisted-living-facilities. The reports are structured for regulators, not families, and require knowing the facility's HHSC license number. StarlynnCare parses these records into plain-language summaries on each Texas facility profile, with dates and source links to the original HHSC document.",
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

export default function TxMemoryCareVsNursingHomePage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Texas", url: canonicalFor("/texas") },
      { name: "Texas guides", url: canonicalFor("/texas/guides") },
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
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/texas" className="hover:text-teal transition-colors">Texas</Link>
              <span aria-hidden>›</span>
              <Link href="/texas/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care vs. nursing home</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Decision guide · Texas ALF memory care vs SNF
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
            <EditorialHero
              src="/illustrations/beach-grandparent-grandchild.png"
              alt="Illustrated grandparent and grandchild walking together on the beach — representing the lifestyle and dignity questions families weigh when choosing between memory care and a nursing home in Texas"
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
                A <em>nursing home</em> (SNF) is a federally certified medical setting. A{" "}
                <em>memory care community</em> in Texas is a residential assisted living facility (ALF) with Alzheimer
                Certification under HHSC — a non-medical setting with dementia-specific programming.
              </li>
              <li>
                Texas SNFs are inspected by CMS and rated on Care Compare. Texas ALFs are inspected by HHSC Long-Term
                Care Regulation — the two systems are not comparable on the same scale.
              </li>
              <li>
                Medicare does not pay for long-term memory care. Texas Medicaid (STAR+PLUS) can cover personal assistance
                services in some ALFs, but not room and board, and not all ALFs participate.
              </li>
              <li>
                The right setting is determined by clinical need and behavioral fit — not by which type feels safer in the
                abstract.
              </li>
            </ul>
          </aside>

          <H2 id="what-each-is">What each one actually is</H2>
          <Prose>
            <p>
              A <strong className="font-medium text-ink">skilled nursing facility</strong> — what most families call a
              &ldquo;nursing home&rdquo; — is a licensed medical setting. In Texas, SNFs are licensed by HHSC and
              federally certified by CMS when they bill Medicare or Medicaid. They maintain registered nurse coverage
              around the clock, admit residents who need ongoing skilled clinical care, and bill on a medical model. The
              standard staff mix is registered nurses, licensed vocational nurses, certified nursing assistants, and
              rehabilitation therapists.
            </p>
            <p>
              A <strong className="font-medium text-ink">memory care community</strong> in Texas is different. Almost all
              are Assisted Living Facilities (ALFs) with HHSC Alzheimer Certification — a residential, non-medical
              setting licensed under Texas Administrative Code Title 26, Chapter 553. ALFs are explicitly{" "}
              <strong className="font-medium text-ink">non-medical</strong>: they provide room, meals, activities,
              supervision, medication assistance, and help with activities of daily living. What makes a community
              &ldquo;memory care&rdquo; specifically is Alzheimer Certification — which requires dementia-specific
              programming, trained staff, and secured or monitored environments. The license class (Type A, B, or C)
              describes the resident population the facility can serve, not the quality of its dementia programming.
            </p>
            <p>
              These are two different licensure regimes, two different staffing models, and two different funding realities.
              Choosing between them is not a question of better or worse — it is a question of which level of clinical
              care and environmental structure matches the specific person&apos;s needs.
            </p>
          </Prose>

          <H2 id="two-regulators">Two regulators, two very different public records</H2>
          <Prose>
            <p>
              <strong className="font-medium text-ink">Texas skilled nursing facilities are surveyed by CMS, and results
              are published on Care Compare</strong> (medicare.gov/care-compare). Families can search any SNF and see its
              star rating, inspection reports, and staffing data in a standardized national format.
            </p>
            <p>
              <strong className="font-medium text-ink">Texas ALFs — including memory care communities — are inspected by
              HHSC Long-Term Care Regulation</strong> (LTCR) and reports are published at hhs.texas.gov. The HHSC portal
              is structured for regulators and licensing staff, not for families. StarlynnCare parses these records and
              shows them in plain language on each Texas facility profile, with direct links to source PDFs.
            </p>
            <p>
              Because the two inspection systems are entirely separate, you cannot meaningfully compare a Texas SNF&apos;s
              Care Compare rating against a Texas ALF&apos;s HHSC LTCR history using the same scale. They measure similar
              things through different frameworks, with different severity labels, different survey cycles, and different
              public-facing interfaces.
            </p>
          </Prose>

          <H2 id="medicare-and-medicaid">Medicare, Medicaid, and who pays</H2>
          <Prose>
            <p>
              <strong className="font-medium text-ink">Medicare does not pay for long-term memory care</strong> in any
              residential setting, including Texas ALFs. Medicare Part A covers short-term skilled nursing stays — up to
              100 days following a qualifying inpatient hospital stay — but only when the person needs skilled nursing or
              therapy services daily. It does not cover the room, meals, supervision, or programming costs of an ALF.
            </p>
            <p>
              <strong className="font-medium text-ink">Texas Medicaid can help through the STAR+PLUS waiver</strong>, but
              with important limits. STAR+PLUS is a managed Medicaid program administered through health plans. The
              Home and Community Based Services (HCBS) component of STAR+PLUS can cover{" "}
              <em>personal assistance services</em> provided in an ALF, but it does not pay room and board — the facility
              charges for those costs separately and they are typically private pay. Not all ALFs participate in
              STAR+PLUS, and waitlists exist. Before making a placement decision based on STAR+PLUS eligibility, verify
              that the specific facility accepts it and has current capacity.
            </p>
            <p>
              Long-term memory care in a Texas ALF is primarily{" "}
              <strong className="font-medium text-ink">private pay</strong> for most families. Monthly costs vary
              significantly by market, facility type, and care level. There is no statewide Texas equivalent to
              California&apos;s Assisted Living Waiver (ALW), though STAR+PLUS serves a similar purpose for qualifying
              low-income Texans.
            </p>
          </Prose>

          <H2 id="which-to-choose">When to choose each setting</H2>
          <Prose>
            <p>
              The decision between a Texas ALF memory care community and a skilled nursing facility comes down to{" "}
              <strong className="font-medium text-ink">clinical need</strong> — specifically, whether the person requires
              daily skilled nursing interventions. Questions to work through with the person&apos;s physician:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Does the person need daily wound care, IV therapy, ventilator management, or other skilled nursing
                services? If yes, a SNF is required.
              </li>
              <li>
                Is the person medically stable enough to live in a residential setting with medication assistance and
                personal care — without requiring daily RN-supervised skilled interventions? If yes, an ALF is appropriate.
              </li>
              <li>
                Does the person have behavioral symptoms of dementia — wandering, agitation, sundowning — that require
                a secured environment and trained dementia staff? A Type B ALF with Alzheimer Certification is designed
                for this.
              </li>
              <li>
                Is the person on hospice? Both ALFs and SNFs can serve hospice residents. Hospice services layer clinical
                care on top of the residential setting — this is distinct from needing the SNF level of care itself.
              </li>
            </ul>
          </Prose>

          <H2 id="tour-questions">Tour questions by setting</H2>
          <Prose>
            <p>
              When touring Texas memory care ALFs, ask specifically about HHSC Alzheimer Certification, license type,
              and inspection history — because these are not always proactively disclosed:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Is this facility Alzheimer-certified by HHSC? What is the license type (A, B, or C)?
              </li>
              <li>
                What does your overnight staffing look like? How many awake staff are on between 10pm and 6am? (For Type
                B, awake overnight staff is required. For Type A, ask anyway.)
              </li>
              <li>
                Has the facility had HHSC citations in the last 24 months? Can I see the most recent inspection report?
                (You can also find these on StarlynnCare.)
              </li>
              <li>
                Do you accept STAR+PLUS managed Medicaid? If so, which health plans and what is the current availability?
              </li>
              <li>
                What is the protocol when a resident&apos;s care needs exceed what the facility is licensed to provide?
              </li>
            </ul>
          </Prose>

          <H2 id="faq">Frequently asked questions</H2>
          <div className="mt-6 space-y-6">
            {FAQ_PAIRS.map((pair) => (
              <div key={pair.q} className="border-t border-paper-rule pt-5">
                <p className="font-[family-name:var(--font-display)] text-[18px] leading-[1.3] text-ink mb-3">
                  {pair.q}
                </p>
                <p className="text-[15.5px] leading-[1.7] text-ink-2">{pair.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-lg border border-paper-rule bg-paper-2 px-5 py-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-3">
              Continue reading
            </p>
            <ul className="space-y-3">
              <li>
                <Link href="/texas/type-a-b-c-licensing" className="text-teal hover:underline text-[16px]">
                  Type A, B, and C assisted living licensing in Texas →
                </Link>
              </li>
              <li>
                <Link href="/library/when-is-it-time-for-memory-care" className="text-teal hover:underline text-[16px]">
                  When is it time for memory care? →
                </Link>
              </li>
              <li>
                <Link href="/texas/guides" className="text-teal hover:underline text-[16px]">
                  All Texas guides & explainers →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
