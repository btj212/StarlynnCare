"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CareCategory } from "@/lib/types";
import { ShortlistButton } from "@/components/shortlist/ShortlistButton";
import { formatFacilityName } from "@/lib/facility/displayName";
import { facilityDisplayName, nameMatchesQuery } from "@/lib/facility/aliases";
import {
  cityHubCardGroup,
  listedInMemoryCareGroup,
  SMALL_HOMES_PREVIEW_COUNT,
  SMALL_HOMES_SECTION_DECK,
  SMALL_HOMES_SECTION_TITLE,
} from "@/lib/city-hub/careSetting";
import {
  CONFIRMED_ACCEPTS_CHIP,
  CONFIRMED_ACCEPTS_SECTION,
  DEMENTIA_CREDENTIAL_CHIP,
  DEMENTIA_CREDENTIAL_SECTION,
} from "@/lib/facility/memoryCareBasis";
import { listLicenseLabel, listSectionDeck, listSectionTitle } from "@/lib/city-hub/licenseLabel";

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
  /** Texas HHSC Alzheimer Certification on roster (Phase 2 MC signal). */
  tx_alzheimer_certified?: boolean;
  inspections: number;
  serious_citations: number;
  total_citations: number;
  /** True when fewer than 4 inspections exist in the past 3 years. */
  limitedHistory?: boolean;
  /** Sourced DBA. Null until filled — never invent. */
  marketing_name?: string | null;
  name_aliases?: string[] | null;
  /**
   * Chip on the card. Pass a value (including null) from the server so Arizona
   * Directed Care and Washington SDC are labeled from the state file, not from
   * serves_memory_care.
   */
  careChip?: string | null;
  /** State-accurate license label (RCF/ALF/ALDC/mo_level_of_care). */
  licenseLabel?: string | null;
  license_type?: string | null;
  mo_level_of_care?: string | null;
  mn_dementia_care_licensed?: boolean | null;
  wa_dementia_care_contract?: boolean | null;
  wa_earc_sdc_contracted?: boolean | null;
  az_mc_subclass?: boolean | null;
  az_license_level?: string | null;
  az_memory_care_endorsed?: boolean | null;
  mc_designation_type?: string | null;
  memory_care_disclosure_source?: string | null;
  mce_endorsed?: boolean | null;
  wa_memory_care_certified?: boolean | null;
  il_dementia_program_flag?: boolean | null;
  mo_alzheimer_scu?: boolean | null;
  /** Quality-gate tier. Ignored until GATE_ENFORCED is on. */
  gateTier?: "A" | "B" | "none";
};

type FilterChip = "all" | "large" | "medium" | "has_citations" | "no_citations" | "small";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
        No inspections on file yet
      </span>
    );
  if (signal.type === "clean")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4a7a50]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#6b8f71] shrink-0" />
        No citations on file (all years)
      </span>
    );
  if (signal.type === "serious")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
        {signal.count} serious citation{signal.count !== 1 ? "s" : ""} on file (all years)
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
      {signal.count} citation{signal.count !== 1 ? "s" : ""} on file (all years)
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Facility card
// ─────────────────────────────────────────────────────────────────────────────

