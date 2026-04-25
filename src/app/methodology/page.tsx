import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  title: "How We Rate Facilities | StarlynnCare",
  description:
    "Our methodology: primary data sources, how we compute each metric, tier thresholds, and why we do not publish a single composite score.",
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
  return (
    <>
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
            Every number on StarlynnCare comes directly from California state
            inspection records. We do not invent data, accept paid placements,
            or produce a single letter grade. Instead, we show four independent
            signals and let families weigh them.
          </p>

          {/* ── Sources ── */}
          <Section id="sources-heading" title="Primary data sources">
            <p>
              Facility licensing, inspection, and complaint data are drawn from
              the{" "}
              <a
                href="https://www.cdss.ca.gov/inforesources/cdss-programs/community-care-licensing"
                className="font-medium text-teal underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                California Department of Social Services (CDSS) Community Care
                Licensing Division
              </a>{" "}
              via two public endpoints:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>
                <span className="font-medium text-ink">CDSS CKAN Open Data</span> —
                statewide RCFE roster, including license status, bed count, and operator.
              </li>
              <li>
                <span className="font-medium text-ink">CDSS Transparency API</span> —
                per-facility LIC 9099 inspection reports, including visit dates,
                Type A/B deficiency citations, inspector narratives, and complaint outcomes.
              </li>
            </ul>
            <p>
              Data is refreshed via automated scrapers. Each facility record
              shows a "last updated" date reflecting the most recent ingest run.
            </p>
          </Section>

          {/* ── Coverage ── */}
          <Section id="coverage-heading" title="Current coverage">
            <p>
              StarlynnCare currently covers <strong>Alameda County,
              California</strong> — specifically RCFEs (Residential Care
              Facilities for the Elderly) that serve residents with memory care
              needs. This is a deliberate geographic beachhead; we add new
              counties as data quality and coverage allow.
            </p>
            <p>
              Only facilities with an active California license and at least one
              published inspection record are shown. Facilities missing key data
              fields are held back until the next ingest run resolves them.
            </p>
            <p className="text-sm text-muted">
              Sample size for current benchmarks: 14 publishable Alameda County
              RCFEs. Percentile thresholds will shift as coverage expands.
            </p>
          </Section>

          {/* ── How we organize facilities ── */}
          <Section id="organization-heading" title="How we organize facilities">
            <p>
              California's RCFE licensing regulations create two natural axes for
              organizing facilities that we use on every city and county listing page.
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
                <span className="font-medium text-ink">≤ 6 beds ("small")</span> —
                Typically a single-family home converted to care use. Owner-operated.
                These facilities receive fewer routine CDSS inspections by design, so
                a short inspection history does not mean a good track record — it
                means less inspector attention. We hide them by default and offer a
                "Show small care homes" toggle.
              </li>
              <li>
                <span className="font-medium text-ink">7–49 beds ("medium")</span> —
                Small to medium freestanding RCFEs. Subject to CDSS annual inspection
                cycle and all Title 22 requirements.
              </li>
              <li>
                <span className="font-medium text-ink">50+ beds ("large")</span> —
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
              The "Show small care homes (≤6 beds)" toggle on each page reveals
              the smaller board-and-care segment for families who want it.
            </p>
          </Section>

          {/* ── Four metrics ── */}
          <Section id="metrics-heading" title="The four metrics">
            <p>
              Each facility profile shows an "At a glance" panel with four rows.
              Here is exactly how each is computed.
            </p>
            <div className="space-y-4 mt-2">
              <MetricCard
                label="Compliance record"
                formula="Total deficiencies ÷ number of routine (non-complaint) inspections on file"
                tierLogic="Compared against the distribution across all 14 Alameda County facilities. At or below the 33rd percentile = Strong; 34th–66th = Mixed; above 66th = Concerns."
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
              distribution using 33rd and 66th percentile cutoffs. "Strong"
              means better than most peers; "Concerns" means worse than most peers.
              These are relative assessments within the current sample, not absolute
              benchmarks.
            </p>
            <TierKey />
          </Section>

          {/* ── Why no composite ── */}
          <Section id="no-composite-heading" title="Why we don't publish a composite score">
            <p>
              A composite score implies that one weighting of metrics is
              universally correct. It isn't. A family with a parent who has
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
                visit. They are not a real-time assessment of today's care quality.
              </li>
              <li>
                Facilities that have improved since a citation was issued will
                still show that citation. Corrective action dates are shown where
                available.
              </li>
              <li>
                A small sample (14 facilities) means percentile thresholds are
                sensitive to individual outliers. Tiers may shift as coverage expands.
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
