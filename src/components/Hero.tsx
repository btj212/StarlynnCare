"use client";

import { useState } from "react";

interface HeroFormProps {
  path: "hero";
}

function HeroForm({ path }: HeroFormProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError("");

    const isEmail = value.includes("@");
    const body = isEmail
      ? { email: value.trim(), path }
      : { email: "", zip: value.trim(), path };

    // If zip only, show email prompt instead of submitting
    if (!isEmail) {
      setError("Please enter your email address to get notified when your area is live.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-teal-light border border-teal/20 rounded-xl px-6 py-4 text-teal font-medium text-base">
        You&apos;re on the list. We&apos;ll notify you when your area goes live.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter your email address"
          className="flex-1 h-14 px-5 text-lg bg-white border border-sc-border rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-14 px-7 bg-teal text-white font-semibold text-base rounded-xl hover:bg-teal/90 transition-colors duration-150 disabled:opacity-60 whitespace-nowrap"
        >
          {loading ? "Joining..." : "Find Facilities →"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-amber">{error}</p>
      )}
      <p className="mt-3 text-sm text-muted">
        Florida &amp; California available now. More states coming soon.
      </p>
    </form>
  );
}

export default function Hero() {
  return (
    <section className="bg-warm-white pt-32 pb-20 lg:pt-40 lg:pb-28">
      <div className="max-w-[1100px] mx-auto px-6 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column */}
          <div>
            <p className="text-[11px] font-bold tracking-[3px] uppercase text-teal mb-4">
              No referral commissions. Ever.
            </p>
            <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1] tracking-[-1px] text-navy mb-5">
              Find memory care you can{" "}
              <em className="not-italic text-teal">actually</em> trust.
            </h1>
            <p className="text-lg leading-[1.7] text-slate mb-8 max-w-[480px]">
              StarlynnCare gives families real inspection records, staffing data,
              and deficiency histories — the things tour guides don&apos;t show you
              — so you can make a decision you won&apos;t regret.
            </p>

            <div className="mb-4 max-w-[520px]">
              <HeroForm path="hero" />
            </div>

            <a
              href="#two-path"
              className="inline-block text-sm font-medium text-teal hover:underline mb-8"
            >
              Need placement in 48 hours? → Start here
            </a>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-slate">
              <span className="flex items-center gap-1.5">
                <span className="text-base">🔒</span> No commissions
              </span>
              <span className="text-sc-border hidden sm:inline">|</span>
              <span className="flex items-center gap-1.5">
                <span className="text-base">📋</span> Real inspection records
              </span>
              <span className="text-sc-border hidden sm:inline">|</span>
              <span className="flex items-center gap-1.5">
                <span className="text-base">⭐</span> Not a referral service
              </span>
            </div>
          </div>

          {/* Right column — UI mockup */}
          <div className="flex justify-center lg:justify-end">
            <div
              className="relative w-full max-w-[440px] opacity-0 animate-[fadeIn_400ms_100ms_ease_forwards]"
              style={{ animation: "fadeIn 400ms 100ms ease forwards" }}
            >
              <style>{`
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(12px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              {/* Facility card mockup at slight tilt */}
              <div
                className="bg-white rounded-2xl border border-sc-border p-5"
                style={{
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1), 0 16px 40px rgba(0,0,0,0.08)",
                  transform: "rotate(-1.5deg)",
                }}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-teal-light flex items-center justify-center text-2xl flex-shrink-0">
                    🏠
                  </div>
                  <div>
                    <p className="font-semibold text-navy text-sm leading-tight">
                      Magnolia Ridge Health
                    </p>
                    <p className="text-muted text-xs mt-0.5">Gainesville, FL · Alachua County</p>
                    <div className="flex items-center gap-1 mt-1">
                      {"★★★☆☆".split("").map((s, i) => (
                        <span key={i} className={`text-xs ${s === "★" ? "text-amber" : "text-sc-border"}`}>
                          {s}
                        </span>
                      ))}
                      <span className="text-[11px] text-muted ml-1">Overall</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="bg-red-light rounded-lg p-3 border-l-2 border-red-badge">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-red-badge mb-1">
                      Class 2 · Resident Care
                    </p>
                    <p className="text-xs text-slate font-mono leading-relaxed">
                      &ldquo;Resident found without call light within reach on 3 of 5 observations...&rdquo;
                    </p>
                  </div>
                  <div className="bg-amber-light rounded-lg p-3 border-l-2 border-amber">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber mb-1">
                      Class 3 · Medication
                    </p>
                    <p className="text-xs text-slate font-mono leading-relaxed">
                      &ldquo;2 missed doses without documentation noted in records...&rdquo;
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-sc-border flex gap-2">
                  <span className="text-[11px] text-muted">Data from AHCA public inspection records</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
