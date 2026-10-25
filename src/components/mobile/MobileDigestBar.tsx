"use client";

import { useEffect, useState } from "react";
import { COVERED_STATES } from "@/lib/states";

const SCROLL_REVEAL_PX = 400;

/**
 * Homepage mobile capture. It opens a real Area Watch for one state.
 * It does not promise a national severe-citation digest — nothing sends that.
 */
export function MobileDigestBar() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SCROLL_REVEAL_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const stateName = COVERED_STATES.find((state) => state.code === stateCode)?.name;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const state = COVERED_STATES.find((item) => item.code === stateCode);
    if (!email.trim() || !state) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/watch/area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          areaName: state.name,
          areaSlug: state.slug,
          stateCode: state.code,
          source: "state_modal",
        }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className={`m-cta-bar md:hidden ${show ? "show" : ""}`}>
      {status === "done" ? (
        <p className="font-[family-name:var(--font-mono)] text-[12px] text-grade-a py-1">
          Watching {stateName}. We&rsquo;ll email when an inspection is added, including a visit that adds no citation.
        </p>
      ) : (
        <>
          <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
            Watch one state
          </p>
          <form onSubmit={onSubmit} className="flex flex-col gap-2">
            <select
              required
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              disabled={status === "submitting"}
              className="border border-paper-rule bg-paper px-3 py-2.5 font-[family-name:var(--font-mono)] text-[14px] focus:outline-none focus:border-teal disabled:opacity-50"
            >
              <option value="">Choose a state</option>
              {COVERED_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "submitting"}
                className="flex-1 border border-paper-rule bg-paper px-3 py-2.5 font-[family-name:var(--font-mono)] text-[14px] focus:outline-none focus:border-teal disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === "submitting"}
                className="bg-ink text-paper px-4 py-2.5 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.06em] disabled:opacity-50 whitespace-nowrap"
              >
                {status === "submitting" ? "…" : "Watch"}
              </button>
            </div>
          </form>
          <p className="font-[family-name:var(--font-mono)] text-[10px] text-ink-4">
            An inspection in that state, even with no new citation. Not a national alert.
          </p>
          {status === "error" && (
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-rust">
              Something went wrong — try again.
            </p>
          )}
        </>
      )}
    </div>
  );
}
