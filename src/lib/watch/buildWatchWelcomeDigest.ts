import { canonicalFor } from "@/lib/seo/canonical";
import { weightedCitationsPerBedPhrase } from "@/lib/facility/pageCopy";
import { REGULATOR_ABBR } from "@/lib/seo/meta";
import { getServiceClient } from "@/lib/supabase/server";
import { formatFacilityName } from "@/lib/facility/displayName";

const STATE_SLUG: Record<string, string> = {
  CA: "california",
  OR: "oregon",
  WA: "washington",
  MN: "minnesota",
  TX: "texas",
  UT: "utah",
  IL: "illinois",
  PA: "pennsylvania",
};

export type WatchWelcomeDigest = {
  facilityName: string;
  facilityUrl: string;
  cityState: string;
  licenseNumber: string;
  recordSummary: string;
  lastActivityDate: string;
  lastActivityType: string;
  quietPeriodLine: string;
  recentEventsText: string;
  statsLine: string;
  severityRankLine: string;
  whatWeWatch: string;
  unsubscribeUrl: string;
};

type SnapshotRow = {
  metrics: {
    severity: { value?: number | null; percentile?: number | null; peer_median?: number | null };
    frequency: { percentile?: number | null };
  };
  grade: { composite_percentile: number } | null;
  peer_set: { n: number };
};

type InspectionRow = {
  inspection_date: string;
  inspection_type: string;
  is_complaint: boolean | null;
};

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtInspectionLabel(insp: InspectionRow): string {
  const type = insp.inspection_type?.trim() || "Inspection";
  if (insp.is_complaint || type.toLowerCase().includes("complaint")) {
    return "Complaint investigation";
  }
  if (type.toLowerCase() === "kitchen") return "Kitchen compliance visit";
  return type;
}

export function severityRankLine(snapshot: SnapshotRow | null, stateCode: string): string {
  if (!snapshot || (snapshot.peer_set?.n ?? 0) < 10) return "";
  return (
    weightedCitationsPerBedPhrase({
      value: snapshot.metrics.severity.value,
      peerMedian: snapshot.metrics.severity.peer_median,
      agencyShort: REGULATOR_ABBR[stateCode] ?? "state",
      windowMonths: 36,
    }) ?? ""
  );
}

function quietPeriodLine(lastDate: string | null): string {
  if (!lastDate) return "No inspections in the records we hold.";
  const last = new Date(lastDate + "T12:00:00");
  const now = new Date();
  const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = fmtDate(lastDate);
  if (days <= 45) {
    return `Last state activity: ${formatted} (${days} day${days === 1 ? "" : "s"} ago).`;
  }
  const months = Math.round(days / 30);
  return `No new state activity since ${formatted} — about ${months} month${months === 1 ? "" : "s"} of quiet in the public file.`;
}

function recentEventsText(inspections: InspectionRow[]): string {
  if (inspections.length === 0) return "No inspections in the records we hold.";
  return inspections
    .slice(0, 3)
    .map((insp) => `• ${fmtDate(insp.inspection_date)} — ${fmtInspectionLabel(insp)}`)
    .join("\n");
}

/**
 * Builds the data payload for the Facility Watch welcome digest email.
 * Uses facility_snapshot RPC + recent inspections — same sources as the profile page.
 */
export async function buildWatchWelcomeDigest(
  facilityId: string,
  unsubscribeToken: string,
): Promise<WatchWelcomeDigest | null> {
  const supabase = getServiceClient();

  const { data: facility, error: facErr } = await supabase
    .from("facilities")
    .select("id, name, slug, city, city_slug, state_code, license_number, beds")
    .eq("id", facilityId)
    .maybeSingle();

  if (facErr || !facility) {
    console.error("[watch-digest] facility load error:", facErr?.message ?? "not found");
    return null;
  }

  const stateSlug = STATE_SLUG[facility.state_code] ?? facility.state_code.toLowerCase();
  const facilityUrl = canonicalFor(`/${stateSlug}/${facility.city_slug}/${facility.slug}`);

  const { data: inspections, error: inspErr } = await supabase
    .from("inspections")
    .select("inspection_date, inspection_type, is_complaint")
    .eq("facility_id", facilityId)
    .order("inspection_date", { ascending: false })
    .limit(5);

  if (inspErr) {
    console.error("[watch-digest] inspections error:", inspErr.message);
  }

  const inspRows = (inspections ?? []) as InspectionRow[];
  const last = inspRows[0] ?? null;

  const { data: snapshotRaw } = await supabase.rpc("facility_snapshot", {
    p_facility_id: facilityId,
  });
  const snapshot = (snapshotRaw ?? null) as SnapshotRow | null;

  const license = facility.license_number ?? "—";
  const cityState = `${facility.city}, ${facility.state_code}`;
  const beds = facility.beds ? `${facility.beds} licensed beds` : "licensed capacity on file";

  const displayName = formatFacilityName(facility.name);
  const recordSummary = last
    ? `${displayName}: recent inspections are listed below.`
    : `${displayName} is on your watch list.`;

  return {
    facilityName: displayName,
    facilityUrl,
    cityState,
    licenseNumber: license,
    recordSummary,
    lastActivityDate: last ? fmtDate(last.inspection_date) : "—",
    lastActivityType: last ? fmtInspectionLabel(last) : "—",
    quietPeriodLine: quietPeriodLine(last?.inspection_date ?? null),
    recentEventsText: recentEventsText(inspRows),
    statsLine: `${cityState} · ${beds}`,
    severityRankLine: severityRankLine(snapshot, facility.state_code),
    whatWeWatch: [
      "• A new inspection visit, including one that adds no citation",
      "• New violations or regulatory actions for this facility",
      "• License or memory-care endorsement status changes",
    ].join("\n"),
    unsubscribeUrl: canonicalFor(`/watch/unsubscribe/${unsubscribeToken}`),
  };
}
