/**
 * County-level benchmark computation for facility metrics.
 *
 * Queries all publishable Alameda County RCFEs in a single call, computes
 * distributions, and returns per-facility tier assessments.
 *
 * Tiers (relative to county distribution):
 *   strong   — at or below 33rd percentile (better than peers)
 *   mixed    — 34th–66th percentile
 *   concerns — above 66th percentile (worse than peers)
 *   informational — used for boolean metrics that have no peer comparison
 */

import { tryPublicSupabaseClient } from "@/lib/supabase/server";

export type BenchmarkTier = "strong" | "mixed" | "concerns" | "informational";

export interface FacilityBenchmarks {
  /** Deficiencies per non-complaint inspection */
  deficienciesPerInspection: {
    value: number;
    countyMedian: number;
    countyMin: number;
    countyMax: number;
    tier: BenchmarkTier;
  };
  /** Number of Type A deficiencies */
  typeACount: {
    value: number;
    countyMedian: number;
    countyRange: [number, number];
    tier: BenchmarkTier;
  };
  /** Whether any §87705 or §87706 dementia-care citation exists in last 5 years */
  dementiaCitation: {
    hasCitation: boolean;
    mostRecentDate: string | null;
    tier: BenchmarkTier;
  };
  /** Complaint substantiation rate (substantiated / total complaints with outcome) */
  complaintSubstantiation: {
    value: number | null; // null when no complaints with outcome
    substantiated: number;
    total: number;
    countyAvg: number;
    tier: BenchmarkTier;
  };
}

// ---------------------------------------------------------------------------
// Internal types for the raw DB aggregation
// ---------------------------------------------------------------------------

interface FacilityStats {
  facilityId: string;
  nonComplaintInspections: number;
  deficiencyCount: number;
  typeACount: number;
  hasDementiaCitation: boolean;
  dementiaCitationDate: string | null;
  complaintsWithOutcome: number;
  substantiatedComplaints: number;
}

// ---------------------------------------------------------------------------
// Percentile helpers
// ---------------------------------------------------------------------------

function percentile(sortedValues: number[], p: number): number {
  if (!sortedValues.length) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[idx];
}

function assignTier(value: number, p33: number, p66: number): BenchmarkTier {
  if (value <= p33) return "strong";
  if (value <= p66) return "mixed";
  return "concerns";
}

// ---------------------------------------------------------------------------
// Main loader — fetches county-wide stats and computes benchmarks
// ---------------------------------------------------------------------------

