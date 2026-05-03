import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor, SITE_ORIGIN } from "@/lib/seo/canonical";
import {
  buildBreadcrumbList,
  buildPersonSchema,
  buildStarlynnPerson,
  buildWebPageWithReviewer,
} from "@/lib/seo/schema";

const ABOUT_PATH = "/about";
const aboutCanonical = canonicalFor(ABOUT_PATH);
const aboutDesc =
  "StarlynnCare is built by Rebecca Lynn Starkey, BSN, RN, PHN (California RN license 95100373), and Blake Jones — combining bedside nursing, public-health regulation, and editorial rigor so families can read California memory care inspection data with confidence.";

export const metadata: Metadata = {
  title: "About | StarlynnCare",
  description: aboutDesc,
  alternates: { canonical: aboutCanonical },
  openGraph: {
    title: "About | StarlynnCare",
    description: aboutDesc,
    url: aboutCanonical,
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "StarlynnCare" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About | StarlynnCare",
    description: aboutDesc,
  },
};

export default function AboutPage() {
  const aboutJsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "About", url: aboutCanonical },
    ]),
    buildWebPageWithReviewer({
      name: "About | StarlynnCare",
      url: aboutCanonical,
      description: aboutDesc,
    }),
    buildStarlynnPerson(),
    buildPersonSchema({
      id: `${SITE_ORIGIN}/about#person-blake-jones`,
      name: "Blake Jones",
      jobTitle: "Co-founder · Operations & editorial systems",
      description:
        "MBA candidate at UC Berkeley Haas; leads product narrative, data partnerships, and responsible distribution of California licensing records.",
      image: "/images/about/blake-jones.png",
      url: `${SITE_ORIGIN}/about#person-blake-jones`,
    }),
  ];

  return (
    <>
      <JsonLd objects={aboutJsonLd} />
      <GovernanceBar />
      <SiteNav />
      <main className="bg-warm-white">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="border-b border-sc-border">
          <div className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-20">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              <Link href="/" className="hover:text-teal transition-colors">
                StarlynnCare
              </Link>{" "}
              · About
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight text-navy md:text-[2.75rem] md:leading-tight">
              About StarlynnCare
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate max-w-[620px]">
              Choosing a care facility for someone you love is one of the hardest decisions a family can make —
              and one of the least transparent. We built StarlynnCare because public regulatory data already
              exists; it simply was not assembled for families navigating dementia care under pressure.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-slate max-w-[620px]">
              Our thesis is straightforward: when inspection narratives, deficiency classifications, and complaint
              outcomes sit beside plain-language guides on cost, staffing expectations, and tour questions,
              families stop guessing and start comparing reality to marketing.
            </p>
          </div>
        </section>

        {/* ── Founders ─────────────────────────────────────────────────────── */}
        <section className="border-b border-sc-border">
          <div className="mx-auto max-w-[1000px] px-6 py-16 md:px-8 md:py-20">
            <div className="grid gap-10 md:grid-cols-2 md:gap-12">
              {/* Star */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-full border-2 border-sc-border bg-sc-border/20 shadow-card">
                  <Image
                    src="/images/about/star.png"
                    alt="Rebecca Lynn Starkey, BSN, RN, PHN — Co-founder of StarlynnCare"
                    fill
                    className="object-cover object-top"
                    sizes="144px"
                    priority
                  />
                </div>
                <div className="mt-5">
                  <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
                    Rebecca Lynn Starkey, BSN, RN, PHN
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-teal">
                    Co-founder · Clinical voice
                  </p>
                  <p className="mt-2 text-sm text-slate">
                    California Registered Nurse License <strong>95100373</strong> — verify anytime via the{" "}
                    <a
                      href="https://search.dca.ca.gov/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-teal underline-offset-4 hover:underline"
                    >
                      California Department of Consumer Affairs license lookup
                    </a>{" "}
                    (search by name or license number).
                  </p>
                </div>
                <div className="mt-5 space-y-4 text-base leading-relaxed text-slate">
                  <p>
                    Friends call her Star — but clinical bylines use her legal name so families can validate
                    credentials the same way they would check a discharge planner or hospice liaison.
                  </p>
                  <p>
                    Rebecca&apos;s practice history spans bedside nursing, public-health case management, and a
                    chapter inside regulatory survey work — walking into facilities after complaints landed,
                    reading medication administration records under fluorescent lights, and watching how quickly
                    operators corrected versus spun.
                  </p>
                  <p>
                    That grounding informs every pillar article on StarlynnCare: when we translate Type A and Type B
                    deficiencies, walk through Medi-Cal versus Medicare limits, or draft tour questions, a practicing
                    RN license sits behind the words — not an anonymous content farm.
                  </p>
                </div>
              </div>

              {/* Blake */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-full border-2 border-sc-border bg-sc-border/20 shadow-card">
                  <Image
                    src="/images/about/blake-jones.png"
                    alt="Blake Jones — Co-founder of StarlynnCare"
                    fill
                    className="object-cover object-top"
                    sizes="144px"
                    priority
                  />
                </div>
                <div className="mt-5">
                  <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
                    Blake Jones
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-teal">
                    Co-founder · Systems & storytelling
                  </p>
                </div>
                <div className="mt-5 space-y-4 text-base leading-relaxed text-slate">
                  <p>
                    Blake leads the publishing stack that ingests CDSS exports, normalizes inspection narratives,
                    and keeps StarlynnCare&apos;s methodology transparent enough for journalists and discharge
                    planners to reuse with attribution.
                  </p>
                  <p>
                    His background is brand journalism and operations — currently an MBA candidate at UC Berkeley
                    Haas — which shows up less on page copy and more in how quickly facility records refresh, how
                    canonical URLs stay stable, and how governance language stays brutally short (see the rust banner
                    above).
                  </p>
                  <p>
                    Together we split responsibilities: Rebecca sets clinical guardrails; Blake enforces data
                    integrity and refuses paid placement dollars that would contaminate rankings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Editorial standards ───────────────────────────────────────────── */}
        <section className="border-b border-sc-border">
          <div className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-16">
            <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
              Editorial standards & conflict of interest
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-slate">
              <p>
                We publish inspection-derived facts and clearly labeled interpretation. We do not accept referral
                fees, &ldquo;lead auctions,&rdquo; or sponsored tiles inside facility directories. If that policy
                ever changes, this page will scream the update before any contract ink dries.
              </p>
              <p>
                Corrections matter: when primary records disagree with our copy, we fix the page, cite the source,
                and log substantive clinical edits with a refreshed reviewer date. Read the full commitment in our{" "}
                <Link href="/editorial-policy" className="font-medium text-teal underline-offset-4 hover:underline">
                  editorial policy
                </Link>
                .
              </p>
              <p>
                Discharge planners, social workers, and geriatric care managers are welcome to cite StarlynnCare
                URLs in packets — the license numbers link straight to CDSS source material whenever families want
                to double-click.
              </p>
            </div>
          </div>
        </section>

        {/* ── Footer CTA ───────────────────────────────────────────────────── */}
        <section>
          <div className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-16">
            <p className="text-base leading-relaxed text-slate">
              Questions, corrections, or collaboration ideas?{" "}
              <a
                href="mailto:hello@starlynncare.com"
                className="font-medium text-teal underline-offset-4 hover:underline"
              >
                hello@starlynncare.com
              </a>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
