import { getServiceClient } from "@/lib/supabase/server";
import { SectionHead } from "@/components/editorial/SectionHead";
import { ReviewTabs } from "./ReviewTabs";

type FacilityReview = {
  id: string;
  license_number: string;
  name: string;
  slug: string;
  city: string;
  street: string | null;
  website: string | null;
  mc_signal_chain_name: boolean;
  mc_signal_explicit_name: boolean;
  mc_signal_deficiency_keyword: boolean;
  mc_signal_deficiency_keyword_source: string | null;
  mc_review_status: string;
  mc_review_notes: string | null;
  mc_reviewed_by: string | null;
  mc_reviewed_at: string | null;
  city_slug: string;
};

type ListingReport = {
  id: string;
  facility_id: string;
  reason: string;
  contact_email: string | null;
  created_at: string;
  status: string;
};

type DeficiencyExcerpt = {
  facility_id: string;
  description: string;
  inspection_date: string;
};

type QueueEvidence = {
  facility_id: string;
  verdict: string;
  confidence: number | null;
  evidence_snippet: string | null;
  source_url: string | null;
  scraped_at: string;
};

const SELECT_COLUMNS = `
  id, license_number, name, slug, city, street, website,
  mc_signal_chain_name, mc_signal_explicit_name,
  mc_signal_deficiency_keyword, mc_signal_deficiency_keyword_source,
  mc_review_status, mc_review_notes, mc_reviewed_by, mc_reviewed_at,
  city_slug
`;

async function loadReviewData() {
  const supabase = getServiceClient();

  const { data: yellowRows, error: yellowError } = await supabase
    .from("facilities")
    .select(SELECT_COLUMNS)
    .eq("state_code", "CA")
    .eq("mc_review_status", "needs_review")
    .order("name");

  if (yellowError) {
    console.error("Failed to load yellow queue:", yellowError);
  }

  const { data: redRows, error: redError } = await supabase
    .from("facilities")
    .select(SELECT_COLUMNS)
    .eq("state_code", "CA")
    .eq("mc_review_status", "reviewed_reject")
    .order("mc_reviewed_at", { ascending: false });

  if (redError) {
    console.error("Failed to load red bucket:", redError);
  }

  // Load listing reports for facilities in the yellow queue
  const yellowIds = (yellowRows || []).map(f => f.id);
  let listingReports: ListingReport[] = [];
  
  if (yellowIds.length > 0) {
    const { data: reports, error: reportsError } = await supabase
      .from("mc_listing_reports")
      .select("id, facility_id, reason, contact_email, created_at, status")
      .in("facility_id", yellowIds)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    
    if (reportsError) {
      console.error("Failed to load listing reports:", reportsError);
    } else {
      listingReports = reports || [];
    }
  }

  const keywordFlaggedIds = [
    ...(yellowRows || []).filter((f) => f.mc_signal_deficiency_keyword).map((f) => f.id),
    ...(redRows || []).filter((f) => f.mc_signal_deficiency_keyword).map((f) => f.id),
  ];

  let deficiencyExcerpts: DeficiencyExcerpt[] = [];

  let queueEvidence: QueueEvidence[] = [];
  if (yellowIds.length > 0) {
    const { data: evRows, error: evError } = await supabase
      .from("mc_queue_evidence")
      .select(
        "facility_id, verdict, confidence, evidence_snippet, source_url, scraped_at",
      )
      .in("facility_id", yellowIds)
      .order("scraped_at", { ascending: false });
    if (evError) {
      console.error("Failed to load queue evidence:", evError);
    } else {
      const seen = new Set<string>();
      for (const row of evRows || []) {
        if (!seen.has(row.facility_id)) {
          seen.add(row.facility_id);
          queueEvidence.push(row as QueueEvidence);
        }
      }
    }
  }

  if (keywordFlaggedIds.length > 0) {
    const { data: inspectionsForFacilities } = await supabase
      .from("inspections")
      .select("id, facility_id, inspection_date")
      .in("facility_id", keywordFlaggedIds)
      .order("inspection_date", { ascending: false });

    const inspIdToFacility = new Map<string, { facility_id: string; inspection_date: string }>();
    for (const i of inspectionsForFacilities ?? []) {
      inspIdToFacility.set(i.id, {
        facility_id: i.facility_id,
        inspection_date: i.inspection_date,
      });
    }

    if (inspIdToFacility.size > 0) {
      const { data: defs } = await supabase
        .from("deficiencies")
        .select("inspection_id, description")
        .in("inspection_id", Array.from(inspIdToFacility.keys()))
        .not("description", "is", null)
        .limit(500);

      const seenFacilities = new Set<string>();
      for (const d of defs ?? []) {
        const meta = inspIdToFacility.get(d.inspection_id);
        if (!meta || seenFacilities.has(meta.facility_id)) continue;
        seenFacilities.add(meta.facility_id);
        deficiencyExcerpts.push({
          facility_id: meta.facility_id,
          description: d.description!,
          inspection_date: meta.inspection_date,
        });
      }
    }
  }

  return {
    yellowQueue: (yellowRows || []) as FacilityReview[],
    redBucket: (redRows || []) as FacilityReview[],
    listingReports,
    deficiencyExcerpts,
    queueEvidence,
  };
}

export default async function MCReviewPage() {
  const data = await loadReviewData();

  return (
    <div className="space-y-8">
      <SectionHead
        label="§ Admin · MC Review"
        title={<>Memory Care <em>Review Queue</em></>}
        deck="Human verification layer for chain-name matches and public corrections before publishing"
      />

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-ink mb-2">Queue Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <div className="font-medium text-amber-900">Yellow Queue (Needs Review)</div>
              <div className="text-2xl font-bold text-amber-700">{data.yellowQueue.length}</div>
              <div className="text-amber-600 text-xs">Awaiting initial decision</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <div className="font-medium text-red-900">Red Bucket (Rejected)</div>
              <div className="text-2xl font-bold text-red-700">{data.redBucket.length}</div>
              <div className="text-red-600 text-xs">Previously rejected</div>
            </div>
          </div>
        </div>

        <ReviewTabs
          yellowQueue={data.yellowQueue}
          redBucket={data.redBucket}
          listingReports={data.listingReports}
          deficiencyExcerpts={data.deficiencyExcerpts}
          queueEvidence={data.queueEvidence}
        />
      </div>
    </div>
  );
}

export const revalidate = 0; // Always fresh for admin interface