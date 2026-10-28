import { getServiceClient } from "@/lib/supabase/server";
import { ComplianceReviewActions } from "./ComplianceReviewActions";

export const dynamic = "force-dynamic";

type FlagRow = {
  facility_id: string;
  license_number: string | null;
  tier: number;
  banner_text: string | null;
  docs: Array<{ type: string; date: string | null; url: string; lifted_by: string | null }>;
  checked_at: string;
  facilities: { name: string; city: string | null; state_code: string } | null;
};

type RunRow = {
  started_at: string;
  finished_at: string | null;
  counts: { "1"?: number; "2"?: number; "3"?: number; "0"?: number; failures?: number } | null;
  diff: {
    new_flags?: Array<{ name?: string; license_number?: string }>;
    lifted_flags?: unknown[];
    tier_changes?: unknown[];
  } | null;
};

export default async function ComplianceReviewPage() {
  const supabase = getServiceClient();
  const { data: flags } = await supabase
    .from("facility_compliance_flags")
    .select("facility_id, license_number, tier, banner_text, docs, checked_at, facilities(name, city, state_code)")
    .eq("tier", 1)
    .eq("review_status", "pending")
    .order("checked_at", { ascending: false })
    .limit(100);

  const { data: runs } = await supabase
    .from("compliance_flag_runs")
    .select("started_at, finished_at, counts, diff")
    .order("started_at", { ascending: false })
    .limit(1);

  const pending = (flags ?? []) as unknown as FlagRow[];
  const latest = ((runs ?? [])[0] ?? null) as RunRow | null;
  const newFlags = latest?.diff?.new_flags ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Compliance flags</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Tier 1 stays off the public page until someone approves the banner. Approving it
          publishes a Washington adult family home with the banner. Hold keeps it unpublished.
        </p>
      </div>

      {latest ? (
        <div className="rounded border border-gray-200 bg-white p-4 text-sm">
          <div className="font-medium">Latest run</div>
          <p className="mt-1 text-gray-600">
            {new Date(latest.started_at).toLocaleString()} · tier 1 {latest.counts?.["1"] ?? 0},
            tier 2 {latest.counts?.["2"] ?? 0}, tier 3 {latest.counts?.["3"] ?? 0}, none{" "}
            {latest.counts?.["0"] ?? 0}
            {latest.counts?.failures ? ` · ${latest.counts.failures} could not be read` : ""}
          </p>
          <p className="mt-1 text-gray-600">
            {newFlags.length} new Tier 1, {latest.diff?.lifted_flags?.length ?? 0} lowered,{" "}
            {latest.diff?.tier_changes?.length ?? 0} tier changes.
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-600">No compliance run yet.</p>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Tier 1 waiting for review ({pending.length})</h2>
        {pending.length === 0 ? <p className="text-sm text-gray-600">None waiting.</p> : null}
        {pending.map((flag) => (
          <article key={flag.facility_id} className="rounded border border-gray-200 bg-white p-4">
            <h3 className="font-medium">
              {flag.facilities?.name ?? "Home"} · {flag.facilities?.city ?? ""} · {flag.license_number}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-800">{flag.banner_text}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(flag.docs ?? []).map((doc) => (
                <li key={doc.url}>
                  <a href={doc.url} className="text-blue-700 underline" rel="noopener noreferrer">
                    {doc.type.replaceAll("_", " ")}
                    {doc.date ? ` · ${doc.date}` : ""}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <ComplianceReviewActions facilityId={flag.facility_id} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
