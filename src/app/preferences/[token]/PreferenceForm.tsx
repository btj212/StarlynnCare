"use client";

import { useState } from "react";

type Item = {
  id: string;
  label: string;
  status: string;
};

export function PreferenceForm({
  token,
  unsubscribedAll,
  items,
}: {
  token: string;
  unsubscribedAll: boolean;
  items: Item[];
}) {
  const [rows, setRows] = useState(items);
  const [allOff, setAllOff] = useState(unsubscribedAll);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function send(body: Record<string, string>) {
    setPending(body.commitmentId ?? "all");
    setMessage(null);
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      billingSeparate?: boolean;
    };
    setPending(null);
    if (!res.ok) {
      setMessage(json.error ?? "Could not update. Try again.");
      return;
    }
    if (body.action === "unsubscribe_all") {
      setAllOff(true);
      setRows((current) => current.map((row) => ({ ...row, status: "unsubscribed" })));
      setMessage(
        json.billingSeparate
          ? "All emails are stopped. A paid subscription, if you have one, continues until you cancel it from the billing link."
          : "All emails are stopped.",
      );
      return;
    }
    setAllOff(false);
    setRows((current) =>
      current.map((row) =>
        row.id === body.commitmentId
          ? { ...row, status: body.action === "unsubscribe" ? "unsubscribed" : "active" }
          : row,
      ),
    );
    setMessage(json.billingSeparate ? "Email updates for that facility are stopped. Billing is unchanged." : "Saved.");
  }

  return (
    <div className="mt-10 space-y-4">
      {rows.length === 0 ? (
        <p className="text-ink-2">We don&apos;t have an active promise on this link.</p>
      ) : (
        rows.map((row) => {
          const off = allOff || row.status === "unsubscribed";
          return (
            <div key={row.id} className="flex items-center justify-between gap-4 border-b border-paper-rule py-4">
              <div>
                <p className="text-ink">{row.label}</p>
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-ink-3">
                  {off ? "Stopped" : "On"}
                </p>
              </div>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() =>
                  send({
                    action: off ? "resubscribe" : "unsubscribe",
                    commitmentId: row.id,
                  })
                }
                className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.06em] text-teal underline underline-offset-4 disabled:opacity-50"
              >
                {pending === row.id ? "…" : off ? "Turn on" : "Stop"}
              </button>
            </div>
          );
        })
      )}
      <button
        type="button"
        disabled={pending !== null || allOff}
        onClick={() => send({ action: "unsubscribe_all" })}
        className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.06em] text-ink-2 underline underline-offset-4 disabled:opacity-50"
      >
        Stop every StarlynnCare email
      </button>
      {message && <p className="text-[15px] text-ink-2">{message}</p>}
    </div>
  );
}
