import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList } from "@/lib/seo/schema";

const PAGE_PATH = "/terms";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Terms of Use & Legal Disclaimer";
const DESC =
  "Terms governing use of StarlynnCare, including disclaimer of warranties, limitation of liability, public-records basis, and notice that nothing on this site constitutes medical or legal advice.";
const EFFECTIVE = "May 2026";

export const metadata: Metadata = {
  title: `${TITLE} | StarlynnCare`,
  description: DESC,
  alternates: { canonical: canonicalUrl },
  robots: { index: true, follow: false },
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
    <section className="mt-12 scroll-mt-24" aria-labelledby={id}>
      <h2
        id={id}
        className="font-[family-name:var(--font-display)] text-[clamp(20px,3vw,28px)] text-ink mb-4"
      >
        {title}
      </h2>
      <div className="space-y-4 text-[16px] leading-[1.75] text-ink-2 max-w-[72ch]">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Terms of Use", url: canonicalUrl },
    ]),
  ];

  return (
    <>
      <JsonLd objects={jsonLd} />
      <GovernanceBar />
      <SiteNav />

      <main className="min-h-[60vh]" style={{ background: "var(--color-paper)" }}>
        <div className="border-b border-paper-rule" style={{ background: "var(--color-paper-2)" }}>
          <div className="mx-auto max-w-[800px] px-4 sm:px-6 md:px-10 py-14">
            <nav
              className="flex flex-wrap items-center gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">Terms of Use</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Legal
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5">
              Terms of Use
            </h1>
            <p className="text-[14px] font-[family-name:var(--font-mono)] text-ink-4 mb-4">
              Effective {EFFECTIVE} · Last updated {EFFECTIVE}
            </p>
            <p className="text-[17px] leading-relaxed text-ink-3 max-w-[62ch]">
              Please read these Terms carefully before using StarlynnCare. By accessing or using this
              site you agree to be bound by these Terms. If you do not agree, do not use this site.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[800px] px-4 sm:px-6 md:px-10 py-14">

          <Section id="about" title="1. About StarlynnCare">
            <p>
              StarlynnCare is operated by <strong>StarlynnCare, PBC</strong>, a California Public Benefit
              Corporation (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). We publish a
              civic-data resource that indexes publicly available inspection records, citation data, and
              licensing information for memory care and residential care facilities in California. We are
              an independent editorial publisher; we are not a care placement service, referral agency,
              or licensed healthcare provider.
            </p>
          </Section>

          <Section id="public-records" title="2. Public-records basis">
            <p>
              The facility inspection data, deficiency records, complaint outcomes, and licensing
              information published on this site are reproduced or derived from records produced by
              the <strong>California Department of Social Services (CDSS), Community Care
              Licensing Division</strong> and, where applicable, the federal <strong>Centers for
              Medicare &amp; Medicaid Services (CMS) Care Compare</strong> database. These are
              official government records maintained under California Health &amp; Safety Code
              §1569 et seq. and related regulations.
            </p>
            <p>
              Our publication of these records constitutes the exercise of First Amendment rights
              with respect to matters of public concern. Nothing in these Terms limits any right
              of access to government records or restricts fair reporting on matters of public
              health and safety. California&rsquo;s fair-report privilege (California Civil Code
              §47(d)) protects accurate reporting on official government proceedings and records.
            </p>
            <p>
              StarlynnCare does not fabricate, alter, or editorialize inspection outcomes.
              Inspection narratives are reproduced from primary CDSS source documents. Analytic
              metrics (peer percentiles, composite scores) are computed from those records and
              are clearly labeled as such. Disputes regarding the underlying CDSS data should
              be directed to CDSS at{" "}
              <a href="https://www.cdss.ca.gov" target="_blank" rel="noopener noreferrer" className="text-teal underline underline-offset-4">
                www.cdss.ca.gov
              </a>.
            </p>
          </Section>

          <Section id="not-advice" title="3. Not medical, legal, or placement advice">
            <p>
              <strong>
                Nothing on this site constitutes medical advice, clinical recommendations, legal
                advice, or a referral to any specific facility or care provider.
              </strong>
            </p>
            <p>
              Facility profiles, inspection summaries, peer-percentile metrics, and editorial
              content are provided for <em>informational purposes only</em> to assist families and
              discharge planners in understanding publicly available government inspection records.
              They are not a substitute for:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Independent evaluation of a facility by a licensed healthcare professional;</li>
              <li>An in-person visit and tour of any prospective facility;</li>
              <li>Review of the current CDSS licensing record directly from CDSS;</li>
              <li>Legal advice from a licensed attorney; or</li>
              <li>Guidance from a licensed care placement advisor.</li>
            </ul>
            <p>
              StarlynnCare accepts no responsibility for care decisions made based on content
              published on this site.
            </p>
          </Section>

          <Section id="disclaimer" title="4. Disclaimer of warranties">
            <p>
              <strong>
                THIS SITE AND ALL CONTENT ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
                AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
              </strong>
            </p>
            <p>
              To the fullest extent permitted by applicable law, StarlynnCare expressly disclaims
              all warranties, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Implied warranties of merchantability, fitness for a particular purpose, and
                non-infringement;</li>
              <li>Warranties that data is accurate, complete, current, or error-free;</li>
              <li>Warranties of uninterrupted or secure site access; and</li>
              <li>Warranties regarding inspection records, deficiency counts, or licensing
                status as of any specific date.</li>
            </ul>
            <p>
              CDSS publishes inspection records on a rolling basis. A facility&rsquo;s record may
              change between our ingest cycles. Always verify current status directly with CDSS.
              Inspection data indexed on this site may lag behind CDSS by days or weeks depending
              on scrape cadence.
            </p>
          </Section>

          <Section id="liability" title="5. Limitation of liability">
            <p>
              <strong>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
                STARLYNNCARE, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR CONTRACTORS BE LIABLE
                FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY
                DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THIS SITE OR THE CONTENT
                HEREIN.
              </strong>
            </p>
            <p>
              This includes, without limitation, damages for:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Reliance on inspection data, percentile scores, or editorial content;</li>
              <li>Care placement decisions or outcomes;</li>
              <li>Loss of business, revenue, or reputation by any facility operator;</li>
              <li>Errors, omissions, or inaccuracies in reproduced government records; or</li>
              <li>Interruption of access to this site.</li>
            </ul>
            <p>
              Where liability cannot be excluded by law, our total aggregate liability to any
              party shall not exceed one hundred U.S. dollars (US$100).
            </p>
          </Section>

          <Section id="facility-operators" title="6. Notice to facility operators">
            <p>
              Facility profiles on this site reproduce official California CDSS public records.
              This publication is protected speech under the First Amendment of the U.S.
              Constitution and California&rsquo;s anti-SLAPP statute (California Code of Civil
              Procedure §425.16), which provides for early dismissal and fee-shifting in suits
              arising from protected speech on matters of public concern.
            </p>
            <p>
              If you believe a specific data point in your facility&rsquo;s profile is factually
              inaccurate as published (e.g., wrong inspection date, wrong deficiency count
              attributable to our processing), contact us at{" "}
              <a href="mailto:hello@starlynncare.com" className="text-teal underline underline-offset-4">
                hello@starlynncare.com
              </a>{" "}
              with primary-source CDSS documentation. We will acknowledge verifiable corrections
              within five business days per our{" "}
              <Link href="/editorial-policy" className="text-teal underline underline-offset-4">
                editorial policy
              </Link>
              .
            </p>
            <p>
              Disputes regarding the <em>underlying CDSS record itself</em> — the inspection
              finding, deficiency classification, or enforcement action — must be addressed
              directly with CDSS. StarlynnCare cannot modify primary government records and will
              not remove factually accurate reproductions of public records in response to
              operator requests.
            </p>
          </Section>

          <Section id="indemnification" title="7. Indemnification">
            <p>
              You agree to defend, indemnify, and hold harmless StarlynnCare and its officers,
              directors, employees, and contractors from and against any claims, damages, losses,
              costs, or expenses (including reasonable attorneys&rsquo; fees) arising out of or
              relating to: (a) your use of this site in violation of these Terms; (b) your
              violation of any applicable law or third-party right; or (c) any content you submit
              to this site (including facility correction submissions or reviews).
            </p>
          </Section>

          <Section id="intellectual-property" title="8. Intellectual property">
            <p>
              The StarlynnCare name, logo, site design, editorial text, and analytic methodology
              are proprietary to StarlynnCare, PBC. Underlying CDSS inspection data is a
              government work and is not subject to copyright.
            </p>
            <p>
              You may link to individual facility profiles or county hub pages. You may not
              scrape, reproduce, or redistribute our editorial content, facility scoring
              methodology, or design assets at scale without prior written permission.
              Automated access to this site for bulk data collection is subject to our{" "}
              <Link href="/llms.txt" className="text-teal underline underline-offset-4">
                usage policy (llms.txt)
              </Link>
              .
            </p>
          </Section>

          <Section id="user-content" title="9. User-submitted content">
            <p>
              If you submit a review, correction request, or other content to this site, you
              grant StarlynnCare a non-exclusive, royalty-free, perpetual license to publish,
              display, and moderate that content. You represent that any submitted content is
              truthful, does not impersonate another person, and does not violate any applicable
              law. Defamatory or harassing submissions will be removed without notice.
            </p>
          </Section>

          <Section id="third-parties" title="10. Third-party links and services">
            <p>
              This site may link to third-party resources including CDSS, CMS Care Compare, and
              external research. StarlynnCare does not endorse and is not responsible for the
              content or privacy practices of any third-party site. We use Google Analytics and
              Ahrefs Analytics for site analytics; see our{" "}
              <Link href="/privacy" className="text-teal underline underline-offset-4">
                Privacy Policy
              </Link>{" "}
              for details.
            </p>
          </Section>

          <Section id="changes" title="11. Changes to these Terms">
            <p>
              We may update these Terms from time to time. Material changes will be reflected in
              an updated effective date at the top of this page. Continued use of the site after
              such changes constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section id="governing-law" title="12. Governing law and dispute resolution">
            <p>
              These Terms are governed by the laws of the State of California, without regard to
              its conflict-of-law provisions. Any dispute arising under these Terms shall be
              resolved exclusively in the state or federal courts located in San Francisco County,
              California, and you consent to personal jurisdiction in those courts.
            </p>
            <p>
              Claims subject to California&rsquo;s anti-SLAPP statute (CCP §425.16) may be
              resolved through that mechanism before litigation proceeds to discovery.
            </p>
          </Section>

          <Section id="contact" title="13. Contact">
            <p>
              Questions about these Terms may be directed to:
            </p>
            <address className="not-italic mt-2 space-y-1 text-[15px]">
              <p><strong>StarlynnCare, PBC</strong></p>
              <p>
                <a href="mailto:hello@starlynncare.com" className="text-teal underline underline-offset-4">
                  hello@starlynncare.com
                </a>
              </p>
            </address>
          </Section>

          <div className="mt-14 pt-8 border-t border-paper-rule text-[14px] text-ink-3 flex flex-col gap-2">
            <Link href="/privacy" className="text-teal underline underline-offset-4 hover:text-teal/80">
              Privacy Policy →
            </Link>
            <Link href="/editorial-policy" className="text-teal underline underline-offset-4 hover:text-teal/80">
              Editorial Policy →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
