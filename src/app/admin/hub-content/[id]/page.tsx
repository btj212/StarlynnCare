import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/server";
import { stateFromCode } from "@/lib/states";
import { HubContentEditor } from "./HubContentEditor";

type HubContentDetail = {
  id: string;
  state_code: string;
  region_slug: string;
  region_kind: string;
  title: string | null;
  body_html: string | null;
  stats_snapshot: Record<string, unknown> | null;
  status: string;
  drift_detected: boolean;
  drift_details: Record<string, unknown> | null;
  model: string | null;
  updated_at: string;
};

export const dynamic = "force-dynamic";

export default async function HubContentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("hub_content")
    .select(
      "id, state_code, region_slug, region_kind, title, body_html, stats_snapshot, status, drift_detected, drift_details, model, updated_at",
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const row = data as HubContentDetail;
  const state = stateFromCode(row.state_code);
  const publicPath = state ? `/${state.slug}/${row.region_slug}` : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/hub-content"
            className="text-xs font-medium text-gray-400 hover:text-ink"
          >
            ← Hub content
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-navy">
            {row.title || row.region_slug}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {row.region_slug} · {row.state_code} · {row.region_kind}
            {row.model && ` · drafted by ${row.model}`}
          </p>
        </div>
        {publicPath && (
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs font-medium text-teal hover:underline"
          >
            View public page ↗
          </a>
        )}
      </div>

      <HubContentEditor
        id={row.id}
        initialTitle={row.title ?? ""}
        initialBodyHtml={row.body_html ?? ""}
        snapshot={row.stats_snapshot ?? {}}
        status={row.status}
        driftDetected={row.drift_detected}
      />
    </div>
  );
}
