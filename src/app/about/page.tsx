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
  "StarlynnCare was built by a California RN to give families access to state inspection records that already exist — organized for care decisions under pressure.";

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
        "MBA candidate at UC Berkeley Haas (Social Impact concentration); leads the data pipeline, ingestion scripts, and normalization layer that powers StarlynnCare's facility profiles.",
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
              The first time you tour a memory care facility, you are already behind. The marketing materials
              are professional. The lobby smells like fresh flowers. The admissions coordinator knows exactly
              how long to make eye contact. And the state inspection record — the document where a regulator
              walked those same halls and wrote down what they found — is buried on a government portal in a
              format that assumes you know what a Type-A deficiency is.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-slate max-w-[620px]">
              Most families don&rsquo;t. Most families are calling facilities the same week a neurologist uses
              the word &ldquo;placement.&rdquo; There is no runway. There is no research team. There is one
              person — usually a daughter or a spouse — Googling at midnight and clicking through paid
              directories where the top results are whoever wrote the largest referral check that month.
            </p>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="border-b border-sc-border">
          <div className="mx-auto max-w-[760px] px-6 py-14 md:px-8 md:py-16">
            <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
              How it works
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-slate">
              <p>
                The technical core is a data pipeline that ingests state inspection exports and normalizes
                them into facility profiles. For California, that means pulling directly from CDSS Community
                Care Licensing — license numbers, facility characteristics, deficiency narratives, and complaint
                outcomes, matched to facilities by their official CDSS license identifier. Texas records come
                from HHSC&rsquo;s Long-Term Care licensing system. Oregon runs through DHS, Washington through
                DSHS, Minnesota through MDH. Each regulator uses different severity classifications and different
                inspection frequencies; the profiles explain those differences in plain language so a family
                comparing a California RCFE to a Texas ALF doesn&rsquo;t mistake the terminology for the quality
                signal.
              </p>
              <p>
                Peer rankings are derived from inspection data within each state, not across states. A facility&rsquo;s
                percentile reflects how its citation history compares to similarly-licensed facilities in the
                same regulatory environment — not against a national average that would obscure what
                California&rsquo;s inspection frequency actually looks like relative to Minnesota&rsquo;s. The
                methodology is published and linkable. Discharge planners and geriatric care managers are welcome
                to cite StarlynnCare profiles directly in placement packets; the license numbers link straight to
                the originating regulator portal whenever families want to verify the primary source.
              </p>
            </div>
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
                    className="object-cover object-[center_33%] brightness-110"
                    sizes="144px"
                    priority
                  />
                </div>
                <div className="mt-5">
                  <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
                    Rebecca Lynn Starkey, BSN, RN, PHN
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
                    Co-founder · Clinical voice
                  </p>
                </div>
                <div className="mt-5 space-y-4 text-base leading-relaxed text-slate">
                  <p>
                    Rebecca Lynn Starkey — friends call her Star — is a registered nurse whose career spans
                    older adult primary care, public health case management, and regulatory survey work in
                    California. That last category is the relevant one here: she has walked into facilities
                    after complaints, reviewed records, interviewed staff, and seen firsthand whether cited
                    deficiencies were being fixed or being reframed. Her California RN license (Board of
                    Registered Nursing #95100373, verifiable at search.dca.ca.gov) is the credential that
                    anchors StarlynnCare&rsquo;s clinical review chain. Every guide, every glossary entry,
                    and every tour question on this site passes through Star&rsquo;s review before it
                    publishes.
                  </p>
                  <p>
                    What she saw in that work was a pattern: the same facilities appeared on repeat. The same
                    classes of deficiency — medication errors, staffing shortfalls, inadequate dementia
                    programming — kept showing up under new administration names or after a round of cosmetic
                    renovations. Families making placement decisions had no systematic way to see that history.
                    Paid review sites, referral aggregators, and facility marketing filled the void with
                    content that served operators. Star decided to build something that served families.
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
                    className="object-cover object-[center_20%] brightness-110"
                    sizes="144px"
                    priority
                  />
                </div>
                <div className="mt-5">
                  <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
                    Blake Jones
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
                    Co-founder · Systems & storytelling
                  </p>
                </div>
                <div className="mt-5 space-y-4 text-base leading-relaxed text-slate">
                  <p>
                    Blake leads the publishing stack — the ingestion scripts, the normalization layer, the
                    data pipeline that turns raw CDSS and HHSC exports into the structured facility profiles
                    on this site. His background is brand strategy and operations; he is currently an MBA
                    candidate at UC Berkeley Haas, where his concentration is Social Impact.
                  </p>
                  <p>
                    He is also Star&rsquo;s husband, which is how this project started: a conversation about
                    why the families she was trying to help kept making decisions without the information she
                    already had access to.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-10 text-center font-[family-name:var(--font-display)] italic text-[18px] text-slate">
              And they happened to be married.
            </p>
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
                StarlynnCare&rsquo;s editorial decisions — which facilities appear, how they are ranked,
                what the guides say — are made by the founders without operator input. Neither Blake nor Star
                holds equity in any licensed memory care operator reviewed on this site. No pending commercial
                relationships with operators exist. Future partnerships — research grants, foundation funding,
                or data licensing arrangements — will be disclosed on this page if they could materially
                influence how facilities are ranked.
              </p>
              <p>
                Errors happen. When primary regulatory records contradict something published on a facility
                profile, the correction goes up within five business days of verifiable notice. Substantive
                clinical changes to editorial guides carry an updated reviewer date and a note on what changed.
                The fastest path to a correction is{" "}
                <a
                  href="mailto:hello@starlynncare.com"
                  className="font-medium text-teal underline-offset-4 hover:underline"
                >
                  hello@starlynncare.com
                </a>{" "}
                with the facility&rsquo;s license number and a link to the primary source. Read the full
                commitment in our{" "}
                <Link href="/editorial-policy" className="font-medium text-teal underline-offset-4 hover:underline">
                  editorial policy
                </Link>
                .
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
