"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useShortlist, type ShortlistItem } from "@/lib/shortlist/context";
import { ShortlistButton } from "@/components/shortlist/ShortlistButton";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD } from "@/lib/security/honeypot";

const CATEGORY_LABEL: Record<string, string> = {
  rcfe_memory_care: "RCFE · Memory care",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF · Memory care",
  alf_general: "ALF",
  snf_general: "Nursing home",
  snf_dementia_scu: "Nursing home · Dementia SCU",
  ccrc: "CCRC",
};

function emitClarityEvent(name: string) {
  try {
    const c = (window as unknown as { clarity?: (cmd: string, event: string) => void }).clarity;
    if (typeof c === "function") c("event", name);
  } catch {}
}

function TrustBadge({ item }: { item: ShortlistItem }) {
  if (item.inspections === 0) {
    return <span className="text-xs text-ink-4">No inspection data yet</span>;
  }
  if (item.serious_citations > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
        {item.serious_citations} serious citation{item.serious_citations !== 1 ? "s" : ""} on file
      </span>
    );
  }
  if (item.total_citations > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        {item.total_citations} citation{item.total_citations !== 1 ? "s" : ""} on file
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4a7a50]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#6b8f71] shrink-0" />
      No citations on file
    </span>
  );
}

function CompareCard({ item }: { item: ShortlistItem }) {
  return (
    <div className="flex flex-col rounded-xl border border-paper-rule bg-paper-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-paper-rule">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/${item.state_slug}/${item.city_slug}/${item.slug}`}
            className="font-[family-name:var(--font-display)] text-[18px] leading-snug text-ink hover:text-teal transition-colors"
          >
            {item.name}
          </Link>
          <ShortlistButton item={item} size="sm" />
        </div>
        {item.city && (
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-ink-4 uppercase tracking-[0.06em]">
            {item.city}
          </p>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">Trust signal</span>
          <TrustBadge item={item} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">Total citations</span>
          <span className="font-[family-name:var(--font-mono)] font-semibold text-ink tabular-nums">
            {item.total_citations}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">Inspections on file</span>
          <span className="font-[family-name:var(--font-mono)] font-semibold text-ink tabular-nums">
            {item.inspections}
          </span>
        </div>
        {item.beds != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-3">Beds</span>
            <span className="font-[family-name:var(--font-mono)] font-semibold text-ink tabular-nums">
              {item.beds}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">License type</span>
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3">
            {CATEGORY_LABEL[item.care_category] ?? item.care_category}
          </span>
        </div>
      </div>

      <div className="mt-auto px-5 py-4 border-t border-paper-rule">
        <Link
          href={`/${item.state_slug}/${item.city_slug}/${item.slug}`}
          className="block w-full rounded-lg border border-teal/30 bg-teal/5 px-3 py-2.5 text-center text-sm font-semibold text-teal-deep hover:bg-teal/10 transition-colors"
        >
          View full inspection record →
        </Link>
      </div>
    </div>
  );
}

function EmailCapture({ items }: { items: ShortlistItem[] }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const tsRef = useRef(Date.now());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "loading" || status === "done") return;
    setStatus("loading");

    try {
      const res = await fetch("/api/watch/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          facilities: items.map((i) => ({ id: i.id, name: i.name })),
          source: "shortlist_page",
          [HONEYPOT_FIELD]: "",
          [HONEYPOT_TS_FIELD]: tsRef.current,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Request failed");
      }
      setStatus("done");
      emitClarityEvent("shortlist_email");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="rounded-xl border border-teal/30 bg-teal/5 px-6 py-5 text-center">
        <p className="font-[family-name:var(--font-display)] text-[18px] text-ink">
          You&apos;re on the list.
        </p>
        <p className="mt-2 text-sm text-ink-3">
          We&apos;ll send updates on your {items.length} shortlisted{" "}
          {items.length === 1 ? "facility" : "facilities"} when inspection records change.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-paper-rule bg-paper-2 px-6 py-6">
      <h2 className="font-[family-name:var(--font-display)] text-[22px] text-ink mb-1">
        Email me these {items.length} inspection reports
      </h2>
      <p className="text-sm text-ink-3 mb-5">
        Get notified when any of your shortlisted facilities receives a new inspection finding.
        No sales calls, no referral commission — just the public record.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input type="text" name={HONEYPOT_FIELD} className="sr-only" aria-hidden tabIndex={-1} autoComplete="off" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 rounded-lg border border-paper-rule bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ink-2 transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "Saving…" : "Email reports"}
        </button>
      </form>
      {status === "error" && (
        <p className="mt-2 text-xs text-red-600">Something went wrong — try again in a moment.</p>
      )}
      <p className="mt-3 text-xs text-ink-4">
        Unsubscribe any time. We never share your email.
      </p>
    </div>
  );
}

export function ShortlistView() {
  const { items, clear } = useShortlist();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isEmpty = !mounted || items.length === 0;

  return (
    <main className="min-h-[70vh]" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-10 py-14">
        <div className="mb-10">
          <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
            § Your shortlist
          </div>
          <h1
            className="font-[family-name:var(--font-display)] font-normal tracking-[-0.02em] text-ink"
            style={{ fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1 }}
          >
            {isEmpty
              ? "Your shortlist is empty"
              : <>Compare {items.length} shortlisted {items.length === 1 ? "facility" : "facilities"}</>}
          </h1>
          {!isEmpty && (
            <p className="mt-4 font-[family-name:var(--font-display)] italic text-[18px] text-ink-3">
              Inspection records side-by-side — no commissions, no referral bias.
            </p>
          )}
        </div>

        {isEmpty ? (
          <div className="space-y-6 max-w-[52ch]">
            <p className="text-[17px] text-ink-2 leading-relaxed">
              Browse facilities and tap the bookmark icon to add them here. You can compare up
              to 10 facilities side-by-side and email the inspection reports to yourself.
            </p>
            <Link
              href="/california/facilities"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink-2 transition-colors"
            >
              Browse California facilities →
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <CompareCard key={item.id} item={item} />
              ))}
            </div>
            <EmailCapture items={items} />
            <div className="flex justify-end">
              <button
                onClick={clear}
                className="text-xs text-ink-4 hover:text-rust transition-colors underline underline-offset-4"
              >
                Clear shortlist
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
