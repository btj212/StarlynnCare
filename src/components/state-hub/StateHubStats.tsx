import type { ReactNode } from "react";
import { SectionHead } from "@/components/editorial/SectionHead";
import { StatBlock, type StatItem } from "@/components/editorial/StatBlock";

type Props = {
  label?: string;
  title: ReactNode;
  stats: StatItem[];
  /** Optional refresh date footnotes ("Data refreshed YYYY-MM-DD ..."). */
  footnotes?: string[];
};

export function StateHubStats({ label, title, stats, footnotes }: Props) {
  return (
    <section
      id="data"
      className="border-b border-paper-rule"
      style={{ background: "var(--color-paper-2)" }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-20">
        <SectionHead label={label} title={title} />
        <StatBlock stats={stats} footnotes={footnotes} />
      </div>
    </section>
  );
}
