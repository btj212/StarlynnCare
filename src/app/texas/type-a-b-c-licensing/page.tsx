import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";

const PAGE_PATH = "/texas/type-a-b-c-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Type A, B, and C assisted living in Texas — what each license class means for memory care";
const TITLE = "Type A, B, and C Assisted Living Licensing in Texas (HHSC) — 2026";
const DESC =
  "HHSC license classes describe facility capability, not deficiency severity. Learn what Type A, B, and C mean for memory care in Texas — Alzheimer Certification, staffing requirements, and how to read both on a StarlynnCare profile.";
const DATE_PUBLISHED = "2026-05-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the difference between a Type A, Type B, and Type C ALF in Texas?",
    a: "Texas classifies assisted living facilities (ALFs) by the level of care residents may need and the physical requirements of the building. Type A facilities serve residents who can evacuate without staff assistance within three minutes. Type B facilities serve residents who may need evacuation assistance, require 24-hour awake staff, and permit a higher degree of hands-on personal assistance. Type C ALFs are specifically for residents who are non-ambulatory and require extensive personal care. These license types reflect capability and physical plant design — they are not ratings of quality or safety. All three types can independently hold an Alzheimer Certification.",
  },
  {
    q: "What is HHSC Alzheimer Certification and how does it differ from license type?",
    a: "Alzheimer Certification is a separate, voluntary credential an ALF operator applies for from Texas Health and Human Services Commission (HHSC). Certification requires specialized staff training in dementia care, a structured activity program, and a secured or monitored environment for residents with cognitive impairment. An ALF can be Type A, B, or C and still hold — or not hold — Alzheimer Certification. StarlynnCare indexes only ALFs with active Alzheimer Certification where that data is available, because the certification signals dementia-specific programming beyond a standard ALF license.",
  },
  {
    q: "Is a Type B ALF safer for someone with advanced dementia?",
    a: "Not necessarily — 'safer' depends on the individual's clinical needs, not the license class alone. A Type B license means the building and staffing model can accommodate residents who need assistance evacuating and 24-hour awake staff coverage, which is relevant for residents with moderate to advanced dementia who may wander or need overnight support. But a Type A ALF with strong Alzheimer Certification programming and skilled dementia staff may still be a better clinical fit for an early-stage resident. Always cross-reference license type with Alzheimer Certification status, inspection history, and staff-to-resident ratios.",
  },
  {
    q: "What does HHSC LTCR inspect in an assisted living facility?",
    a: "HHSC Long-Term Care Regulation (LTCR) inspects Texas ALFs annually and following complaints. Inspectors look at resident rights, medication management, staffing levels, physical environment, dementia programming (for Alzheimer-certified facilities), emergency preparedness, and whether the facility's practices match its license type. Inspection findings are categorized by scope and severity — from isolated minor violations to widespread deficiencies that pose immediate risk. StarlynnCare shows these findings on each Texas facility profile with dates and source links to the HHSC record.",
  },
  {
    q: "Where can I find the HHSC inspection record for a specific Texas ALF?",
    a: "HHSC LTCR publishes inspection reports at hhs.texas.gov/long-term-care/assisted-living-facilities. The reports require knowing the facility's HHSC license number, and the PDFs are dense for families unfamiliar with regulatory language. StarlynnCare parses these records and surfaces them in plain language on each Texas facility profile, with a direct link to the source PDF.",
  },
  {
    q: "How is Texas ALF licensing different from California RCFE licensing?",
    a: "California uses a single license category — Residential Care Facility for the Elderly (RCFE) — regulated by CDSS Community Care Licensing. Deficiency severity in California is labeled Type A (immediate risk) and Type B (potential harm). Texas uses three ALF license classes (A, B, C) that describe facility capability, not deficiency severity. HHSC's deficiency scale uses different terminology. When reading a StarlynnCare profile, always check which state the facility is in — the labels mean different things. Our methodology page for each state explains the regulatory framework in detail.",
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

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-[family-name:var(--font-display)] font-normal text-[clamp(19px,2.5vw,26px)] leading-[1.15] tracking-[-0.005em] text-ink mt-10 mb-3">
      {children}
    </h3>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink-2 max-w-[72ch] space-y-5">{children}</div>
  );
}

