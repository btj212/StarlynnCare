"use client";

import { useEffect, useRef, useState } from "react";
import { useShortlist, type ShortlistItem } from "@/lib/shortlist/context";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD } from "@/lib/security/honeypot";

function emitClarityEvent(name: string) {
  try {
    const c = (window as unknown as { clarity?: (cmd: string, event: string) => void }).clarity;
    if (typeof c === "function") c("event", name);
  } catch {}
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
          source: "shortlist_shared",
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
          We&apos;ll send updates on these {items.length} shortlisted{" "}
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
        Get notified when any shortlisted facility receives a new inspection finding.
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
      <p className="mt-3 text-xs text-ink-4">Unsubscribe any time. We never share your email.</p>
    </div>
  );
}

function SaveToMyShortlist({ items }: { items: ShortlistItem[] }) {
  const { add, has } = useShortlist();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    items.forEach((item) => {
      if (!has(item.id)) add(item);
    });
    emitClarityEvent("shortlist_save_shared");
    setSaved(true);
  };

  if (saved) {
    return (
      <p className="text-sm text-teal font-semibold">
        ✓ Saved to your shortlist — you can add or remove facilities from{" "}
        <a href="/shortlist" className="underline underline-offset-4">
          your shortlist page
        </a>
        .
      </p>
    );
  }

  return (
    <button
      onClick={handleSave}
      className="inline-flex items-center gap-2 rounded-lg border border-ink/20 bg-paper px-5 py-2.5 text-sm font-semibold text-ink hover:bg-paper-2 transition-colors"
    >
      Save to my shortlist
    </button>
  );
}

export function SharedShortlistClient({ items }: { items: ShortlistItem[] }) {
  useEffect(() => {
    emitClarityEvent("shortlist_shared_view");
  }, []);

  return (
    <div className="space-y-8 mt-10">
      <div className="rounded-xl border border-paper-rule bg-paper-2 px-6 py-6">
        <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-rust mb-2">
          Someone shared this list with you
        </div>
        <p className="font-[family-name:var(--font-display)] text-[20px] text-ink leading-snug mb-4">
          Save these facilities to your own shortlist, or email the inspection reports to yourself.
        </p>
        <SaveToMyShortlist items={items} />
      </div>

      <EmailCapture items={items} />
    </div>
  );
}
