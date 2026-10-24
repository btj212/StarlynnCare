import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { AuthorByline } from "@/components/editorial/AuthorByline";
import { canonicalFor } from "@/lib/seo/canonical";
import { buildBreadcrumbList, buildWebPageWithReviewer } from "@/lib/seo/schema";

const PAGE_PATH = "/library/choosing-memory-care";
const canonicalUrl = canonicalFor(PAGE_PATH);
const TITLE = "Choosing memory care, one decision at a time";
const DESC =
  "Five steps families use to read an inspection record, decide on timing, understand who pays, tour, and review a contract before signing.";
const DATE = "2026-10-24";

const STEPS = [
  {
    n: "1",
    title: "Read the record before the brochure",
    body: "A serious finding and a paperwork finding are not the same thing. California labels them Type A and Type B. Other states use different words for the same idea.",
    href: "/library/type-a-vs-type-b-deficiencies-explained",
    label: "How California labels findings",
  },
  {
    n: "2",
    title: "Decide whether it is time",
    body: "The useful question is whether home is still safe, not whether a brochure looks calm.",
    href: "/library/when-is-it-time-for-memory-care",
    label: "When it is time for memory care",
  },
  {
    n: "3",
    title: "Find out who pays",
    body: "In California, Medi-Cal memory care usually means the Assisted Living Waiver, and only in participating counties. Other states have their own programs. Confirm the current list with the state before you rely on it.",
    href: "/library/medi-cal-and-memory-care",
    label: "Medi-Cal and memory care",
  },
  {
    n: "4",
    title: "Tour with a list",
    body: "Ask about the facility’s own inspection history, not a generic script.",
    href: "/library/37-questions-to-ask-on-a-memory-care-tour",
    label: "37 questions for a tour",
  },
  {
    n: "5",
    title: "Read the contract, then the first 72 hours",
    body: "Fee increases, discharge rules, and arbitration clauses are in the admission agreement. If a hospital is discharging someone this week, start with the first-72-hours guide.",
    href: "/library/the-first-72-hours",
    label: "The first 72 hours",
  },
] as const;

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
};

export default function ChoosingMemoryCarePage() {
  return (
    <>
      <JsonLd
        objects={[
          buildBreadcrumbList([
            { name: "Home", url: canonicalFor("/") },
            { name: "Library", url: canonicalFor("/library") },
            { name: "Choosing memory care", url: canonicalUrl },
          ]),
          buildWebPageWithReviewer({
            name: TITLE,
            url: canonicalUrl,
            description: DESC,
            datePublished: DATE,
            dateModified: DATE,
          }),
        ]}
      />
      <GovernanceBar />
      <SiteNav badge="" />
      <main className="bg-paper px-4 py-12 md:px-8">
        <article className="mx-auto max-w-[720px]">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-rust">
            Library
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(36px,6vw,64px)] leading-[0.98] tracking-[-0.02em] text-ink">
            Choosing memory care, one decision at a time.
          </h1>
          <p className="mt-6 text-[18px] leading-relaxed text-ink-2">
            Most families need this intensely once. These five steps point at the guides already on the site. Nothing here is a new statistic.
          </p>
          <div className="mt-8">
            <AuthorByline lastReviewed={DATE} />
          </div>
          <ol className="mt-4 space-y-8">
            {STEPS.map((step) => (
              <li key={step.n} className="border-t border-paper-rule pt-6">
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-ink-3">
                  Step {step.n}
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-tight text-ink">
                  {step.title}
                </h2>
                <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{step.body}</p>
                <Link href={step.href} className="mt-3 inline-block text-teal underline underline-offset-4">
                  {step.label}
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-10 border-t border-paper-rule pt-6 text-[16px] leading-relaxed text-ink-2">
            About to sign an admission agreement?{" "}
            <Link href="/tools/contract-review" className="text-teal underline underline-offset-4">
              The contract review is free.
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
