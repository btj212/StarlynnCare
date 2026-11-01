"use client";

import { useState } from "react";
import { Honeypot } from "@/components/security/Honeypot";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD } from "@/lib/security/honeypot";

export function PartnerTourForm({
  facilityId,
  communityName,
  consentText,
  consentVersion,
}: {
  facilityId: string;
  communityName: string;
  consentText: string;
  consentVersion: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/partners/tour-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId,
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          relationship: data.get("relationship"),
          timing: data.get("timing"),
          consentText,
          consentVersion,
          [HONEYPOT_FIELD]: data.get(HONEYPOT_FIELD),
          [HONEYPOT_TS_FIELD]: data.get(HONEYPOT_TS_FIELD),
        }),
      });
      const body = (await res.json()) as { message?: string; delivered?: boolean; error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(body.error ?? "The request could not be sent.");
        return;
      }
      form.reset();
      setStatus(body.delivered ? "sent" : "saved");
      setMessage(body.message ?? `Your request went only to ${communityName}.`);
    } catch {
      setStatus("error");
      setMessage("The request could not be sent.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative mt-8 grid gap-3 sm:grid-cols-2">
      <Honeypot />
      <label className="block text-sm text-ink-2">
        Your name
        <input name="name" required autoComplete="name" className="mt-1 w-full border border-paper-rule bg-paper px-3 py-2 text-ink" />
      </label>
      <label className="block text-sm text-ink-2">
        Email
        <input name="email" type="email" required autoComplete="email" className="mt-1 w-full border border-paper-rule bg-paper px-3 py-2 text-ink" />
      </label>
      <label className="block text-sm text-ink-2">
        Phone <span className="text-ink-4">(optional)</span>
        <input name="phone" autoComplete="tel" className="mt-1 w-full border border-paper-rule bg-paper px-3 py-2 text-ink" />
      </label>
      <label className="block text-sm text-ink-2">
        Relationship
        <input name="relationship" required placeholder="Daughter, son, spouse" className="mt-1 w-full border border-paper-rule bg-paper px-3 py-2 text-ink" />
      </label>
      <label className="block text-sm text-ink-2 sm:col-span-2">
        When you are looking
        <input name="timing" required placeholder="This month, next few months" className="mt-1 w-full border border-paper-rule bg-paper px-3 py-2 text-ink" />
      </label>
      <p className="sm:col-span-2 text-sm leading-relaxed text-ink-3">{consentText}</p>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={status === "sending"}
          className="bg-teal px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
        >
          {status === "sending" ? "Sending" : `Request a tour from ${communityName}`}
        </button>
        {message ? (
          <p className="mt-3 text-sm text-ink-2" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
