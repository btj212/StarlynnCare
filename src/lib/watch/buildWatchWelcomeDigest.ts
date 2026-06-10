import { canonicalFor } from "@/lib/seo/canonical";
import { getServiceClient } from "@/lib/supabase/server";

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

const STATE_NAME: Record<string, string> = {
  CA: "California",
  OR: "Oregon",
  WA: "Washington",
  MN: "Minnesota",
  TX: "Texas",
  UT: "Utah",
  IL: "Illinois",
  PA: "Pennsylvania",
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
    severity: { percentile: number | null };
    frequency: { percentile: number | null };
  };
  grade: { composite_percentile: number } | null;
  peer_set: { n: number };
};

type InspectionRow = {
  inspection_date: string;
  inspection_type: string;
  total_deficiency_count: number | null;
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

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  const d = n % 10;
  if (d === 1) return "st";
  if (d === 2) return "nd";
  if (d === 3) return "rd";
  return "th";
}

function severityRankLine(snapshot: SnapshotRow | null, stateCode: string): string {
  if (!snapshot) {
    return "Peer comparison unavailable for this facility.";
  }
  const state = STATE_NAME[stateCode] ?? stateCode;
  const composite = snapshot?.grade?.composite_percentile ?? null;
  const severityPct = snapshot?.metrics.severity.percentile ?? null;

  if (composite !== null && composite >= 50) {
    const topPct = Math.max(1, 100 - Math.round(composite));
    return `Ranks in the top ${topPct}% among ${state} memory care peers (36-month window).`;
  }
  if (severityPct !== null && severityPct < 50) {
    return `Ranks in the bottom ${Math.max(1, Math.round(severityPct))}% on citation severity among ${state} peers.`;
  }
  if (composite !== null) {
    const rounded = Math.round(composite);
    return `Ranks in the ${rounded}${ordinalSuffix(rounded)} percentile among ${state} peers.`;
  }
  return `Compared against ${snapshot?.peer_set.n ?? 0} ${state} peers with similar bed count.`;
}

function quietPeriodLine(lastDate: string | null): string {
  if (!lastDate) return "No inspections on record in our database.";
  const last = new Date(lastDate + "T12:00:00");
  const now = new Date();
  const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = fmtDate(lastDate);
  if (days <= 45) {
    return `Last state activity: ${formatted} (${days} day${days === 1 ? "" : "s"} ago).`;
  }
  const months = Math.round(days / 30);
  return `No new state activity since ${formatted} — about ${months} month${months === 1 ? "" : "s"} of quiet on the public record.`;
}

function recentEventsText(inspections: InspectionRow[]): string {
  if (inspections.length === 0) return "No inspections on record.";
  return inspections
    .slice(0, 3)
    .map((insp) => {
      const defs = insp.total_deficiency_count ?? 0;
      const finding =
        defs === 0 ? "no findings cited" : `${defs} finding${defs === 1 ? "" : "s"} cited`;
      return `• ${fmtDate(insp.inspection_date)} — ${fmtInspectionLabel(insp)} (${finding})`;
    })
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
    .select("inspection_date, inspection_type, total_deficiency_count, is_complaint")
    .eq("facility_id", facilityId)
    .order("inspection_date", { ascending: false })
    .limit(5);

  if (inspErr) {
    console.error("[watch-digest] inspections error:", inspErr.message);
  }

  const inspRows = (inspections ?? []) as InspectionRow[];
  const last = inspRows[0] ?? null;
  const totalDefs = inspRows.reduce((s, i) => s + (i.total_deficiency_count ?? 0), 0);

  const { data: snapshotRaw } = await supabase.rpc("facility_snapshot", {
    p_facility_id: facilityId,
  });
  const snapshot = (snapshotRaw ?? null) as SnapshotRow | null;

  const license = facility.license_number ?? "—";
  const cityState = `${facility.city}, ${facility.state_code}`;
  const beds = facility.beds ? `${facility.beds} licensed beds` : "licensed capacity on file";

  const recordSummary = last
    ? `${facility.name} has ${totalDefs} citation${totalDefs === 1 ? "" : "s"} on record across recent inspections. ${beds}. License ${license}.`
    : `${facility.name} is on your watch list. ${beds}. License ${license}.`;

  return {
    facilityName: facility.name,
    facilityUrl,
    cityState,
    licenseNumber: license,
    recordSummary,
    lastActivityDate: last ? fmtDate(last.inspection_date) : "—",
    lastActivityType: last ? fmtInspectionLabel(last) : "—",
    quietPeriodLine: quietPeriodLine(last?.inspection_date ?? null),
    recentEventsText: recentEventsText(inspRows),
    statsLine: `License ${license} · ${cityState} · ${beds}`,
    severityRankLine: severityRankLine(snapshot, facility.state_code),
    whatWeWatch: [
      "• New Oregon DHS inspections or complaint investigations",
      "• New violations or regulatory actions on the state portal",
      "• License status or memory-care endorsement changes",
      "• News or legal coverage we verify is about this facility",
    ].join("\n"),
    unsubscribeUrl: canonicalFor(`/watch/unsubscribe/${unsubscribeToken}`),
  };
}
