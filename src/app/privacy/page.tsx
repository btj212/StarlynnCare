import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList } from "@/lib/seo/schema";

const PAGE_PATH = "/privacy";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Privacy Policy";
const DESC =
  "How StarlynnCare collects, uses, and protects information — including analytics data, voluntary submissions, and California residents' rights under CCPA.";
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

export default function PrivacyPage() {
  const jsonLd = [
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Privacy Policy", url: canonicalUrl },
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
              <span className="text-ink-3">Privacy Policy</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Legal
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.04] tracking-[-0.02em] text-ink mt-3 mb-5">
              Privacy Policy
            </h1>
            <p className="text-[14px] font-[family-name:var(--font-mono)] text-ink-4 mb-4">
              Effective {EFFECTIVE} · Last updated {EFFECTIVE}
            </p>
            <p className="text-[17px] leading-relaxed text-ink-3 max-w-[62ch]">
              StarlynnCare does not sell your personal information. This policy explains what we
              collect, why, and how you can control it.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[800px] px-4 sm:px-6 md:px-10 py-14">

          <Section id="overview" title="1. Who we are">
            <p>
              StarlynnCare is operated by <strong>StarlynnCare, PBC</strong>, a California Public
              Benefit Corporation. We publish a civic-data resource indexing publicly available
              inspection records for memory care facilities in California. We are headquartered
              in California and our services are directed primarily at users in the United States.
            </p>
            <p>
              Questions about this policy: {" "}
              <a href="mailto:hello@starlynncare.com" className="text-teal underline underline-offset-4">
                hello@starlynncare.com
              </a>
            </p>
          </Section>

          <Section id="what-we-collect" title="2. Information we collect">
            <p>
              We collect two categories of information:
            </p>

            <h3 className="font-semibold text-ink mt-6 mb-2">Automatically collected data</h3>
            <p>
              When you visit this site, our analytics providers automatically collect standard
              server-log and browser data, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address (anonymized or truncated by Google Analytics;</li>
              <li>Browser type, operating system, and device type;</li>
              <li>Pages visited, referring URL, and approximate geographic region;</li>
              <li>Date and time of visit; and</li>
              <li>Aggregate engagement metrics (scroll depth, session duration).</li>
            </ul>
            <p>
              We use <strong>Google Analytics</strong> (Google LLC) and <strong>Ahrefs
              Analytics</strong> (Ahrefs Pte. Ltd.) for this purpose. Neither service is used
              to serve personalized advertising. See §5 below for opt-out options.
            </p>

            <h3 className="font-semibold text-ink mt-6 mb-2">Voluntarily submitted data</h3>
            <p>
              If you submit a facility correction request, review, or contact-form message, we
              collect:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your name and email address (if provided);</li>
              <li>The content of your message or submission; and</li>
              <li>Metadata needed to process the correction (e.g., facility ID, source document).</li>
            </ul>
            <p>
              We do not require account registration to use this site.
            </p>
          </Section>

          <Section id="what-we-dont-collect" title="3. What we do not collect">
            <p>
              We do not collect, and have no interest in collecting:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Social Security numbers, financial account numbers, or payment information;</li>
              <li>Health or medical information about site visitors;</li>
              <li>Information about children under 13 (this site is not directed at minors); or</li>
              <li>Information through advertising networks, retargeting pixels, or social media
                tracking tags.</li>
            </ul>
          </Section>

          <Section id="how-we-use" title="4. How we use information">
            <p>We use collected information solely for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Site analytics and improvement:</strong> understanding aggregate traffic
                patterns, identifying broken pages, and improving navigation and content.
              </li>
              <li>
                <strong>Responding to corrections and contact submissions:</strong> reviewing
                and actioning factual correction requests per our{" "}
                <Link href="/editorial-policy" className="text-teal underline underline-offset-4">
                  editorial policy
                </Link>
                .
              </li>
              <li>
                <strong>Legal compliance:</strong> retaining records where required by law or
                in connection with legal proceedings.
              </li>
            </ul>
            <p>
              <strong>We do not sell, rent, lease, or trade your personal information to any
              third party.</strong> We do not use personal information for behavioral advertising.
            </p>
          </Section>

          <Section id="third-parties" title="5. Third-party services and cookies">
            <p>
              The following third-party services are active on this site. Each is subject to
              its own privacy policy.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="text-[14px] w-full border-collapse">
                <thead>
                  <tr className="border-b border-paper-rule font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    <th className="text-left py-2 pr-4 font-semibold">Service</th>
                    <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
                    <th className="text-left py-2 font-semibold">Opt-out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-rule text-ink-2">
                  <tr>
                    <td className="py-3 pr-4 align-top font-medium">Google Analytics</td>
                    <td className="py-3 pr-4 align-top">Aggregate site traffic analytics</td>
                    <td className="py-3 align-top">
                      <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-teal underline underline-offset-2">
                        GA opt-out
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 align-top font-medium">Ahrefs Analytics</td>
                    <td className="py-3 pr-4 align-top">Aggregate traffic and referral analytics</td>
                    <td className="py-3 align-top">Browser ad-block or uBlock Origin</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 align-top font-medium">Supabase</td>
                    <td className="py-3 pr-4 align-top">Database hosting for facility data and submitted corrections</td>
                    <td className="py-3 align-top">N/A (infrastructure only)</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 align-top font-medium">Vercel</td>
                    <td className="py-3 pr-4 align-top">Web hosting and CDN; server-side rendering</td>
                    <td className="py-3 align-top">N/A (infrastructure only)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              Google Analytics is configured with IP anonymization. We do not enable Google
              Signals or cross-device tracking. Ahrefs Analytics collects only aggregate,
              anonymized traffic data.
            </p>
            <p>
              You can prevent analytics cookie placement by using browser settings, private/
              incognito browsing mode, or a browser extension such as uBlock Origin. We do not
              honor Do Not Track (DNT) headers because our analytics configuration does not
              perform behavioral tracking that DNT is designed to prevent.
            </p>
          </Section>

          <Section id="data-retention" title="6. Data retention">
            <p>
              Analytics data is retained according to each provider&rsquo;s standard retention
              periods (typically 14 months for Google Analytics aggregates). Correction
              submissions and contact messages are retained for as long as necessary to resolve
              the underlying request, and thereafter for up to three years for legal-compliance
              purposes. We periodically purge records no longer needed.
            </p>
          </Section>

          <Section id="security" title="7. Security">
            <p>
              We implement industry-standard technical safeguards including HTTPS, encrypted
              database connections, and access controls. No method of internet transmission is
              100% secure. We do not store payment information, Social Security numbers, or
              health records, so the blast radius of any breach is limited to contact submissions
              and analytics identifiers.
            </p>
          </Section>

          <Section id="ccpa" title="8. California residents — CCPA rights">
            <p>
              If you are a California resident, the California Consumer Privacy Act (CCPA) as
              amended by the California Privacy Rights Act (CPRA) provides you with the following
              rights with respect to personal information we hold about you:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Right to know:</strong> request disclosure of the categories and specific
                pieces of personal information we have collected about you.
              </li>
              <li>
                <strong>Right to delete:</strong> request deletion of personal information we hold
                about you, subject to certain exceptions.
              </li>
              <li>
                <strong>Right to correct:</strong> request correction of inaccurate personal
                information.
              </li>
              <li>
                <strong>Right to opt out of sale / sharing:</strong> we do not sell or share
                personal information for cross-context behavioral advertising, so this right is
                not applicable.
              </li>
              <li>
                <strong>Right to non-discrimination:</strong> we will not discriminate against
                you for exercising any of these rights.
              </li>
            </ul>
            <p>
              To exercise any CCPA right, email{" "}
              <a href="mailto:hello@starlynncare.com" className="text-teal underline underline-offset-4">
                hello@starlynncare.com
              </a>{" "}
              with the subject line &ldquo;CCPA Request.&rdquo; We will respond within 45 days.
              We may need to verify your identity before processing your request. Because we do
              not collect login credentials, verification may require matching your request to
              voluntarily submitted contact data.
            </p>
            <p>
              <strong>Shine the Light (California Civil Code §1798.83):</strong> We do not
              disclose personal information to third parties for their direct marketing purposes.
              A §1798.83 request is not applicable.
            </p>
          </Section>

          <Section id="minors" title="9. Children's privacy">
            <p>
              This site is not directed at children under the age of 13 and we do not knowingly
              collect personal information from children under 13. If we learn we have inadvertently
              collected such information, we will delete it promptly. Parents or guardians may
              contact us at{" "}
              <a href="mailto:hello@starlynncare.com" className="text-teal underline underline-offset-4">
                hello@starlynncare.com
              </a>
              .
            </p>
          </Section>

          <Section id="changes" title="10. Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. Material changes will be
              reflected in an updated effective date at the top of this page. We encourage you
              to review this policy periodically.
            </p>
          </Section>

          <Section id="contact" title="11. Contact">
            <p>
              For privacy inquiries, CCPA requests, or data deletion requests:
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
            <Link href="/terms" className="text-teal underline underline-offset-4 hover:text-teal/80">
              Terms of Use →
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
