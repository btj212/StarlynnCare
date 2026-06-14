import type { Metadata } from "next";
import { canonicalFor } from "@/lib/seo/canonical";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ContractEmailCapture } from "./ContractEmailCapture";

export const metadata: Metadata = {
  title: "Contract Decoder — Free Admission Agreement Review | StarlynnCare",
  description:
    "Upload your memory care admission contract. We'll map every fee escalation, discharge trigger, and arbitration clause into plain language — free.",
  alternates: { canonical: canonicalFor("/tools/contract-review") },
  robots: { index: true, follow: true },
};

export default function ContractReviewPage() {
  return (
    <>
      <GovernanceBar />
      <SiteNav />
      <main className="bg-paper min-h-screen">
        <section className="border-b-2 border-ink px-4 py-14 md:py-20 md:px-8">
          <div className="mx-auto max-w-[700px]">
            <div className="mb-4 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-rust">
              Free Tool · Contract Decoder
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(40px,7vw,80px)] leading-[0.95] tracking-[-0.025em] text-ink mb-5">
              Before you sign,{" "}
              <em className="not-italic text-rust">understand it.</em>
            </h1>
            <p className="font-[family-name:var(--font-display)] text-[19px] italic leading-[1.45] text-ink-2 max-w-[55ch]">
              Memory care admission contracts are long, dense, and written by the facility's
              lawyers. We read them so families don&rsquo;t have to.
            </p>
          </div>
        </section>

        <section className="px-4 py-14 md:py-20 md:px-8">
          <div className="mx-auto max-w-[700px]">
            <h2 className="font-[family-name:var(--font-display)] text-[28px] leading-[1.15] tracking-[-0.01em] text-ink mb-4">
              What we look for
            </h2>
            <ul className="space-y-3 font-[family-name:var(--font-mono)] text-[13px] tracking-[0.03em] text-ink-2 leading-relaxed">
              {[
                "Fee escalation clauses — when rates can increase, by how much, and on what notice",
                "Discharge triggers — what grounds allow the facility to ask you to leave",
                "Arbitration clauses — whether you're waiving your right to sue",
                "Refund policies — what happens if a resident leaves within the first 30–90 days",
                "Care plan change procedures — who decides when the level of care (and cost) increases",
                "Ancillary fee schedules — the extras that aren't in the headline monthly rate",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-0.5 text-teal shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-12 border-t-2 border-ink pt-10">
              <h2 className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] tracking-[-0.01em] text-ink mb-2">
                Send us your contract
              </h2>
              <p className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.04em] text-ink-3 mb-6">
                Leave your email and attach the contract PDF. We&rsquo;ll email you a plain-language
                breakdown within 2 business days — free, no referral fees, no sales calls.
              </p>
              <ContractEmailCapture />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
