/**
 * Normalized facility profile loader.
 *
 * Single async function called by the facility page server component.
 * Returns a fully-resolved `FacilityProfile` so every section component
 * is a pure function of its props — no Supabase calls inside section components.
 *
 * Data sources wired here:
 *   • facilities table  (1 row)
 *   • inspections table (up to 50 rows, ordered most-recent-first)
 *   • deficiencies table (all rows for those inspections)
 *   • facility_snapshot() RPC (1 call — percentiles, sparkline, heatmap)
 *   • reviews table via loadPublishedReviews()
 *   • Per-state config via getStateProfileConfig()
 *   • SEO / JSON-LD builders
 */

import { notFound } from "next/navigation";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { regionFromSlug } from "@/lib/regions";
import { countyRegionContainingCitySlug } from "@/lib/regionsCountyLookup";
import { stateFromSlug } from "@/lib/states";
import { getStateProfileConfig } from "@/lib/states/profileConfig";
import { loadPublishedReviews } from "@/lib/reviews/loadPublishedReviews";
import { canonicalFor } from "@/lib/seo/canonical";
import {
  buildBreadcrumbList,
  buildFaqPageSchema,
  buildLocalBusinessForFacility,
  buildReviewSchema,
} from "@/lib/seo/schema";
import type { Facility, Deficiency } from "@/lib/types";
import type { StateProfileConfig, Rule } from "@/lib/states/profileConfig";
import type { Review } from "@/components/reviews/ReviewCard";
import type { Region } from "@/lib/regions";
import type { StateInfo } from "@/lib/states";

// ─────────────────────────────────────────────────────────────────
// Raw DB row types (narrower than full Inspection / Deficiency)
// ─────────────────────────────────────────────────────────────────

export type InspectionRow = {
  id: string;
  inspection_date: string;
  inspection_type: string | null;
  is_complaint: boolean;
  complaint_id: string | null;
  total_deficiency_count: number | null;
  narrative_summary: string | null;
  source_url: string | null;
  raw_data: {
    outcome?: string;
    inspector_name?: string;
    narrative?: string;
    duration_minutes?: number;
    areas_examined?: string;
  } | null;
};

export type DeficiencyRow = {
  id: string;
  inspection_id: string;
  class: string | null;
  code: string | null;
  severity: number | null;
  scope: string | null;
  scope_severity_code: string | null;
  immediate_jeopardy: boolean;
  description: string | null;
  inspector_narrative: string | null;
  state_severity_raw: string | null;
  is_repeat: boolean;
};

// ─────────────────────────────────────────────────────────────────
// facility_snapshot RPC return shape
// ─────────────────────────────────────────────────────────────────

export type SnapshotMetric = {
  value: number;
  percentile: number | null;
  peer_median: number;
};

export type SnapshotPayload = {
  facility: {
    id: string;
    name: string;
    beds: number | null;
    state_code: string;
    license_type: string | null;
  };
  peer_set: {
    definition: string;
    n: number;
    fallback_level: number;
  };
  metrics: {
    severity: SnapshotMetric;
    repeats: SnapshotMetric;
    frequency: SnapshotMetric;
    trajectory: SnapshotMetric;
  };
  grade: { letter: string; composite_percentile: number } | null;
  has_inspections: boolean;
  trajectory_series: Array<{
    month: string;
    facility_score: number;
    peer_median_score: number;
  }>;
  heatmap: Array<{
    severity: number;
    scope: string;
    count: number;
    tags: string[] | null;
  }>;
  pull_quote: { date: string; tag: string | null; text: string } | null;
};

// ─────────────────────────────────────────────────────────────────
// Normalized output types
// ─────────────────────────────────────────────────────────────────

export type TimelinePoint = {
  month: string;
  facilityScore: number;
  peerMedianScore: number;
  cited: boolean;
};

export type ScopeSeverityCell = {
  sev: 1 | 2 | 3 | 4;
  scope: "isolated" | "pattern" | "widespread";
  count: number;
  tags: string[];
};

export type RuleCard = Rule & { citedDate: string | null };

export type MapState = {
  lat: number;
  lon: number;
  mapboxToken: string | null;
};

export interface FacilityProfile {
  facility: Facility;
  state: StateInfo;
  region: Region | null;
  county: { name: string; slug: string } | null;
  cfg: StateProfileConfig;

  /** Inspection rows, most-recent-first. */
  inspections: InspectionRow[];
  /** Deficiency rows keyed by inspection_id. */
  deficienciesByInspection: Map<string, DeficiencyRow[]>;
  totals: {
    inspections: number;
    deficiencies: number;
    typeA: number;
    lastCitation: string | null;
  };

  /** Raw output from facility_snapshot() RPC. null when unavailable. */
  snapshot: SnapshotPayload | null;
  /** 24-month trajectory derived from snapshot.trajectory_series. */
  timeline: TimelinePoint[];
  /** 4×3 scope×severity grid derived from snapshot.heatmap. */
  scopeSeverityGrid: ScopeSeverityCell[];

  /** Rules with "Cited <date>" pill computed from citation history. */
  rulesCards: RuleCard[];
  /** Tour questions from facility.content.tour_questions. */
  tourQuestions: string[];

