import Link from "next/link";
import type { NationalStateSummary } from "@/lib/data/nationalHome";

type Props = {
  states: NationalStateSummary[];
};

const STATE_REGULATORS: Record<string, string> = {
  CA: "CDSS",
  OR: "Oregon DHS",
  WA: "DSHS",
  MN: "MDH",
  TX: "HHSC",
};

const STATE_DESCRIPTIONS: Record<string, string> = {
  CA: "RCFE Memory Care · Annual unannounced inspections · CDSS public record",
  OR: "Memory Care Endorsed ALFs & RCFs · Oregon DHS LTC portal",
  WA: "Specialized Dementia Care ALFs · DSHS ALF Reports portal",
  MN: "ALF with Dementia Care license · MN Dept. of Health",
  TX: "Alzheimer-certified assisted living · HHSC LTCR records",
};

export function StatesWeCoverGrid({ states }: Props) {
  return (
    <div className="grid grid-cols-1 gap-px bg-paper-rule sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 border border-paper-rule">
      {states.map((s) => (
        <Link
          key={s.stateCode}
          href={`/${s.stateSlug}`}
          className="group flex flex-col gap-3 bg-paper p-6 no-underline text-ink hover:bg-paper-2 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <span
              className="font-[family-name:var(--font-display)] text-[clamp(1.4rem,3vw,2rem)] leading-none tracking-[-0.015em]"
            >
              {s.stateName}
            </span>
            <span
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-rust border border-rust px-[5px] py-[2px] rounded-[2px] shrink-0 relative top-[3px]"
            >
              {STATE_REGULATORS[s.stateCode] ?? s.stateCode}
            </span>
          </div>

          <div className="flex gap-4 font-[family-name:var(--font-mono)] text-[11.5px] text-ink-3 tracking-[0.04em]">
            <span>
              <strong className="text-ink text-[15px] font-semibold">
                {s.facilityCount > 0 ? s.facilityCount.toLocaleString() : "—"}
              </strong>{" "}
              facilities
            </span>
            <span>
              <strong className="text-ink text-[15px] font-semibold">
                {s.cityCount > 0 ? s.cityCount.toLocaleString() : "—"}
              </strong>{" "}
              cities
            </span>
          </div>

          <p className="text-[12px] leading-snug text-ink-4 font-[family-name:var(--font-mono)] tracking-[0.02em]">
            {STATE_DESCRIPTIONS[s.stateCode] ?? "Public regulator data"}
          </p>

          <span className="mt-auto font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] text-rust group-hover:underline">
            Browse →
          </span>
        </Link>
      ))}
    </div>
  );
}
