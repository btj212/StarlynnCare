import { cache } from "react";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";

/**
 * Live California research corpus. The May 2026 papers analyzed 484 homes;
 * the directory has grown. Counts that describe "what we publish now" come
 * from here. Findings that were computed on the 484-home snapshot stay dated
 * as that study and are not silently rewritten as if they were rerun.
 */

export const CA_FROZEN_STUDY_DATE = "May 11, 2026";
export const CA_FROZEN_STUDY_HOMES = 484;
export const CA_RESEARCH_SOURCE = "CDSS Community Care Licensing";
export const CA_RESEARCH_WINDOW = "all years on file";

export type CaResearchCorpus = {
  homes: number;
  deficiencies: number;
  dementiaStatute: number;
  sharePct: number;
  asOf: string;
  source: string;
  window: string;
};

export function frozenCaStudyDisclaimer(liveHomes: number | null): string {
  const live =
    liveHomes && liveHomes > 0
      ? ` StarlynnCare now publishes ${liveHomes.toLocaleString("en-US")} California homes.`
      : "";
  return (
    `This analysis is a frozen study of ${CA_FROZEN_STUDY_HOMES.toLocaleString("en-US")} ` +
    `publishable California homes as of ${CA_FROZEN_STUDY_DATE}.${live} ` +
    `Findings below were not rerun on the live corpus.`
  );
}

export function formatSharePct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function isDementiaStatute(code: string | null): boolean {
  if (!code) return false;
  return /87705|87706/.test(code);
}

export const loadCaResearchCorpus = cache(async function loadCaResearchCorpus(): Promise<CaResearchCorpus | null> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;

  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .eq("state_code", "CA")
      .range(from, from + 999);
    if (error) {
      console.error("[caResearchCorpus] homes:", error.message);
      return null;
    }
    const page = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
    ids.push(...page);
    if (page.length < 1000) break;
  }

  const inspIds: string[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("inspections")
        .select("id")
        .in("facility_id", chunk)
        .range(from, from + 999);
      if (error) {
        console.error("[caResearchCorpus] inspections:", error.message);
        return null;
      }
      const page = (data ?? []) as Array<{ id: string }>;
      inspIds.push(...page.map((r) => r.id));
      if (page.length < 1000) break;
      from += 1000;
    }
  }

  let deficiencies = 0;
  let dementiaStatute = 0;
  for (let i = 0; i < inspIds.length; i += 150) {
    const chunk = inspIds.slice(i, i + 150);
    const { data, error } = await supabase
      .from("deficiencies")
      .select("code")
      .in("inspection_id", chunk)
      .limit(5000);
    if (error) {
      console.error("[caResearchCorpus] deficiencies:", error.message);
      return null;
    }
    for (const row of (data ?? []) as Array<{ code: string | null }>) {
      deficiencies += 1;
      if (isDementiaStatute(row.code)) dementiaStatute += 1;
    }
  }

  return {
    homes: ids.length,
    deficiencies,
    dementiaStatute,
    sharePct: formatSharePct(dementiaStatute, deficiencies),
    asOf: new Date().toISOString().slice(0, 10),
    source: CA_RESEARCH_SOURCE,
    window: CA_RESEARCH_WINDOW,
  };
});
