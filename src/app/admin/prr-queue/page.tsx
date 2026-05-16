import { getServiceClient } from "@/lib/supabase/server";

interface PrrRequest {
  id: string;
  state_code: string;
  scope_description: string;
  batched_license_numbers: string[];
  status: string;
  submitted_at: string | null;
  dshs_ack_date: string | null;
  fulfilled_at: string | null;
  received_pdf_count: number;
  notes: string | null;
  created_at: string;
}

interface CoverageGap {
  license_number: string;
  name: string;
  city: string;
  oldest_inspection: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-50 text-blue-700",
  acknowledged: "bg-yellow-50 text-yellow-700",
  partial: "bg-orange-50 text-orange-700",
  fulfilled: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-400",
};

async function loadPrrRequests(): Promise<PrrRequest[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("prr_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("PRR queue load error:", error);
    return [];
  }
  return (data ?? []) as PrrRequest[];
}

async function loadCoverageGaps(): Promise<CoverageGap[]> {
  const supabase = getServiceClient();
  // Facilities that have NO inspection older than 3 years (history gap)
  const { data, error } = await supabase.rpc("exec", {
    sql: `
      SELECT f.license_number, f.name, f.city,
             MIN(i.inspection_date)::text AS oldest_inspection
      FROM facilities f
      LEFT JOIN inspections i ON i.facility_id = f.id
      WHERE f.state_code = 'WA'
        AND f.publishable = true
        AND f.license_number IS NOT NULL
      GROUP BY f.license_number, f.name, f.city
      HAVING MAX(i.inspection_date) IS NULL
          OR MAX(i.inspection_date) < NOW() - INTERVAL '3 years'
      ORDER BY f.name
      LIMIT 100
    `,
  });

  if (error) return [];
  return (data ?? []) as CoverageGap[];
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default async function PrrQueuePage() {
  const [requests, gaps] = await Promise.all([
    loadPrrRequests(),
    // Coverage gaps via direct query — gracefully empty on error
    loadCoverageGaps().catch(() => [] as CoverageGap[]),
  ]);

  const open = requests.filter((r) => !["fulfilled", "closed"].includes(r.status));
  const closed = requests.filter((r) => ["fulfilled", "closed"].includes(r.status));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">PRR Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Public Records Requests for historical WA DSHS inspection PDFs.
          To create a new PRR: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">python3 scrapers/prr_request_builder.py --from-db-gaps</code>
        </p>
      </div>

      {/* Open requests */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium text-ink">Open ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-sm text-gray-400">No open PRR requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Scope</th>
                  <th className="pb-2 pr-4 text-right">Lics</th>
                  <th className="pb-2 pr-4">Submitted</th>
                  <th className="pb-2 pr-4">Ack'd</th>
                  <th className="pb-2 pr-4 text-right">PDFs received</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {open.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 max-w-[260px] truncate text-ink" title={req.scope_description}>
                      {req.scope_description}
                      <div className="text-[10px] text-gray-400 font-mono">{req.id.slice(0, 8)}…</div>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{req.batched_license_numbers?.length ?? 0}</td>
                    <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{formatDate(req.submitted_at)}</td>
                    <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{formatDate(req.dshs_ack_date)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{req.received_pdf_count}</td>
                    <td className="py-3 text-gray-500 text-xs max-w-[180px] truncate" title={req.notes ?? undefined}>
                      {req.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Coverage gaps */}
      {gaps.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-medium text-ink">Coverage Gaps (top {gaps.length})</h2>
          <p className="mb-3 text-xs text-gray-500">
            Publishable WA facilities with no inspections older than 3 years — candidates for PRR.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 pr-4">License</th>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">City</th>
                  <th className="pb-2">Oldest inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gaps.map((gap) => (
                  <tr key={gap.license_number} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">{gap.license_number}</td>
                    <td className="py-2 pr-4 text-ink">{gap.name}</td>
                    <td className="py-2 pr-4 text-gray-500">{gap.city}</td>
                    <td className="py-2 text-gray-500">{gap.oldest_inspection ?? "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            To generate a PRR for all gaps:{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded">python3 scrapers/prr_request_builder.py --from-db-gaps --max-licenses 50</code>
          </p>
        </section>
      )}

      {/* Closed requests */}
      {closed.length > 0 && (
        <section>
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-ink select-none mb-3">
              Fulfilled / Closed ({closed.length})
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Scope</th>
                    <th className="pb-2 pr-4 text-right">Lics</th>
                    <th className="pb-2 pr-4">Fulfilled</th>
                    <th className="pb-2 text-right">PDFs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {closed.map((req) => (
                    <tr key={req.id} className="opacity-60 hover:opacity-100">
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 max-w-[260px] truncate" title={req.scope_description}>
                        {req.scope_description}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{req.batched_license_numbers?.length ?? 0}</td>
                      <td className="py-3 pr-4 text-gray-500">{formatDate(req.fulfilled_at)}</td>
                      <td className="py-3 text-right tabular-nums">{req.received_pdf_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
