"use client";

import { useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export function ContractEmailCapture() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setFormState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/offer/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source: "contract_review_page",
        }),
      });
      if (res.ok) {
        setFormState("success");
      } else {
        const json = await res.json().catch(() => ({}));
        setErrorMsg((json as { error?: string }).error ?? "Something went wrong.");
        setFormState("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setFormState("error");
    }
  };

  if (formState === "success") {
    return (
      <div className="border border-teal bg-teal/5 p-5">
        <p className="font-[family-name:var(--font-mono)] text-[12.5px] tracking-[0.04em] text-teal">
          ✓ Got it — watch your inbox. We&rsquo;ll follow up within 2 business days.
        </p>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.02em] text-ink-3">
          While you wait, reply to our email with the contract PDF attached.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-[400px]">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        disabled={formState === "submitting"}
        className="h-12 w-full border border-paper-rule bg-paper px-3 font-[family-name:var(--font-mono)] text-[13px] text-ink placeholder:text-ink-4 focus:border-ink focus:outline-none transition-colors"
      />
      <button
        type="submit"
        disabled={formState === "submitting" || !email.trim()}
        className="h-12 w-full font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.14em] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--color-teal)" }}
      >
        {formState === "submitting" ? "Sending…" : "Get the breakdown →"}
      </button>
      {formState === "error" && (
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-rust">{errorMsg}</p>
      )}
      <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.04em] text-ink-4">
        Free · no spam · reply with your PDF attached
      </p>
    </form>
  );
}
