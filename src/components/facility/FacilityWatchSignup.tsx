"use client";

import { useState } from "react";

interface FacilityWatchSignupProps {
  facilityId: string;
  facilityName: string;
}

type FormState = "idle" | "submitting" | "success" | "error";

export function FacilityWatchSignup({ facilityId, facilityName }: FacilityWatchSignupProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          facilityId,
          facilityName,
          source: "facility_hero",
        }),
      });

      if (res.ok) {
        setState("success");
      } else {
        const json = await res.json().catch(() => ({}));
        setErrorMsg((json as { error?: string }).error ?? "Something went wrong. Try again.");
        setState("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <section className="border-t border-paper-rule py-10 px-4 md:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="border border-teal/30 bg-teal-soft px-6 py-5 max-w-xl">
            <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-teal mb-2">
              Watch confirmed
            </p>
            <p className="font-[family-name:var(--font-display)] text-[18px] leading-snug text-ink">
              Check your email to confirm your watch.
            </p>
            <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] text-ink-2">
              We sent a confirmation link to {email}.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-paper-rule py-10 px-4 md:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-12">
          {/* Copy */}
          <div className="md:max-w-[380px]">
            <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-rust mb-2">
              Facility Watch · Beta
            </p>
            <p className="font-[family-name:var(--font-display)] text-[22px] leading-snug text-ink">
              Get notified when{" "}
              <em className="not-italic text-rust">{facilityName}</em>'s inspection
              record changes.{" "}
              <span className="text-ink-2">Free.</span>
            </p>
            <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink-2">
              New citations, complaint investigations, or status changes —
              delivered to your inbox.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 md:flex-row md:items-start"
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor="watch-email"
                className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-ink-2"
              >
                Email address
              </label>
              <input
                id="watch-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-10 w-full min-w-[240px] border border-paper-rule bg-white px-3 font-[family-name:var(--font-mono)] text-[13px] text-ink placeholder:text-ink-2/50 focus:border-teal focus:outline-none md:w-auto"
                disabled={state === "submitting"}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="hidden font-[family-name:var(--font-mono)] text-[10px] md:block">&nbsp;</span>
              <button
                type="submit"
                disabled={state === "submitting" || !email.trim()}
                className="h-10 bg-teal px-5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "submitting" ? "Sending…" : "Watch this facility"}
              </button>
            </div>
          </form>
        </div>

        {state === "error" && (
          <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-rust">
            {errorMsg}
          </p>
        )}
      </div>
    </section>
  );
}
