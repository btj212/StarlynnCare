import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/server";

type HubContentRow = {
  id: string;
  state_code: string;
  region_slug: string;
  region_kind: string;
  title: string | null;
  status: string;
  drift_detected: boolean;
  stats_snapshot: Record<string, unknown> | null;
  updated_at: string;
};

async function loadAllHubContent(): Promise<HubContentRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("hub_content")
    .select(
      "id, state_code, region_slug, region_kind, title, status, drift_detected, stats_snapshot, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Admin hub-content load error:", error);
    return [];
  }
  return (data ?? []) as HubContentRow[];
}

export const dynamic = "force-dynamic";

export default async function AdminHubContentPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "draft" } = await searchParams;
  const all = await loadAllHubContent();

  const counts = {
    draft: all.filter((r) => r.status === "draft").length,
    in_review: all.filter((r) => r.status === "in_review").length,
    published: all.filter((r) => r.status === "published").length,
  };
  const driftCount = all.filter((r) => r.drift_detected).length;

  const rows = all.filter((r) => r.status === filter);

  const tabClass = (tab: string) =>
    `px-4 py-2 text-sm font-medium rounded-md transition ${
      filter === tab ? "bg-white shadow-sm text-ink" : "text-gray-500 hover:text-ink"
    }`;

  const TABS: { key: string; label: string }[] = [
    { key: "draft", label: "Draft" },
    { key: "in_review", label: "In review" },
    { key: "published", label: "Published" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Hub content</h1>
        <p className="mt-1 text-sm text-gray-500">
          Edit and approve LLM-drafted city-hub editorial. Numbers are verified
          against the grounded snapshot on every save and on publish — you only
          review the prose.
        </p>
      </div>

      {driftCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {driftCount} published {driftCount === 1 ? "page is" : "pages are"}{" "}
          drift-flagged and currently hidden from the public site until
          re-approved.
        </div>
      )}

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => (
          <a key={tab.key} href={`?filter=${tab.key}`} className={tabClass(tab.key)}>
            {tab.label}
            <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
              {counts[tab.key as keyof typeof counts]}
            </span>
          </a>
        ))}
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No {filter.replace("_", " ")} content.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const facilityCount = row.stats_snapshot?.facility_count;
            const updated = new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
            }).format(new Date(row.updated_at));
            return (
              <Link
                key={row.id}
                href={`/admin/hub-content/${row.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal/40 hover:shadow"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-semibold text-ink">
                    {row.title || row.region_slug}
                  </p>
                  <p className="text-xs text-gray-400">
                    {row.region_slug} · {row.state_code} · {row.region_kind}
                    {typeof facilityCount === "number" &&
                      ` · ${facilityCount} facilities`}
                    {` · updated ${updated}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row.drift_detected && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Drift
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      row.status === "published"
                        ? "bg-teal/10 text-teal"
                        : row.status === "in_review"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {row.status.replace("_", " ")}
                  </span>
                  <span className="text-gray-300">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
