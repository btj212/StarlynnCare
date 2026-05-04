"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CareCategory } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ListFacility = {
  id: string;
  name: string;
  city: string | null;
  /** Street line from CDSS (optional; used for schema on listing pages). */
  street: string | null;
  zip: string | null;
  city_slug: string;
  slug: string;
  beds: number | null;
  care_category: CareCategory;
  photo_url: string | null;
  capacity_tier: "small" | "medium" | "large" | "unknown";
  serves_memory_care: boolean;
  memory_care_disclosure_filed: boolean;
  inspections: number;
  serious_citations: number;
  total_citations: number;
};

type FilterChip = "all" | "large" | "medium" | "has_citations" | "no_citations" | "small";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_SHORT: Partial<Record<CareCategory, string>> = {
  rcfe_memory_care: "RCFE",
  rcfe_general: "RCFE",
  alf_memory_care: "ALF",
  alf_general: "ALF",
  snf_general: "Nursing home",
  snf_dementia_scu: "Nursing home",
  ccrc: "CCRC",
};

// Deterministic soft gradient from facility name
const PALETTES: [string, string][] = [
  ["#e8efe9", "#d0e0d2"], // sage
  ["#f5ede0", "#eadbcc"], // warm sand
  ["#e5eaf0", "#d5dde8"], // cool slate
  ["#f0e8e8", "#e4d5d5"], // blush
  ["#ede8f0", "#ddd0e8"], // lavender
  ["#f0eee5", "#e5e0d5"], // warm ivory
];

function nameHash(s: string) {
  return s.split("").reduce((a, c) => ((a * 31 + c.charCodeAt(0)) & 0xffff), 0);
}

function gradientFor(name: string): [string, string] {
  return PALETTES[nameHash(name) % PALETTES.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Trust signal
// ─────────────────────────────────────────────────────────────────────────────

type TrustSignal =
  | { type: "no_data" }
  | { type: "clean"; inspections: number }
  | { type: "serious"; count: number }
  | { type: "minor"; count: number };

function trustSignal(f: ListFacility): TrustSignal {
  if (f.inspections === 0) return { type: "no_data" };
  if (f.serious_citations > 0) return { type: "serious", count: f.serious_citations };
  if (f.total_citations > 0) return { type: "minor", count: f.total_citations };
  return { type: "clean", inspections: f.inspections };
}

function TrustBadge({ signal }: { signal: TrustSignal }) {
  if (signal.type === "no_data")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-muted/50 shrink-0" />
        No inspection data yet
      </span>
    );
  if (signal.type === "clean")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4a7a50]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#6b8f71] shrink-0" />
        No citations on file
      </span>
    );
  if (signal.type === "serious")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
        {signal.count} serious citation{signal.count !== 1 ? "s" : ""} on file
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
      {signal.count} citation{signal.count !== 1 ? "s" : ""} on file
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Facility card
// ─────────────────────────────────────────────────────────────────────────────

