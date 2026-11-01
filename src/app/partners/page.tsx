import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList, buildWebPageWithReviewer } from "@/lib/seo/schema";
import { GOVERNANCE_24_WORDS } from "@/lib/seo/governance";
import { PARTNER_PRICE_USD, PARTNER_TERMS } from "@/lib/partners/constants";
import { isPartnerCheckoutEnabled } from "@/lib/partners/config";
import { loadPartnerProgramCounts } from "@/lib/partners/gate";
import { EligibilityLookup } from "@/components/partners/EligibilityLookup";

export const dynamic = "force-dynamic";

const PAGE_PATH = "/partners";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Verified Partner";
const DESC =
  "Eligible memory care communities can pay a flat fee to add labeled photos, prices, and a tour button to their own StarlynnCare page. The fee never changes a grade or a rank.";

export const metadata: Metadata = {
  title: `${TITLE} | StarlynnCare`,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: `${TITLE} | StarlynnCare`,
    description: DESC,
    url: canonicalUrl,
    type: "website",
  },
};

const RULES = [
  "Grade C or better. The composite score sits in the top half of state peers of the same care type and size. A current partner stays eligible down to C−.",
  "No severity-4 citation in 24 months. That is immediate jeopardy or the state’s equivalent.",
  "At most one severity-3 citation in 12 months, such as a California Type A.",
  "An active license, not on probation and not facing a pending suspension or revocation.",
  "A current record: at least one inspection in the last 36 months, and a public grade, which needs 10 or more peers.",
];

export default async function PartnersPage() {
  const counts = await loadPartnerProgramCounts();
  const checkoutEnabled = isPartnerCheckoutEnabled();
  const foundingOpen = counts.ok && counts.foundingTaken < counts.foundingCap;
  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Verified Partner", url: canonicalUrl },
    ]),
    buildWebPageWithReviewer({
      name: `${TITLE} | StarlynnCare`,
      url: canonicalUrl,
      description: DESC,
    }),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh] bg-paper">
        <div className="border-b border-paper-rule bg-paper-2">
          <div className="mx-auto max-w-[800px] px-4 py-14 sm:px-6 md:px-10">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-teal">
              For communities
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(36px,6vw,56px)] leading-[1.05] text-ink">
              Verified Partner
            </h1>
            <p className="mt-5 max-w-[68ch] text-[18px] leading-[1.7] text-ink-2">
              Families already read your state inspection record here. If that record clears the bar below, you can add labeled photos, prices, staffing, and a tour button to your own page.
            </p>
            <p className="mt-4 max-w-[68ch] text-[16px] leading-[1.7] text-ink-3">{GOVERNANCE_24_WORDS}</p>
          </div>
        </div>

        <div className="mx-auto max-w-[800px] px-4 py-12 sm:px-6 md:px-10">
          <p className="text-[16px] leading-[1.7] text-ink-2">
            {counts.ok ? (
              counts.active === 0 && counts.paused === 0 ? (
                <>No paying partners yet. {counts.foundingTaken} of {counts.foundingCap} founding places are reserved.</>
              ) : (
                <>
                  {counts.active} paying {counts.active === 1 ? "partner" : "partners"}. {counts.paused} paused. {counts.foundingTaken} of {counts.foundingCap} founding places are reserved.
                </>
              )
            ) : (
              <>The partner count could not be loaded.</>
            )}
          </p>

          <section className="mt-12" aria-labelledby="what-payment-buys">
            <h2 id="what-payment-buys" className="font-[family-name:var(--font-display)] text-[clamp(22px,3vw,30px)] text-ink">
              What the fee buys
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[16px] leading-[1.7] text-ink-2">
              <li>A labeled panel on your own page: up to 12 photos, a monthly price range, openings, day and night staffing, and 150 words.</li>
              <li>Tour requests from that page, sent only to you, with the family’s consent. There is no per-request fee.</li>
              <li>A badge you can place on your website. It links to your StarlynnCare record and disappears if you no longer qualify.</li>
            </ul>
            <p className="mt-4 text-[16px] leading-[1.7] text-ink-2">
              Payment does not buy a grade, a rank, a list position, a citation change, or a placement on someone else’s page. Any licensed community can reply to a finding for free.
            </p>
          </section>

          <section className="mt-12" aria-labelledby="partner-rules">
            <h2 id="partner-rules" className="font-[family-name:var(--font-display)] text-[clamp(22px,3vw,30px)] text-ink">
              Who qualifies
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-[16px] leading-[1.7] text-ink-2">
              {RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
            <p className="mt-4 text-[16px] leading-[1.7] text-ink-2">
              If a state file cannot prove an active license, or an open enforcement action, the community does not qualify. A partner that falls below the bar loses the panel, the badge, and the tour button, and billing pauses until the record clears.
            </p>
          </section>

          <section className="mt-12" aria-labelledby="partner-prices">
            <h2 id="partner-prices" className="font-[family-name:var(--font-display)] text-[clamp(22px,3vw,30px)] text-ink">
              Pricing
            </h2>
            <div className="mt-4 overflow-x-auto border border-paper-rule">
              <table className="w-full text-left text-sm">
                <thead className="bg-paper-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  <tr>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Who</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-rule text-ink-2">
                  <tr>
                    <td className="px-4 py-3 text-ink">Founding</td>
                    <td className="px-4 py-3">${PARTNER_PRICE_USD.foundingMonthly}/month or ${PARTNER_PRICE_USD.foundingAnnual.toLocaleString()}/year</td>
                    <td className="px-4 py-3">First {counts.ok ? counts.foundingCap : 20}. Price locked for 12 months. Cancel anytime.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-ink">Partner</td>
                    <td className="px-4 py-3">${PARTNER_PRICE_USD.standardMonthly}/month or ${PARTNER_PRICE_USD.standardAnnual.toLocaleString()}/year</td>
                    <td className="px-4 py-3">After the founding places are taken.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-ink">Operator</td>
                    <td className="px-4 py-3">${PARTNER_PRICE_USD.operatorMonthly} per community / month</td>
                    <td className="px-4 py-3">Five or more communities, one invoice. Each community must pass on its own.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[16px] leading-[1.7] text-ink-2">
              The operator plan is invoiced by hand.{" "}
              <a className="underline" href="mailto:hello@starlynncare.com?subject=Verified%20Partner%20operator%20plan">
                Contact hello@starlynncare.com
              </a>
              . StarlynnCare does not sell a per-request fee.
            </p>
          </section>

          <section className="mt-12" aria-labelledby="check-community">
            <h2 id="check-community" className="font-[family-name:var(--font-display)] text-[clamp(22px,3vw,30px)] text-ink">
              Check a community
            </h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-ink-2">
              The lookup uses the same gate as the nightly check. A public “top half” line on its own is not enough.
            </p>
            <div className="mt-6">
              <EligibilityLookup checkoutEnabled={checkoutEnabled} foundingOpen={foundingOpen} />
            </div>
          </section>

          <section className="mt-12" aria-labelledby="partner-terms">
            <h2 id="partner-terms" className="font-[family-name:var(--font-display)] text-[clamp(22px,3vw,30px)] text-ink">
              Partner terms
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-[16px] leading-[1.7] text-ink-2">
              {PARTNER_TERMS.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ol>
          </section>

          <p className="mt-12 text-sm text-ink-3">
            <Link href="/editorial-policy" className="underline">
              Editorial policy
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