function ComparisonTable() {
  const rows = [
    {
      attr: "Evacuation capability",
      typeA: "Can evacuate without staff help within 3 minutes",
      typeB: "May need staff evacuation assistance",
      typeC: "Non-ambulatory; requires full evacuation support",
    },
    {
      attr: "Overnight awake staff",
      typeA: "Not required by HHSC (may be on call)",
      typeB: "Required — 24-hour awake staff on duty",
      typeC: "Required — 24-hour awake staff on duty",
    },
    {
      attr: "Resident acuity",
      typeA: "Lower care needs; early cognitive impairment",
      typeB: "Moderate to higher care needs; may include advanced dementia",
      typeC: "Extensive care needs; non-ambulatory residents",
    },
    {
      attr: "Alzheimer Certification",
      typeA: "Optional — must apply separately from HHSC",
      typeB: "Optional — must apply separately from HHSC",
      typeC: "Optional — must apply separately from HHSC",
    },
    {
      attr: "Physical plant",
      typeA: "Standard ALF building requirements",
      typeB: "Enhanced requirements; secured perimeters common",
      typeC: "Medical-grade design; specific HHSC standards",
    },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[640px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">
              Factor
            </th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Type A
            </th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Type B
            </th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">
              Type C
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.attr}
              className="border-t border-paper-rule"
              style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}
            >
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">
                {row.attr}
              </td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.typeA}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.typeB}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.typeC}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TxTypeLicensingPage() {
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
      { name: "Type A, B, and C licensing", url: canonicalUrl },
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
              <span className="text-ink-3">Type A, B, and C licensing</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Texas licensing guide · HHSC ALF regulation
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(28px,4.5vw,48px)] leading-[1.08] tracking-[-0.02em] text-ink mt-3 mb-5">
              {ARTICLE_HEADLINE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[62ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
          {/* Short version callout */}
          <aside className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6 text-[16px] leading-[1.7] text-ink-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">
              The short version
            </p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>
                Texas HHSC license classes (Type A, B, C) describe{" "}
                <strong className="font-medium text-ink">what level of care a facility can provide</strong> — not how safe
                or good it is, and not how serious a deficiency is.
              </li>
              <li>
                <strong className="font-medium text-ink">Alzheimer Certification is separate</strong> from license type.
                Any Type A, B, or C ALF can apply for it. Certification requires dementia-specific programming, staff
                training, and secured or monitored environments.
              </li>
              <li>
                Texas&apos;s license class labels are{" "}
                <strong className="font-medium text-ink">unrelated to California&apos;s Type A / Type B deficiency
                severity labels</strong>. If you have used StarlynnCare for California facilities, do not carry that
                framing to Texas profiles.
              </li>
              <li>
                When evaluating a Texas memory care facility, look at:{" "}
                <strong className="font-medium text-ink">
                  license type + Alzheimer Certification status + HHSC inspection history
                </strong>
                {" "}— all three, together.
              </li>
            </ul>
          </aside>

          <H2 id="what-license-types-mean">What the three license types actually mean</H2>
          <Prose>
            <p>
              Texas Health and Human Services Commission (HHSC) licenses assisted living facilities under three classes
              defined in Title 26, Chapter 553 of the Texas Administrative Code. The classification determines which
              residents a facility can legally admit based on their care needs and evacuation capability — not on quality,
              staffing ratios, or clinical programming.
            </p>
          </Prose>

          <H3>Type A — Lower care needs, ambulatory residents</H3>
          <Prose>
            <p>
              A Type A ALF is designed for residents who can evacuate the building{" "}
              <strong className="font-medium text-ink">without staff assistance within three minutes</strong> of an alarm.
              In practice, this means residents are ambulatory or can move quickly with a walker or wheelchair under their
              own direction. HHSC does not require 24-hour awake staff for Type A facilities, although many operators
              choose to maintain overnight coverage.
            </p>
            <p>
              Type A facilities can and do serve residents with early-stage dementia — particularly those who are still
              mobile and oriented enough to respond to evacuation cues. If a Type A facility holds Alzheimer Certification,
              it has met HHSC&apos;s additional training and programming requirements for dementia care. But if a resident&apos;s
              dementia progresses to the point where they can no longer meet the three-minute evacuation standard, the
              facility is required to reassess whether the resident can remain.
            </p>
          </Prose>

          <H3>Type B — Moderate to higher care needs, 24-hour awake staff</H3>
          <Prose>
            <p>
              A Type B ALF serves residents who{" "}
              <strong className="font-medium text-ink">may need staff assistance to evacuate</strong> — a broader population
              that includes residents with moderate to advanced dementia, significant mobility limitations, or behavioral
              needs that require consistent overnight supervision. HHSC requires Type B facilities to maintain{" "}
              <strong className="font-medium text-ink">24-hour awake staff</strong> at all times, which is a meaningful
              structural difference from Type A.
            </p>
            <p>
              For families placing a loved one with moderate to advanced Alzheimer&apos;s disease, most memory care
              communities in Texas operate as Type B ALFs — because the residents they serve typically cannot meet the
              Type A evacuation standard. Secured or monitored perimeters, which are common in dementia care settings, are
              physically more compatible with Type B design.
            </p>
          </Prose>

          <H3>Type C — Non-ambulatory, extensive care needs</H3>
          <Prose>
            <p>
              A Type C ALF serves residents who are{" "}
              <strong className="font-medium text-ink">completely non-ambulatory</strong> and require extensive hands-on
              personal care. The physical plant requirements for Type C are more intensive, and these facilities are
              relatively uncommon in the Texas memory care market. Most memory care communities do not operate as Type C.
            </p>
          </Prose>

          <ComparisonTable />

          <H2 id="alzheimer-certification">Alzheimer Certification — the layer that matters most for memory care</H2>
          <Prose>
            <p>
              License type tells you what{" "}
              <em>capability tier</em> an ALF is built for. Alzheimer Certification tells you whether the operator has
              gone through HHSC&apos;s additional credentialing for dementia-specific care. The two are independent.
            </p>
            <p>
              To receive and maintain Alzheimer Certification, an ALF must:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Provide staff training specifically in Alzheimer&apos;s disease and related dementias, including
                communication strategies, behavioral symptom management, and end-of-life care
              </li>
              <li>
                Maintain a structured activity program designed for residents with cognitive impairment
              </li>
              <li>
                Implement a secured or monitored environment (where clinically indicated) to address wandering risk
              </li>
              <li>
                Disclose the certification status to residents and families before admission
              </li>
            </ul>
            <p>
              HHSC inspects Alzheimer-certified ALFs with the same survey cycle as all ALFs, but surveyors are directed
              to pay additional attention to dementia-specific care plan implementation and programming quality. StarlynnCare
              surfaces Alzheimer Certification status on each Texas facility profile.
            </p>
          </Prose>

          <H2 id="how-to-read-on-profile">How to read license type and certification on a StarlynnCare profile</H2>
          <Prose>
            <p>
              On a Texas facility profile, you will see the HHSC license class (Type A, B, or C) and whether the facility
              holds Alzheimer Certification displayed in the facility header alongside the facility name and address.
              Below that, the inspection history section shows all HHSC LTCR findings by date, with deficiency descriptions
              rendered in plain language and linked to the source PDF.
            </p>
            <p>
              When reading Texas inspection findings, note that HHSC uses its own severity and scope language for
              deficiencies — <em>not</em> California&apos;s Type A / Type B terminology. The inspection record tab on
              each profile explains what each finding category means in the context of HHSC&apos;s scale.
            </p>
            <p>
              To browse Texas memory care facilities with Alzheimer Certification:
            </p>
          </Prose>
          <div className="mt-6">
            <Link
              href="/texas"
              className="inline-flex items-center gap-2 border border-ink px-5 py-3 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-ink hover:bg-ink hover:text-paper transition-colors"
            >
              Browse Texas memory care facilities →
            </Link>
          </div>

          <H2 id="not-the-same-as-california">A note for families who have also used California profiles</H2>
          <Prose>
            <p>
              California uses a single RCFE license class for all residential memory care, regulated by CDSS Community
              Care Licensing. Deficiency severity in California is labeled{" "}
              <strong className="font-medium text-ink">Type A</strong> (immediate risk to health or safety) and{" "}
              <strong className="font-medium text-ink">Type B</strong> (potential for harm if not corrected) — and these
              labels refer to{" "}
              <em>inspection findings</em>, not facility capability.
            </p>
            <p>
              In Texas, Type A, B, and C describe the{" "}
              <em>facility&apos;s license class</em> — the population it is licensed to serve. A Texas &ldquo;Type A&rdquo; facility is
              not in any way analogous to a California &ldquo;Type A citation.&rdquo; They are different uses of the same alphabet
              in two separate regulatory systems.
            </p>
            <p>
              StarlynnCare renders each state&apos;s inspection data using that state&apos;s own regulatory terminology. When
              you compare a California profile and a Texas profile, the frameworks are different by design.
            </p>
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
                <Link href="/texas/memory-care-vs-nursing-home" className="text-teal hover:underline text-[16px]">
                  Memory care vs. nursing home (SNF) in Texas →
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
