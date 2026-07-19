import { getServiceClient } from "@/lib/supabase/server";
import { stateFromCode } from "@/lib/states";

export const dynamic = "force-dynamic";

function facilityHref(f: {
  slug: string;
  city_slug: string;
  state_code: string;
}): string {
  const stateSlug =
    stateFromCode(f.state_code)?.slug ?? f.state_code.toLowerCase();
  return `/${stateSlug}/${f.city_slug}/${f.slug}`;
}

type WatcherRow = {
  id: string;
  confirmed_at: string | null;
  alerts_eligible: boolean | null;
  source: string | null;
  facilities: {
    name: string;
    slug: string;
    city_slug: string;
    state_code: string;
  } | null;
};

type PaidRow = {
  id: string;
  email: string;
  status: string;
  billing_interval: string;
  fulfillment_status: string;
  firecrawl_monitor_id: string | null;
  created_at: string;
  facilities: {
    name: string;
    slug: string;
    city_slug: string;
    state_code: string;
  } | null;
};

async function loadWatcherStats() {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("facility_watchers")
    .select(
      "id, confirmed_at, alerts_eligible, source, facilities(name, slug, city_slug, state_code)",
    )
    .order("confirmed_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[admin/watchers] load error:", error.message);
    return {
      total: 0,
      alertEligible: 0,
      oneTimeLeads: 0,
      byState: [],
      topFacilities: [],
    };
  }

  const rows = (data ?? []) as unknown as WatcherRow[];
  const total = rows.length;
  const alertEligible = rows.filter(
    (r) => r.confirmed_at !== null && r.alerts_eligible !== false,
  ).length;
  const oneTimeLeads = rows.filter((r) => r.alerts_eligible === false).length;

  const stateMap = new Map<string, number>();
  for (const row of rows) {
    if (row.alerts_eligible === false) continue;
    const code = row.facilities?.state_code ?? "??";
    stateMap.set(code, (stateMap.get(code) ?? 0) + 1);
  }
  const byState = [...stateMap.entries()]
    .map(([state_code, count]) => ({ state_code, count }))
    .sort((a, b) => b.count - a.count);

  const facMap = new Map<
    string,
    {
      facility_name: string;
      href: string;
      count: number;
    }
  >();
  for (const row of rows) {
    if (row.alerts_eligible === false) continue;
    const f = row.facilities;
    if (!f) continue;
    const key = f.slug;
    const entry = facMap.get(key);
    if (entry) {
      entry.count++;
    } else {
      facMap.set(key, {
        facility_name: f.name,
        href: facilityHref(f),
        count: 1,
      });
    }
  }
  const topFacilities = [...facMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { total, alertEligible, oneTimeLeads, byState, topFacilities };
}

async function loadPaidSubscriptions() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("facility_watch_subscriptions")
    .select(
      "id, email, status, billing_interval, fulfillment_status, firecrawl_monitor_id, created_at, facilities(name, slug, city_slug, state_code)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[admin/watchers] paid load error:", error.message);
    return {
      rows: [] as PaidRow[],
      active: 0,
      monthly: 0,
      annual: 0,
      pendingFulfillment: 0,
    };
  }

  const rows = (data ?? []) as unknown as PaidRow[];
  const active = rows.filter((r) => r.status === "active" || r.status === "past_due").length;
  const monthly = rows.filter(
    (r) =>
      (r.status === "active" || r.status === "past_due") && r.billing_interval === "month",
  ).length;
  const annual = rows.filter(
    (r) =>
      (r.status === "active" || r.status === "past_due") && r.billing_interval === "year",
  ).length;
  const pendingFulfillment = rows.filter(
    (r) =>
      (r.status === "active" || r.status === "past_due") &&
      r.fulfillment_status === "pending",
  ).length;

  return { rows, active, monthly, annual, pendingFulfillment };
}

export default async function AdminWatchersPage() {
  const stats = await loadWatcherStats();
  const paid = await loadPaidSubscriptions();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Facility Watch</h1>
        <p className="mt-1 text-sm text-gray-500">
          Paid Facility Watch subscriptions, legacy official-record alert
          recipients, and one-time email leads.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Official-alert recipients",
            value: stats.alertEligible.toLocaleString(),
          },
          {
            label: "One-time email leads",
            value: stats.oneTimeLeads.toLocaleString(),
          },
          {
            label: "Total facility_watchers rows",
            value: stats.total.toLocaleString(),
          },
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

      <div>
        <h2 className="mb-3 text-lg font-semibold text-navy">Paid Facility Watch</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Active / past due", value: paid.active },
            { label: "Monthly", value: paid.monthly },
            { label: "Annual", value: paid.annual },
            { label: "Awaiting fulfillment", value: paid.pendingFulfillment },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-navy">
                {value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {paid.rows.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Facility</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Fulfillment</th>
                  <th className="px-4 py-3 text-left">Monitor ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paid.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      {row.facilities ? (
                        <a
                          href={facilityHref(row.facilities)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-teal hover:underline"
                        >
                          {row.facilities.name} ↗
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.email}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">{row.status}</td>
                    <td className="px-4 py-3 text-gray-700">{row.billing_interval}</td>
                    <td className="px-4 py-3 text-gray-700">{row.fulfillment_status}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {row.firecrawl_monitor_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stats.byState.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-navy">
            Official-alert recipients by state
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">State</th>
                  <th className="px-5 py-3 text-right">Recipients</th>
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

      {stats.topFacilities.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-navy">
            Top 10 facilities by official-alert recipients
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">Facility</th>
                  <th className="px-5 py-3 text-right">Recipients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.topFacilities.map((row, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3">
                      <a
                        href={row.href}
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

      {stats.total === 0 && paid.rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No watchers or paid subscriptions yet.
        </div>
      )}
    </div>
  );
}
