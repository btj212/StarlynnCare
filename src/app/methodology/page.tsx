import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";
import { buildBreadcrumbList, buildFaqSchemaFromPairs, buildWebPageWithReviewer } from "@/lib/seo/schema";

const METHODOLOGY_PATH = "/methodology";
const methodologyCanonical = canonicalFor(METHODOLOGY_PATH);
const EFFECTIVE = "May 2026";
const methodologyDesc =
  "Our methodology: primary data sources, how we compute each metric, tier thresholds, and why we do not publish a single composite score.";

export const metadata: Metadata = {
  title: "How We Rate Facilities | StarlynnCare",
  description: methodologyDesc,
  alternates: { canonical: methodologyCanonical },
  openGraph: {
    title: "How We Rate Facilities | StarlynnCare",
    description: methodologyDesc,
    url: methodologyCanonical,
    type: "article",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How We Rate Facilities | StarlynnCare",
    description: methodologyDesc,
    images: ["/og-default.png"],
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
    <section className="mt-12" aria-labelledby={id}>
      <h2
        id={id}
        className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
      >
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-slate">
        {children}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  formula,
  tierLogic,
  rationale,
}: {
  label: string;
  formula: string;
  tierLogic: string;
  rationale: string;
}) {
  return (
    <div className="rounded-lg border border-sc-border bg-white px-5 py-5 shadow-card space-y-3">
      <p className="text-sm font-bold uppercase tracking-wide text-navy">{label}</p>
      <div className="grid gap-1 text-sm">
        <p>
          <span className="font-semibold text-ink">Formula: </span>
          <span className="text-slate">{formula}</span>
        </p>
        <p>
          <span className="font-semibold text-ink">Tier logic: </span>
          <span className="text-slate">{tierLogic}</span>
        </p>
        <p>
          <span className="font-semibold text-ink">Why it matters: </span>
          <span className="text-slate">{rationale}</span>
        </p>
      </div>
    </div>
  );
}

