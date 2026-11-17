"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

type Match = {
  name: string;
  url: string;
  license_number: string | null;
  regulator_url: string | null;
  city: string | null;
  beds: number | null;
  last_inspection_date: string | null;
};

type LookupResponse = { matches: Match[] };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; query: string; matches: Match[] };

type Props = {
  stateSlug: string;
  stateName: string;
  regulatorName: string;
  regulatorUrl: string;
};

const linkCls = "text-teal underline underline-offset-4 hover:text-ink";

function isLookupResponse(value: unknown): value is LookupResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { matches?: unknown }).matches)
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function FacilityLookupBox({ stateSlug, stateName, regulatorName, regulatorUrl }: Props) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    if (query.length < 3) {
      setStatus({ kind: "error", message: "Type at least 3 characters of a home name or license number." });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const response = await fetch(
        `/api/facilities/${stateSlug}/lookup?q=${encodeURIComponent(query)}`,
      );
      const body: unknown = await response.json();
      if (!response.ok || !isLookupResponse(body)) {
        setStatus({ kind: "error", message: "The search is unavailable right now. Try again in a minute." });
        return;
      }
      setStatus({ kind: "done", query, matches: body.matches });
    } catch {
      setStatus({ kind: "error", message: "The search is unavailable right now. Try again in a minute." });
    }
  }

  return (
    <section
      aria-label={`Search ${stateName} homes`}
      className="mb-10 rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-5 py-6 shadow-[var(--shadow-card)] md:px-7"
    >
      <label
        htmlFor={inputId}
        className="mb-3 block font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust"
      >
        Look up a {stateName} home
      </label>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Home name or license number"
          className="w-full flex-1 rounded-[14px] border border-clearing-rule-2 bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="rounded-[14px] bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ink-2 disabled:opacity-60"
        >
          {status.kind === "loading" ? "Searching…" : "Search"}
        </button>
      </form>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
        This searches the memory care homes StarlynnCare publishes in {stateName}. For any other home, use the{" "}
        <a href={regulatorUrl} rel="noopener noreferrer" className={linkCls}>
          {regulatorName}
        </a>
        .
      </p>

      <div aria-live="polite" className="mt-5">
        {status.kind === "error" && <p className="text-sm text-rust">{status.message}</p>}
        {status.kind === "done" && status.matches.length === 0 && (
          <p className="text-sm text-ink-2">
            No published {stateName} home matches &ldquo;{status.query}&rdquo;. Try fewer words, or search the{" "}
            <a href={regulatorUrl} rel="noopener noreferrer" className={linkCls}>
              {regulatorName}
            </a>
            .
          </p>
        )}
        {status.kind === "done" && status.matches.length > 0 && (
          <ul className="divide-y divide-paper-rule">
            {status.matches.map((match) => (
              <li key={match.url} className="py-4 first:pt-0 last:pb-0">
                <p className="font-[family-name:var(--font-display)] text-[20px] leading-[1.2] text-ink">
                  {match.name}
                </p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[12px] tracking-[0.03em] text-ink-3">
                  {[
                    match.city,
                    match.license_number ? `License ${match.license_number}` : null,
                    match.last_inspection_date
                      ? `Last inspection ${formatDate(match.last_inspection_date)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <Link href={new URL(match.url).pathname} className={linkCls}>
                    StarlynnCare profile
                  </Link>
                  <a href={match.regulator_url ?? regulatorUrl} rel="noopener noreferrer" className={linkCls}>
                    {match.regulator_url ? `${regulatorName} record` : regulatorName}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
