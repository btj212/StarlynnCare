import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SubmissionRow = {
  id: string;
  event_type: string;
  email: string;
  source: string | null;
  summary: string;
  payload: Record<string, unknown>;
  alert_status: string;
  alert_error: string | null;
  created_at: string;
  facility_id: string | null;
};

type ScanRunRow = {
  id: string;
  state_code: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  changes_detected: number;
  error: string | null;
};

const EVENT_TYPES = [
  { key: "all",            label: "All" },
  { key: "facility_watch", label: "Facility Watch" },
  { key: "area_watch",     label: "Area Watch" },
  { key: "listing_report", label: "Listing Report" },
  { key: "review",         label: "Review" },
  { key: "waitlist",       label: "Waitlist" },
];

const ALERT_COLORS: Record<string, string> = {
  sent:    "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed:  "bg-red-100 text-red-700",
  skipped: "bg-gray-100 text-gray-500",
  completed: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-700",
  running: "bg-blue-100 text-blue-700",
};

const TYPE_COLORS: Record<string, string> = {
  facility_watch: "bg-teal-100 text-teal-700",
  area_watch:     "bg-blue-100 text-blue-700",
  listing_report: "bg-orange-100 text-orange-700",
  review:         "bg-purple-100 text-purple-700",
  waitlist:       "bg-indigo-100 text-indigo-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
  });
}

async function loadSubmissions(eventType: string): Promise<SubmissionRow[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from("submission_events")
    .select("id, event_type, email, source, summary, payload, alert_status, alert_error, created_at, facility_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (eventType !== "all") {
    query = query.eq("event_type", eventType);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[admin/submissions] load error:", error.message);
    return [];
  }
  return (data ?? []) as SubmissionRow[];
}

async function loadRecentScanRuns(): Promise<ScanRunRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("state_scan_runs")
    .select("id, state_code, status, started_at, completed_at, changes_detected, error")
    .order("started_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("[admin/submissions] scan run load error:", error.message);
    return [];
  }
  return (data ?? []) as ScanRunRow[];
}

type PageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  const { type: rawType } = await searchParams;
  const activeType = EVENT_TYPES.some((t) => t.key === rawType) ? (rawType ?? "all") : "all";
  const [rows, scanRuns] = await Promise.all([
    loadSubmissions(activeType),
    loadRecentScanRuns(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Submissions</h1>
        <p className="mt-1 text-sm text-gray-500">
          All email captures across every form — most recent 200 shown.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-navy">Latest state source scans</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {scanRuns.map((run) => (
            <div key={run.id} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-ink">{run.state_code}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ALERT_COLORS[run.status] ?? ALERT_COLORS.failed}`}>
                  {run.status}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                {formatDate(run.started_at)} · {run.changes_detected} change{run.changes_detected === 1 ? "" : "s"}
              </p>
              {run.error && (
                <p className="mt-1 line-clamp-2 text-[10px] text-red-700" title={run.error}>
                  {run.error}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map(({ key, label }) => (
          <Link
            key={key}
            href={key === "all" ? "/admin/submissions" : `/admin/submissions?type=${key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeType === key
                ? "border-navy bg-navy text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No submissions yet{activeType !== "all" ? ` for "${activeType}"` : ""}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Time (PT)</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Summary</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="group hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-gray-500">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        TYPE_COLORS[row.event_type] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.event_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">
                    {row.email}
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-xs text-gray-700">
                    <div className="line-clamp-2">{row.summary}</div>
                    {/* Expandable payload on hover */}
                    {Object.keys(row.payload).length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] text-gray-400 hover:text-gray-600">
                          details
                        </summary>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-gray-100 p-1.5 text-[10px] text-gray-600">
                          {JSON.stringify(row.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.source ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        ALERT_COLORS[row.alert_status] ?? "bg-gray-100 text-gray-600"
                      }`}
                      title={row.alert_error ?? undefined}
                    >
                      {row.alert_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
