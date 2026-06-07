"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  STAT_KEYS,
  sanitizeHubHtml,
  verifyHubStats,
  type StatsSnapshot,
} from "@/lib/content/hubGate";
import {
  saveHubContent,
  publishHubContent,
  unpublishHubContent,
  type HubActionResult,
} from "@/app/actions/hubContent";

export function HubContentEditor({
  id,
  initialTitle,
  initialBodyHtml,
  snapshot,
  status,
  driftDetected,
}: {
  id: string;
  initialTitle: string;
  initialBodyHtml: string;
  snapshot: StatsSnapshot;
  status: string;
  driftDetected: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBodyHtml);
  const [issues, setIssues] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clean = useMemo(() => sanitizeHubHtml(body), [body]);
  // Live, deterministic gate preview — the exact code the server enforces.
  const liveIssues = useMemo(
    () => verifyHubStats(clean, snapshot),
    [clean, snapshot],
  );
  const gatePasses = liveIssues.length === 0;

  function handle(result: HubActionResult, okMessage: string) {
    if (result.ok) {
      setIssues([]);
      setMessage(okMessage);
      router.refresh();
    } else {
      setIssues(result.issues);
      setMessage(null);
    }
  }

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      handle(await saveHubContent(id, title, body), "Saved.");
    });
  }

  function onPublish() {
    setMessage(null);
    startTransition(async () => {
      // Persist the on-screen edits first so we publish exactly what's shown.
      const saved = await saveHubContent(id, title, body);
      if (!saved.ok) {
        handle(saved, "");
        return;
      }
      handle(await publishHubContent(id), "Published — now live on the public page.");
    });
  }

  function onUnpublish() {
    setMessage(null);
    startTransition(async () => {
      handle(await unpublishHubContent(id), "Unpublished — pulled back to draft.");
    });
  }

  return (
    <div className="space-y-6">
      {driftDetected && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Drift flagged.</strong> The grounded numbers no longer match
          the database. This page is hidden from the public site. Regenerate the
          draft (re-run the generator) before publishing again.
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-teal/30 bg-teal/5 px-4 py-2 text-sm text-teal">
          {message}
        </div>
      )}

      {issues.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Blocked — numeric gate failed:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {issues.map((iss, i) => (
              <li key={i}>{iss}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none"
              placeholder="e.g. Memory care in Oakland"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">
              Body HTML
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck
              className="mt-1 h-80 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs leading-relaxed text-ink focus:border-teal focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Constrained HTML: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;,
              and the locked stat spans. Numbers must stay inside their{" "}
              <code>data-stat</code> spans.
            </p>
          </div>

          {/* Grounded snapshot — the only numbers the prose may cite. */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-500">
              Grounded snapshot
            </p>
            <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {STAT_KEYS.map((k) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="truncate text-gray-400">{k}</dt>
                  <dd className="font-mono font-semibold text-ink">
                    {String(snapshot[k] ?? "—")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Preview</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                gatePasses
                  ? "bg-teal/10 text-teal"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {gatePasses ? "Numbers ✓" : `${liveIssues.length} numeric issue(s)`}
            </span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div
              className="text-[17px] leading-relaxed text-ink-2 max-w-[62ch] [&_p]:mt-4 [&_p:first-child]:mt-0 [&_a]:text-teal [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: clean }}
            />
          </div>
          {!gatePasses && (
            <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-red-500">
              {liveIssues.map((iss, i) => (
                <li key={i}>{iss}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
        <button
          disabled={pending}
          onClick={onSave}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gray-50 disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          disabled={pending || driftDetected}
          onClick={onPublish}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-mid disabled:opacity-50"
          title={driftDetected ? "Resolve drift before publishing" : undefined}
        >
          Save & publish
        </button>
        {status === "published" && (
          <button
            disabled={pending}
            onClick={onUnpublish}
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            Unpublish
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          Status: <span className="font-medium">{status.replace("_", " ")}</span>
        </span>
      </div>
    </div>
  );
}
