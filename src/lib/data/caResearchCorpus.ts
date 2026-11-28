import { cache } from "react";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { collectInPages } from "@/lib/data/pageSelect";

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

const FACILITY_CHUNK = 80;
const INSPECTION_CHUNK = 150;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function headCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number | null> {
  const { count, error } = await query;
  if (error || count == null) return null;
  return count;
}

async function loadCaResearchCorpusUncached(): Promise<CaResearchCorpus | null> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;

  const homes = await collectInPages<{ id: string }>((from, to) =>
    supabase
      .from("facilities")
      .select("id")
      .eq("publishable", true)
      .eq("state_code", "CA")
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (homes.error) {
    console.error("[caResearchCorpus] homes:", homes.error);
    return null;
  }
  const ids = homes.rows.map((row) => row.id);

  let deficiencies = 0;
  let dementiaStatute = 0;
  for (const facilityChunk of chunk(ids, FACILITY_CHUNK)) {
    const inspections = await collectInPages<{ id: string }>((from, to) =>
      supabase
        .from("inspections")
        .select("id")
        .in("facility_id", facilityChunk)
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (inspections.error) {
      console.error("[caResearchCorpus] inspections:", inspections.error);
      return null;
    }
    for (const inspectionChunk of chunk(
      inspections.rows.map((row) => row.id),
      INSPECTION_CHUNK,
    )) {
      const [total, statute87705, statute87706, both] = await Promise.all([
        headCount(
          supabase
            .from("deficiencies")
            .select("id", { count: "exact", head: true })
            .in("inspection_id", inspectionChunk),
        ),
        headCount(
          supabase
            .from("deficiencies")
            .select("id", { count: "exact", head: true })
            .in("inspection_id", inspectionChunk)
            .like("code", "%87705%"),
        ),
        headCount(
          supabase
            .from("deficiencies")
            .select("id", { count: "exact", head: true })
            .in("inspection_id", inspectionChunk)
            .like("code", "%87706%"),
        ),
        headCount(
          supabase
            .from("deficiencies")
            .select("id", { count: "exact", head: true })
            .in("inspection_id", inspectionChunk)
            .like("code", "%87705%")
            .like("code", "%87706%"),
        ),
      ]);
      if (total == null || statute87705 == null || statute87706 == null || both == null) {
        console.error("[caResearchCorpus] deficiencies: count failed");
        return null;
      }
      deficiencies += total;
      // A code that contains both statute numbers is in both counts. Subtract it once.
      dementiaStatute += statute87705 + statute87706 - both;
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
}

let corpusPromise: Promise<CaResearchCorpus | null> | null = null;

export const loadCaResearchCorpus = cache(function loadCaResearchCorpus(): Promise<CaResearchCorpus | null> {
  if (!corpusPromise) {
    const pending = loadCaResearchCorpusUncached().then((result) => {
      if (result == null && corpusPromise === pending) corpusPromise = null;
      return result;
    });
    corpusPromise = pending;
  }
  return corpusPromise;
});
