/**
 * One source of truth for which states are live vs pilot.
 *
 * Live: at least MIN_LIVE_FACILITY_THRESHOLD publishable homes.
 * Pilot: at least one publishable home, but below that threshold
 * (Texas 1 and Colorado 71 as of 2026-11).
 *
 * Homepage hero, homepage FAQ, JSON-LD, and the states grid all
 * read from classifyCoverage() so those surfaces cannot drift.
 */

import { COVERED_STATES } from "@/lib/states";
import { STATE_REGULATORS, joinAnd, regulatorFor } from "@/lib/states/regulators";

export const MIN_LIVE_FACILITY_THRESHOLD = 100;

export type CoverageState = {
  slug: string;
  code: string;
  name: string;
  facilityCount: number;
};

export type Coverage = {
  live: CoverageState[];
  pilot: CoverageState[];
  indexed: CoverageState[];
  indexedStateCount: number;
  liveStateCount: number;
};

export type CoverageInput = {
  stateCode: string;
  facilityCount: number;
};

export function classifyCoverage(states: CoverageInput[]): Coverage {
  const countByCode = new Map(states.map((row) => [row.stateCode, row.facilityCount]));
  const indexed: CoverageState[] = COVERED_STATES.map((state) => ({
    slug: state.slug,
    code: state.code,
    name: state.name,
    facilityCount: countByCode.get(state.code) ?? 0,
  })).filter((state) => state.facilityCount > 0);

  const live = indexed.filter((state) => state.facilityCount >= MIN_LIVE_FACILITY_THRESHOLD);
  const pilot = indexed.filter(
    (state) => state.facilityCount > 0 && state.facilityCount < MIN_LIVE_FACILITY_THRESHOLD,
  );

  return {
    live,
    pilot,
    indexed,
    indexedStateCount: live.length + pilot.length,
    liveStateCount: live.length,
  };
}

/** Hero line: "CA · OR · … · Pilot: TX (1) · CO (71)". */
export function heroStateLine(coverage: Coverage): string {
  const live = coverage.live.map((state) => state.code).join(" · ");
  if (coverage.pilot.length === 0) return live;
  const pilot = coverage.pilot
    .map((state) => `${state.code} (${state.facilityCount})`)
    .join(" · ");
  return live ? `${live} · Pilot: ${pilot}` : `Pilot: ${pilot}`;
}

export function coverageStateNames(coverage: Coverage): string {
  return joinAnd(coverage.indexed.map((state) => state.name));
}

export function regulatorAcronymList(): string {
  return COVERED_STATES.map((state) => regulatorFor(state.code)?.short)
    .filter((short): short is string => Boolean(short))
    .join(" · ");
}

export function coverageFaqAnswer(coverage: Coverage): string {
  const liveNames = joinAnd(coverage.live.map((state) => state.name));
  const regulators = coverage.indexed
    .map((state) => {
      const regulator = STATE_REGULATORS[state.code];
      return regulator ? `${regulator.short} for ${state.name}` : state.name;
    })
    .filter(Boolean);

  const liveClause =
    coverage.live.length === 0
      ? "No state currently meets the live-coverage threshold."
      : `${liveNames} ${coverage.live.length === 1 ? "is" : "are"} live with publishable facility profiles.`;

  const pilotClause =
    coverage.pilot.length === 0
      ? ""
      : ` ${joinAnd(
          coverage.pilot.map(
            (state) =>
              `${state.name} (${state.facilityCount} ${state.facilityCount === 1 ? "home" : "homes"})`,
          ),
        )} ${coverage.pilot.length === 1 ? "is" : "are"} in pilot.`;

  const regulatorClause =
    regulators.length > 0
      ? ` That is ${coverage.indexedStateCount} states in total. Each state's data comes from its regulator — ${joinAnd(regulators)}.`
      : ` That is ${coverage.indexedStateCount} states in total.`;

  return `${liveClause}${pilotClause}${regulatorClause}`;
}
