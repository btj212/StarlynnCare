"use client";

import { useState } from "react";

export default function WaitlistCTA() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), path: "footer" }),
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

  return (
    <section
      id="waitlist"
      className="py-20 lg:py-28 px-6 lg:px-16"
      style={{ background: "linear-gradient(135deg, #1a365d 0%, #2d4a7a 100%)" }}
    >
      <div className="max-w-[600px] mx-auto text-center">
        <p className="text-[11px] font-bold tracking-[3px] uppercase text-teal-mid mb-4">
          Join the Waitlist
        </p>
        <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.25rem)] leading-[1.2] tracking-[-0.5px] text-white mb-4">
          Be first when we launch in your state.
        </h2>
        <p className="text-white/65 text-base leading-[1.7] mb-8">
          We&apos;re building facility profiles for every memory care community in
          California and Florida first, with more states coming soon. Enter your
          email and we&apos;ll notify you when your area is live — and send you our
          free guide:{" "}
          <em className="text-white/80 not-italic font-medium">
            &ldquo;7 things the tour won&apos;t show you.&rdquo;
          </em>
        </p>

        {success ? (
          <div className="bg-teal/20 border border-teal/30 rounded-xl px-6 py-4 text-white text-base font-medium">
            You&apos;re on the list. We&apos;ll be in touch when your area goes live.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 h-14 px-5 text-base bg-white border border-white/10 rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal/40"
              />
              <button
                type="submit"
                disabled={loading}
                className="h-14 px-7 bg-teal text-white font-semibold text-base rounded-xl hover:bg-teal/90 transition-colors duration-150 disabled:opacity-60 whitespace-nowrap"
              >
                {loading ? "Joining..." : "Get Early Access →"}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-amber-light">{error}</p>}
          </form>
        )}

        <p className="mt-4 text-[13px] text-white/40">
          No spam. Unsubscribe anytime. We don&apos;t sell your data.
        </p>
      </div>
    </section>
  );
}
