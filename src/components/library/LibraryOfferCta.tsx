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
}: LibraryOfferCtaProps) {
  const variant = `library_${slug}`;
  const source = variant;

  useEffect(() => {
    emitOfferImpression(variant);
  }, [variant]);

  if (kind === "route") {
    return (
      <div className="my-10 border border-ink/15 border-l-4 border-l-rust bg-paper-2 px-6 py-6">
        <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-rust mb-2">
          {eyebrow}
        </div>
        <p className="font-[family-name:var(--font-display)] text-[19px] leading-[1.25] tracking-[-0.01em] text-ink mb-2">
          {headline}
        </p>
        <p className="font-[family-name:var(--font-mono)] text-[11.5px] tracking-[0.02em] text-ink-2 leading-relaxed mb-5">
          {sub}
        </p>
        <Link
          href={href ?? "#"}
          onClick={() => emitOfferClick(variant)}
          className="inline-flex items-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-paper px-5 py-3 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--color-teal)" }}
        >
          {ctaLabel}
        </Link>
        <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.04em] text-ink-4">
          Free · no spam · unsubscribe any time
        </p>
      </div>
    );
  }

  return <LibraryEmailCapture variant={variant} source={source} eyebrow={eyebrow} headline={headline} sub={sub} ctaLabel={ctaLabel} />;
}

function LibraryEmailCapture({
  variant,
  source,
  eyebrow,
  headline,
  sub,
  ctaLabel,
}: {
  variant: string;
  source: string;
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
        body: JSON.stringify({ email: trimmed, source, journeyStage: "research" }),
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
      <div className="my-10 border border-teal/30 bg-teal/5 px-6 py-5">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-teal mb-2">
          ✓ On its way
        </div>
        <p className="font-[family-name:var(--font-display)] text-[18px] text-ink leading-snug">
          Check your inbox in the next few minutes.
        </p>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.04em] text-ink-3">
          No spam · Unsubscribe any time
        </p>
      </div>
    );
  }

  return (
    <div className="my-10 border border-ink/15 border-l-4 border-l-rust bg-paper-2 px-6 py-6">
      <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-rust mb-2">
        {eyebrow}
      </div>
      <p className="font-[family-name:var(--font-display)] text-[19px] leading-[1.25] tracking-[-0.01em] text-ink mb-2">
        {headline}
      </p>
      <p className="font-[family-name:var(--font-mono)] text-[11.5px] tracking-[0.02em] text-ink-2 leading-relaxed mb-5">
        {sub}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-md">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={formState === "submitting"}
          className="flex-1 border border-paper-rule bg-paper px-4 py-2.5 font-[family-name:var(--font-mono)] text-[13px] text-ink placeholder:text-ink-4 focus:outline-none focus:border-teal transition disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={formState === "submitting" || !email.trim()}
          className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-paper px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          style={{ backgroundColor: "var(--color-teal)" }}
        >
          {formState === "submitting" ? "Sending…" : ctaLabel}
        </button>
      </form>
      {formState === "error" && (
        <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-rust">
          Something went wrong — please try again.
        </p>
      )}
      <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.04em] text-ink-4">
        Free · no spam · unsubscribe any time
      </p>
    </div>
  );
}
