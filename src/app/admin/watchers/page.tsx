import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type WatcherRow = {
  id: string;
  confirmed_at: string | null;
  facilities: { name: string; slug: string; city_slug: string; state_slug: string; state_code: string } | null;
};

async function loadWatcherStats() {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("facility_watchers")
    .select("id, confirmed_at, facilities(name, slug, city_slug, state_slug, state_code)")
    .order("confirmed_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[admin/watchers] load error:", error.message);
    return { total: 0, confirmed: 0, byState: [], topFacilities: [] };
  }

  const rows = (data ?? []) as unknown as WatcherRow[];
  const total = rows.length;
  const confirmed = rows.filter((r) => r.confirmed_at !== null).length;

  // Count by state
  const stateMap = new Map<string, number>();
  for (const row of rows) {
    const code = row.facilities?.state_code ?? "??";
    stateMap.set(code, (stateMap.get(code) ?? 0) + 1);
  }
  const byState = [...stateMap.entries()]
    .map(([state_code, count]) => ({ state_code, count }))
    .sort((a, b) => b.count - a.count);

  // Top 10 facilities by watcher count
  const facMap = new Map<string, { facility_name: string; state_slug: string; city_slug: string; facility_slug: string; count: number }>();
  for (const row of rows) {
    const f = row.facilities;
    if (!f) continue;
    const key = f.slug;
    const entry = facMap.get(key);
    if (entry) {
      entry.count++;
    } else {
      facMap.set(key, {
        facility_name: f.name,
        state_slug: f.state_slug,
        city_slug: f.city_slug,
        facility_slug: f.slug,
        count: 1,
      });
    }
  }
  const topFacilities = [...facMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { total, confirmed, byState, topFacilities };
}

export default async function AdminWatchersPage() {
  const stats = await loadWatcherStats();
  const confirmRate =
    stats.total > 0
      ? Math.round((stats.confirmed / stats.total) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Facility Watch</h1>
        <p className="mt-1 text-sm text-gray-500">
          Email capture sign-ups across all facility profiles.
        </p>
      </div>

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total sign-ups", value: stats.total.toLocaleString() },
          { label: "Confirmed", value: stats.confirmed.toLocaleString() },
          { label: "Confirmation rate", value: `${confirmRate}%` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-navy">{value}</p>
          </div>
        ))}
      </div>

      {/* By state */}
      {stats.byState.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-navy">Sign-ups by state</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">State</th>
                  <th className="px-5 py-3 text-right">Sign-ups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.byState.map((row) => (
                  <tr key={row.state_code}>
                    <td className="px-5 py-3 font-medium text-ink">{row.state_code}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top facilities */}
      {stats.topFacilities.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-navy">Top 10 watched facilities</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">Facility</th>
                  <th className="px-5 py-3 text-right">Watchers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.topFacilities.map((row, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3">
                      <a
                        href={`/${row.state_slug}/${row.city_slug}/${row.facility_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-teal hover:underline"
                      >
                        {row.facility_name} ↗
                      </a>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No sign-ups yet.
        </div>
      )}
    </div>
  );
}