function TierKey() {
  return (
    <div className="flex flex-wrap gap-4 mt-4">
      {[
        { label: "Strong", dot: "bg-teal", badge: "bg-teal-light text-teal border border-teal/20", desc: "At or below 33rd percentile — better than most peers" },
        { label: "Mixed", dot: "bg-amber", badge: "bg-amber-light text-amber border border-amber/30", desc: "34th–66th percentile — near the county middle" },
        { label: "Concerns", dot: "bg-red-400", badge: "bg-red-light text-red-600 border border-red-200", desc: "Above 66th percentile — worse than most peers" },
        { label: "For reference", dot: "bg-slate-400", badge: "bg-sc-border text-slate border border-sc-border", desc: "Boolean metric with no peer comparison" },
      ].map(({ label, dot, badge, desc }) => (
        <div key={label} className="flex items-start gap-2">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
          <div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
              {label}
            </span>
            <p className="mt-1 text-xs text-muted">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MethodologyPage() {
  const methodologyFaqs = [
    {
      q: "How does StarlynnCare rate memory care facilities?",
      a: "StarlynnCare rates facilities using only official state inspection records — no paid placements, referral fees, or user-submitted content. We compute four independent signals (compliance record, severity record, dementia-care specificity, and complaint pattern) and compare each against the facility's local peer set using 33rd and 66th percentile cutoffs.",
    },
    {
      q: "Why doesn't StarlynnCare publish a composite score or star rating?",
      a: "A composite score implies one universal weighting of four different signals — but the right weighting depends on each family's situation. A family focused on dementia-specific violations will weight §87705 citations differently than one focused on overall compliance frequency. Composites also obscure: a facility with one catastrophic Type A event looks the same as one with a steady pattern of minor violations. We show four signals separately so families can weigh them.",
    },
    {
      q: "Where does the inspection data come from?",
      a: "Data comes directly from official state licensing portals: CDSS Community Care Licensing (CA), Oregon DHS LTC Licensing (OR), DSHS ALTSA (WA), Minnesota MDH (MN), HHSC LTCR (TX), and PA DHS OLTL (PA). We ingest records on a regular automated schedule and publish only facilities with an active state license and at least one published inspection record.",
    },
  ];
  const methodologyJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Methodology", url: methodologyCanonical },
    ]),
    buildWebPageWithReviewer({
      name: "How We Rate Facilities | StarlynnCare",
      url: methodologyCanonical,
      description: methodologyDesc,
    }),
    buildFaqSchemaFromPairs(methodologyFaqs, methodologyCanonical),
  ];

  return (
    <>
      <JsonLd objects={methodologyJsonLd} />
      <SiteNav />
      <main className="border-b border-sc-border bg-warm-white">
        <article className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            <Link href="/" className="hover:text-teal">
              StarlynnCare
            </Link>{" "}
            · Methodology
          </p>

          <h1 className="mt-4 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight text-navy md:text-[2.75rem] md:leading-tight">
            How we rate facilities
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate">
            Every number on StarlynnCare comes directly from official state
            inspection records. We do not invent data, accept paid placements,
            or produce a single letter grade. Instead, we show four independent
            signals and let families weigh them.
          </p>
          <p className="mt-3 text-sm text-muted">
            Looking for a summary of how we rate facilities?{" "}
            <Link href="/memory-care-facility-ratings" className="text-teal underline underline-offset-4">
              Memory care facility ratings, explained →
            </Link>
          </p>
          <p className="mt-3 text-[14px] font-[family-name:var(--font-mono)] text-muted">
            Last updated {EFFECTIVE}
          </p>

          <section
            id="no-paid-placement"
            className="mt-8 rounded-lg border border-teal/25 bg-teal-light/40 px-5 py-4 text-sm leading-relaxed text-slate"
            aria-label="Editorial independence"
          >
            <p className="font-semibold text-navy">Editorial independence</p>
            <p className="mt-2">{GOVERNANCE_24_WORDS}</p>
            <p className="mt-3">
              <Link
                href="/data"
                className="font-medium text-teal underline-offset-2 hover:underline"
              >
                Dataset overview →
              </Link>
            </p>
          </section>

          {/* ── Sources ── */}
          <Section id="sources-heading" title="Primary data sources">
            <p>
              Facility licensing, inspection, and complaint data are drawn from
              official public records published by each state&rsquo;s licensing authority.
              Each source provides a facility roster and per-facility inspection
              reports — including visit dates, deficiency citations, inspector
              narratives, and complaint outcomes, where available.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse mt-2">
                <thead>
                  <tr className="border-b border-sc-border">
                    <th className="text-left py-2 pr-4 font-semibold text-ink whitespace-nowrap">State</th>
                    <th className="text-left py-2 pr-4 font-semibold text-ink">Licensing body</th>
                    <th className="text-left py-2 font-semibold text-ink">Sources</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sc-border/50 text-slate">
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">CA</td>
                    <td className="py-2.5 pr-4 align-top">CDSS Community Care Licensing Division — Residential Care Facilities for the Elderly (RCFEs)</td>
                    <td className="py-2.5 align-top">CDSS CKAN Open Data (roster); CDSS Transparency Portal (inspection reports, citations)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">OR</td>
                    <td className="py-2.5 pr-4 align-top">Oregon DHS Long-Term Care Licensing — Residential Care Facilities, Memory Care Communities</td>
                    <td className="py-2.5 align-top">OregonDHS LTC public facility directory and inspection records</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">WA</td>
                    <td className="py-2.5 pr-4 align-top">DSHS Aging and Long-Term Support Administration (ALTSA) — Adult Family Homes and Assisted Living Facilities</td>
                    <td className="py-2.5 align-top">DSHS BH-Forms public inspection reports; DSHS facility directory</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">MN</td>
                    <td className="py-2.5 pr-4 align-top">Minnesota Department of Health (MDH) / Assisted Living Licensure and Certification (ALRC) — ALDC and assisted living facilities</td>
                    <td className="py-2.5 align-top">MDH inspection findings; ALRC public licensing records</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">TX</td>
                    <td className="py-2.5 pr-4 align-top">Texas HHSC — Assisted Living Facilities (Type A, B, C)</td>
                    <td className="py-2.5 align-top">HHSC public inspection reports</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">UT</td>
                    <td className="py-2.5 pr-4 align-top">Utah DHHS Division of Licensing and Background Checks (DLBC) — Type I &amp; II Assisted Living Facilities</td>
                    <td className="py-2.5 align-top">DLBC public facility roster; R432-270 inspection records</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">IL</td>
                    <td className="py-2.5 pr-4 align-top">Illinois Dept. of Public Health (IDPH) — Assisted Living and Shared Housing Establishments</td>
                    <td className="py-2.5 align-top">IDPH public inspection records</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">PA</td>
                    <td className="py-2.5 pr-4 align-top">PA Dept. of Human Services (DHS) OLTL — Personal Care Homes (PCH) and Assisted Living Residences (ALR)</td>
                    <td className="py-2.5 align-top">PA DHS inspection PDFs; OLTL provider directory</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">AZ</td>
                    <td className="py-2.5 pr-4 align-top">ADHS Bureau of Residential Facilities Licensing (BRFL) — Assisted Living Homes (ALH) and Assisted Living Centers (ALC), Directed Care level</td>
                    <td className="py-2.5 align-top">ADHS ArcGIS Open Data Hub (directory); AZ Care Check Aura API (inspection records). ADHS confirmed via public records response (Jun 2026): facilities with a Directed Care license are automatically authorized for memory care services.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-ink align-top">MO</td>
                    <td className="py-2.5 pr-4 align-top">Missouri DHSS Section for Long-Term Care Regulation — Assisted Living Facilities (ALF, ALF**) and Residential Care Facilities (RCF, RCF*) meeting the §198.510 Alzheimer&rsquo;s SCU Disclosure or ALF** non-self-evacuation authorization</td>
                    <td className="py-2.5 align-top">data.mo.gov Socrata fenu-sipv LTC Directory (facility roster); DHSS FOIA records (inspection/deficiency data, 2018–2026)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Data is refreshed via automated scrapers; production runs target a{" "}
              <strong className="font-medium text-ink">weekly cadence</strong> on CI/CD schedules,
              with facility rows reflecting the latest successful ingest in{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">updated_at</code>.
              See also the <Link href="/data" className="font-medium text-teal underline underline-offset-4 hover:underline">dataset page</Link>.
            </p>
          </Section>

          {/* ── Coverage ── */}
          <Section id="coverage-heading" title="Current coverage">
            <p>
              StarlynnCare currently publishes inspection data for{" "}
              <strong>over 3,800 facilities across 10 states</strong>, with coverage
              expanding as we ingest new state licensing data.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><span className="font-medium text-ink">California</span> — licensed RCFEs across California, covering counties statewide.</li>
              <li><span className="font-medium text-ink">Arizona</span> — 1,908 Directed Care ALHs and ALCs. ADHS confirmed Directed Care = memory care authorized (public records, Jun 2026).</li>
              <li><span className="font-medium text-ink">Minnesota</span> — 552 licensed assisted living facilities with Dementia Care license (ALDC and AL).</li>
              <li><span className="font-medium text-ink">Oregon</span> — 131 licensed residential care facilities with Memory Care Endorsement.</li>
              <li><span className="font-medium text-ink">Washington</span> — 180 licensed assisted living facilities with Specialized Dementia Care contract.</li>
              <li><span className="font-medium text-ink">Pennsylvania</span> — 355 PCH and ALR facilities with Special Care designation.</li>
              <li><span className="font-medium text-ink">Utah</span> — 118 Type I &amp; II assisted living facilities.</li>
              <li><span className="font-medium text-ink">Illinois</span> — early coverage; 30 facilities published to date.</li>
              <li><span className="font-medium text-ink">Texas</span> — early coverage expanding; ingest in progress.</li>
            </ul>
            <p>
              Only facilities with an active state license and at least one
              published inspection record are shown. Facilities missing key data
              fields are held back until the next ingest run resolves them.
            </p>
            <p className="text-sm text-muted">
              Benchmarks and peer sets are recomputed dynamically as coverage expands.
              Percentile thresholds will shift as more facilities are added within each state.
            </p>
          </Section>

          {/* ── How we organize facilities ── */}
          <Section id="organization-heading" title="How we organize facilities">
            <p>
              The following applies to{" "}
              <strong className="font-medium text-ink">California</strong>{" "}
              facilities; analogous capacity and dementia-care distinctions exist
              in other states, with state-specific thresholds and regulatory designations.
              California&rsquo;s RCFE licensing regulations create two natural axes for
              organizing facilities that we use on every California city and county listing page.
            </p>

            <p className="font-semibold text-ink">Axis 1 — Capacity tier</p>
            <p>
              The ≤6-bed threshold in{" "}
              <a
                href="https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=1569.2."
                className="font-medium text-teal underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                HSC §1569.2
              </a>{" "}
              is the regulatory line that separates residential board-and-care
              homes from larger facilities:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>
                <span className="font-medium text-ink">≤ 6 beds (&ldquo;small&rdquo;)</span> —
                Typically a single-family home converted to care use. Owner-operated.
                These facilities receive fewer routine CDSS inspections by design, so
                a short inspection history does not mean a good track record — it
                means less inspector attention. We hide them by default and offer a
                &ldquo;Show small care homes&rdquo; toggle.
              </li>
              <li>
                <span className="font-medium text-ink">7–49 beds (&ldquo;medium&rdquo;)</span> —
                Small to medium freestanding RCFEs. Subject to CDSS annual inspection
                cycle and all Title 22 requirements.
              </li>
              <li>
                <span className="font-medium text-ink">50+ beds (&ldquo;large&rdquo;)</span> —
                Community-style facilities, often purpose-built buildings operated by
                regional or national chains. Typically have a dedicated memory-care wing.
              </li>
            </ul>

            <p className="font-semibold text-ink">Axis 2 — Memory-care designation</p>
            <p>
              California{" "}
              <a
                href="https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=1569.627."
                className="font-medium text-teal underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                HSC §1569.627
              </a>{" "}
              requires any RCFE that advertises or promotes special care, special
              programming, or a special environment for persons with dementia to
              disclose the special features of its program in the plan of operation
              filed with CDSS. This filing is the canonical regulatory signal that
              a facility is operating a dementia program — better than relying on
              what the facility puts on its own website.
            </p>
            <p>
              Until CDSS publishes a machine-readable list of these filings, we
              identify memory-care facilities through two proxies: (1) a facility
              name or licensee name that contains a recognized dementia-program
              keyword or known memory-care chain name, and (2) any CDSS citation
              under Title 22 §87705 or §87706 — the dementia-care-specific
              regulations — which constitutes regulatory confirmation that the
              facility operates a dementia program.
            </p>

            <p>
              By default, each listing page shows only{" "}
              <strong>7+ bed facilities with a confirmed memory-care signal</strong>.
              The &ldquo;Show small care homes (≤6 beds)&rdquo; toggle on each page reveals
              the smaller board-and-care segment for families who want it.
            </p>
          </Section>

          {/* ── Four metrics ── */}
          <Section id="metrics-heading" title="The four metrics">
            <p>
              Each facility profile shows an &ldquo;At a glance&rdquo; panel with four rows.
              Here is exactly how each is computed.
            </p>
            <div className="space-y-4 mt-2">
              <MetricCard
                label="Compliance record"
                formula="Total deficiencies ÷ number of routine (non-complaint) inspections on file"
                tierLogic="Compared against the distribution across all same-state, same-county peer facilities. At or below the 33rd percentile = Strong; 34th–66th = Mixed; above 66th = Concerns."
                rationale="Routine inspections are the most comparable measure of regulatory compliance across facilities. Complaint-triggered visits are excluded here because they are initiated by external reports, not by the state's regular cycle."
              />
              <MetricCard
                label="Severity record"
                formula="Count of Type A deficiency citations on file (all time)"
                tierLogic="Same percentile cutoffs (33rd / 66th) across all county facilities."
                rationale="California distinguishes Type A (actual harm or immediate risk of death/serious bodily injury) from Type B (potential harm). A Type A citation is the most serious regulatory outcome short of license revocation; even one warrants a closer look."
              />
              <MetricCard
                label="Dementia-care specificity"
                formula="Boolean: any §87705 or §87706 citation in the past 5 years"
                tierLogic="No tier comparison — shown as 'For reference' with the date of the most recent qualifying citation."
                rationale="California Code of Regulations Title 22, §§ 87705–87706 govern RCFE dementia-care programs specifically. A citation under these sections means a facility was found out of compliance with requirements designed to protect residents with cognitive impairment. This is surfaced separately because it is uniquely relevant to memory care placement decisions."
              />
              <MetricCard
                label="Complaint pattern"
                formula="Substantiated complaints ÷ total complaints that received a CDSS outcome determination"
                tierLogic="Same percentile cutoffs, restricted to facilities with at least one complaint that has a recorded outcome. Facilities with no complaints-with-outcome show 'For reference'."
                rationale="CDSS investigates complaints and issues a formal outcome (Substantiated, Unsubstantiated, etc.). A high substantiation rate relative to peers is a meaningful signal, but many complaints are routine and do not result in findings — context matters."
              />
            </div>
          </Section>

          {/* ── Tier color key ── */}
          <Section id="tiers-heading" title="Tier color key">
            <p>
              All numeric metrics are compared against the current county
              distribution using 33rd and 66th percentile cutoffs. &ldquo;Strong&rdquo;
              means better than most peers; &ldquo;Concerns&rdquo; means worse than most peers.
              These are relative assessments within the current sample, not absolute
              benchmarks.
            </p>
            <TierKey />
          </Section>

          {/* ── Why no composite ── */}
          <Section id="no-composite-heading" title="Why we don&rsquo;t publish a composite score">
            <p>
              A composite score implies that one weighting of metrics is
              universally correct. It isn&apos;t. A family with a parent who has
              advanced dementia may weight §87705 citations more heavily than
              a family whose parent is largely independent. A family that has
              already toured three facilities and spoken to staff may weight a
              slightly elevated complaint rate differently than the aggregate
              numbers suggest.
            </p>
            <p>
              Composite scores also obscure: a facility with one catastrophic
              Type A event and otherwise clean records will look identical to a
              facility with a pattern of minor Type B deficiencies if both are
              averaged into the same number.
            </p>
            <p>
              We believe four honest signals, clearly labeled, serve families
              better than one opaque number.
            </p>
          </Section>

          {/* ── Limitations ── */}
          <Section id="limitations-heading" title="Limitations and disclaimers">
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>
                Inspection records reflect conditions at the time of a specific
                visit. They are not a real-time assessment of today&rsquo;s care quality.
              </li>
              <li>
                Facilities that have improved since a citation was issued will
                still show that citation. Corrective action dates are shown where
                available.
              </li>
              <li>
                Percentile thresholds are computed per county and may be sensitive
                to outliers in counties with few facilities. Tiers may shift as
                coverage expands.
              </li>
              <li>
                StarlynnCare is an information resource, not a licensed placement
                agency or healthcare provider. Nothing on this site constitutes
                medical or legal advice. Always tour facilities, speak with staff,
                and consult a licensed care advisor before making placement decisions.
              </li>
            </ul>
          </Section>

          <div className="mt-14 border-t border-sc-border pt-8 text-sm text-muted">
            <p>
              Questions about methodology or data errors?{" "}
              <a
                href="mailto:hello@starlynncare.com"
                className="font-medium text-teal underline-offset-4 hover:underline"
              >
                hello@starlynncare.com
              </a>
            </p>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
