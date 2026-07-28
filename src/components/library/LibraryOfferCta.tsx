"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  emitOfferImpression,
  emitOfferClick,
  emitOfferConvert,
} from "@/lib/analytics/clarityEvents";

type Kind = "route" | "email";

interface LibraryOfferCtaProps {
  /**
   * Page slug — used for Clarity variant tagging and /api/watch/digest source.
   * E.g. "medi-cal-and-memory-care" → source = "library_medi-cal-and-memory-care".
   */
  slug: string;
  eyebrow: string;
  headline: string;
  sub: string;
  ctaLabel: string;
  kind: Kind;
  /** Required when kind === "route" */
  href?: string;
  /**
   * Server-side magnet key. When set, /api/watch/digest will fire a
   * specific transactional email (e.g. "tour_scoresheet", "crisis_checklist").
   * Only used when kind === "email".
   */
  magnet?: string;
}

type FormState = "idle" | "submitting" | "success" | "error";

export function LibraryOfferCta({
  slug,
  eyebrow,
  headline,
  sub,
  ctaLabel,
  kind,
  href,
  magnet,
}: LibraryOfferCtaProps) {
  const variant = `library_${slug}`;
  const source = variant;

  useEffect(() => {
    emitOfferImpression(variant);
  }, [variant]);

  if (kind === "route") {
    return (
      <div className="my-10 rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-6 py-6 shadow-[var(--shadow-card)]">
        <div className="mb-2 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.12em] text-teal">
          {eyebrow}
        </div>
        <p className="mb-2 font-[family-name:var(--font-display)] text-[19px] leading-[1.25] tracking-[-0.01em] text-ink">
          {headline}
        </p>
        <p className="mb-5 font-[family-name:var(--font-sans)] text-[13.5px] leading-relaxed tracking-[0.01em] text-ink-2">
          {sub}
        </p>
        <Link
          href={href ?? "#"}
          onClick={() => emitOfferClick(variant)}
          className="inline-flex items-center rounded-xl px-5 py-3 font-[family-name:var(--font-sans)] text-[13px] font-semibold text-paper transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--color-teal)" }}
        >
          {ctaLabel}
        </Link>
        <p className="mt-3 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-4">
          Free · no spam · unsubscribe any time
        </p>
      </div>
    );
  }

  return <LibraryEmailCapture variant={variant} source={source} magnet={magnet} eyebrow={eyebrow} headline={headline} sub={sub} ctaLabel={ctaLabel} />;
}

function LibraryEmailCapture({
  variant,
  source,
  magnet,
  eyebrow,
  headline,
  sub,
  ctaLabel,
}: {
  variant: string;
  source: string;
  magnet?: string;
  eyebrow: string;
  headline: string;
  sub: string;
  ctaLabel: string;
}) {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setFormState("submitting");
    emitOfferClick(variant);
    try {
      const res = await fetch("/api/watch/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          source,
          journeyStage: "research",
          ...(magnet ? { magnet } : {}),
        }),
      });
      if (res.ok) {
        emitOfferConvert(variant);
        setFormState("success");
      } else {
        setFormState("error");
      }
    } catch {
      setFormState("error");
    }
  };

  if (formState === "success") {
    return (
      <div className="my-10 rounded-[18px] border border-teal/25 bg-teal/5 px-6 py-5">
        <div className="mb-2 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.12em] text-teal">
          ✓ On its way
        </div>
        <p className="font-[family-name:var(--font-display)] text-[18px] leading-snug text-ink">
          Check your inbox in the next few minutes.
        </p>
        <p className="mt-1 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-3">
          No spam · Unsubscribe any time
        </p>
      </div>
    );
  }

  return (
    <div className="my-10 rounded-[18px] border border-clearing-rule-2 bg-clearing-card px-6 py-6 shadow-[var(--shadow-card)]">
      <div className="mb-2 font-[family-name:var(--font-sans)] text-[12px] font-semibold uppercase tracking-[0.12em] text-teal">
        {eyebrow}
      </div>
      <p className="mb-2 font-[family-name:var(--font-display)] text-[19px] leading-[1.25] tracking-[-0.01em] text-ink">
        {headline}
      </p>
      <p className="mb-5 font-[family-name:var(--font-sans)] text-[13.5px] leading-relaxed tracking-[0.01em] text-ink-2">
        {sub}
      </p>
      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-2.5 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={formState === "submitting"}
          className="flex-1 rounded-[12px] border border-clearing-rule-2 bg-clearing-bg px-4 py-2.5 font-[family-name:var(--font-sans)] text-[14px] text-ink transition placeholder:text-ink-4 focus:border-teal focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={formState === "submitting" || !email.trim()}
          className="whitespace-nowrap rounded-xl px-5 py-2.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--color-teal)" }}
        >
          {formState === "submitting" ? "Sending…" : ctaLabel}
        </button>
      </form>
      {formState === "error" && (
        <p className="mt-2 font-[family-name:var(--font-sans)] text-[12px] text-rust">
          Something went wrong — please try again.
        </p>
      )}
      <p className="mt-3 font-[family-name:var(--font-sans)] text-[12px] tracking-[0.02em] text-ink-4">
        Free · no spam · unsubscribe any time
      </p>
    </div>
  );
}