function FacilityCard({ f, stateSlug }: { f: ListFacility; stateSlug: string }) {
  const href = `/${stateSlug}/${f.city_slug}/${f.slug}`;
  const signal = trustSignal(f);
  const [g1, g2] = gradientFor(f.name);
  const typeLabel = CATEGORY_SHORT[f.care_category] ?? "Care facility";
  const isMc = f.memory_care_disclosure_filed || f.serves_memory_care;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-sc-border bg-white shadow-card transition-shadow hover:shadow-card-hover"
      style={signal.type === "serious" ? { borderColor: "#f5c6c6" } : undefined}
    >
      {/* Photo / gradient */}
      <div className="relative h-32 w-full overflow-hidden shrink-0">
        {f.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={f.photo_url}
            alt={`Exterior of ${f.name}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div
            className="h-full w-full transition-opacity group-hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${g1} 0%, ${g2} 100%)`,
            }}
          />
        )}
        {signal.type === "serious" && (
          <span className="absolute top-2 left-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-600/90 text-white shadow-sm backdrop-blur-sm">
            {signal.count} serious
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Tier 1: name */}
        <p className="font-semibold text-ink leading-snug group-hover:text-teal transition-colors line-clamp-2">
          {f.name}
        </p>

        {/* Tier 2: trust signal */}
        <TrustBadge signal={signal} />

        {/* Tier 3: metadata */}
        <p className="mt-auto pt-1 text-[11px] text-muted leading-relaxed">
          {[
            f.city,
            f.beds != null ? `${f.beds} beds` : null,
            typeLabel,
            isMc ? "Memory care" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-sc-border pb-3">
      <h2 className="font-[family-name:var(--font-serif)] text-xl font-semibold text-navy">
        {title}
      </h2>
      <span className="text-sm tabular-nums text-muted font-normal">({count})</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────────────────────

const CHIPS: { id: FilterChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "large", label: "50+ beds" },
  { id: "medium", label: "7–49 beds" },
  { id: "no_citations", label: "No citations" },
];

export function FacilityListClient({
  facilities,
  stateSlug,
  regionName,
  hiddenSmallCount,
  initialShowSmall = false,
}: {
  facilities: ListFacility[];
  stateSlug: string;
  regionName: string;
  hiddenSmallCount: number;
  /** When all indexed facilities are small-tier, show them by default so the list is not empty. */
  initialShowSmall?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<FilterChip>("all");
  const [showSmall, setShowSmall] = useState(initialShowSmall);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return facilities.filter((f) => {
      // Search
      if (q && !f.name.toLowerCase().includes(q) && !f.city?.toLowerCase().includes(q)) {
        return false;
      }
      // Small homes gate
      if (f.capacity_tier === "small" && !showSmall) return false;
      // Chip filters
      if (chip === "large") return f.capacity_tier === "large";
      if (chip === "medium") return f.capacity_tier === "medium" || f.capacity_tier === "unknown";
      if (chip === "has_citations") return f.total_citations > 0;
      if (chip === "no_citations") return f.total_citations === 0 && f.inspections > 0;
      if (chip === "small") return f.capacity_tier === "small";
      return true;
    });
  }, [facilities, query, chip, showSmall]);

  const isFiltered = query.trim() !== "" || chip !== "all";

  // Groups for default sectioned view
  const mcLarge = filtered.filter(
    (f) =>
      (f.memory_care_disclosure_filed || f.serves_memory_care) &&
      f.capacity_tier === "large",
  );
  const mcMedium = filtered.filter(
    (f) =>
      (f.memory_care_disclosure_filed || f.serves_memory_care) &&
      (f.capacity_tier === "medium" || f.capacity_tier === "unknown"),
  );
  const nonMc = filtered.filter(
    (f) =>
      !f.memory_care_disclosure_filed &&
      !f.serves_memory_care &&
      f.capacity_tier !== "small",
  );
  const smallHomes = filtered.filter((f) => f.capacity_tier === "small");

  return (
    <div>
      {/* ── Search + filter rail ── */}
      <div className="mt-6 space-y-3">
        {/* Search input */}
        <div className="relative max-w-md">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setChip("all"); }}
            placeholder={`Search facilities in ${regionName}…`}
            className="w-full rounded-lg border border-sc-border bg-white pl-9 pr-4 py-2.5 text-sm text-ink placeholder:text-muted shadow-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition"
          />
        </div>

        {/* Filter chips + small homes toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              onClick={() => { setChip(c.id); setQuery(""); }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                chip === c.id && !query
                  ? "bg-navy text-white"
                  : "bg-white border border-sc-border text-slate hover:border-navy/30 hover:text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
          {hiddenSmallCount > 0 && (
            <button
              onClick={() => { setShowSmall((v) => !v); setChip("all"); setQuery(""); }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                showSmall
                  ? "bg-navy text-white"
                  : "bg-white border border-sc-border text-slate hover:border-navy/30 hover:text-ink"
              }`}
            >
              {showSmall ? "Hide" : "Show"} ≤6-bed homes ({hiddenSmallCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      {filtered.length === 0 ? (
        <div className="mt-12 text-center text-sm text-muted">
          No facilities match &ldquo;{query}&rdquo;.
        </div>
      ) : isFiltered ? (
        /* Flat list when filtering */
        <section className="mt-8">
          <p className="mb-4 text-sm text-muted tabular-nums">
            {filtered.length} {filtered.length === 1 ? "facility" : "facilities"}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((f) => (
              <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
            ))}
          </div>
        </section>
      ) : (
        /* Default sectioned view */
        <>
          {mcLarge.length > 0 && (
            <section className="mt-10">
              <SectionHead title="Memory care · 50+ beds" count={mcLarge.length} />
              <p className="mt-1.5 text-xs text-muted">
                Community-style facilities (purpose-built buildings, common in regional chains).
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {mcLarge.map((f) => (
                  <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
                ))}
              </div>
            </section>
          )}

          {mcMedium.length > 0 && (
            <section className="mt-12">
              <SectionHead title="Memory care · 7–49 beds" count={mcMedium.length} />
              <p className="mt-1.5 text-xs text-muted">
                Small to medium freestanding RCFEs with a memory-care program.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {mcMedium.map((f) => (
                  <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
                ))}
              </div>
            </section>
          )}

          {nonMc.length > 0 && (
            <section className="mt-12">
              <SectionHead title="Other licensed facilities" count={nonMc.length} />
              <p className="mt-1.5 text-xs text-muted">
                Licensed and inspected — no confirmed memory-care program on file.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {nonMc.map((f) => (
                  <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
                ))}
              </div>
            </section>
          )}

          {showSmall && smallHomes.length > 0 && (
            <section className="mt-12">
              <SectionHead title="Residential care homes · ≤6 beds" count={smallHomes.length} />
              <p className="mt-1.5 text-xs text-muted">
                Single-family-home conversions. Owner-operated. Receive fewer routine state inspections by design — inspect the home yourself before committing.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {smallHomes.map((f) => (
                  <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