  reviews: Review[];
  /** Photo URLs — up to 5 for the gallery; sourced from photo_urls[] with photo_url fallback. */
  photoUrls: string[];
  /** Per-photo source metadata for attribution display (Google Places API TOS requirement). */
  photoSources: Array<{ url: string; source: string; attribution: string }>;
  mapState: MapState | null;

  canonicalUrl: string;
  backHref: string;
  backLabel: string;
  breadcrumbTrail: { name: string; url: string }[];
  jsonLd: object[];
}

// ─────────────────────────────────────────────────────────────────
// Internal loaders
// ─────────────────────────────────────────────────────────────────

async function fetchFacility(
  stateCode: string,
  citySlug: string,
  facilitySlug: string,
): Promise<{ facility: Facility | null; error: string | null; configured: boolean }> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return { facility: null, error: null, configured: false };

  const { data, error } = await supabase
    .from("facilities")
    .select("*")
    .eq("state_code", stateCode)
    .eq("city_slug", citySlug)
    .eq("slug", facilitySlug)
    .eq("publishable", true)
    .limit(1);

  if (error) return { facility: null, error: error.message, configured: true };
  const row = (data ?? [])[0] as Facility | undefined;
  return { facility: row ?? null, error: null, configured: true };
}

async function fetchInspectionsAndDeficiencies(facilityId: string): Promise<{
  inspections: InspectionRow[];
  deficiencies: DeficiencyRow[];
}> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return { inspections: [], deficiencies: [] };

  const { data: inspData } = await supabase
    .from("inspections")
    .select(
      "id, inspection_date, inspection_type, is_complaint, complaint_id, total_deficiency_count, narrative_summary, source_url, raw_data",
    )
    .eq("facility_id", facilityId)
    .order("inspection_date", { ascending: false })
    .limit(50);

  const inspections = (inspData ?? []) as InspectionRow[];
  if (!inspections.length) return { inspections: [], deficiencies: [] };

  const inspIds = inspections.map((i) => i.id);
  const { data: defData } = await supabase
    .from("deficiencies")
    .select(
      "id, inspection_id, class, code, severity, scope, scope_severity_code, immediate_jeopardy, description, inspector_narrative, state_severity_raw, is_repeat",
    )
    .in("inspection_id", inspIds);

  return {
    inspections,
    deficiencies: (defData ?? []) as DeficiencyRow[],
  };
}

