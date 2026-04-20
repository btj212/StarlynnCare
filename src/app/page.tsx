import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

const asOf = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "America/New_York",
}).format(new Date());

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="border-b border-sc-border bg-warm-white">
          <div className="mx-auto max-w-[680px] px-6 py-20 md:px-8 md:py-28">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              As of {asOf}
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-serif)] text-4xl font-semibold leading-[1.15] tracking-tight text-navy md:text-5xl">
              Memory care quality, from the sources that regulate it.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate">
              StarlynnCare publishes facility profiles built from{" "}
              <strong className="font-medium text-ink">CMS</strong> and{" "}
              <strong className="font-medium text-ink">state agency</strong>{" "}
              data—not lead-gen ads. Every stat on every page will link to a
              primary source and an &ldquo;as of&rdquo; date.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/california/alameda-county"
                className="inline-flex items-center justify-center rounded-md bg-teal px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-mid"
              >
                Browse Alameda County memory care
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center text-sm font-semibold text-teal underline-offset-4 hover:underline"
              >
                How we source data
              </a>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-24 border-b border-sc-border bg-warm-white"
        >
          <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
            <h2 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-navy md:text-4xl">
              Three steps. No hype.
            </h2>
            <p className="mt-3 max-w-2xl text-slate">
              We ingest public datasets, join them into one facility record, and
              run a quality-checked content chain—nothing publishes without
              citations.
            </p>
            <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
              <li className="relative pl-8">
                <span
                  className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-teal-light text-xs font-bold text-teal"
                  aria-hidden
                >
                  1
                </span>
                <h3 className="font-semibold text-ink">Ingest</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  California CDSS licensing records and CMS Care Compare data
                  —no aggregators, no scraping of marketing sites.
                </p>
              </li>
              <li className="relative pl-8">
                <span
                  className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-teal-light text-xs font-bold text-teal"
                  aria-hidden
                >
                  2
                </span>
                <h3 className="font-semibold text-ink">Join &amp; cite</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  One facility profile with structured inspection and deficiency
                  history. Each figure carries a source URL and effective date.
                </p>
              </li>
              <li className="relative pl-8">
                <span
                  className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-teal-light text-xs font-bold text-teal"
                  aria-hidden
                >
                  3
                </span>
                <h3 className="font-semibold text-ink">Quality gate</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  Generated summaries pass an automated gate: uncited claims and
                  sales tone are rejected before anything goes live.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="bg-warm-white">
          <div className="mx-auto max-w-[680px] px-6 py-20 md:px-8 md:py-24">
            <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy">
              What we&apos;re not
            </h2>
            <ul className="mt-6 space-y-4 text-slate">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                Not a referral service—we don&apos;t sell your contact info.
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                Not paid placement—rankings reflect data, not sponsorships.
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                Not opinion blogs—when we add narrative, it stays factual and
                cited.
              </li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
