import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import {
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";

const PAGE_PATH = "/memory-care-facility-ratings";
const pageCanonical = canonicalFor(PAGE_PATH);
const pageTitle = "Memory Care Facility Ratings | StarlynnCare";
const pageDesc =
  "Memory care facility ratings, explained: how we grade every facility from state inspection records — with no referral commissions or paid placement.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDesc,
  alternates: { canonical: pageCanonical },
  openGraph: {
    title: pageTitle,
    description: pageDesc,
    url: pageCanonical,
    type: "article",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDesc,
    images: ["/og-default.png"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────

const STATE_SECTIONS: Array<{
  code: string;
  name: string;
  hubSlug: string;
  regulator: string;
  licenseType: string;
  inspectionSummary: string;
  licenseExplainerHref: string | null;
  licenseExplainerLabel: string | null;
}> = [
  {
    code: "CA",
    name: "California",
    hubSlug: "california",
    regulator: "CDSS Community Care Licensing",
    licenseType: "Residential Care Facility for the Elderly (RCFE)",
    inspectionSummary:
      "CDSS inspects every RCFE on an unannounced basis and publishes every deficiency finding in one of two classes: Type A (immediate health or safety risk) and Type B (lesser violation). Each finding includes the regulation violated, an inspector narrative, and the facility's plan of correction. We index every published finding for every licensed facility.",
    licenseExplainerHref: null,
    licenseExplainerLabel: null,
  },
  {
    code: "OR",
    name: "Oregon",
    hubSlug: "oregon",
    regulator: "Oregon DHS LTC Licensing",
    licenseType: "Memory Care Endorsed ALF or Residential Care Facility (RCF)",
    inspectionSummary:
      "Oregon DHS licenses and inspects Assisted Living Facilities with a Memory Care endorsement and Residential Care Facilities. Inspection findings are published with rule citations and detailed narratives. We index every published inspection and deficiency for Oregon's memory care licensed facilities.",
    licenseExplainerHref: "/oregon/memory-care-licensing",
    licenseExplainerLabel: "Oregon memory care licensing explained",
  },
  {
    code: "WA",
    name: "Washington",
    hubSlug: "washington",
    regulator: "DSHS Aging and Long-Term Support Administration",
    licenseType: "Specialized Dementia Care ALF",
    inspectionSummary:
      "Washington DSHS licenses Specialized Dementia Care programs within Assisted Living Facilities and publishes findings from both routine surveys and complaint investigations. We index inspection findings from the DSHS ALF Reports portal for every licensed Washington memory care facility.",
    licenseExplainerHref: "/washington/memory-care-licensing",
    licenseExplainerLabel: "Washington memory care licensing explained",
  },
  {
    code: "MN",
    name: "Minnesota",
    hubSlug: "minnesota",
    regulator: "Minnesota Department of Health (MDH)",
    licenseType: "Assisted Living Facility with Dementia Care (ALFD)",
    inspectionSummary:
      "Minnesota's 2021 ALF law created the Assisted Living Facility with Dementia Care (ALFD) licensure category. MDH inspects every ALFD and publishes statements of deficiencies. We index MDH findings for all licensed Minnesota memory care facilities.",
    licenseExplainerHref: "/minnesota/memory-care-licensing",
    licenseExplainerLabel: "Minnesota memory care licensing explained",
  },
  {
    code: "TX",
    name: "Texas",
    hubSlug: "texas",
    regulator: "HHSC Long-Term Care Regulation (LTCR)",
    licenseType: "Alzheimer Certified Assisted Living Facility",
    inspectionSummary:
      "Texas HHSC licenses Alzheimer-certified ALFs and publishes inspection findings through the Long-Term Care Regulation (LTCR) portal. We index findings for Alzheimer-certified facilities where published. Note: Texas ALF license types (A/B/C) denote capacity class, not deficiency severity — this differs from California's Type A/B deficiency classification.",
    licenseExplainerHref: "/texas/type-a-b-c-licensing",
    licenseExplainerLabel: "Texas ALF license types explained",
  },
  {
    code: "PA",
    name: "Pennsylvania",
    hubSlug: "pennsylvania",
    regulator: "PA Department of Human Services, Office of Long-Term Living (OLTL)",
    licenseType: "Personal Care Home (PCH) or Assisted Living Residence (ALR)",
    inspectionSummary:
      "Pennsylvania DHS licenses Personal Care Homes and Assisted Living Residences that provide memory care services. PA DHS publishes inspection findings including severity scores and Immediate Jeopardy findings. We index every published finding for Pennsylvania's memory care facilities.",
    licenseExplainerHref: "/pennsylvania/memory-care-licensing",
    licenseExplainerLabel: "Pennsylvania memory care licensing explained",
  },
];

const FAQ_PAIRS = [
  {
    q: "How does StarlynnCare rate memory care facilities?",
    a: "StarlynnCare rates facilities using only official state inspection records — we do not accept paid placements, referral fees, or operator submissions that could bias rankings. Each facility is scored on four independent signals derived from its state inspection file: citation severity (how serious), citation frequency (how often), repeat citations (the same problem recurring), and inspection recency (how current the data is). These signals are compared against the facility's local peer set so a rural facility is not penalized for having fewer inspections than a large urban community.",
  },
  {
    q: "What does 'rated by inspection records' mean?",
    a: "Every state that licenses memory care facilities must inspect them on a regular basis and publish the findings. Those published findings — called deficiencies, citations, or statements of deficiency depending on the state — are the raw data behind our ratings. We ingest these documents directly from each state's licensing portal and parse them into a searchable database. A facility's 'rating' on StarlynnCare is therefore an index of its published government inspection record, not a consumer review or an advertiser-sponsored ranking.",
  },
  {
    q: "Do you use star ratings or letter grades?",
    a: "No. We do not publish a single composite letter grade or star rating because doing so would collapse four meaningfully different signals into one number that obscures more than it reveals. Instead, we show the individual signals — severity tier, frequency tier, repeat-citation status, and recency — so a family can weigh the specific risks that matter most for their situation. Full scoring methodology is at /methodology.",
  },
  {
    q: "Why are these ratings better than A Place for Mom or Caring.com?",
    a: "A Place for Mom, Caring.com, and similar referral services earn revenue by connecting families to facilities — which creates a structural conflict: they cannot publish inspection-derived ratings that penalize their paying customers. StarlynnCare earns no referral fees or commissions from any facility, so we can publish the full inspection record for every facility including those that would never pay to be listed.",
  },
  {
    q: "How often is the inspection data updated?",
    a: "We re-ingest state inspection records regularly — the exact cadence varies by state based on how frequently each licensing portal publishes new data. Each facility profile displays a 'refreshed' date showing when its data was last updated from the source.",
  },
  {
    q: "Does a clean inspection record mean a facility is safe?",
    a: "No. A clean inspection record means no documented violations were found during the inspections we have on file. State inspections do not capture every incident, they are periodic and not continuous, and some regulators have longer inspection cycles than others. A clean record is a positive signal — but it is not a guarantee. We always recommend families conduct their own tours and interviews. Our 37-question tour checklist is at /library/37-questions-to-ask-on-a-memory-care-tour.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function MemoryCareFacilityRatingsPage() {
  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Memory care facility ratings", url: pageCanonical },
    ]),
    buildWebPageWithReviewer({
      name: pageTitle,
      url: pageCanonical,
      description: pageDesc,
    }),
    buildFaqSchemaFromPairs(FAQ_PAIRS, pageCanonical),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <div className="flex flex-col">
        <div className="-order-1">
          <GovernanceBar scope="national" />
          <SiteNav />
        </div>

        <main style={{ background: "var(--color-paper)" }}>
          {/* ── Hero ── */}
          <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[900px] px-4 sm:px-6 md:px-10 py-16">
              <nav
                className="flex items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
                aria-label="Breadcrumb"
              >
                <Link href="/" className="hover:text-teal transition-colors">Home</Link>
                <span aria-hidden>›</span>
                <span className="text-ink-3">Memory care facility ratings</span>
              </nav>

              <h1
                className="font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink"
                style={{ fontSize: "clamp(36px, 4.5vw, 60px)", lineHeight: 1.05 }}
              >
                Memory care facility ratings,{" "}
                <em>explained.</em>
              </h1>
              <p className="mt-5 text-[19px] leading-[1.5] text-ink-3 max-w-[58ch]">
                How we grade every licensed memory care facility from state inspection
                records — no referral fees, no paid placements, no invented data.
              </p>

              <div className="mt-8 flex flex-wrap gap-3 text-[13px]">
                <Link
                  href="/methodology"
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/5 px-4 py-2 text-teal hover:bg-teal/10 transition-colors"
                >
                  Full scoring methodology →
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-full border border-paper-rule px-4 py-2 text-ink-3 hover:text-ink hover:border-ink/20 transition-colors"
                >
                  Browse facilities
                </Link>
              </div>
            </div>
          </div>

          {/* ── What "rated by inspection records" means ── */}
          <div className="border-b border-paper-rule">
            <div className="mx-auto max-w-[900px] px-4 sm:px-6 md:px-10 py-14">
              <div className="mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
                § What this means
              </div>
              <h2
                className="font-[family-name:var(--font-display)] font-normal tracking-[-0.015em] text-ink mt-1 mb-4"
                style={{ fontSize: "clamp(24px, 3vw, 36px)" }}
              >
                The public record <em>no one else publishes.</em>
              </h2>
              <div className="space-y-4 text-[17px] leading-[1.7] text-ink-2 max-w-[66ch]">
                <p>
                  Every state that licenses memory care facilities must inspect them
                  and publish the findings. Those published findings — called deficiencies,
                  citations, or statements of deficiency depending on the state — are the
                  raw data behind our ratings.
                </p>
                <p>
                  We ingest inspection records directly from each state&rsquo;s licensing
                  portal and parse them into a searchable database. A facility&rsquo;s
                  &ldquo;rating&rdquo; on StarlynnCare is an index of its published
                  government inspection record — not a consumer review, not an advertiser-
                  sponsored ranking, and not a survey result.
                </p>
                <p>
                  Referral services like A Place for Mom and Caring.com earn revenue when
                  a family chooses a facility through them — which creates a structural
                  conflict: they cannot publish inspection-derived ratings that penalize
                  their paying customers.{" "}
                  <strong className="font-semibold text-ink">
                    StarlynnCare earns no referral fees or commissions from any facility,
                  </strong>{" "}
                  so we can publish the full record for every facility including those
                  that would never pay to be listed.
                </p>
              </div>
            </div>
          </div>

          {/* ── Four signals ── */}
          <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[900px] px-4 sm:px-6 md:px-10 py-14">
              <div className="mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
                § How we score
              </div>
              <h2
                className="font-[family-name:var(--font-display)] font-normal tracking-[-0.015em] text-ink mt-1 mb-6"
                style={{ fontSize: "clamp(24px, 3vw, 36px)" }}
              >
                Four signals, <em>not one grade.</em>
              </h2>
              <p className="text-[17px] leading-[1.7] text-ink-2 max-w-[66ch] mb-8">
                We do not publish a single composite letter grade or star rating — doing so
                collapses four meaningfully different signals into one number that obscures
                more than it reveals. Instead, we show each signal independently.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    n: "01",
                    label: "Citation severity",
                    desc: "How serious were the violations? Type A (immediate risk) citations carry more weight than Type B (lesser violation) citations. Compared against local peers.",
                  },
                  {
                    n: "02",
                    label: "Citation frequency",
                    desc: "How often does this facility accumulate citations per inspection? A facility inspected twice with zero citations is different from one inspected twice with ten.",
                  },
                  {
                    n: "03",
                    label: "Repeat citations",
                    desc: "The same violation recurring across multiple inspection cycles is a strong signal that the underlying issue is not being corrected — it weights heavily against a facility.",
                  },
                  {
                    n: "04",
                    label: "Inspection recency",
                    desc: "How current is the data? A facility last inspected three years ago has a weaker signal than one inspected six months ago. We flag limited-history facilities explicitly.",
                  },
                ].map(({ n, label, desc }) => (
                  <div
                    key={n}
                    className="rounded-xl border border-paper-rule bg-paper px-5 py-5 space-y-2"
                  >
                    <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4">
                      {n}
                    </div>
                    <h3 className="font-[family-name:var(--font-display)] text-[18px] text-ink leading-snug">
                      {label}
                    </h3>
                    <p className="text-[14px] leading-[1.6] text-ink-3">{desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[14px] text-ink-3">
                Full formula details, peer-comparison logic, and tier thresholds:{" "}
                <Link href="/methodology" className="text-teal underline underline-offset-4">
                  read the methodology
                </Link>
                .
              </p>
            </div>
          </div>

          {/* ── Per-state sections ── */}
          <div className="border-b border-paper-rule">
            <div className="mx-auto max-w-[900px] px-4 sm:px-6 md:px-10 py-14">
              <div className="mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
                § By state
              </div>
              <h2
                className="font-[family-name:var(--font-display)] font-normal tracking-[-0.015em] text-ink mt-1 mb-2"
                style={{ fontSize: "clamp(24px, 3vw, 36px)" }}
              >
                Ratings in every state <em>we cover.</em>
              </h2>
              <p className="text-[16px] leading-[1.7] text-ink-3 mb-10 max-w-[60ch]">
                Each state licenses and inspects memory care differently. Here is what
                the inspection record looks like in each of the {STATE_SECTIONS.length} states
                we currently cover.
              </p>
              <div className="space-y-10">
                {STATE_SECTIONS.map((s) => (
                  <div
                    key={s.code}
                    id={`state-${s.code.toLowerCase()}`}
                    className="border-l-2 border-rust/30 pl-6"
                  >
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className="font-[family-name:var(--font-display)] text-[22px] text-ink leading-tight">
                        {s.name}
                      </h3>
                      <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-ink-4 border border-paper-rule rounded px-1.5 py-0.5">
                        {s.code}
                      </span>
                    </div>
                    <p className="text-[13px] font-[family-name:var(--font-mono)] text-ink-4 mb-3">
                      Regulator: {s.regulator} · License type: {s.licenseType}
                    </p>
                    <p className="text-[15px] leading-[1.65] text-ink-2 mb-4 max-w-[66ch]">
                      {s.inspectionSummary}
                    </p>
                    <div className="flex flex-wrap gap-3 text-[13px]">
                      <Link
                        href={`/${s.hubSlug}`}
                        className="text-teal underline underline-offset-4 hover:text-teal/80"
                      >
                        Browse {s.name} facilities →
                      </Link>
                      {s.licenseExplainerHref && s.licenseExplainerLabel && (
                        <Link
                          href={s.licenseExplainerHref}
                          className="text-ink-3 underline underline-offset-4 hover:text-ink"
                        >
                          {s.licenseExplainerLabel} →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── FAQ ── */}
          <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
            <div className="mx-auto max-w-[900px] px-4 sm:px-6 md:px-10 py-14">
              <div className="mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
                § FAQ
              </div>
              <h2
                className="font-[family-name:var(--font-display)] font-normal tracking-[-0.015em] text-ink mt-1 mb-8"
                style={{ fontSize: "clamp(24px, 3vw, 36px)" }}
              >
                Common <em>questions.</em>
              </h2>
              <div className="space-y-8 max-w-[66ch]">
                {FAQ_PAIRS.map(({ q, a }) => (
                  <div key={q}>
                    <h3 className="font-[family-name:var(--font-display)] text-[18px] text-ink leading-snug mb-2">
                      {q}
                    </h3>
                    <p className="text-[15px] leading-[1.7] text-ink-2">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Footer CTA ── */}
          <div>
            <div className="mx-auto max-w-[900px] px-4 sm:px-6 md:px-10 py-14">
              <p className="font-[family-name:var(--font-display)] text-[22px] text-ink mb-4">
                Ready to look up a specific facility?
              </p>
              <div className="flex flex-wrap gap-3 text-[14px]">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-5 py-2.5 hover:bg-ink/90 transition-colors"
                >
                  Search facilities
                </Link>
                <Link
                  href="/methodology"
                  className="inline-flex items-center gap-1.5 rounded-full border border-paper-rule px-5 py-2.5 text-ink-3 hover:text-ink hover:border-ink/20 transition-colors"
                >
                  Full methodology
                </Link>
                <Link
                  href="/library/37-questions-to-ask-on-a-memory-care-tour"
                  className="inline-flex items-center gap-1.5 rounded-full border border-paper-rule px-5 py-2.5 text-ink-3 hover:text-ink hover:border-ink/20 transition-colors"
                >
                  Tour questions checklist
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
