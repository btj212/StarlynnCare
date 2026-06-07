"use client";

import { useEffect, useState } from "react";
import { submitDigest } from "@/lib/watch/submitDigest";

const SCROLL_REVEAL_PX = 400;

/**
 * Fixed bottom email-capture bar. Reveals after scroll depth, replaces the
 * previous duplicate ZIP bar. Mirrors the area-watch pattern: Loops + audit log, no DB.
 */
export function MobileDigestBar() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SCROLL_REVEAL_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    const r = await submitDigest({ email: email.trim(), source: "mobile_digest_bar" });
    setStatus(r.ok ? "done" : "error");
  }

  return (
    <div className={`m-cta-bar md:hidden ${show ? "show" : ""}`}>
      {status === "done" ? (
        <p className="font-[family-name:var(--font-mono)] text-[12px] text-grade-a py-1">
          Subscribed — we&rsquo;ll notify you when severe citations are filed in covered states.
        </p>
      ) : (
        <>
          <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
            Stay on top of the record
          </p>
          <form onSubmit={onSubmit} className="flex gap-2">
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
              {status === "submitting" ? "…" : "Subscribe"}
            </button>
          </form>
          <p className="font-[family-name:var(--font-mono)] text-[10px] text-ink-4">
            Get notified when severe citations land in covered states. No operator emails.
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
