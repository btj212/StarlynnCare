/**
 * Per-state facility profile configuration.
 *
 * Every section component consumes a `StateProfileConfig` through the
 * normalized `FacilityProfile` shape — none import from state-specific
 * modules directly. To add a new state, create
 * `src/lib/states/{STATE_CODE}/{rulebook,severity,formatters}.ts`
 * and register the result in `getStateProfileConfig` below.
 *
 * See docs/FACILITY_PROFILE_ARCHITECTURE.md for the full runbook.
 */

import type { Deficiency } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type SeverityTone = "danger" | "warn" | "info" | "ok";

export type RuleIcon =
  | "training"
  | "staff"
  | "health"
  | "report"
  | "enforce";

export interface Rule {
  id: string;
  icon: RuleIcon;
  question: string;
  /** Full regulation citation shown in the mono chip, e.g. "22 CCR §87705 / HSC §1569.625" */
  regCite: string;
  /** Plain-language paragraph shown when card is expanded. */
  plain: string;
  /** The "Ask on tour" question shown in the indented aside. */
  ask: string;
  /**
   * Regex tested against `deficiency.code` to compute the amber "Cited <Mon YYYY>" pill.
   * Omit to never show the pill for this rule.
   */
  codePattern?: RegExp;
}

export interface StateProfileConfig {
  /** Two-letter state code, e.g. "CA". */
  code: string;
  /** Short agency name used inline, e.g. "CDSS". */
  agencyShort: string;
  /** Full agency label used in footers and source lines. */
  agencyLong: string;
  /**
   * Prefix prepended to deficiency.code in the "Download original" citation block.
   * E.g. "22 CCR §" → "22 CCR §87705(c)(5)".
   */
  citationPrefix: string;
  /**
   * How many months back the peer-comparison window covers.
   * Matches the window used by `facility_snapshot` SQL.
   * Default: 36.
   */
  inspectionWindowMonths: number;
  /**
   * How many months back the 24-month timeline rail covers.
   * Matches `trajectory_series` in `facility_snapshot`.
   * Default: 24.
   */
  timelineWindowMonths: number;
  /**
   * Map a raw `Deficiency` row to the chip the state uses on the public record.
   * Return `null` to omit the chip entirely (row still shows, just without a tag).
   */
  formatSeverityTag: (d: Deficiency) => { label: string; tone: SeverityTone } | null;
  /**
   * Return the form name shown in "Download original <form> →" links.
   * Return `null` to hide the download link for this deficiency.
   */
  formNameForDeficiency: (d: Deficiency) => string | null;
  /**
   * Ordered list of regulatory rule cards shown in § 04 · The Rulebook.
   * Export `[]` for states whose rules are not yet written.
   * Section hides entirely when this is empty.
   */
  rulebook: Rule[];
}

// ─────────────────────────────────────────────────────────────────
// State registrations (import from per-state modules)
// ─────────────────────────────────────────────────────────────────

import { caProfileConfig } from "./CA/profileConfig";
import { txProfileConfig } from "./TX/profileConfig";
import { orProfileConfig } from "./OR/profileConfig";
import { waProfileConfig, waNhProfileConfig } from "./WA/profileConfig";
import { mnProfileConfig } from "./MN/profileConfig";

const STATE_CONFIGS: Record<string, StateProfileConfig> = {
  CA: caProfileConfig,
  TX: txProfileConfig,
  OR: orProfileConfig,
  WA: waProfileConfig,
  MN: mnProfileConfig,
};

/**
 * Returns the profile config for the given state code.
 * For WA nursing homes (wa_facility_type = 'NH'), returns waNhProfileConfig.
 * Falls back to a safe no-op config if the state is not registered.
 */
export function getStateProfileConfig(
  stateCode: string,
  facilityType?: string | null,
): StateProfileConfig {
  const upper = stateCode.toUpperCase();
  if (upper === "WA" && facilityType === "NH") return waNhProfileConfig;
  return STATE_CONFIGS[upper] ?? makeNullConfig(upper);
}

/** Minimal safe config for unregistered states — no rules, no chips, no form names. */
function makeNullConfig(code: string): StateProfileConfig {
  return {
    code,
    agencyShort: "State regulator",
    agencyLong: `${code} state regulatory agency`,
    citationPrefix: "",
    inspectionWindowMonths: 36,
    timelineWindowMonths: 24,
    formatSeverityTag: (d) => {
      const raw = d.state_severity_raw ?? d.class;
      if (!raw) return null;
      return { label: raw, tone: "info" };
    },
    formNameForDeficiency: () => null,
    rulebook: [],
  };
}
