import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalFor } from "@/lib/seo/canonical";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import {
  buildArticleSchema,
  buildBreadcrumbList,
  buildFaqSchemaFromPairs,
} from "@/lib/seo/schema";
import { CrisisEmailMagnet } from "./CrisisEmailMagnet";

const PAGE_PATH = "/library/the-first-72-hours";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "The First 72 Hours: A Family Playbook for Crisis Memory Care Placement";
const DESC =
  "What a discharge planner can and cannot force, the five questions to ask before signing anything, and how to find a conflict-free facility fast — without trading your leverage.";
const DATE_PUBLISHED = "2026-06-12";

const FAQ_PAIRS: Array<{ q: string; a: string }> = [
  {
    q: "Can a hospital discharge planner force us to choose a specific facility?",
    a: "No. A discharge planner may present a list of facilities that accept your loved one's payer source and have available beds, but the choice is yours. Federal patient discharge rights (42 CFR § 482.13) require hospitals to give you a written list and allow adequate time to evaluate options. A planner who pressures you toward a specific facility may receive referral fees from that facility — ask directly.",
  },
  {
    q: "What happens if we say we need more time?",
    a: "For Medicare patients, the hospital must issue a formal 'Notice of Medicare Non-Coverage' (NOMNC) before discharge. You have the right to appeal through your state's Quality Improvement Organization (QIO) — a call to the QIO hotline can buy 24–48 additional hours while your appeal is reviewed.",
  },
  {
    q: "Is a 30-day notice the same thing as a 30-day eviction?",
    a: "No. Facilities must give residents at least 30 days written notice before a transfer or discharge, except in emergencies or when the resident's safety requires it. Check the specific grounds stated — 'failure to pay' and 'facility closure' are the most common legitimate reasons. An ombudsman can review whether the grounds are valid.",
  },
  {
    q: "What is a Long-Term Care Ombudsman?",
    a: "A federally-mandated free advocate for nursing home and assisted living residents. Every state has one. They investigate complaints, review contracts, and can accompany you to meetings with facility staff. They take no money from facilities.",
  },
  {
    q: "How does StarlynnCare help in a crisis?",
    a: "Filter by inspection grade to surface facilities with clean records in your area, then cross-reference our shortlist tool to compare two or three options side by side — without talking to a placement agent first.",
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

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-[family-name:var(--font-display)] font-normal text-[20px] leading-snug text-ink mt-10 mb-3">
      {children}
    </h3>
  );
}

