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

const PAGE_PATH = "/missouri/memory-care-licensing";
const canonicalUrl = canonicalFor(PAGE_PATH);
const ARTICLE_HEADLINE =
  "Missouri memory care licensing explained — ALF**, Alzheimer's Special Care Disclosure & 19 CSR 30";
const TITLE = "Missouri Memory Care Licensing: ALF**, SCU Disclosure & 19 CSR (2026)";
const DESC =
  "Missouri has no standalone memory care license. Two authoritative signals define memory care: the Alzheimer's Special Care Services Disclosure (§198.510 RSMo) and the ALF** license (§198.073.6). Learn what each means, how DHSS inspects these facilities, and how to read a profile on StarlynnCare.";
const DATE_PUBLISHED = "2026-06-28";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Does Missouri have a standalone memory care license?",
    a: "No. Missouri does not issue a separate 'memory care' license category. Memory care capability is signaled through two mechanisms: (1) the Alzheimer's Special Care Services Disclosure (Form MO 580-2637, required by §198.510 RSMo) for facilities that specialize in or advertise dementia care, and (2) the ALF** license designation under §198.073.6 RSMo for facilities authorized to retain residents who cannot self-evacuate — a common profile for residents with moderate to advanced dementia.",
  },
  {
    q: "What is the Alzheimer's Special Care Services Disclosure in Missouri?",
    a: "Section 198.510 RSMo requires any residential care or assisted living facility that specializes in, advertises, or represents itself as providing care for Alzheimer's disease or other dementias to file a disclosure (Form MO 580-2637) with DHSS. The disclosure must describe the facility's dementia-specific services, staffing, training, programming, environment, and admission/discharge criteria. It is updated annually. StarlynnCare uses alzheimer_s_scu=true in the DHSS LTC Directory as the authoritative data signal corresponding to this disclosure.",
  },
  {
    q: "What is an ALF** license in Missouri?",
    a: "ALF** ('ALF double-star') is a license designation under §198.073.6 RSMo. It authorizes an Assisted Living Facility to retain residents who are unable to self-evacuate in an emergency — a requirement that applies to residents with moderate to advanced dementia who cannot independently exit the building. Standard ALF and RCF licenses do not carry this authorization. ALF** facilities are required to have secured environments and evacuation plans specifically covering non-ambulatory or cognitively impaired residents.",
  },
  {
    q: "What is the difference between an ALF and an RCF in Missouri?",
    a: "Both Assisted Living Facilities (ALF) and Residential Care Facilities (RCF) are licensed and inspected by DHSS under Chapter 198 RSMo and 19 CSR 30. RCFs provide a lower level of care — primarily supervisory assistance and room/board — while ALFs provide more hands-on personal care assistance with activities of daily living (ADLs) and medication management. Memory care residents typically require the higher level of care available in ALFs, particularly ALF** facilities. An RCF* designation (like ALF**) also indicates authorization to retain non-self-evacuating residents.",
  },
  {
    q: "How does DHSS inspect Missouri memory care facilities?",
    a: "DHSS Section for Long-Term Care Regulation conducts routine licensure surveys (typically annual or biennial), initial licensure surveys, complaint investigations, and follow-up visits for all ALF and RCF licensees. Inspections are unannounced. Deficiency citations are issued under 19 CSR 30 rule sections. Substantiated complaint investigations are separately documented. StarlynnCare sources inspection records from DHSS FOIA requests and displays findings with their survey category (routine vs. complaint) and deficiency tags.",
  },
  {
    q: "Does Missouri Medicaid (MO HealthNet) cover memory care in ALFs?",
    a: "MO HealthNet (Missouri's Medicaid program) offers limited coverage for assisted living and residential care through the Ticket to Work Health Assurance Program and the Missouri HCBS (Home and Community-Based Services) waiver. Coverage is not automatic — it requires eligibility determination, care needs assessment, and a waiver slot. Many memory care ALFs in Missouri do not accept MO HealthNet. Families should ask directly about Medicaid acceptance, bed availability, and expected private-pay rates during the inquiry process.",
  },
  {
    q: "How is Missouri's system different from Arizona's or California's?",
    a: "Arizona uses a Directed Care license level as the primary dementia signal and is moving to a formal Memory Care subclass (HB2764). California uses RCFE licensing with a dementia-specific disclosure (Title 22). Missouri uses disclosure-based signaling (§198.510 SCU disclosure) plus the ALF** evacuation authorization — there is no separate license tier for dementia care. Each state's inspection records use different severity labels and regulatory frameworks. When reading a StarlynnCare profile, always note the state — the signals and data sources differ significantly.",
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

function ComparisonTable() {
  const rows = [
    { attr: "License type", alf: "Assisted Living Facility (ALF)", rfc: "Residential Care Facility (RCF)" },
    { attr: "Care level", alf: "Personal care + medication mgmt.", rfc: "Supervisory / room and board" },
    { attr: "Memory care designation", alf: "ALF** (non-self-evac authorization)", rfc: "RCF* (same authority)" },
    { attr: "Alzheimer's SCU disclosure", alf: "§198.510 RSMo required if advertising MC", rfc: "§198.510 RSMo required if advertising MC" },
    { attr: "Regulator", alf: "DHSS Section for LTCR", rfc: "DHSS Section for LTCR" },
    { attr: "Governing rule", alf: "19 CSR 30-86 / Ch. 198 RSMo", rfc: "19 CSR 30-82 / Ch. 198 RSMo" },
    { attr: "MO HealthNet (Medicaid)?", alf: "HCBS waiver — limited, not guaranteed", rfc: "HCBS waiver — limited, not guaranteed" },
    { attr: "Inspection source", alf: "DHSS LTCR (FOIA / public records)", rfc: "DHSS LTCR (FOIA / public records)" },
  ];
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-paper-rule">
      <table className="w-full min-w-[540px] text-[14px]">
        <thead>
          <tr style={{ background: "var(--color-ink)", color: "var(--color-paper)" }}>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal w-[160px]">Factor</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">ALF / ALF**</th>
            <th className="px-4 py-3 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] font-normal">RCF / RCF*</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.attr} className="border-t border-paper-rule" style={{ background: i % 2 === 0 ? "var(--color-paper-2)" : "var(--color-paper)" }}>
              <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-ink-2 align-top">{row.attr}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.alf}</td>
              <td className="px-4 py-3 leading-relaxed text-ink-2 align-top">{row.rfc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MoLicensingPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: ARTICLE_HEADLINE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Missouri", url: canonicalFor("/missouri") },
      { name: "Missouri guides", url: canonicalFor("/missouri/guides") },
      { name: "Memory care licensing", url: canonicalUrl },
    ]),
    buildFaqSchemaFromPairs(FAQ_PAIRS, canonicalUrl),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar scope="MO" />
      <SiteNav badge="Missouri" ctaHref="/missouri/facilities" ctaLabel="Missouri memory care facilities" stateNavHref="/missouri" />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/missouri" className="hover:text-teal transition-colors">Missouri</Link>
              <span aria-hidden>›</span>
              <Link href="/missouri/guides" className="hover:text-teal transition-colors">Guides</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Memory care licensing</span>
            </nav>

            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              Missouri licensing guide · DHSS regulation
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
          <aside className="rounded-lg border border-paper-rule bg-paper-2 px-5 py-6 text-[16px] leading-[1.7] text-ink-2">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-3">
              The short version
            </p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>
                Missouri has <strong className="font-medium text-ink">no standalone memory care license</strong>.
                Memory care capability is signaled by the{" "}
                <strong className="font-medium text-ink">Alzheimer&apos;s Special Care Services Disclosure</strong>{" "}
                (§198.510 RSMo) and/or the{" "}
                <strong className="font-medium text-ink">ALF** license</strong> (§198.073.6 RSMo).
              </li>
              <li>
                The disclosure is legally required whenever a facility specializes in, advertises, or represents
                itself as providing care for Alzheimer&apos;s disease or other dementias.
              </li>
              <li>
                <strong className="font-medium text-ink">ALF**</strong> authorizes facilities to retain residents
                who cannot self-evacuate — a key safety authorization for residents with advanced dementia.
              </li>
              <li>
                DHSS inspects all ALF and RCF facilities under 19 CSR 30; complaint investigations are documented
                separately from routine surveys.
              </li>
            </ul>
          </aside>

          <H2 id="no-standalone-mc-license">Why Missouri has no standalone memory care license</H2>
          <Prose>
            <p>
              Unlike Arizona (Directed Care license level) or Oregon (Memory Care Endorsement), Missouri does not
              have a separate license tier specifically for memory care. The Missouri Division of Senior and Disability
              Services regulates all residential care under Chapter 198 RSMo, which covers both Assisted Living
              Facilities (ALF) and Residential Care Facilities (RCF) without a dementia-specific tier.
            </p>
            <p>
              Instead, Missouri uses two disclosure and authorization mechanisms as proxies for dementia care
              capability. Families and researchers need to know both signals to identify facilities that are
              genuinely equipped and authorized for memory care.
            </p>
          </Prose>

          <H2 id="alzheimers-scu">The Alzheimer&apos;s Special Care Services Disclosure (§198.510 RSMo)</H2>
          <Prose>
            <p>
              Missouri Statute §198.510 RSMo requires any facility that specializes in, advertises, or represents
              itself as providing care for persons with Alzheimer&apos;s disease or other dementias to file Form MO
              580-2637 with DHSS. The disclosure is public record and must be provided to prospective residents
              and their families upon request.
            </p>
            <p>The disclosure must describe:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The specific services provided for Alzheimer&apos;s/dementia residents</li>
              <li>Staff training and ongoing competency requirements for dementia care</li>
              <li>The physical environment, including any secured or restricted areas</li>
              <li>Activity and programming approaches for dementia populations</li>
              <li>Admission, discharge, and transfer criteria for dementia residents</li>
            </ul>
            <p>
              The disclosure must be updated annually. StarlynnCare uses the{" "}
              <code className="font-[family-name:var(--font-mono)] text-[14px] bg-paper-2 px-1 rounded">alzheimer_s_scu=true</code>{" "}
              flag in the DHSS LTC Directory (data.mo.gov) as the data signal for this disclosure — 316 licensed
              facilities in Missouri carry this flag as of the 2026 directory.
            </p>
          </Prose>

          <H2 id="alf-star-star">The ALF** license: §198.073.6 RSMo</H2>
          <Prose>
            <p>
              Section 198.073.6 RSMo authorizes assisted living facilities to retain residents who are not capable
              of self-preservation or self-evacuation in an emergency — provided the facility meets specific
              physical environment, staffing, and fire safety requirements. Facilities meeting these requirements
              receive an <strong className="font-medium text-ink">ALF**</strong> license designation (pronounced
              &ldquo;ALF double-star&rdquo;).
            </p>
            <p>
              The practical implication for memory care: standard ALF facilities <em>cannot</em> retain residents
              who cannot self-evacuate. Many residents in mid-to-late stage dementia lose the ability to independently
              exit a building. ALF** facilities are built and staffed to serve these residents safely. This makes
              the ALF** designation a meaningful proxy for secured-environment memory care capability.
            </p>
            <p>
              Similarly, an RCF* (RCF &ldquo;single-star&rdquo;) carries the same evacuation-retention authorization
              for residential care facilities. StarlynnCare indexes both ALF** and alzheimer_s_scu=true facilities
              in the publishable set.
            </p>
          </Prose>

          <ComparisonTable />

          <H2 id="how-inspections-work">How DHSS inspects Missouri memory care facilities</H2>
          <Prose>
            <p>
              DHSS Section for Long-Term Care Regulation (LTCR) conducts unannounced routine licensure surveys
              (typically annual for ALFs, biennial for some RCFs), initial licensure surveys for new facilities,
              complaint investigations, and follow-up visits to verify correction of previously cited deficiencies.
            </p>
            <p>
              Deficiencies are cited under 19 CSR 30 rule sections. Unlike California (Type A/B) or Arizona
              (A.A.C. R9-10), Missouri uses alphanumeric tag codes (e.g., K-0001, L-0040) to identify the
              specific regulation violated. StarlynnCare displays each citation by tag code with its description.
              Complaint investigations are labeled separately — when visible in the record, a complaint-driven
              finding indicates a substantiated allegation from a resident, family member, or mandated reporter.
            </p>
          </Prose>

          <H2 id="how-to-read-profile">How to read a Missouri facility on StarlynnCare</H2>
          <Prose>
            <p>Each Missouri facility profile on StarlynnCare shows:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>License type (ALF / ALF** / RCF / RCF*) and Alzheimer&apos;s SCU disclosure status</li>
              <li>DHSS inspection history with survey categories (routine vs. complaint) and deficiency tags</li>
              <li>Peer comparison grade based on deficiency frequency and severity vs. other MO facilities</li>
              <li>Direct link to the DHSS LTC Regulation portal for source verification</li>
            </ul>
          </Prose>

          <H2 id="faq">Frequently asked questions</H2>
          <div className="space-y-8 mt-6">
            {FAQ_PAIRS.map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-[family-name:var(--font-display)] font-normal text-[18px] leading-[1.25] text-ink mb-2">{q}</h3>
                <p className="text-[16px] leading-[1.7] text-ink-2">{a}</p>
              </div>
            ))}
          </div>

          <DataFootnote
            source="Missouri DHSS Section for Long-Term Care Regulation (§198.510 RSMo; §198.073.6 RSMo; 19 CSR 30); data.mo.gov Socrata fenu-sipv LTC Directory"
            refreshed={DATE_PUBLISHED}
          />

          <div className="mt-16 pt-8 border-t border-paper-rule">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4 mb-4">
              Continue reading
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/missouri/memory-care-vs-nursing-home"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">Missouri</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">Memory care vs. nursing home in Missouri</p>
              </Link>
              <Link
                href="/library/37-questions-to-ask-on-a-memory-care-tour"
                className="block rounded-lg border border-paper-rule bg-paper-2 px-5 py-4 hover:border-teal transition-colors"
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-rust mb-1">All states</p>
                <p className="font-[family-name:var(--font-display)] text-[16px] leading-[1.3] text-ink">37 questions to ask on a memory care tour</p>
              </Link>
            </div>
            <Link href="/missouri/guides" className="mt-4 inline-block text-[14px] text-teal hover:underline">
              ← All Missouri guides
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
