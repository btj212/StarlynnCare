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

const PAGE_PATH = "/pennsylvania/personal-care-home-vs-assisted-living";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Personal Care Home vs. Assisted Living in Pennsylvania";
const TITLE =
  "Personal Care Home vs. Assisted Living in Pennsylvania — PCH, ALR & Memory Care Compared";
const DESC =
  "Pennsylvania uses 'Personal Care Home' (PCH) and 'Assisted Living Residence' (ALR) where most states say 'assisted living.' Here is how they differ on care level, staffing, inspections, and Medicaid — and what each means for memory care.";
const DATE_PUBLISHED = "2026-06-09";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "What is the difference between a Personal Care Home and Assisted Living in Pennsylvania?",
    a: "Pennsylvania licenses two types: Personal Care Homes (PCH, Chapter 2600) and Assisted Living Residences (ALR, Chapter 2800). A PCH provides personal care assistance and room/board for residents who do not need continuous nursing. An ALR provides a higher care level — including nursing oversight and more complex medication management — for residents with greater medical needs. Both are regulated by PA DHS OLTL. In most other states, both types would simply be called 'assisted living.' When a PA facility says 'assisted living,' ask whether it holds a PCH or ALR license.",
  },
  {
    q: "Which is better for memory care in Pennsylvania — a PCH or an ALR?",
    a: "Both can serve memory care residents when they hold a DHS-recognized Special Care or Secure Dementia Care Unit designation. The right choice depends on your loved one's medical complexity. An ALR can serve residents with more advanced dementia and greater physical care needs; a PCH is appropriate for residents who are more medically stable but need supervision, behavioral support, and dementia programming. Check the license type, the Special Care designation status, and — most importantly — the DHS OLTL inspection record for each facility before deciding.",
  },
  {
    q: "Does 'assisted living' in Pennsylvania mean the same thing as in other states?",
    a: "No. Pennsylvania uses 'Personal Care Home' where most states say 'assisted living.' What Pennsylvania calls an 'Assisted Living Residence' (ALR) is a higher-acuity license than a PCH, closer to what some states call 'enhanced assisted living' or 'residential care with nursing.' When comparing facilities across states on StarlynnCare, the state label on each profile identifies which regulatory system applies — PA DHS OLTL for PCH/ALR, vs CDSS for California RCFEs, HHSC for Texas ALFs, etc.",
  },
  {
    q: "Who inspects Personal Care Homes and ALRs in Pennsylvania?",
    a: "Both are inspected by PA DHS OLTL surveyors under 55 Pa Code (Ch 2600 for PCHs, Ch 2800 for ALRs). Annual routine surveys and complaint investigations follow the same general process. Enforcement severity labels — Citation, Civil Money Penalty, Provisional License, Immediate Jeopardy, Revocation — apply to both license types. StarlynnCare publishes the full DHS OLTL inspection record for each PA facility profile.",
  },
  {
    q: "Does Pennsylvania Medicaid cover assisted living or personal care homes?",
    a: "Pennsylvania Medicaid (Medical Assistance) does not pay room and board in a PCH or ALR. MA can fund personal care services through HealthChoices managed care for eligible residents, but not the daily base rate. By contrast, Medicaid-certified nursing homes (SNFs) do accept MA for room and board. The LIFE program (PACE-equivalent) provides a more comprehensive benefit at enrolled sites for residents meeting nursing-facility level of care, but LIFE enrollment sites are limited. If Medicaid coverage of room and board is a requirement, ask each facility about nursing home alternatives with secured dementia units.",
  },
  {
    q: "What is an 'Assisted Living — Special Care' license in Pennsylvania?",
    a: "Assisted Living — Special Care is a specific ALR license subtype under Chapter 2800 that designates the facility as focused on dementia and Alzheimer's care. It carries more intensive requirements for staff training, programming, and physical environment for memory care residents than a standard ALR license. Not all ALRs hold this designation — check the license type on each StarlynnCare PA profile or verify directly with PA DHS OLTL.",
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

type CompareRow = { label: string; pch: string; alr: string };
const COMPARE_ROWS: CompareRow[] = [
  { label: "License", pch: "PCH — 55 Pa Code Ch 2600", alr: "ALR — 55 Pa Code Ch 2800" },
  { label: "Regulator", pch: "PA DHS OLTL", alr: "PA DHS OLTL" },
  { label: "Care level", pch: "Personal care + ADL assistance; no continuous nursing", alr: "Nursing oversight; more complex medical needs" },
  { label: "Memory care designation", pch: "Special Care or Secure Dementia Care Unit", alr: "Special Care, Secure Dementia Care Unit, or Assisted Living — Special Care license" },
  { label: "Medicaid room & board", pch: "Not covered (MA funds services only)", alr: "Not covered (MA funds services only)" },
  { label: "Inspection record", pch: "DHS OLTL annual survey; 55 Pa Code citations", alr: "DHS OLTL annual survey; 55 Pa Code citations" },
];

export default function PchVsAssistedLivingPage() {
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
      { name: "PCH vs. assisted living", url: canonicalUrl },
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
              <span className="text-ink-3">PCH vs. assisted living</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Pennsylvania decision guide · PA DHS OLTL · PCH vs. ALR
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
                Pennsylvania calls residential care &quot;Personal Care Homes&quot; (PCH) and
                &quot;Assisted Living Residences&quot; (ALR) — not &quot;assisted living&quot; the
                way most states do. Both are regulated by{" "}
                <strong className="font-medium text-ink">PA DHS OLTL</strong>.
              </li>
              <li>
                A <strong className="font-medium text-ink">PCH</strong> is for residents needing
                personal care without continuous nursing. An{" "}
                <strong className="font-medium text-ink">ALR</strong> provides nursing oversight
                for higher medical complexity — including the{" "}
                <em>Assisted Living — Special Care</em> license for dementia-focused facilities.
              </li>
              <li>
                Both can serve memory care residents when they hold a{" "}
                <strong className="font-medium text-ink">Special Care</strong> or{" "}
                <strong className="font-medium text-ink">Secure Dementia Care Unit</strong>{" "}
                DHS designation.
              </li>
              <li>
                <strong className="font-medium text-ink">Neither PCH nor ALR</strong> has
                Medicaid room-and-board coverage. MA funds personal care services only.
              </li>
            </ul>
          </aside>

          <H2 id="why-terminology">Why Pennsylvania uses different terminology</H2>
          <Prose>
            <p>
              When families move to Pennsylvania from another state — or research facilities
              online using terms like &quot;assisted living near me&quot; — they often hit a
              naming wall. Pennsylvania&apos;s licensing structure uses terms that don&apos;t
              map cleanly onto the national vocabulary.
            </p>
            <p>
              What most states call &quot;assisted living&quot; is what Pennsylvania calls a{" "}
              <strong className="font-medium text-ink">Personal Care Home (PCH)</strong>. What
              Pennsylvania calls an <strong className="font-medium text-ink">Assisted Living
              Residence (ALR)</strong> is a higher-acuity license — roughly equivalent to what
              some states call &quot;enhanced assisted living&quot; or &quot;residential care
              with nursing oversight.&quot;
            </p>
            <p>
              This matters on StarlynnCare because each PA facility profile displays the DHS
              license type (PCH or ALR) alongside the Special Care designation status. Reading
              both together gives you a clearer picture of what level of care the facility is
              authorized and equipped to provide.
            </p>
          </Prose>

          <H2 id="comparison">Side-by-side comparison</H2>
          <div className="mt-6 overflow-x-auto rounded-lg border border-paper-rule">
            <table className="w-full text-[15px] leading-[1.6]">
              <thead>
                <tr style={{ background: "var(--color-paper-2)" }}>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3 w-[30%]">
                    Factor
                  </th>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Personal Care Home (PCH)
                  </th>
                  <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Assisted Living Residence (ALR)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-rule">
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label} className="align-top">
                    <td className="px-4 py-3 font-medium text-ink text-[14px]">{row.label}</td>
                    <td className="px-4 py-3 text-ink-2">{row.pch}</td>
                    <td className="px-4 py-3 text-ink-2">{row.alr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2 id="memory-care">Memory care in a PCH vs. ALR</H2>
          <Prose>
            <p>
              Both PCHs and ALRs can provide memory care — the differentiator is the
              DHS-recognized designation, not the license type alone. Look for:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="font-medium text-ink">Special Care</strong> — dementia-specific
                programming; disclosed to DHS and recorded in the provider directory.
              </li>
              <li>
                <strong className="font-medium text-ink">Secure Dementia Care Unit</strong> — a
                physically secured environment for residents at elopement risk.
              </li>
              <li>
                <strong className="font-medium text-ink">Assisted Living — Special Care</strong>{" "}
                (ALR only) — an explicit license subtype for dementia-focused facilities with
                more intensive programming and staffing requirements than a standard ALR.
              </li>
            </ul>
            <p>
              A facility can market itself as &quot;memory care&quot; without any of these
              designations. When comparing PA facilities on StarlynnCare, filter by the
              designation that matches your loved one&apos;s needs — and always read the
              DHS OLTL inspection record alongside the facility&apos;s marketing materials.
            </p>
          </Prose>

          <H2 id="inspection-records">What the inspection record tells you</H2>
          <Prose>
            <p>
              The single most useful comparison tool between a PCH and an ALR is not the license
              type — it is the DHS OLTL inspection record. A well-run PCH with a clean inspection
              history may provide better practical care than a newly licensed ALR-Special Care
              facility with a pattern of serious citations.
            </p>
            <p>
              On each StarlynnCare PA facility profile, the full DHS OLTL inspection record
              shows: the date of each inspection, the specific 55 Pa Code regulation cited, the
              enforcement classification (Citation through Immediate Jeopardy), and the inspector
              narrative where available. The peer percentile positions the facility against other
              DHS-regulated memory care facilities in its county.
            </p>
            <p>
              A facility&apos;s inspection record is the regulator&apos;s own assessment of
              operator quality. No marketing copy can substitute for it.
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
            source="Pennsylvania DHS OLTL; 55 Pa Code Chapters 2600 and 2800; PA DHS Human Services Provider Directory; Pennsylvania HealthChoices managed care"
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
                href="/pennsylvania/personal-care-home-cost"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">
                  Pennsylvania
                </p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">
                  What does a personal care home cost in Pennsylvania?
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