function FacilityCard({ f, stateSlug }: { f: ListFacility; stateSlug: string }) {
  const href = `/${stateSlug}/${f.city_slug}/${f.slug}`;
  const displayName = facilityDisplayName(f);
  const signal = trustSignal(f);
  const [g1, g2] = gradientFor(displayName);
  const typeLabel =
    f.licenseLabel ??
    listLicenseLabel({
      stateCode:
        stateSlug === "california"
          ? "CA"
          : stateSlug === "oregon"
            ? "OR"
            : stateSlug === "minnesota"
              ? "MN"
              : stateSlug === "missouri"
                ? "MO"
                : stateSlug === "colorado"
                  ? "CO"
                  : "",
      care_category: f.care_category,
      license_type: f.license_type,
      mo_level_of_care: f.mo_level_of_care,
      mn_dementia_care_licensed: f.mn_dementia_care_licensed,
    });
  const inMemoryCareGroup = listedInMemoryCareGroup({
    stateSlug,
    careChip: f.careChip,
    servesMemoryCare: f.serves_memory_care,
    memoryCareDisclosureFiled: f.memory_care_disclosure_filed,
    txAlzheimerCertified: f.tx_alzheimer_certified,
    gateTier: f.gateTier,
  });
  const careChip =
    f.careChip !== undefined
      ? f.careChip
      : stateSlug === "arizona"
        ? "Directed Care"
        : stateSlug === "washington"
          ? null
          : inMemoryCareGroup
            ? "Memory care"
            : null;

  const shortlistItem = {
    id: f.id,
    name: displayName,
    slug: f.slug,
    city_slug: f.city_slug,
    state_slug: stateSlug,
    city: f.city,
    beds: f.beds,
    total_citations: f.total_citations,
    serious_citations: f.serious_citations,
    inspections: f.inspections,
    care_category: f.care_category,
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-[18px] border border-clearing-rule-2 bg-clearing-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
      style={signal.type === "serious" ? { borderColor: "#f5c6c6" } : undefined}
    >
      {/* Photo / gradient */}
      <Link href={href} className="block shrink-0 h-32 relative overflow-hidden">
        {f.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={f.photo_url}
            alt={`Exterior of ${displayName}`}
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
      </Link>

      {/* Shortlist bookmark — positioned in top-right corner */}
      <ShortlistButton
        item={shortlistItem}
        className="absolute top-2 right-2 shadow-sm"
      />

      {/* Body */}
      <Link href={href} className="flex flex-1 flex-col gap-2 p-4 no-underline">
        {/* Tier 1: name */}
        <p className="font-semibold text-ink leading-snug group-hover:text-teal transition-colors line-clamp-2">
          {displayName}
        </p>
        {f.limitedHistory && (
          <span className="font-[family-name:var(--font-sans)] text-[10px] font-medium uppercase tracking-[0.08em] text-amber-600">
            · limited history
          </span>
        )}

        {/* Tier 2: trust signal */}
        <TrustBadge signal={signal} />

        {/* Tier 3: metadata */}
        <p className="mt-auto pt-1 text-[11px] leading-relaxed text-muted">
          {[
            f.city,
            f.beds != null ? `${f.beds} beds` : null,
            typeLabel,
            careChip,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-clearing-rule pb-3">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-normal text-ink">
        {title}
      </h2>
      <span className="text-sm font-normal tabular-nums text-muted">({count})</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────────────────────

type SortBy = "name" | "record";

const CHIPS: { id: FilterChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "large", label: "50+ beds" },
  { id: "medium", label: "7–49 beds" },
  { id: "no_citations", label: "No citations" },
  { id: "has_citations", label: "Has citations" },
];

export function FacilityListClient({
  facilities,
  stateSlug,
  regionName,
  hiddenSmallCount,
  initialShowSmall = false,
  defaultSortBy = "name",
  resultsOnly = false,
  smallHomesSection = false,
}: {
  facilities: ListFacility[];
  stateSlug: string;
  regionName: string;
  hiddenSmallCount: number;
  /** When all indexed facilities are small-tier, show them by default so the list is not empty. */
  initialShowSmall?: boolean;
  /** Default sort order. Pass "record" to surface fewest-citations-first. */
  defaultSortBy?: SortBy;
  /** Server already chose this page. Render the cards without a second search box. */
  resultsOnly?: boolean;
  /**
   * City hub. Small homes are their own section, after the Washington tier
   * sections and before other licensed facilities. The first 24 show; the
   * rest open in place.
   */
  smallHomesSection?: boolean;
}) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [chip, setChip] = useState<FilterChip>("all");
  const [showSmall, setShowSmall] = useState(initialShowSmall);
  const [expandSmallHomes, setExpandSmallHomes] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>(defaultSortBy);

  // Sync query if the URL param changes (e.g. browser back/forward).
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setQuery(q);
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const base = facilities.filter((f) => {
      // Search
      if (q && !nameMatchesQuery(f, q) && !f.city?.toLowerCase().includes(q)) {
        return false;
      }
      // Browse pages hide small homes until the toggle. The city hub shows
      // them in their own section. Both Washington tier chips stay visible
      // either way, or those sections would be empty on a city with a larger home.
      if (
        !smallHomesSection &&
        f.capacity_tier === "small" &&
        !showSmall &&
        f.careChip !== CONFIRMED_ACCEPTS_CHIP &&
        f.careChip !== DEMENTIA_CREDENTIAL_CHIP
      ) {
        return false;
      }
      // Chip filters
      if (chip === "large") return f.capacity_tier === "large";
      if (chip === "medium") return f.capacity_tier === "medium" || f.capacity_tier === "unknown";
      if (chip === "has_citations") return f.total_citations > 0;
      if (chip === "no_citations") return f.total_citations === 0 && f.inspections > 0;
      if (chip === "small") return f.capacity_tier === "small";
      return true;
    });

    if (sortBy === "record") {
      // Fewest citations first; ties broken by most inspections (more data = more signal),
      // then alphabetically. Facilities with no inspection data sort last.
      return [...base].sort((a, b) => {
        const aNoData = a.inspections === 0;
        const bNoData = b.inspections === 0;
        if (aNoData !== bNoData) return aNoData ? 1 : -1;
        if (a.total_citations !== b.total_citations) return a.total_citations - b.total_citations;
        if (b.inspections !== a.inspections) return b.inspections - a.inspections;
        return formatFacilityName(a.name).localeCompare(formatFacilityName(b.name));
      });
    }
    return base;
  }, [facilities, query, chip, showSmall, smallHomesSection, sortBy]);

  const isFiltered = query.trim() !== "" || chip !== "all";

  // Groups for default sectioned view
  const inMcGroup = (f: ListFacility) =>
    listedInMemoryCareGroup({
      stateSlug,
      careChip: f.careChip,
      servesMemoryCare: f.serves_memory_care,
      memoryCareDisclosureFiled: f.memory_care_disclosure_filed,
      txAlzheimerCertified: f.tx_alzheimer_certified,
      gateTier: f.gateTier,
    });
  const groupOf = (f: ListFacility) =>
    cityHubCardGroup({
      careChip: f.careChip,
      capacityTier: f.capacity_tier,
      inMemoryCareGroup: inMcGroup(f),
    });
  const mcLarge = filtered.filter(
    (f) => groupOf(f) === "memory-care" && f.capacity_tier === "large",
  );
  const mcMedium = filtered.filter(
    (f) =>
      groupOf(f) === "memory-care" &&
      (f.capacity_tier === "medium" || f.capacity_tier === "unknown"),
  );
  const confirmedAccepts = filtered.filter((f) => groupOf(f) === "confirmed-accepts");
  const credentialHomes = filtered.filter((f) => groupOf(f) === "credential");
  const nonMc = filtered.filter((f) => groupOf(f) === "other");
  const smallHomes = filtered.filter((f) => groupOf(f) === "small");
  const visibleSmallHomes =
    smallHomesSection && !expandSmallHomes
      ? smallHomes.slice(0, SMALL_HOMES_PREVIEW_COUNT)
      : smallHomes;
  const smallSection =
    smallHomes.length > 0 && (smallHomesSection || showSmall) ? (
      <section className="mt-12">
        <SectionHead
          title={smallHomesSection ? SMALL_HOMES_SECTION_TITLE : "Residential care homes · ≤6 beds"}
          count={smallHomes.length}
        />
        <p className="mt-1.5 text-xs text-muted">
          {smallHomesSection
            ? SMALL_HOMES_SECTION_DECK
            : "Single-family-home conversions. Owner-operated. Receive fewer routine state inspections by design — inspect the home yourself before committing."}
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSmallHomes.map((f) => (
            <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
          ))}
        </div>
        {smallHomesSection && smallHomes.length > visibleSmallHomes.length && (
          <button
            type="button"
            onClick={() => setExpandSmallHomes(true)}
            className="mt-5 rounded-full border border-clearing-rule-2 bg-clearing-card px-4 py-2 text-sm font-semibold text-teal hover:border-teal/40"
          >
            Show all {smallHomes.length}
          </button>
        )}
      </section>
    ) : null;

  if (resultsOnly) {
    return (
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {facilities.map((f) => (
          <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
        ))}
      </div>
    );
  }

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
            className="w-full rounded-[14px] border border-clearing-rule-2 bg-clearing-card py-2.5 pr-4 pl-9 text-sm text-ink shadow-[var(--shadow-card)] transition placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none"
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
                  ? "bg-teal text-white"
                  : "border border-clearing-rule-2 bg-clearing-card text-ink-3 hover:border-teal/30 hover:text-ink"
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
                  ? "bg-teal text-white"
                  : "border border-clearing-rule-2 bg-clearing-card text-ink-3 hover:border-teal/30 hover:text-ink"
              }`}
            >
              {showSmall ? "Hide" : "Show"} ≤6-bed homes ({hiddenSmallCount})
            </button>
          )}
          {/* Sort toggle */}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
            <span className="hidden sm:inline">Sort:</span>
            <button
              onClick={() => setSortBy("name")}
              className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${
                sortBy === "name"
                  ? "bg-teal text-white"
                  : "bg-transparent text-ink-3 hover:text-ink"
              }`}
            >
              A–Z
            </button>
            <button
              onClick={() => setSortBy("record")}
              className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${
                sortBy === "record"
                  ? "bg-teal text-white"
                  : "bg-transparent text-ink-3 hover:text-ink"
              }`}
              title="Fewest citations first — facilities with the cleanest inspection records at the top"
            >
              By record
            </button>
          </div>
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
              <SectionHead
                title={listSectionTitle(stateSlug, "large")}
                count={mcLarge.length}
              />
              <p className="mt-1.5 text-xs text-muted">
                {listSectionDeck(stateSlug, "large")}
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
              <SectionHead
                title={listSectionTitle(stateSlug, "medium")}
                count={mcMedium.length}
              />
              <p className="mt-1.5 text-xs text-muted">
                {listSectionDeck(stateSlug, "medium")}
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {mcMedium.map((f) => (
                  <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
                ))}
              </div>
            </section>
          )}

          {confirmedAccepts.length > 0 && (
            <section className="mt-12">
              <SectionHead title={CONFIRMED_ACCEPTS_SECTION} count={confirmedAccepts.length} />
              <p className="mt-1.5 text-xs text-muted">
                These homes told StarlynnCare they accept residents with dementia. They do not have a secured or dedicated memory-care unit.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {confirmedAccepts.map((f) => (
                  <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
                ))}
              </div>
            </section>
          )}

          {credentialHomes.length > 0 && (
            <section className="mt-12">
              <SectionHead title={DEMENTIA_CREDENTIAL_SECTION} count={credentialHomes.length} />
              <p className="mt-1.5 text-xs text-muted">
                Staff at these adult family homes completed Washington dementia training. That is a credential, not a confirmation that the home accepts residents with dementia, and it is not a secured unit.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {credentialHomes.map((f) => (
                  <FacilityCard key={f.id} f={f} stateSlug={stateSlug} />
                ))}
              </div>
            </section>
          )}

          {smallHomesSection ? smallSection : null}

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

          {smallHomesSection ? null : smallSection}
        </>
      )}
      <p className="mt-10 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-ink-4">
        Citation counts on these cards are all years on file in the state inspection record.
        Facility profiles show the last 3 years.
      </p>
    </div>
  );
}
