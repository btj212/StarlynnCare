"use client";

import { useState } from "react";
import Link from "next/link";

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

interface ReviewTabsProps {
  yellowQueue: FacilityReview[];
  redBucket: FacilityReview[];
  listingReports: ListingReport[];
  deficiencyExcerpts: DeficiencyExcerpt[];
  queueEvidence: QueueEvidence[];
}

export function ReviewTabs({
  yellowQueue,
  redBucket,
  listingReports,
  deficiencyExcerpts,
  queueEvidence,
}: ReviewTabsProps) {
  const [activeTab, setActiveTab] = useState<"yellow" | "red">("yellow");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<FacilityReview | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch("/api/admin/mc-review/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });

      if (response.ok) {
        const result = await response.json();
        setSearchResult(result.facility);
      } else {
        setSearchResult(null);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  const getListingReportForFacility = (facilityId: string) => {
    return listingReports.find(r => r.facility_id === facilityId);
  };

  const getDeficiencyExcerptForFacility = (facilityId: string) => {
    return deficiencyExcerpts.find(d => d.facility_id === facilityId);
  };

  const evidenceByFacility = new Map<string, QueueEvidence>();
  for (const ev of queueEvidence) {
    if (!evidenceByFacility.has(ev.facility_id)) {
      evidenceByFacility.set(ev.facility_id, ev);
    }
  }

  const getEvidenceForFacility = (facilityId: string) =>
    evidenceByFacility.get(facilityId);

  const renderSignalBadges = (facility: FacilityReview) => {
    const badges = [];
    
    if (facility.mc_signal_explicit_name) {
      badges.push(
        <span key="explicit" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Explicit MC
        </span>
      );
    }
    
    if (facility.mc_signal_chain_name) {
      badges.push(
        <span key="chain" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          Chain Match
        </span>
      );
    }
    
    if (facility.mc_signal_deficiency_keyword) {
      badges.push(
        <span key="keyword" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Keyword +
        </span>
      );
    }

    const report = getListingReportForFacility(facility.id);
    if (report) {
      badges.push(
        <span key="report" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          Public Report
        </span>
      );
    }

    return badges;
  };

  const renderOfficialSiteLink = (facility: FacilityReview) => {
    if (facility.website) {
      return (
        <a
          href={facility.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          Official Site →
        </a>
      );
    }

    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${facility.name}" ${facility.city} California`)}`;
    return (
      <a
        href={googleSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 text-sm"
      >
        Google Search →
      </a>
    );
  };

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Look up by license number, slug, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </form>
        
        {searchResult && (
          <div className="mt-3 p-3 bg-white border rounded-md">
            <div className="text-sm">
              <strong>{searchResult.name}</strong> • {searchResult.city} • Status: {searchResult.mc_review_status}
            </div>
            <Link
              href={`/california/${searchResult.city_slug}/${searchResult.slug}`}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View facility page →
            </Link>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("yellow")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "yellow"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Yellow Queue ({yellowQueue.length})
          </button>
          <button
            onClick={() => setActiveTab("red")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "red"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Red Bucket ({redBucket.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "yellow" && (
        <div className="space-y-4">
          {yellowQueue.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No facilities awaiting review
            </div>
          ) : (
            yellowQueue.map((facility) => (
              <YellowQueueRow
                key={facility.id}
                facility={facility}
                listingReport={getListingReportForFacility(facility.id)}
                deficiencyExcerpt={getDeficiencyExcerptForFacility(facility.id)}
                queueEvidence={getEvidenceForFacility(facility.id)}
                signalBadges={renderSignalBadges(facility)}
                officialSiteLink={renderOfficialSiteLink(facility)}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "red" && (
        <div className="space-y-4">
          {redBucket.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No rejected facilities
            </div>
          ) : (
            redBucket.map((facility) => (
              <RedBucketRow
                key={facility.id}
                facility={facility}
                signalBadges={renderSignalBadges(facility)}
                officialSiteLink={renderOfficialSiteLink(facility)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function YellowQueueRow({
  facility,
  listingReport,
  deficiencyExcerpt,
  queueEvidence,
  signalBadges,
  officialSiteLink,
}: {
  facility: FacilityReview;
  listingReport?: ListingReport;
  deficiencyExcerpt?: DeficiencyExcerpt;
  queueEvidence?: QueueEvidence;
  signalBadges: React.ReactNode[];
  officialSiteLink: React.ReactNode;
}) {
  const [notes, setNotes] = useState(facility.mc_review_notes || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAction = async (action: "approve" | "reject" | "pending") => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/mc-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: facility.id,
          action,
          notes: notes.trim(),
        }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        console.error("Action failed");
      }
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg text-ink">
            {facility.name}
          </h3>
          <div className="text-sm text-gray-600">
            {facility.city} • {facility.license_number}
            {facility.street && ` • ${facility.street}`}
          </div>
        </div>
        <div className="text-right">
          {officialSiteLink}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {signalBadges}
      </div>

      {queueEvidence && (
        <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
          <div className="text-sm font-medium text-slate-900">
            Auto-verification suggestion
          </div>
          <div className="mt-1 flex flex-wrap gap-2 items-center text-xs">
            <span className="font-mono uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-800">
              {queueEvidence.verdict}
            </span>
            {queueEvidence.confidence != null && (
              <span className="text-slate-600">
                confidence{" "}
                {(Number(queueEvidence.confidence) <= 1
                  ? Number(queueEvidence.confidence) * 100
                  : Number(queueEvidence.confidence)
                ).toFixed(0)}
                %
              </span>
            )}
            <span className="text-slate-500">
              {new Date(queueEvidence.scraped_at).toLocaleString()}
            </span>
          </div>
          {queueEvidence.evidence_snippet && (
            <div className="text-sm text-slate-800 mt-2">{queueEvidence.evidence_snippet}</div>
          )}
          {queueEvidence.source_url && (
            <a
              href={queueEvidence.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-xs mt-2 inline-block"
            >
              Source page →
            </a>
          )}
        </div>
      )}

      {listingReport && (
        <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
          <div className="text-sm font-medium text-orange-900">Public Report:</div>
          <div className="text-sm text-orange-800 mt-1">{listingReport.reason}</div>
          {listingReport.contact_email && (
            <div className="text-xs text-orange-600 mt-1">Contact: {listingReport.contact_email}</div>
          )}
        </div>
      )}

      {deficiencyExcerpt && (
        <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-md">
          <div className="text-sm font-medium text-purple-900">Deficiency Excerpt:</div>
          <div className="text-sm text-purple-800 mt-1">
            {deficiencyExcerpt.description.substring(0, 300)}
            {deficiencyExcerpt.description.length > 300 && "..."}
          </div>
          <div className="text-xs text-purple-600 mt-1">
            From inspection: {new Date(deficiencyExcerpt.inspection_date).toLocaleDateString()}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Review Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            rows={2}
            placeholder="Add notes about your decision..."
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleAction("approve")}
            disabled={isUpdating}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => handleAction("reject")}
            disabled={isUpdating}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => handleAction("pending")}
            disabled={isUpdating}
            className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            Keep Pending
          </button>
        </div>
      </div>
    </div>
  );
}

function RedBucketRow({
  facility,
  signalBadges,
  officialSiteLink,
}: {
  facility: FacilityReview;
  signalBadges: React.ReactNode[];
  officialSiteLink: React.ReactNode;
}) {
  const [notes, setNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAction = async (action: "restore" | "approve_anyway") => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/mc-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: facility.id,
          action,
          notes: notes.trim(),
        }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        console.error("Action failed");
      }
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg text-ink">
            {facility.name}
          </h3>
          <div className="text-sm text-gray-600">
            {facility.city} • {facility.license_number}
            {facility.street && ` • ${facility.street}`}
          </div>
        </div>
        <div className="text-right">
          {officialSiteLink}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {signalBadges}
      </div>

      <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
        <div className="text-sm font-medium text-red-900">Previous Rejection:</div>
        <div className="text-sm text-red-800 mt-1">
          Reviewer: {facility.mc_reviewed_by} • {
            facility.mc_reviewed_at ? 
            new Date(facility.mc_reviewed_at).toLocaleDateString() : 
            "Date unknown"
          }
        </div>
        {facility.mc_review_notes && (
          <div className="text-sm text-red-700 mt-2">
            Notes: {facility.mc_review_notes}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Notes (will be appended)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            rows={2}
            placeholder="Add notes about this action..."
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleAction("restore")}
            disabled={isUpdating}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md text-sm hover:bg-yellow-700 disabled:opacity-50"
          >
            Restore to Queue
          </button>
          <button
            onClick={() => handleAction("approve_anyway")}
            disabled={isUpdating}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
          >
            Approve Anyway
          </button>
        </div>
      </div>
    </div>
  );
}