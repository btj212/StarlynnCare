import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";
import { STARLYNN_EDITORIAL_REVIEWER } from "@/lib/seo/editor";
import { StatBlock, type StatItem } from "@/components/editorial/StatBlock";
import { DataFootnote } from "@/components/editorial/DataFootnote";

const PAGE_PATH = "/library/memory-care-cost-california";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "What Memory Care Costs in California (2026)";
const DESC =
  "Monthly cost ranges for memory care in California by region, what drives the price, how to compare facilities, and why Medi-Cal and Medicare do not typically cover RCFE memory care costs.";
const DATE_PUBLISHED = "2026-05-02";

export const metadata: Metadata = {
  title: `${TITLE} | StarlynnCare`,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
    url: canonicalUrl,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonicalUrl}#article`,
    headline: TITLE,
    description: DESC,
    url: canonicalUrl,
    datePublished: DATE_PUBLISHED,
    dateModified: DATE_PUBLISHED,
    author: { "@type": "Organization", name: "StarlynnCare", url: SITE_ORIGIN },
    reviewedBy: { "@type": "Person", name: STARLYNN_EDITORIAL_REVIEWER },
    publisher: { "@type": "Organization", name: "StarlynnCare", url: SITE_ORIGIN },
    isPartOf: { "@type": "WebSite", name: "StarlynnCare", url: SITE_ORIGIN },
    about: { "@type": "Place", name: "California, USA" },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Library", item: canonicalFor("/library") },
      { "@type": "ListItem", position: 3, name: "Memory care cost in California", item: canonicalUrl },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: canonicalUrl,
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does memory care cost in California per month?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Memory care in California typically costs between $5,500 and $12,000 per month in 2026, depending on region, facility size, and level of care. The statewide median is approximately $6,800 per month. Bay Area facilities average $8,000–$12,000 per month, while Inland Empire and Sacramento region facilities range from $5,500–$7,500.",
        },
      },
      {
        "@type": "Question",
        name: "Does Medicare pay for memory care in California?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Medicare does not cover the cost of ongoing room and board in a memory care RCFE. Medicare Part A may cover short-term skilled nursing care after a qualifying hospital stay, but that is not the same as memory care residential placement. Most families pay out-of-pocket or use long-term care insurance.",
        },
      },
      {
        "@type": "Question",
        name: "Does Medi-Cal pay for memory care facilities in California?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Medi-Cal generally does not pay for RCFE-licensed memory care facilities. Medi-Cal does fund some in-home and community-based services (HCBS waiver programs), and it covers skilled nursing facility (SNF) care for eligible beneficiaries, but most RCFE-based memory care programs are private-pay only.",
        },
      },
      {
        "@type": "Question",
        name: "What is included in the monthly fee for memory care?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most California memory care facilities include room and board, meals, medication management, personal care assistance, dementia-specific programming, and 24-hour supervision in the base monthly rate. Additional charges may apply for higher acuity personal care, incontinence supplies, physical or occupational therapy, and specialized behavioral support.",
        },
      },
    ],
  },
];

const REGIONAL_STATS: StatItem[] = [
  {
    n: "$8,000–$12,000",
    unit: "/ mo",
    label: "Bay Area (Alameda, Contra Costa, San Mateo, Santa Clara counties)",
    src: "Genworth 2024",
  },
  {
    n: "$6,500–$9,500",
    unit: "/ mo",
    label: "Southern California (Los Angeles, Orange, San Diego counties)",
    src: "Genworth 2024",
  },
  {
    n: "$5,500–$7,500",
    unit: "/ mo",
    label: "Sacramento region and Inland Empire",
    src: "Genworth 2024",
  },
  {
    n: "~$6,800",
    unit: "/ mo",
    label: "Statewide median monthly cost, all regions",
    src: "Genworth 2024",
  },
];

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
      {children}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-8 border-l-[3px] border-rust pl-5 py-1 text-[15px] leading-[1.65] text-ink-2 max-w-[66ch]">
      {children}
    </div>
  );
}

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

