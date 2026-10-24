"use client";

import { useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  label: string;
  status: string;
};

const STAGES = [
  {
    id: "researching",
    label: "Still researching",
    next: "Start with the decision guide, then the record on a facility page.",
    href: "/library/choosing-memory-care",
    link: "Open the decision guide",
  },
  {
    id: "touring",
    label: "Touring",
    next: "Take the question list to the tour.",
    href: "/library/37-questions-to-ask-on-a-memory-care-tour",
    link: "Open the tour questions",
  },
  {
    id: "signing",
    label: "About to sign",
    next: "Contract review is free.",
    href: "/tools/contract-review",
    link: "Decode a contract",
  },
  {
    id: "placed",
    label: "Already moved in",
    next: "Facility Watch is on that facility’s page. It is $9 a month.",
    href: null,
    link: null,
  },
  {
    id: "finished",
    label: "No longer looking",
    next: "You can stop every email below.",
    href: null,
    link: null,
  },
] as const;

export function PreferenceForm({
  token,
  unsubscribedAll,
  items,
  journeyStage,
}: {
  token: string;
  unsubscribedAll: boolean;
  items: Item[];
  journeyStage: string | null;
}) {
  const [rows, setRows] = useState(items);
  const [allOff, setAllOff] = useState(unsubscribedAll);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [stage, setStage] = useState(journeyStage);

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
    if (body.action === "set_stage") {
      setStage(body.stage ?? null);
      setMessage("Saved.");
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

  const stageHelp = STAGES.find((item) => item.id === stage);

  return (
    <div className="mt-10 space-y-4">
      <div className="border border-paper-rule p-4">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-ink-3">
          Where are you in the decision?
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {STAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={pending !== null}
              onClick={() => void send({ action: "set_stage", stage: item.id })}
              className="min-h-11 border border-paper-rule px-3 py-2 text-left text-[15px] text-ink disabled:opacity-50"
            >
              {stage === item.id ? "✓ " : ""}
              {item.label}
            </button>
          ))}
        </div>
        {stageHelp && (
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            {stageHelp.next}{" "}
            {stageHelp.href && (
              <Link href={stageHelp.href} className="text-teal underline underline-offset-4">
                {stageHelp.link}
              </Link>
            )}
          </p>
        )}
      </div>
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
