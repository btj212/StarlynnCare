"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// Only Alameda County covered today; routing will expand as coverage grows.
const COVERED_ZIPS: Record<string, string> = {
  // Alameda County zip codes
  "94501": "/california/alameda-county",
  "94502": "/california/alameda-county",
  "94536": "/california/alameda-county",
  "94537": "/california/alameda-county",
  "94538": "/california/alameda-county",
  "94539": "/california/alameda-county",
  "94540": "/california/alameda-county",
  "94541": "/california/alameda-county",
  "94542": "/california/alameda-county",
  "94543": "/california/alameda-county",
  "94544": "/california/alameda-county",
  "94545": "/california/alameda-county",
  "94546": "/california/alameda-county",
  "94550": "/california/alameda-county",
  "94551": "/california/alameda-county",
  "94552": "/california/alameda-county",
  "94555": "/california/alameda-county",
  "94560": "/california/alameda-county",
  "94566": "/california/alameda-county",
  "94568": "/california/alameda-county",
  "94577": "/california/alameda-county",
  "94578": "/california/alameda-county",
  "94579": "/california/alameda-county",
  "94580": "/california/alameda-county",
  "94586": "/california/alameda-county",
  "94587": "/california/alameda-county",
  "94588": "/california/alameda-county",
  "94601": "/california/alameda-county",
  "94602": "/california/alameda-county",
  "94603": "/california/alameda-county",
  "94604": "/california/alameda-county",
  "94605": "/california/alameda-county",
  "94606": "/california/alameda-county",
  "94607": "/california/alameda-county",
  "94608": "/california/alameda-county",
  "94609": "/california/alameda-county",
  "94610": "/california/alameda-county",
  "94611": "/california/alameda-county",
  "94612": "/california/alameda-county",
  "94613": "/california/alameda-county",
  "94614": "/california/alameda-county",
  "94615": "/california/alameda-county",
  "94617": "/california/alameda-county",
  "94618": "/california/alameda-county",
  "94619": "/california/alameda-county",
  "94620": "/california/alameda-county",
  "94621": "/california/alameda-county",
  "94706": "/california/alameda-county",
  "94707": "/california/alameda-county",
  "94708": "/california/alameda-county",
  "94709": "/california/alameda-county",
  "94710": "/california/alameda-county",
  "94712": "/california/alameda-county",
  "94720": "/california/alameda-county",
};

export function ZipSearch() {
  const router = useRouter();
  const [zip, setZip] = useState("");
  const [status, setStatus] = useState<"idle" | "not-covered">("idle");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = zip.trim();
    const dest = COVERED_ZIPS[clean];
    if (dest) {
      router.push(dest);
    } else {
      setStatus("not-covered");
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{5}"
          maxLength={5}
          value={zip}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, ""));
            setStatus("idle");
          }}
          placeholder="Enter your zip code"
          className="w-40 rounded-md border border-sc-border bg-white px-4 py-3 text-sm text-ink placeholder:text-muted shadow-sm focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal transition"
          aria-label="Zip code"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-teal px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-mid whitespace-nowrap"
        >
          Search your area →
        </button>
      </form>

      {status === "not-covered" && (
        <p className="text-xs text-muted">
          We don&apos;t cover that zip yet —{" "}
          <a
            href="/california/alameda-county"
            className="text-teal underline underline-offset-2 hover:text-teal-mid"
          >
            browse Alameda County
          </a>{" "}
          or{" "}
          <a
            href="mailto:hello@starlynncare.com"
            className="text-teal underline underline-offset-2 hover:text-teal-mid"
          >
            request your area
          </a>
          .
        </p>
      )}

      {status === "idle" && (
        <p className="text-xs text-muted">Currently covering Alameda County, CA</p>
      )}
    </div>
  );
}
