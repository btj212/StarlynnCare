import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHead } from "@/components/editorial/SectionHead";
import { SyncedHomeSampleCardDesktop } from "@/components/home/SampleFacilityRotation";

type Step = { n: string; t: string; p: string };

type Props = {
  sectionLabel?: string;
  sectionTitle: ReactNode;
  explainerTitle: string;
  explainerBody: ReactNode;
  methodologyHref: string;
  steps: readonly Step[];
};

export function StateHubMethodology({
  sectionLabel,
  sectionTitle,
  explainerTitle,
  explainerBody,
  methodologyHref,
  steps,
}: Props) {
  return (
    <section id="methodology" className="border-b border-clearing-rule bg-clearing-bg">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:px-[60px] md:py-20">
        <SectionHead label={sectionLabel} title={sectionTitle} />

        <div className="grid items-start gap-10 md:grid-cols-[1fr_1.05fr] md:gap-16">
          <div>
            <h3 className="m-0 mb-4 font-[family-name:var(--font-display)] text-[26px] font-normal leading-[1.1] tracking-[-0.01em] sm:text-[32px]">
              {explainerTitle}
            </h3>
            <div className="mb-4 leading-relaxed text-ink-2">{explainerBody}</div>
            <p className="mb-6 leading-relaxed text-ink-2">
              The methodology is published and version-controlled. We change it in public.{" "}
              <Link href={methodologyHref} className="text-teal underline underline-offset-4 hover:text-rust">
                Read the full methodology →
              </Link>
            </p>
          </div>

          <SyncedHomeSampleCardDesktop />
        </div>

        <div className="mt-16 grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className="rounded-[18px] border border-clearing-rule-2 bg-clearing-card p-6 shadow-[var(--shadow-card)] sm:p-8"
            >
              <div className="mb-3 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">{s.n}</div>
              <h4 className="m-0 mb-2.5 font-[family-name:var(--font-display)] text-[26px] font-normal leading-[1.1] tracking-[-0.005em]">{s.t}</h4>
              <p className="m-0 text-[15px] leading-relaxed text-ink-2">{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
