"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Bay Area coverage (county hubs). Expand as we add counties.
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

  // Contra Costa County (common)
  "94509": "/california/contra-costa-county",
  "94513": "/california/contra-costa-county",
  "94519": "/california/contra-costa-county",
  "94520": "/california/contra-costa-county",
  "94521": "/california/contra-costa-county",
  "94523": "/california/contra-costa-county",
  "94526": "/california/contra-costa-county",
  "94530": "/california/contra-costa-county",
  "94531": "/california/contra-costa-county",
  "94549": "/california/contra-costa-county",
  "94553": "/california/contra-costa-county",
  "94556": "/california/contra-costa-county",
  "94563": "/california/contra-costa-county",
  "94565": "/california/contra-costa-county",
  "94572": "/california/contra-costa-county",
  "94575": "/california/contra-costa-county",
  "94583": "/california/contra-costa-county",
  "94595": "/california/contra-costa-county",
  "94596": "/california/contra-costa-county",
  "94597": "/california/contra-costa-county",
  "94598": "/california/contra-costa-county",
  "94801": "/california/contra-costa-county",
  "94804": "/california/contra-costa-county",

  // San Mateo County (common)
  "94010": "/california/san-mateo-county",
  "94014": "/california/san-mateo-county",
  "94015": "/california/san-mateo-county",
  "94044": "/california/san-mateo-county",
  "94061": "/california/san-mateo-county",
  "94063": "/california/san-mateo-county",
  "94065": "/california/san-mateo-county",
  "94066": "/california/san-mateo-county",
  "94070": "/california/san-mateo-county",
  "94074": "/california/san-mateo-county",
  "94080": "/california/san-mateo-county",
  "94128": "/california/san-mateo-county",
  "94401": "/california/san-mateo-county",
  "94402": "/california/san-mateo-county",
  "94403": "/california/san-mateo-county",

  // Santa Clara County (common)
  "94022": "/california/santa-clara-county",
  "94024": "/california/santa-clara-county",
  "94040": "/california/santa-clara-county",
  "94041": "/california/santa-clara-county",
  "94043": "/california/santa-clara-county",
  "94085": "/california/santa-clara-county",
  "94086": "/california/santa-clara-county",
  "94087": "/california/santa-clara-county",
  "94089": "/california/santa-clara-county",
  "94301": "/california/santa-clara-county",
  "94303": "/california/santa-clara-county",
  "94306": "/california/santa-clara-county",
  "95008": "/california/santa-clara-county",
  "95014": "/california/santa-clara-county",
  "95020": "/california/santa-clara-county",
  "95030": "/california/santa-clara-county",
  "95032": "/california/santa-clara-county",
  "95035": "/california/santa-clara-county",
  "95037": "/california/santa-clara-county",
  "95110": "/california/santa-clara-county",
  "95112": "/california/santa-clara-county",
  "95123": "/california/santa-clara-county",
  "95124": "/california/santa-clara-county",
  "95125": "/california/santa-clara-county",
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
          <Link
            href="/california/alameda-county"
            className="text-teal underline underline-offset-2 hover:text-teal-mid"
          >
            browse Alameda County
          </Link>{" "}
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
        <p className="text-xs text-muted">Currently covering the Bay Area (CA)</p>
      )}
    </div>
  );
}
