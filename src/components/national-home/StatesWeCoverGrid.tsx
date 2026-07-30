"use client";

import Link from "next/link";
import type { NationalStateSummary } from "@/lib/data/nationalHome";
import { ProximityGroup, proximityItemProps } from "@/components/interaction/ProximityGroup";

type Props = {
  states: NationalStateSummary[];
};

const STATE_REGULATORS: Record<string, string> = {
  CA: "CDSS",
  OR: "Oregon DHS",
  WA: "DSHS",
  MN: "MDH",
  TX: "HHSC",
  PA: "PA DHS",
  AZ: "ADHS",
  UT: "DLBC",
  IL: "IDPH",
  MO: "DHSS",
};

const STATE_DESCRIPTIONS: Record<string, string> = {
  CA: "RCFE Memory Care · Annual unannounced inspections · CDSS public record",
  OR: "Memory Care Endorsed ALFs & RCFs · Oregon DHS LTC portal",
  WA: "Specialized Dementia Care ALFs · DSHS ALF Reports portal",
  MN: "ALF with Dementia Care license · MN Dept. of Health",
  TX: "Alzheimer-certified assisted living · HHSC LTCR records",
  PA: "PCH & ALR Special Care designations · PA DHS OLTL portal",
  AZ: "Directed Care ALH & ALC · ADHS BRFL · AZ Care Check inspections",
  UT: "Type I & II Assisted Living · DLBC · R432-270",
  IL: "Public regulator data · IDPH",
  MO: "ALF** & Alzheimer's SCU Disclosure · DHSS LTCR · 19 CSR 30",
};

// TX is temporarily hidden from the grid — only 1 facility live (pilot).
// Remove this filter once the full HHSC dataset is ingested.
const HIDDEN_STATE_CODES = ["TX"];

export function StatesWeCoverGrid({ states }: Props) {
  const visibleStates = states.filter((s) => !HIDDEN_STATE_CODES.includes(s.stateCode));
  return (
    <ProximityGroup
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      radius={180}
      intensity={0.035}
    >
      {visibleStates.map((s) => (
        <Link
          key={s.stateCode}
          href={`/${s.stateSlug}`}
          {...proximityItemProps(
            "card-lift group flex flex-col gap-3 rounded-2xl border border-clearing-rule-2 bg-clearing-card px-5 py-[18px] text-ink no-underline shadow-[var(--shadow-card)] transition-colors hover:border-teal/25",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-[family-name:var(--font-sans)] text-[17px] font-semibold leading-none tracking-[-0.01em]">
              {s.stateName}
            </span>
            <span className="relative top-[1px] shrink-0 rounded-full border border-[#C6D6D0] px-2 py-[2px] font-[family-name:var(--font-sans)] text-[11px] font-semibold text-teal">
              {STATE_REGULATORS[s.stateCode] ?? s.stateCode}
            </span>
          </div>

          <div className="text-[14px] text-ink-3">
            <strong className="font-semibold text-ink">
              {s.facilityCount > 0 ? s.facilityCount.toLocaleString() : "—"}
            </strong>{" "}
            facilities
            {s.facilityCount > 0 && s.facilityCount < 100 ? " · pilot" : ""}
          </div>

          <p className="text-[12.5px] leading-snug text-ink-4">
            {STATE_DESCRIPTIONS[s.stateCode] ?? "Public regulator data"}
          </p>

          <span className="mt-auto text-[13px] font-semibold text-teal group-hover:underline">
            Browse →
          </span>
        </Link>
      ))}
    </ProximityGroup>
  );
}
