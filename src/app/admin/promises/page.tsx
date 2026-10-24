import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DeliveryRow = {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

type CommitmentRow = {
  id: string;
  email: string;
  product: string;
  subject_key: string;
  source: string | null;
  status: string;
  stage: string | null;
  due_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  customer_deliveries: DeliveryRow[] | null;
};

const QUEUE_STATUSES = ["open", "overdue", "needs_review"];

type PageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function AdminPromisesPage({ searchParams }: PageProps) {
  const { email } = await searchParams;
  const filter = email?.trim().toLowerCase() ?? "";
  const supabase = getServiceClient();

  let query = supabase
    .from("customer_commitments")
    .select(
      "id, email, product, subject_key, source, status, stage, due_at, metadata, created_at, customer_deliveries(id, kind, status, error, payload, created_at)",
    )
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  query = filter
    ? query.eq("email", filter)
    : query.in("status", QUEUE_STATUSES);

  const { data, error } = await query;
  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-navy">Promises</h1>
        <p className="mt-3 text-sm text-red-700">Could not load the queue: {error.message}</p>
      </div>
    );
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("customer_commitments")
    .select("product, source, metadata, created_at")
    .gte("created_at", since)
    .limit(500);
  const funnel = new Map<string, number>();
  for (const row of recent ?? []) {
    const product = typeof row.product === "string" ? row.product : "unknown";
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    const channel = typeof meta.utmSource === "string"
      ? meta.utmSource
      : typeof meta.referrerHost === "string"
        ? meta.referrerHost
        : "not recorded";
    const key = `${product} · ${channel}`;
    funnel.set(key, (funnel.get(key) ?? 0) + 1);
  }
  const funnelRows = [...funnel.entries()].sort((a, b) => b[1] - a[1]);

  const rows = (data ?? []) as unknown as CommitmentRow[];
  const overdue = rows.filter((row) => row.status === "overdue").length;
  const needsReview = rows.filter((row) => row.status === "needs_review").length;
  const failed = rows.filter((row) =>
    (row.customer_deliveries ?? []).some((delivery) => delivery.status === "failed"),
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Promises</h1>
        <p className="mt-1 text-sm text-gray-500">
          What we owe, separate from the admin-alert log. Nothing here sends itself.{" "}
          <Link href="/admin/watchers" className="text-teal underline underline-offset-2">
            Watcher dashboard
          </Link>
          {" · "}
          <Link href="/admin/submissions" className="text-teal underline underline-offset-2">
            Submissions
          </Link>
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">Signups, last 90 days</p>
        <p className="mt-1 text-xs text-gray-500">
          Grouped by product and the referring site or campaign saved with the signup. Google click totals stay in Search Console.
        </p>
        {funnelRows.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">No signups in this window.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {funnelRows.map(([label, count]) => (
              <li key={label} className="flex justify-between gap-4">
                <span>{label}</span>
                <span className="font-mono">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Overdue" value={overdue} />
        <Stat label="Needs review" value={needsReview} />
        <Stat label="Failed deliveries" value={failed} />
      </div>

      <form className="flex gap-2" action="/admin/promises">
        <input
          type="email"
          name="email"
          defaultValue={filter}
          placeholder="Look up one email"
          className="flex-1 rounded border border-gray-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-navy px-3 py-2 text-sm text-white">
          History
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing in this view.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Promise</th>
                <th className="px-3 py-3 text-left">Email</th>
                <th className="px-3 py-3 text-left">Next step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 text-xs">
                    <div className="font-semibold uppercase">{row.status}</div>
                    <div className="text-gray-400">{row.stage ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div>{row.product}</div>
                    <div className="text-gray-400">{row.source ?? row.subject_key}</div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    <Link href={`/admin/promises?email=${encodeURIComponent(row.email)}`} className="underline">
                      {row.email}
                    </Link>
                  </td>
                  <td className="max-w-[360px] px-3 py-3 text-xs text-gray-700">
                    <PromiseNote row={row} />
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>
    </div>
  );
}

function PromiseNote({ row }: { row: CommitmentRow }) {
  const note = row.metadata?.note;
  const deliveries = Array.isArray(row.customer_deliveries) ? row.customer_deliveries : [];
  const pending = deliveries.find((delivery) => delivery.status === "pending" || delivery.status === "failed");
  const instruction = pending?.payload?.instruction;
  const draft = pending?.payload?.draft;
  return (
    <div className="space-y-2">
      {typeof note === "string" && <p>{note}</p>}
      {typeof instruction === "string" && <p>{instruction}</p>}
      {pending?.error && <p className="text-red-700">{pending.error}</p>}
      {typeof draft === "string" && (
        <details>
          <summary className="cursor-pointer text-gray-400">Draft — send by hand</summary>
          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-gray-600">{draft}</pre>
        </details>
      )}
      {row.due_at && <p className="text-gray-400">Due {new Date(row.due_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}</p>}
    </div>
  );
}
