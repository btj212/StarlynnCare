import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHead } from "@/components/editorial/SectionHead";
import { SyncedHomeSampleCardDesktop } from "@/components/home/SampleFacilityRotation";

type Step = { n: string; t: string; p: string };

type Props = {
  sectionLabel: string;
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
    <section
      id="methodology"
      className="border-b border-paper-rule"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
        <SectionHead label={sectionLabel} title={sectionTitle} />

        <div className="grid gap-10 md:gap-16 items-start md:grid-cols-[1fr_1.05fr]">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[32px] font-normal leading-[1.1] tracking-[-0.01em] m-0 mb-4">
              {explainerTitle}
            </h3>
            <div className="text-ink-2 mb-4 leading-relaxed">{explainerBody}</div>
            <p className="text-ink-2 mb-6 leading-relaxed">
              The methodology is published and version-controlled. We change it in public.{" "}
              <Link href={methodologyHref} className="text-teal underline underline-offset-4">
                Read the full methodology →
              </Link>
            </p>
          </div>

          <SyncedHomeSampleCardDesktop />
        </div>

        <div className="mt-16 grid grid-cols-1 border-t border-paper-rule md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className="p-6 sm:p-8 border-b border-paper-rule last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-rust mb-3">{s.n}</div>
              <h4 className="font-[family-name:var(--font-display)] text-[26px] font-normal leading-[1.1] tracking-[-0.005em] m-0 mb-2.5">{s.t}</h4>
              <p className="text-[15px] text-ink-2 m-0 leading-relaxed">{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