export default function MemoryCareCostPage() {
  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        {/* ── Header ── */}
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/library" className="hover:text-teal transition-colors">Library</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care cost</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Cost guide
            </div>
            <h1
              className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,56px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5"
            >
              What memory care costs in California — <em>by region.</em>
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">
              Monthly cost ranges, what drives the price difference between facilities,
              and what Medicare and Medi-Cal actually cover (and don&apos;t).
            </p>
            <p className="mt-4 font-[family-name:var(--font-mono)] text-[11px] text-ink-4 tracking-[0.06em]">
              By {STARLYNN_EDITORIAL_REVIEWER} · Published {DATE_PUBLISHED}
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">

          <H2 id="regional-costs">Cost by California region</H2>
          <Prose>
            <p>
              Memory care in California is priced significantly higher than the national average,
              driven by labor costs, real-estate overhead, and the state&apos;s heightened staffing
              requirements for licensed dementia care programs. Costs vary substantially by
              region.
            </p>
          </Prose>
          <div className="mt-6">
            <StatBlock
              stats={REGIONAL_STATS}
              footnotes={[
                "Genworth 2024 Cost of Care Survey, California. Ranges reflect mid-tier RCFE memory care; luxury / specialized behavioral units can exceed the upper bound.",
                "StarlynnCare does not independently verify operator-submitted rate data. Use these ranges for comparison only; confirm current pricing directly with each facility.",
              ]}
            />
          </div>

          <H2 id="whats-included">What the monthly fee typically includes</H2>
          <Prose>
            <p>
              California RCFE memory care facilities generally include the following in the
              base monthly rate:
            </p>
          </Prose>
          <ul className="mt-4 space-y-2 text-[15.5px] leading-[1.65] text-ink-2 list-disc pl-6 max-w-[68ch]">
            <li>Private or semi-private room and board</li>
            <li>Three daily meals plus snacks, prepared to accommodate dietary needs</li>
            <li>24-hour supervision and safety monitoring</li>
            <li>Medication management and administration</li>
            <li>Personal care assistance (bathing, dressing, grooming, continence)</li>
            <li>
              Structured dementia-specific programming — required under California Title 22
              §87705 for licensed memory care units
            </li>
            <li>Housekeeping and laundry</li>
            <li>Transportation to medical appointments (varies by facility)</li>
          </ul>

          <H2 id="add-ons">Common add-on charges</H2>
          <Prose>
            <p>
              The following services are frequently billed separately, so they are worth asking
              about before signing an admission agreement:
            </p>
          </Prose>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-[14.5px] text-ink-2 border-collapse">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="text-left py-3 pr-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Service
                  </th>
                  <th className="text-left py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Typical extra cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-rule">
                {[
                  ["Higher-acuity personal care (e.g., two-person assist)", "$500–$1,500 / mo"],
                  ["Incontinence supplies", "$100–$300 / mo"],
                  ["Physical or occupational therapy (non-Medicare)", "$150–$250 / session"],
                  ["Behavioral support or 1:1 supervision", "$1,000–$3,000 / mo"],
                  ["Companion/sitter services", "$20–$30 / hr"],
                  ["Medication pharmacy dispensing fee", "$50–$150 / mo"],
                ].map(([service, cost]) => (
                  <tr key={service}>
                    <td className="py-3 pr-6 text-ink-2">{service}</td>
                    <td className="py-3 font-[family-name:var(--font-mono)] text-[13px] text-rust">
                      {cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataFootnote
            source="California RCFE admission agreements · CANHR consumer guidance"
            refreshed={DATE_PUBLISHED}
          />

          <H2 id="medicare-medicaid">Medicare and Medi-Cal coverage</H2>

          <Callout>
            Neither Medicare nor Medi-Cal typically covers ongoing room and board in a California
            RCFE memory care facility. Most families pay out of pocket, draw on long-term care
            insurance, or use Veterans benefits.
          </Callout>

          <Prose>
            <p>
              <strong>Medicare</strong> covers medically necessary services, not residential
              care. Medicare Part A will pay for short-term skilled nursing care after a
              qualifying 3-day hospital stay (up to 100 days), but that is discharge-to-SNF
              coverage, not placement in an RCFE. Once a person moves into a memory care
              RCFE, Medicare will still cover physician visits, some outpatient therapy, and
              prescription drugs (Part D) — but not the monthly facility fee.
            </p>
            <p>
              <strong>Medi-Cal</strong> (California&apos;s Medicaid program) funds some
              community-based home care programs (such as In-Home Supportive Services and
              HCBS waivers) for people who meet income and asset thresholds. Medi-Cal also
              pays for care in certified Skilled Nursing Facilities. However, most
              RCFE-licensed memory care facilities are private-pay only — they are not
              Medi-Cal-certified providers. A small number of facilities do accept Medi-Cal
              Community-Based Adult Services (CBAS) funding for day programming, but this
              does not cover residential costs.
            </p>
          </Prose>

          <H2 id="private-pay-options">Private-pay and funding options</H2>
          <Prose>
            <p>Families who need to fund RCFE memory care typically use:</p>
          </Prose>
          <ul className="mt-4 space-y-2.5 text-[15.5px] leading-[1.65] text-ink-2 list-disc pl-6 max-w-[68ch]">
            <li>
              <strong>Personal savings or investments</strong> — the most common source; plan
              for 2–5 years of costs at today&apos;s rates, accounting for annual increases of 4–8%.
            </li>
            <li>
              <strong>Long-term care insurance</strong> — policies purchased before age 65
              typically cover RCFE costs; check the policy&apos;s benefit trigger language for
              &ldquo;cognitive impairment&rdquo; and the elimination period (often 90 days).
            </li>
            <li>
              <strong>Veterans benefits (Aid &amp; Attendance)</strong> — eligible veterans and
              surviving spouses may qualify for up to ~$2,700/mo (veteran + spouse, 2025
              rates) through the VA Pension with Aid &amp; Attendance supplement.
            </li>
            <li>
              <strong>Home sale proceeds</strong> — equity from selling a primary residence
              is often used to fund the first 2–4 years of care.
            </li>
            <li>
              <strong>Medicaid spend-down</strong> — once a resident&apos;s assets fall below
              Medi-Cal thresholds, some facilities will accept Medi-Cal for SNF-level care,
              but most RCFEs require private pay throughout. Ask each facility directly
              about their policy.
            </li>
          </ul>

          <H2 id="how-to-compare">How to compare costs across facilities</H2>
          <Prose>
            <p>
              Base monthly rates are rarely the full story. When comparing facilities, ask for
              a complete fee schedule — not just the starting rate — and request a sample
              admission agreement to review what is included and what triggers additional
              charges.
            </p>
            <p>
              Quality-adjusted cost is what matters most. A facility charging $7,500 per month
              with a clean inspection record and no substantiated complaints often represents
              better value than one charging $6,000 per month with repeat Type A deficiency
              citations. StarlynnCare&apos;s facility profiles show both price indicators and
              inspection history side by side so you can make a direct comparison.
            </p>
          </Prose>

          <div className="mt-10 pt-8 border-t border-paper-rule flex flex-col gap-3 text-[14px] text-ink-3">
            <p>
              <Link href="/california" className="text-teal underline underline-offset-4 hover:text-teal/80">
                Browse California memory care facilities →
              </Link>
            </p>
            <p>
              <Link
                href="/library/type-a-vs-type-b-deficiencies-explained"
                className="text-teal underline underline-offset-4 hover:text-teal/80"
              >
                What do Type A and Type B deficiencies mean? →
              </Link>
            </p>
            <p>
              <Link href="/methodology" className="text-teal underline underline-offset-4 hover:text-teal/80">
                How StarlynnCare grades facilities →
              </Link>
            </p>
          </div>
          <DataFootnote
            source="Genworth 2024 Cost of Care Survey · VA Aid & Attendance 2025 rates · California CANHR"
            refreshed={DATE_PUBLISHED}
            note="Cost ranges are estimates. Confirm current pricing directly with each facility."
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
