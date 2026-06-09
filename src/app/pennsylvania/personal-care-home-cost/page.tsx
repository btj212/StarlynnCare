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

const PAGE_PATH = "/pennsylvania/personal-care-home-cost";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "What Does a Personal Care Home Cost in Pennsylvania?";
const TITLE =
  "Personal Care Home Cost in Pennsylvania — 2024 Monthly Ranges, Fees & Medicaid";
const DESC =
  "Pennsylvania personal care home (PCH) and memory care ALR costs range from $4,000–$8,500/month depending on location, care level, and Special Care designation. Here is what drives the price and what Medicaid does — and does not — cover.";
const DATE_PUBLISHED = "2026-06-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "How much does a personal care home cost in Pennsylvania per month?",
    a: "Typical monthly costs for a licensed Personal Care Home (PCH) or Assisted Living Residence (ALR) in Pennsylvania range from approximately $4,000 to $8,500 per month, depending on location, care level, and whether the facility operates a Special Care memory care unit. Philadelphia-area and suburban facilities tend to be at the higher end; rural central and western PA facilities are often at the lower end. These are planning estimates based on Genworth 2024 regional data — get written rate sheets from each facility you tour, as base rates and add-on fees vary significantly.",
  },
  {
    q: "What is typically included in the monthly rate?",
    a: "Most PA PCH and ALR base rates include room, meals, housekeeping, laundry, and basic personal care assistance (bathing, dressing, grooming). Medication management, incontinence supplies, specialized dementia programming, and transportation are often billed as add-ons. Before signing any contract, ask for a complete fee schedule — not just the base rate — and a written list of what triggers a care-level reassessment and corresponding rate increase.",
  },
  {
    q: "Does Pennsylvania Medicaid pay for a personal care home?",
    a: "Pennsylvania Medicaid (Medical Assistance) does not cover room and board in a PCH or ALR. MA can fund personal care services for eligible residents through HealthChoices managed care organizations, but not the facility's base daily rate. The LIFE program (Living Independently for Elders, Pennsylvania's PACE-equivalent) provides more comprehensive coverage — including room, board, and medical services — at enrolled sites for residents meeting nursing-facility level of care criteria, but LIFE enrollment sites are limited and waitlists exist. Families whose primary concern is Medicaid coverage of room and board should also explore Medicaid-certified nursing homes with secured dementia units.",
  },
  {
    q: "Is memory care more expensive than standard assisted living in Pennsylvania?",
    a: "Generally yes. PA PCH and ALR facilities with a DHS-recognized Special Care or Secure Dementia Care Unit designation typically charge a premium above their standard personal care rate — often $300–$800 more per month — to cover dementia-specific staffing training, secured unit maintenance, and programming. Facilities with an Assisted Living — Special Care license (the ALR subtype specifically for dementia care) may charge even more due to higher staffing ratios and care intensity requirements.",
  },
  {
    q: "What questions should I ask about cost before signing a contract?",
    a: "Ask for the complete fee schedule including all add-ons, the care-level reassessment policy and what triggers a rate increase, the notice period before a rate change, the discharge policy and conditions that require you to leave, and whether the facility accepts any MA waiver programs or has sliding-scale options. Ask specifically about what happens to cost if your loved one's care needs increase — facilities that cannot meet escalating needs will discharge, and the cost of moving is real.",
  },
  {
    q: "How do I compare cost against quality for PA personal care homes?",
    a: "Cost alone is not a reliable quality signal. Some of Pennsylvania's most expensive facilities have serious PA DHS OLTL inspection records; some lower-cost rural facilities have clean records. On StarlynnCare, every PA facility profile shows the full DHS OLTL inspection record alongside the facility's location, bed count, and license type — so you can assess inspection history and peer rank before calling for a price quote.",
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: canonicalUrl,
    type: "article",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
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
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">
      {children}
    </div>
  );
}