export default function CrisisPlaybookPage() {
  const jsonLd = [
    buildArticleSchema({
      headline: TITLE,
      description: DESC,
      url: canonicalUrl,
      datePublished: DATE_PUBLISHED,
    }),
    buildBreadcrumbList([
      { name: "Home", url: canonicalFor("/") },
      { name: "Editorial library", url: canonicalFor("/library") },
      { name: "The first 72 hours", url: canonicalUrl },
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
            <nav className="flex flex-wrap gap-1.5 mb-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-ink-4">
              <Link href="/" className="hover:text-teal transition-colors">Home</Link>
              <span aria-hidden>›</span>
              <Link href="/library" className="hover:text-teal transition-colors">Library</Link>
              <span aria-hidden>›</span>
              <span className="text-ink-3">The first 72 hours</span>
            </nav>
            <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
              § Crisis guide · hospital discharge + emergency placement
            </div>
            <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink mt-3 mb-5">
              {TITLE}
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-3 max-w-[58ch]">{DESC}</p>
            <div className="mt-8">
              <AuthorByline lastReviewed={DATE_PUBLISHED} className="border-b-0 pb-0 mb-0" />
            </div>

            {/* Not-medical-advice callout */}
            <div className="mt-8 rounded border border-paper-rule bg-paper px-5 py-4">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-rust mb-1">
                Scope of this guide
              </p>
              <p className="text-[13.5px] leading-relaxed text-ink-3">
                This is a navigation guide — regulatory rights, questions to ask, and contacts to call.
                It is not legal advice, medical advice, or a recommendation for any specific facility.
                For urgent safety matters, call 911 or your state elder abuse hotline.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-4 sm:px-6 md:px-10 py-14 space-y-5 text-[16.5px] leading-[1.75] text-ink-2">

          <H2 id="discharge-rights">1 · What a discharge planner can — and cannot — do</H2>

          <p>
            When a hospital social worker hands you a list of facilities, it feels like a directive.
            It is not. Under federal patient discharge rights{" "}
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-ink-3">(42 CFR § 482.13)</span>,
            you have the right to evaluate options and choose. The planner&rsquo;s job is to document
            a safe discharge plan — your job is to ensure that plan reflects your standards, not their
            referral relationships.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 my-8">
            <div className="rounded border border-paper-rule bg-paper-2 px-5 py-4">
              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-ink-4 mb-3">
                A planner CAN
              </p>
              <ul className="space-y-2 text-[15px] text-ink-2">
                <li className="flex gap-2"><span className="text-teal shrink-0 mt-0.5">✓</span> Present a list of available, in-network facilities</li>
                <li className="flex gap-2"><span className="text-teal shrink-0 mt-0.5">✓</span> Recommend based on clinical needs (staffing ratio, memory care certification)</li>
                <li className="flex gap-2"><span className="text-teal shrink-0 mt-0.5">✓</span> Set a discharge date once Medicare coverage ends</li>
                <li className="flex gap-2"><span className="text-teal shrink-0 mt-0.5">✓</span> Issue a formal Notice of Non-Coverage to trigger your appeal rights</li>
              </ul>
            </div>
            <div className="rounded border border-paper-rule bg-paper-2 px-5 py-4">
              <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-rust mb-3">
                A planner CANNOT
              </p>
              <ul className="space-y-2 text-[15px] text-ink-2">
                <li className="flex gap-2"><span className="text-rust shrink-0 mt-0.5">✗</span> Force you to accept their preferred facility</li>
                <li className="flex gap-2"><span className="text-rust shrink-0 mt-0.5">✗</span> Discharge without a written plan you&rsquo;ve received</li>
                <li className="flex gap-2"><span className="text-rust shrink-0 mt-0.5">✗</span> Prevent you from researching alternatives on the list</li>
                <li className="flex gap-2"><span className="text-rust shrink-0 mt-0.5">✗</span> Collect a referral fee without disclosing it (Stark Law)</li>
              </ul>
            </div>
          </div>

          <p>
            <strong className="text-ink">If the pressure feels coercive:</strong> ask the planner directly
            whether any facility on the list has a referral relationship with the hospital. Then call the
            QIO — your state&rsquo;s Quality Improvement Organization — immediately. A single QIO call
            can pause the discharge while your appeal is reviewed.
          </p>

          <H2 id="five-questions">2 · Five questions to ask before signing anything</H2>

          <p>
            Admission agreements are the most consequential contract most families ever sign under pressure.
            You should read it, and you should ask these five questions before the pen touches paper.
          </p>

          <ol className="space-y-6 pl-0 list-none my-8">
            {[
              {
                n: "01",
                q: "What is the base monthly rate, and what triggers a rate increase?",
                a: "Many agreements allow annual increases with 30 days notice. Ask for the increase history over the last three years. A facility that raised rates 15% annually is a different financial commitment than one that held steady.",
              },
              {
                n: "02",
                q: "Under what circumstances can the facility discharge my loved one?",
                a: "Legitimate grounds include non-payment, needs exceeding the facility's clinical capacity, and documented threat to other residents. Ask for the exact contractual language and how many days notice they provide.",
              },
              {
                n: "03",
                q: "What level of dementia does this unit specialize in — and what happens when they exceed that level?",
                a: "A unit licensed for moderate-stage dementia may transfer a resident to a locked unit or skilled nursing when late-stage behaviors emerge. Understand the pathway before you move in.",
              },
              {
                n: "04",
                q: "Is this facility currently under a compliance agreement or corrective action plan with the state?",
                a: "Look this up yourself on the state regulator's portal before the tour. A facility with recent Type-A deficiencies (immediate jeopardy) is a different risk profile than one with a clean record.",
              },
              {
                n: "05",
                q: "Who do I call if I have a complaint, and what is the escalation path?",
                a: "Beyond the facility's own ombudsman contact, you should have the state's Long-Term Care Ombudsman number and the licensing agency's complaint hotline saved before you sign.",
              },
            ].map(({ n, q, a }) => (
              <li key={n} className="flex gap-5 border-l-2 pl-5" style={{ borderColor: "var(--color-teal)" }}>
                <div>
                  <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-teal mb-1">{n}</p>
                  <p className="font-medium text-ink text-[16.5px] leading-snug mb-2">{q}</p>
                  <p className="text-[15px] text-ink-3 leading-relaxed">{a}</p>
                </div>
              </li>
            ))}
          </ol>

          <H2 id="find-facility">3 · Finding a facility fast — without the sales layer</H2>

          <p>
            The placement agency model is efficient for the agency and expensive for you. Most agencies
            collect a referral fee — sometimes one month&rsquo;s rent — from the facility you choose. That
            fee doesn&rsquo;t come from the facility&rsquo;s marketing budget; it comes from the rate you pay.
            More practically, it means their list is filtered by contract relationships, not by inspection quality.
          </p>

          <H3>Use the public inspection record first</H3>

          <p>
            Every licensed memory care facility in the U.S. has an inspection history maintained by the
            state licensing agency. In California, that&rsquo;s CDSS. In Oregon, it&rsquo;s DHS. The reports are
            public and free. On StarlynnCare, we parse the raw PDFs into a readable timeline so you can see
            at a glance whether a facility has had recent findings — before the sales tour.
          </p>

          <div className="my-8 rounded border border-paper-rule bg-paper-2 px-5 py-5">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink-4 mb-3">
              Your shortlist, conflict-free
            </p>
            <p className="text-[15.5px] text-ink-2 leading-relaxed mb-4">
              Build a comparison shortlist of facilities in your area, ranked by inspection grade.
              No referral fees. No paid placement. The same public record the state uses — in plain language.
            </p>
            <Link
              href="/california"
              className="inline-block font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-white px-4 py-2.5 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-teal)" }}
            >
              Browse facilities by inspection grade →
            </Link>
          </div>

          <H2 id="contacts">4 · Contacts to have before you need them</H2>

          <p>
            Save these before a crisis — not during one.
          </p>

          <div className="my-6 space-y-4">
            {[
              {
                label: "Long-Term Care Ombudsman (national locator)",
                contact: "eldercare.acl.gov or call 1-800-677-1116",
                note: "Free, federally-mandated advocate for LTC residents. No facility affiliations.",
              },
              {
                label: "Quality Improvement Organization (QIO) — Medicare appeal",
                contact: "qioprogram.org",
                note: "Initiates a fast appeal if the hospital is rushing a discharge. Must call before discharge.",
              },
              {
                label: "State Adult Protective Services (elder abuse hotline)",
                contact: "ncea.acl.gov/Resources/State.aspx",
                note: "For elder abuse, financial exploitation, or neglect — not just crisis placement.",
              },
              {
                label: "National Academy of Elder Law Attorneys (NAELA)",
                contact: "naela.org",
                note: "Find an elder-law attorney for contract review, guardianship, or discharge disputes.",
              },
            ].map(({ label, contact, note }) => (
              <div key={label} className="rounded border border-paper-rule bg-paper-2 px-5 py-4">
                <p className="font-medium text-ink text-[15px]">{label}</p>
                <p className="font-[family-name:var(--font-mono)] text-[12px] text-teal mt-0.5">{contact}</p>
                <p className="text-[13.5px] text-ink-3 mt-1.5">{note}</p>
              </div>
            ))}
          </div>

          <H2 id="faq">Frequently asked questions</H2>

          <div className="space-y-6">
            {FAQ_PAIRS.map(({ q, a }) => (
              <div key={q} className="border-b border-paper-rule pb-6">
                <p className="font-medium text-ink text-[16.5px] mb-2">{q}</p>
                <p className="text-[15.5px] text-ink-3 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>

          {/* Crisis email magnet */}
          <CrisisEmailMagnet />

          <p className="font-[family-name:var(--font-mono)] text-[12px] text-ink-4 border-t border-paper-rule pt-10 mt-10">
            This guide is reviewed periodically against federal discharge regulations and state inspection
            frameworks.{" "}
            <Link href="/editorial-policy" className="text-teal underline underline-offset-4">
              Editorial policy →
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