export async function loadBenchmarks(
  facilityId: string,
  stateCode: string = "CA",
  countySlug: string = "alameda-county",
): Promise<FacilityBenchmarks | null> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;

  // 1. Get all publishable facilities in the county
  const { data: facilities, error: facErr } = await supabase
    .from("facilities")
    .select("id, city_slug")
    .eq("state_code", stateCode)
    .eq("publishable", true);

  if (facErr || !facilities?.length) return null;

  const allFacilityIds = facilities.map((f) => f.id);

  // 2. Fetch inspections for all county facilities in one query
  const { data: inspections, error: inspErr } = await supabase
    .from("inspections")
    .select("id, facility_id, is_complaint, raw_data")
    .in("facility_id", allFacilityIds);

  if (inspErr) return null;
  const allInspections = inspections ?? [];

  // 3. Fetch deficiencies for all those inspections
  const inspectionIds = allInspections.map((i) => i.id);
  const { data: deficiencies, error: defErr } = await supabase
    .from("deficiencies")
    .select("id, inspection_id, class, code, cited_date")
    .in("inspection_id", inspectionIds.length ? inspectionIds : ["__none__"]);

  if (defErr) return null;
  const allDeficiencies = deficiencies ?? [];

  // 4. Build a per-facility stats map
  const statsMap = new Map<string, FacilityStats>();
  const initStats = (id: string): FacilityStats => ({
    facilityId: id,
    nonComplaintInspections: 0,
    deficiencyCount: 0,
    typeACount: 0,
    hasDementiaCitation: false,
    dementiaCitationDate: null,
    complaintsWithOutcome: 0,
    substantiatedComplaints: 0,
  });

  for (const fac of facilities) {
    statsMap.set(fac.id, initStats(fac.id));
  }

  // Index deficiencies by inspection_id for O(1) lookup
  const defByInsp = new Map<
    string,
    Array<{ id: string; inspection_id: string; class: string | null; code: string | null; cited_date: string | null }>
  >();
  for (const def of allDeficiencies) {
    const list = defByInsp.get(def.inspection_id) ?? [];
    list.push(def as { id: string; inspection_id: string; class: string | null; code: string | null; cited_date: string | null });
    defByInsp.set(def.inspection_id, list);
  }

  for (const insp of allInspections) {
    const stats = statsMap.get(insp.facility_id);
    if (!stats) continue;

    const defs = defByInsp.get(insp.id) ?? [];

    if (!insp.is_complaint) {
      stats.nonComplaintInspections++;
      stats.deficiencyCount += defs.length;
    }

    for (const def of defs) {
      if (def.class === "Type A") stats.typeACount++;

      // §87705 or §87706 dementia-care citations
      if (/8770[56]/.test(def.code ?? "")) {
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 5);
        const defDate = def.cited_date
          ? new Date(def.cited_date + "T12:00:00")
          : null;
        if (!defDate || defDate >= cutoff) {
          stats.hasDementiaCitation = true;
          // Track most recent citation date
          if (
            !stats.dementiaCitationDate ||
            (def.cited_date ?? "") > stats.dementiaCitationDate
          ) {
            stats.dementiaCitationDate = def.cited_date ?? null;
          }
        }
      }
    }

    if (insp.is_complaint) {
      const outcome = (insp.raw_data as { outcome?: string } | null)?.outcome;
      if (outcome) {
        stats.complaintsWithOutcome++;
        if (outcome === "Substantiated") stats.substantiatedComplaints++;
      }
    }
  }

  // 5. Compute county-wide distributions
  const allStats = Array.from(statsMap.values());

  const dpiValues = allStats.map((s) =>
    s.nonComplaintInspections > 0
      ? s.deficiencyCount / s.nonComplaintInspections
      : 0,
  );
  const typeAValues = allStats.map((s) => s.typeACount);
  const complaintRates = allStats
    .filter((s) => s.complaintsWithOutcome > 0)
    .map((s) => s.substantiatedComplaints / s.complaintsWithOutcome);

  const dpiSorted = [...dpiValues].sort((a, b) => a - b);
  const typeASorted = [...typeAValues].sort((a, b) => a - b);
  const complaintSorted = [...complaintRates].sort((a, b) => a - b);

  const dpiP33 = percentile(dpiSorted, 33);
  const dpiP66 = percentile(dpiSorted, 66);
  const typeAP33 = percentile(typeASorted, 33);
  const typeAP66 = percentile(typeASorted, 66);
  const complaintP33 = percentile(complaintSorted, 33);
  const complaintP66 = percentile(complaintSorted, 66);

  const countyAvgComplaint =
    complaintRates.length > 0
      ? complaintRates.reduce((a, b) => a + b, 0) / complaintRates.length
      : 0;

  const dpiMedian = percentile(dpiSorted, 50);
  const typeAMedian = percentile(typeASorted, 50);
  const dpiMin = dpiSorted[0] ?? 0;
  const dpiMax = dpiSorted[dpiSorted.length - 1] ?? 0;
  const typeAMin = typeASorted[0] ?? 0;
  const typeAMax = typeASorted[typeASorted.length - 1] ?? 0;

  // 6. Look up THIS facility's stats
  const mine = statsMap.get(facilityId);
  if (!mine) return null;

  const myDpi =
    mine.nonComplaintInspections > 0
      ? mine.deficiencyCount / mine.nonComplaintInspections
      : 0;

  const myComplaintRate =
    mine.complaintsWithOutcome > 0
      ? mine.substantiatedComplaints / mine.complaintsWithOutcome
      : null;

  return {
    deficienciesPerInspection: {
      value: myDpi,
      countyMedian: dpiMedian,
      countyMin: dpiMin,
      countyMax: dpiMax,
      tier: assignTier(myDpi, dpiP33, dpiP66),
    },
    typeACount: {
      value: mine.typeACount,
      countyMedian: typeAMedian,
      countyRange: [typeAMin, typeAMax],
      tier: assignTier(mine.typeACount, typeAP33, typeAP66),
    },
    dementiaCitation: {
      hasCitation: mine.hasDementiaCitation,
      mostRecentDate: mine.dementiaCitationDate,
      tier: "informational",
    },
    complaintSubstantiation: {
      value: myComplaintRate,
      substantiated: mine.substantiatedComplaints,
      total: mine.complaintsWithOutcome,
      countyAvg: countyAvgComplaint,
      tier:
        myComplaintRate === null
          ? "informational"
          : assignTier(myComplaintRate, complaintP33, complaintP66),
    },
  };
}
