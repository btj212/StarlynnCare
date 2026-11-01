"use client";

import { useState } from "react";
import Link from "next/link";
import { Honeypot } from "@/components/security/Honeypot";
import { HONEYPOT_FIELD, HONEYPOT_TS_FIELD } from "@/lib/security/honeypot";

type Match = { id: string; name: string; city: string | null; state: string; path: string };
type Rule = { code: string; pass: boolean; detail: string };

export function EligibilityLookup({
  checkoutEnabled,
  foundingOpen,
}: {
  checkoutEnabled: boolean;
  foundingOpen: boolean;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [picked, setPicked] = useState<Match | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [pass, setPass] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"founding" | "standard">(foundingOpen ? "founding" : "standard");
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setPicked(null);
    setRules(null);
    setPass(null);
    const res = await fetch(`/api/partners/eligibility?q=${encodeURIComponent(query)}`);
    const body = (await res.json()) as { matches?: Match[]; error?: string };
    if (!res.ok) {
      setMessage(body.error ?? "Search is unavailable.");
      setMatches([]);
      return;
    }
    setMatches(body.matches ?? []);
    if ((body.matches ?? []).length === 0) setMessage("No published community matched that name.");
  }

  async function choose(match: Match) {
    setBusy(true);
    setMessage("");
    setPicked(match);
    const res = await fetch(`/api/partners/eligibility?facilityId=${match.id}`);
    const body = (await res.json()) as { gate?: { pass: boolean; rules: Rule[] }; error?: string };
    setBusy(false);
    if (!res.ok || !body.gate) {
      setRules(null);
      setPass(null);
      setMessage(body.error ?? "Eligibility could not be checked.");
      return;
    }
    setRules(body.gate.rules);
    setPass(body.gate.pass);
  }

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!picked) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/partners/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: picked.id,
        email,
        plan,
        interval,
        [HONEYPOT_FIELD]: data.get(HONEYPOT_FIELD),
        [HONEYPOT_TS_FIELD]: data.get(HONEYPOT_TS_FIELD),
      }),
    });
    const body = (await res.json()) as { url?: string; manageUrl?: string; error?: string };
    setBusy(false);
    if (body.url) {
      window.location.href = body.url;
      return;
    }
    if (body.manageUrl) {
      window.location.href = body.manageUrl;
      return;
    }
    setMessage(body.error ?? "Checkout could not start.");
  }

  return (
    <div>
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="partner-search">Community name</label>
        <input
          id="partner-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Community name"
          className="w-full border border-paper-rule bg-paper px-3 py-2 text-ink"
        />
        <button type="submit" className="bg-ink px-4 py-2 text-sm text-paper">
          Look up
        </button>
      </form>
      {matches.length > 0 ? (
        <ul className="mt-4 divide-y divide-paper-rule border border-paper-rule">
          {matches.map((match) => (
            <li key={match.id}>
              <button type="button" onClick={() => choose(match)} className="block w-full px-4 py-3 text-left hover:bg-paper-2">
                <span className="text-ink">{match.name}</span>
                <span className="mt-1 block text-sm text-ink-3">
                  {[match.city, match.state].filter(Boolean).join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {picked && rules ? (
        <div className="mt-6">
          <h3 className="font-[family-name:var(--font-display)] text-2xl text-ink">{picked.name}</h3>
          <p className="mt-2 text-sm text-ink-2">
            <Link href={picked.path} className="underline">
              Public record
            </Link>
            . {pass ? "Eligible." : "Not eligible."} Payment still would not change this page’s grade or rank.
          </p>
          <ul className="mt-4 space-y-2">
            {rules.map((rule) => (
              <li key={rule.code} className="text-sm text-ink-2">
                <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  {rule.pass ? "Pass" : "Fail"}
                </span>
                {" · "}
                {rule.detail}
              </li>
            ))}
          </ul>
          {pass && checkoutEnabled ? (
            <form onSubmit={checkout} className="relative mt-6 grid gap-3">
              <Honeypot />
              <label className="text-sm text-ink-2">
                Billing email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full border border-paper-rule bg-paper px-3 py-2 text-ink"
                />
              </label>
              <div className="flex flex-wrap gap-3 text-sm text-ink-2">
                {foundingOpen ? (
                  <label>
                    <input type="radio" name="plan" checked={plan === "founding"} onChange={() => setPlan("founding")} /> Founding
                  </label>
                ) : null}
                <label>
                  <input type="radio" name="plan" checked={plan === "standard"} onChange={() => setPlan("standard")} /> Standard
                </label>
                <label>
                  <input type="radio" name="interval" checked={interval === "month"} onChange={() => setInterval("month")} /> Monthly
                </label>
                <label>
                  <input type="radio" name="interval" checked={interval === "year"} onChange={() => setInterval("year")} /> Annual
                </label>
              </div>
              <button type="submit" disabled={busy} className="w-fit bg-teal px-4 py-2 text-sm text-paper disabled:opacity-60">
                Continue to checkout
              </button>
            </form>
          ) : null}
          {pass && !checkoutEnabled ? (
            <p className="mt-6 max-w-[62ch] text-sm leading-relaxed text-ink-2">
              This community clears the gate. Checkout stays closed until counsel has reviewed the terms and the insurance is in place.
              Write to <a className="underline" href="mailto:hello@starlynncare.com">hello@starlynncare.com</a>.
            </p>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="mt-4 text-sm text-ink-2">{message}</p> : null}
      {busy ? <p className="mt-3 text-sm text-ink-4">Checking the record…</p> : null}
    </div>
  );
}