export default function PersonalCareHomeCostPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Pennsylvania", url: canonicalFor("/pennsylvania") },
      { name: "Pennsylvania guides", url: canonicalFor("/pennsylvania/guides") },
      { name: "Personal care home cost", url: canonicalUrl },
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
              <Link href="/pennsylvania" className="hover:text-teal transition-colors">Pennsylvania</Link>
              <span aria-hidden>›</span>
              <Link href="/pennsylvania/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Personal care home cost</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Pennsylvania cost guide · PCH + ALR · 2024 benchmarks
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          <aside className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6 text-[16px] leading-[1.7] text-ink-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">
              The short version
            </p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>
                PA PCH and ALR memory care typically runs{" "}
                <strong className="font-medium text-ink">$4,000–$8,500/month</strong>. Philadelphia
                suburbs and high-demand corridors are at the top of that range.
              </li>
              <li>
                The base rate rarely covers everything. Add-ons for incontinence care, medication
                management, and specialized memory care programming often add{" "}
                <strong className="font-medium text-ink">$300–$1,000+/month</strong>.
              </li>
              <li>
                <strong className="font-medium text-ink">Pennsylvania Medicaid does not pay
                room and board</strong> in a PCH or ALR. MA funds personal care services only.
              </li>
              <li>
                Cost is not a quality signal. Check the DHS OLTL inspection record on each
                StarlynnCare profile before calling for a rate quote.
              </li>
            </ul>
          </aside>

          <H2 id="ranges">Statewide cost ranges for 2024</H2>
          <Prose>
            <p>
              Based on Genworth 2024 Cost of Care regional data and PA DHS OLTL rate guidance,
              Pennsylvania personal care homes and assisted living residences with memory care
              designations typically fall in the following ranges:
            </p>
          </Prose>

          <div className="mt-6 overflow-x-auto rounded-lg border border-paper-rule">
            <table className="w-full text-[15px] leading-[1.6]">
              <thead>
                <tr style={{ background: "var(--color-paper-2)" }}>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Region
                  </th>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Typical monthly range
                  </th>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-rule text-ink-2">
                <tr className="align-top">
                  <td className="px-4 py-3 font-medium text-ink">Philadelphia metro &amp; suburbs</td>
                  <td className="px-4 py-3">$5,500–$8,500/mo</td>
                  <td className="px-4 py-3 text-[14px]">Chester, Montgomery, Bucks, Delaware counties at high end</td>
                </tr>
                <tr className="align-top">
                  <td className="px-4 py-3 font-medium text-ink">Pittsburgh metro</td>
                  <td className="px-4 py-3">$4,500–$7,500/mo</td>
                  <td className="px-4 py-3 text-[14px]">Allegheny County; suburban corridors closer to high end</td>
                </tr>
                <tr className="align-top">
                  <td className="px-4 py-3 font-medium text-ink">Central PA (Harrisburg, Lancaster, York)</td>
                  <td className="px-4 py-3">$4,200–$7,000/mo</td>
                  <td className="px-4 py-3 text-[14px]">Broad range; newer ALR-Special Care facilities higher</td>
                </tr>
                <tr className="align-top">
                  <td className="px-4 py-3 font-medium text-ink">Rural PA</td>
                  <td className="px-4 py-3">$4,000–$6,000/mo</td>
                  <td className="px-4 py-3 text-[14px]">Lower labor costs; fewer specialty options</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[13px] text-ink-4 font-[family-name:var(--font-mono)]">
            Planning estimates only. Get written rate sheets from each facility you tour.
          </p>

          <H2 id="what-drives-cost">What drives the cost difference</H2>
          <Prose>
            <p>
              Several factors push a facility&apos;s rate above or below the state median:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="font-medium text-ink">License type.</strong> ALR-Special Care
                facilities face more intensive staffing requirements than PCHs, and typically charge
                more. The dementia-specific programming, secured unit infrastructure, and licensing
                overhead are priced into the rate.
              </li>
              <li>
                <strong className="font-medium text-ink">Location.</strong> Suburban Philadelphia
                and Pittsburgh facilities compete for higher-income markets and pay higher labor
                costs — both drive rates up. Rural facilities operate with lower overhead and
                generally charge less.
              </li>
              <li>
                <strong className="font-medium text-ink">Room type.</strong> Private rooms cost
                more than shared rooms, often $400–$1,000 more per month. Some facilities only
                offer private rooms in their memory care unit.
              </li>
              <li>
                <strong className="font-medium text-ink">Care-level tier.</strong> Most facilities
                assess residents on a points or tier system. Higher care needs move a resident to
                a higher tier with a higher monthly rate. Ask how often reassessments happen and
                what the typical cost step is between tiers.
              </li>
              <li>
                <strong className="font-medium text-ink">Add-ons.</strong> Incontinence supplies,
                one-on-one companion hours, specialized therapies, and transportation are billed
                separately at most facilities. Always request the full fee schedule.
              </li>
            </ul>
          </Prose>

          <H2 id="medicaid">What Pennsylvania Medicaid covers</H2>
          <Prose>
            <p>
              This is the most consequential financial fact for PA families:
            </p>
            <p>
              <strong className="font-medium text-ink">Pennsylvania Medical Assistance (Medicaid)
              does not pay room and board in a PCH or ALR.</strong> MA can fund personal care
              services — assistance with ADLs, supervision, medication management — through
              HealthChoices managed care organizations for eligible residents. But the facility&apos;s
              base daily rate, which covers room and meals, must be paid from private funds, long-term
              care insurance, or other sources.
            </p>
            <p>
              The <strong className="font-medium text-ink">LIFE program</strong> (Living
              Independently for Elders) is Pennsylvania&apos;s PACE-equivalent program. It provides
              comprehensive coverage including room, board, medical care, and personal care for
              dually eligible (Medicare + Medicaid) residents who meet nursing-facility level of care
              criteria. LIFE enrollment sites are limited and located primarily in urban centers —
              search the PA DHS LIFE program directory for enrolled sites near you.
            </p>
            <p>
              Families who need Medicaid to cover room and board should also evaluate
              Medicaid-certified nursing homes (SNFs) with secured dementia units. The clinical
              environment is more intensive, but full MA coverage is available for eligible
              residents. These are indexed separately on StarlynnCare using CMS Care Compare data.
            </p>
          </Prose>

          <H2 id="inspection-vs-cost">Cost is not a quality signal — use the inspection record</H2>
          <Prose>
            <p>
              Pennsylvania&apos;s most expensive PCH and ALR facilities are not necessarily the
              ones with the cleanest inspection records. Some of the most serious DHS OLTL
              findings — Immediate Jeopardy citations, Substantiated Abuse findings — appear
              in affluent suburban facilities that charge above-market rates.
            </p>
            <p>
              Before requesting a rate quote from any PA facility, look at its DHS OLTL inspection
              record on StarlynnCare. The record shows every citation, the specific 55 Pa Code
              regulation violated, the enforcement classification, and the peer percentile
              positioning the facility against other PA memory care facilities in its county. A
              facility that charges $7,000/month with five Immediate Jeopardy findings in three
              years is not a premium facility — it is an expensive one.
            </p>
          </Prose>

          <H2 id="faq">Frequently asked questions</H2>
          <div className="space-y-8 mt-6">
            {FAQ_PAIRS.map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-[family-name:var(--font-display)] font-normal text-[18px] leading-[1.25] text-ink mb-2">
                  {q}
                </h3>
                <p className="text-[16px] leading-[1.7] text-ink-2">{a}</p>
              </div>
            ))}
          </div>

          <DataFootnote
            source="Genworth Cost of Care Survey 2024; PA DHS OLTL rate guidance; Pennsylvania HealthChoices managed care; PA LIFE program (PACE); CMS Care Compare"
            refreshed={DATE_PUBLISHED}
          />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/pennsylvania/what-is-a-personal-care-home"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  What is a personal care home in Pennsylvania?
                </p>
              </Link>
              <Link
                href="/pennsylvania/personal-care-home-vs-assisted-living"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  Personal care home vs. assisted living in Pennsylvania
                </p>
              </Link>
              <Link
                href="/pennsylvania/memory-care-vs-nursing-home"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  Memory care vs. nursing home in Pennsylvania
                </p>
              </Link>
              <Link
                href="/pennsylvania/facilities"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  Browse all Pennsylvania memory care facilities
                </p>
              </Link>
            </div>
            <Link
              href="/pennsylvania/guides"
              className="mt-4 inline-block text-[14px] text-teal hover:underline"
            >
              ← All Pennsylvania guides
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