async function fetchSnapshot(facilityId: string): Promise<SnapshotPayload | null> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("facility_snapshot", {
      p_facility_id: facilityId,
    });
    if (error) {
      console.error("[loadFacilityProfile] snapshot RPC error:", error.message);
      return null;
    }
    return (data as SnapshotPayload) ?? null;
  } catch (err) {
    console.error("[loadFacilityProfile] snapshot RPC threw:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Derivations
// ─────────────────────────────────────────────────────────────────

function deriveTimeline(snapshot: SnapshotPayload | null): TimelinePoint[] {
  if (!snapshot) return [];
  return snapshot.trajectory_series.map((p) => ({
    month: p.month,
    facilityScore: p.facility_score,
    peerMedianScore: p.peer_median_score,
    cited: p.facility_score > 0,
  }));
}

const SCOPE_ORDER = ["isolated", "pattern", "widespread"] as const;
const SEV_ORDER = [1, 2, 3, 4] as const;

function deriveScopeSeverityGrid(snapshot: SnapshotPayload | null): ScopeSeverityCell[] {
  const cells: ScopeSeverityCell[] = [];
  if (!snapshot) return cells;

  const lookup = new Map<string, { count: number; tags: string[] }>();
  for (const cell of snapshot.heatmap) {
    lookup.set(`${cell.severity}-${cell.scope}`, {
      count: cell.count,
      tags: cell.tags ?? [],
    });
  }

  for (const sev of SEV_ORDER) {
    for (const scope of SCOPE_ORDER) {
      const key = `${sev}-${scope}`;
      const cell = lookup.get(key) ?? { count: 0, tags: [] };
      cells.push({
        sev: sev as 1 | 2 | 3 | 4,
        scope,
        count: cell.count,
        tags: cell.tags,
      });
    }
  }
  return cells;
}

function deriveRulesCards(
  cfg: StateProfileConfig,
  deficiencies: DeficiencyRow[],
  inspections: InspectionRow[],
): RuleCard[] {
  const inspDateById = new Map<string, string>(
    inspections.map((i) => [i.id, i.inspection_date]),
  );

  return cfg.rulebook.map((rule) => {
    let citedDate: string | null = null;
    if (rule.codePattern) {
      const matches = deficiencies
        .filter((d) => d.code && rule.codePattern!.test(d.code))
        .map((d) => inspDateById.get(d.inspection_id) ?? "")
        .filter(Boolean)
        .sort()
        .reverse();
      citedDate = matches[0] ?? null;
    }
    return { ...rule, citedDate };
  }).sort((a, b) => {
    if (a.citedDate && !b.citedDate) return -1;
    if (!a.citedDate && b.citedDate) return 1;
    return 0;
  });
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────

export async function loadFacilityProfile(params: {
  stateSlug: string;
  regionSlug: string;
  facilitySlug: string;
}): Promise<FacilityProfile | "not_found" | "unconfigured"> {
  const { stateSlug, regionSlug, facilitySlug } = params;

  const state = stateFromSlug(stateSlug);
  if (!state) return "not_found";

  const { facility, error, configured } = await fetchFacility(
    state.code,
    regionSlug,
    facilitySlug,
  );

  if (!configured) return "unconfigured";
  if (error) throw new Error(error);
  if (!facility) return "not_found";

  const region = regionFromSlug(stateSlug, regionSlug);
  const countyHub = countyRegionContainingCitySlug(state.code, facility.city_slug);

  const [{ inspections, deficiencies }, snapshot, reviews] = await Promise.all([
    fetchInspectionsAndDeficiencies(facility.id),
    fetchSnapshot(facility.id),
    loadPublishedReviews(facility.id),
  ]);

  // Build deficiency map
  const deficienciesByInspection = new Map<string, DeficiencyRow[]>();
  for (const d of deficiencies) {
    const list = deficienciesByInspection.get(d.inspection_id) ?? [];
    list.push(d);
    deficienciesByInspection.set(d.inspection_id, list);
  }

  // Compute substantiated-complaint gaps (scraper gap: citation on sub-page)
  const substantiatedGaps = inspections.filter(
    (i) =>
      i.is_complaint &&
      i.raw_data?.outcome === "Substantiated" &&
      (deficienciesByInspection.get(i.id) ?? []).length === 0,
  );

  const typeACount = deficiencies.filter((d) => d.class === "Type A").length;
  const totalDeficiencies = deficiencies.length + substantiatedGaps.length;
  const lastCitation =
    inspections.find((i) => (deficienciesByInspection.get(i.id) ?? []).length > 0)
      ?.inspection_date ?? null;

  // Per-state config
  const cfg = getStateProfileConfig(state.code);

  // Derived data
  const timeline = deriveTimeline(snapshot);
  const scopeSeverityGrid = deriveScopeSeverityGrid(snapshot);
  const rulesCards = deriveRulesCards(cfg, deficiencies, inspections);
  const tourQuestions = (facility.content as { tour_questions?: string[] } | null)?.tour_questions?.filter((q) => q.trim()) ?? [];

  // Photos — use the gallery array (photo_urls) when populated; fall back to legacy photo_url.
  const facilityWithGallery = facility as unknown as {
    photo_urls?: string[];
    photo_sources?: Array<{ url: string; source: string; attribution: string }>;
  };
  const rawPhotoUrls = facilityWithGallery.photo_urls;
  const photoUrls: string[] = Array.isArray(rawPhotoUrls) && rawPhotoUrls.length > 0
    ? rawPhotoUrls.filter(Boolean)
    : facility.photo_url
      ? [facility.photo_url]
      : [];
  const photoSources = facilityWithGallery.photo_sources ?? photoUrls.map((url) => ({
    url,
    source: "Google Street View",
    attribution: facility.photo_attribution ?? "© Google",
  }));

  // Map
  const lat = facility.latitude ? parseFloat(facility.latitude) : null;
  const lon = facility.longitude ? parseFloat(facility.longitude) : null;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? null;
  const mapState: MapState | null =
    lat !== null && lon !== null ? { lat, lon, mapboxToken } : null;

  // Navigation
  const backHref = region
    ? `/${state.slug}/${region.slug}`
    : `/${state.slug}/${facility.city_slug}`;
  const backLabel = region ? region.name : facility.city ?? state.name;

  // SEO
  const canonicalUrl = canonicalFor(
    `/${state.slug}/${facility.city_slug}/${facility.slug}`,
  );
  const businessId = `${canonicalUrl}#business`;
  const breadcrumbTrail = [
    { name: "Home", url: canonicalFor("/") },
    { name: state.name, url: canonicalFor(`/${state.slug}`) },
    { name: backLabel, url: canonicalFor(backHref) },
    { name: facility.name, url: canonicalUrl },
  ];

  const jsonLd: object[] = [
    buildLocalBusinessForFacility(facility, state, {
      canonicalUrl,
      reviews: reviews.length ? reviews : undefined,
    }),
    buildBreadcrumbList(breadcrumbTrail),
    ...reviews.map((r) => buildReviewSchema(r, businessId)),
  ];
  if (tourQuestions.length) {
    jsonLd.push(buildFaqPageSchema(tourQuestions, canonicalUrl));
  }

  return {
    facility,
    state,
    region,
    county: countyHub ? { name: countyHub.name, slug: countyHub.slug } : null,
    cfg,

    inspections,
    deficienciesByInspection,
    totals: {
      inspections: inspections.length,
      deficiencies: totalDeficiencies,
      typeA: typeACount,
      lastCitation,
    },

    snapshot,
    timeline,
    scopeSeverityGrid,

    rulesCards,
    tourQuestions,

    reviews,
    photoUrls,
    photoSources,
    mapState,

    canonicalUrl,
    backHref,
    backLabel,
    breadcrumbTrail,
    jsonLd,
  };
}
